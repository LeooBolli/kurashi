// ============================================================
// Calc: tutta la logica dei KPI. Nessun accesso al DOM.
// ============================================================
const Calc = {
  // ---------- Abitudini ----------
  activeHabits() { return Store.d.habits.filter((h) => !h.archived); },

  isDue(h, date) {
    return date >= h.start_date && (h.days || [1, 2, 3, 4, 5, 6, 7]).includes(U.dow(date));
  },
  habitsDueOn(date) { return this.activeHabits().filter((h) => this.isDue(h, date)); },

  value(h, date) { return Store.logIdx.get(`${h.id}|${date}`) || 0; },
  isDone(h, date) { return this.value(h, date) >= (h.kind === "check" ? 1 : Number(h.target)); },

  // Credito 0..1: le abitudini quantitative contano anche per metà
  credit(h, date) {
    const v = this.value(h, date);
    if (h.kind === "check") return v >= 1 ? 1 : 0;
    return U.clamp(v / Number(h.target || 1), 0, 1);
  },

  dayStats(date, habits) {
    const due = (habits || this.habitsDueOn(date)).filter((h) => this.isDue(h, date));
    const credit = U.sum(due.map((h) => this.credit(h, date)));
    return { due: due.length, credit, done: due.filter((h) => this.isDone(h, date)).length, pct: due.length ? credit / due.length : null };
  },

  // Percentuale (0..100) di completamento tra due date, o null se non c'era nulla in programma
  rate(from, to, habits) {
    const list = habits || this.activeHabits();
    let due = 0, credit = 0;
    for (const d of U.range(from, to)) {
      for (const h of list) if (this.isDue(h, d)) { due++; credit += this.credit(h, d); }
    }
    return due ? (credit / due) * 100 : null;
  },

  streak(h) {
    let d = U.today(), n = 0;
    if (this.isDue(h, d) && !this.isDone(h, d)) d = U.addDays(d, -1); // oggi non è ancora perso
    for (let i = 0; i < 1500 && d >= h.start_date; i++, d = U.addDays(d, -1)) {
      if (!this.isDue(h, d)) continue;
      if (this.isDone(h, d)) n++; else break;
    }
    return n;
  },

  bestStreak(h) {
    let best = 0, run = 0;
    for (const d of U.range(h.start_date, U.today())) {
      if (!this.isDue(h, d)) continue;
      if (this.isDone(h, d)) { run++; best = Math.max(best, run); }
      else if (d !== U.today()) run = 0;
    }
    return best;
  },

  bestOverallStreak() {
    return Math.max(0, ...this.activeHabits().map((h) => this.streak(h)));
  },

  // ---------- Obiettivi ----------
  activeGoals() { return Store.d.goals.filter((g) => g.status === "active"); },
  childGoals(g) { return Store.d.goals.filter((x) => x.parent_goal_id === g.id && x.status !== "archived"); },
  // Genitori possibili per un obiettivo: solo orizzonti più lunghi (breve→medio/lungo, medio→lungo), mai sé stesso
  possibleParents(g) {
    const order = ["short", "medium", "long"];
    const i = order.indexOf(g ? g.horizon : "short");
    if (i < 0) return [];
    const longer = order.slice(i + 1);
    return Store.d.goals.filter((x) => longer.includes(x.horizon) && x.status !== "archived" && (!g || x.id !== g.id));
  },
  // Tappe di primo livello di un obiettivo (le sottotappe, o gli argomenti di un esame, stanno dentro la tappa madre)
  milestonesOf(g) { return Store.d.milestones.filter((m) => m.goal_id === g.id && !m.parent_id).sort((a, b) => a.position - b.position); },
  childrenOf(m) { return Store.d.milestones.filter((x) => x.parent_id === m.id).sort((a, b) => a.position - b.position); },
  EXAM_PHASES: ["studio", "ripasso", "preparazione"],
  // Completamento 0..100 di una fase di un esame: argomenti spuntati / totali di quella fase
  examPhasePct(m, phase) {
    const items = this.childrenOf(m).filter((k) => k.phase === phase);
    return items.length ? (items.filter((k) => k.done).length / items.length) * 100 : 0;
  },
  // Completamento 0..100 di una tappa: per un esame è la media delle 3 fasi, altrimenti sottotappe fatte / totali
  msPct(m, asOf = null) {
    if (m.is_exam) return U.avg(this.EXAM_PHASES.map((p) => this.examPhasePct(m, p))) || 0;
    const isDone = (x) => x.done && (!asOf || !x.done_at || U.dateOf(x.done_at) <= asOf);
    const kids = this.childrenOf(m);
    if (kids.length) return (kids.filter(isDone).length / kids.length) * 100;
    return isDone(m) ? 100 : 0;
  },
  habitsOfGoal(g) { return Store.d.habits.filter((h) => h.goal_id === g.id && !h.archived); },

  // ---------- Periodi (obiettivi ricorrenti) ----------
  // Intervallo [inizio, fine] del periodo che contiene "ref" (oggi di default)
  periodRange(period, ref = U.today()) {
    if (period === "week") { const s = U.mondayOf(ref); return [s, U.addDays(s, 6)]; }
    if (period === "year") { const y = ref.slice(0, 4); return [`${y}-01-01`, `${y}-12-31`]; }
    const s = ref.slice(0, 8) + "01";
    return [s, U.addDays(U.addMonths(s, 1), -1)];
  },
  // Il periodo n posizioni prima/dopo quello dato (n negativo = passato)
  shiftPeriod(period, range, n) {
    const step = period === "year" ? 12 : period === "month" ? 1 : null;
    const ref = step ? U.addMonths(range[0], step * n) : U.addDays(range[0], 7 * n);
    return this.periodRange(period, ref);
  },
  // Ultimi n+1 periodi (storico + quello attuale), ognuno con la sua percentuale: per lo streak visivo
  periodHistory(g, n = 8) {
    const cur = this.periodRange(g.period);
    const out = [];
    for (let i = -n; i <= 0; i++) {
      const range = i === 0 ? cur : this.shiftPeriod(g.period, cur, i);
      out.push({ ...range, from: range[0], to: range[1], pct: this.goalProgressParts(g, range[0], range[1], range[1]), current: i === 0 });
    }
    return out;
  },

  // Avanzamento 0..100 "a una certa data" (serve anche per confrontare le settimane)
  goalProgress(g, asOf = U.today()) {
    if (g.horizon === "recurring") {
      const [from, to] = this.periodRange(g.period, asOf);
      return this.goalProgressParts(g, from, to, asOf);
    }
    if (g.status === "done" && (!g.done_at || U.dateOf(g.done_at) <= asOf)) return 100;
    return this.goalProgressParts(g, g.start_date, g.due_date, asOf);
  },

  // Le stesse fonti di avanzamento (tappe, abitudini, libri, obiettivi figli, peso), su un intervallo dato:
  // così i normali obiettivi (intero periodo) e quelli ricorrenti (periodo corrente) condividono la logica.
  goalProgressParts(g, from, to, asOf) {
    const parts = [];
    const ms = this.milestonesOf(g);
    if (ms.length) parts.push(U.avg(ms.map((m) => this.msPct(m, asOf))));
    const hs = this.habitsOfGoal(g);
    if (hs.length) {
      // giorni completati / giorni previsti nell'intervallo
      let planned = 0, credit = 0;
      for (const d of U.range(from, to)) {
        for (const h of hs) {
          if (!this.isDue(h, d)) continue;
          planned++;
          if (d <= asOf) credit += this.credit(h, d);
        }
      }
      if (planned) parts.push((credit / planned) * 100);
    }
    const bk = this.goalBooks(g, asOf, from, to);
    if (bk) parts.push(bk.pct);
    const wt = this.weightProgress(g, asOf, from);
    if (wt != null) parts.push(wt);
    const kids = this.childGoals(g);
    if (kids.length) parts.push(U.avg(kids.map((k) => this.goalProgress(k, asOf))));
    if (!parts.length) return Number(g.manual_progress) || 0;
    return U.clamp(U.avg(parts), 0, 100);
  },

  // Obiettivo collegato alla Lettura ("leggi N libri"): conta i libri finiti nell'intervallo.
  // Il collegamento vive nelle impostazioni ({ idObiettivo: N }), quindi non serve altro nel database.
  booksTarget(g) { const n = Number((Store.cfg().goalBooks || {})[g.id]); return n > 0 ? n : 0; },
  goalBooks(g, asOf = U.today(), from = g.start_date, to = g.due_date) {
    const target = this.booksTarget(g);
    if (!target) return null;
    const end = asOf < to ? asOf : to;
    const done = Store.d.reading_items
      .filter((r) => r.kind === "book" && r.status === "done" && r.done_at && U.dateOf(r.done_at) >= from && U.dateOf(r.done_at) <= end)
      .sort((a, b) => b.done_at.localeCompare(a.done_at));
    return { target, done, count: done.length, pct: Math.min(100, (done.length / target) * 100) };
  },

  // Obiettivo di peso: quanto ti sei avvicinato al peso target rispetto al peso di partenza
  // (l'ultima pesata registrata prima dell'inizio dell'intervallo, o la prima disponibile).
  // Funziona sia per dimagrire sia per aumentare di peso: conta la distanza percorsa, in qualunque direzione.
  weightProgress(g, asOf = U.today(), from = g.start_date) {
    if (g.weight_target == null) return null;
    const logs = [...Store.d.weight_logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    if (!logs.length) return null;
    const before = [...logs].filter((w) => w.log_date <= from).pop();
    const start = before ? Number(before.kg) : Number(logs[0].kg);
    const at = [...logs].filter((w) => w.log_date <= asOf).pop();
    const current = at ? Number(at.kg) : start;
    const target = Number(g.weight_target);
    if (start === target) return current === target ? 100 : 0;
    return U.clamp(((start - current) / (start - target)) * 100, 0, 100);
  },

  // Quanto dovremmo essere avanti in base al tempo trascorso (nel periodo, per i ricorrenti)
  goalExpected(g, asOf = U.today()) {
    const [from, to] = g.horizon === "recurring" ? this.periodRange(g.period, asOf) : [g.start_date, g.due_date];
    const total = Math.max(1, U.diffDays(from, to));
    return U.clamp((U.diffDays(from, asOf) / total) * 100, 0, 100);
  },

  goalPace(g, asOf = U.today()) {
    const p = this.goalProgress(g, asOf), e = this.goalExpected(g, asOf);
    if (g.status === "done") return { key: "done", label: "Completato", progress: 100, expected: e };
    let key = "on", label = "In linea";
    if (p >= e + 10) { key = "ahead"; label = "Avanti"; }
    else if (p < e - 20) { key = "behind"; label = "Indietro"; }
    else if (p < e - 5) { key = "slight"; label = "Da recuperare"; }
    return { key, label, progress: p, expected: e };
  },

  daysLeft(g) {
    if (g.horizon === "recurring") return U.diffDays(U.today(), this.periodRange(g.period)[1]);
    return U.diffDays(U.today(), g.due_date);
  },

  // ---------- Focus ----------
  focusDone() { return Store.d.focus_sessions.filter((s) => s.completed); },
  focusMinutes(from, to) {
    return U.sum(this.focusDone().filter((s) => { const d = U.dateOf(s.started_at); return d >= from && d <= to; }).map((s) => s.duration_min));
  },
  // Sessioni consecutive sigillate senza uscire (dalla più recente all'indietro)
  focusChain() {
    const all = [...Store.d.focus_sessions].sort((a, b) => b.started_at.localeCompare(a.started_at));
    let n = 0;
    for (const s of all) { if (s.completed) n++; else break; }
    return n;
  },
  // Bonus a catena: +20% per ogni yokai sigillato di fila, fino a x2
  comboFor(minutes, chain) {
    const mult = 1 + 0.2 * Math.min(chain, 5);
    return { mult, xp: Math.round(minutes * mult), ryo: Math.max(1, Math.round((minutes / 5) * mult)) };
  },

  // ---------- Benessere ----------
  moodByDay(from, to, field) {
    const map = {};
    for (const m of Store.d.mood_logs) {
      if (m[field] == null) continue;
      const d = U.dateOf(m.logged_at);
      if (d < from || d > to) continue;
      (map[d] = map[d] || []).push(m[field]);
    }
    return map;
  },
  moodAvg(from, to, field) {
    const map = this.moodByDay(from, to, field);
    return U.avg(Object.values(map).flat());
  },
  sleepAvg(from, to) {
    return U.avg(Store.d.sleep_logs.filter((s) => s.sleep_date >= from && s.sleep_date <= to).map((s) => Number(s.hours)));
  },
  workoutsIn(from, to) { return Store.d.workouts.filter((w) => w.workout_date >= from && w.workout_date <= to); },
  latestWeight() {
    const w = [...Store.d.weight_logs].sort((a, b) => b.log_date.localeCompare(a.log_date));
    return w[0] || null;
  },

  // ---------- Punteggio generale (0..100), su 7 giorni che finiscono a `end` ----------
  score(end = U.today()) {
    const from = U.addDays(end, -6);
    const cfg = Store.cfg();
    const parts = [];

    const habits = this.rate(from, end);
    if (habits != null) parts.push({ key: "habits", label: "Abitudini", value: habits, w: 0.35 });

    const goals = this.activeGoals().filter((g) => g.start_date <= end);
    if (goals.length) {
      const v = U.avg(goals.map((g) => {
        const e = this.goalExpected(g, end), p = this.goalProgress(g, end);
        return e < 3 ? 100 : U.clamp((p / e) * 100, 0, 100);
      }));
      parts.push({ key: "goals", label: "Obiettivi", value: v, w: 0.25 });
    }

    const focusMin = this.focusMinutes(from, end);
    if (Store.d.focus_sessions.length) {
      parts.push({ key: "focus", label: "Focus", value: U.clamp((focusMin / cfg.focusWeeklyMin) * 100, 0, 100), w: 0.15 });
    }

    const well = [];
    const mood = this.moodAvg(from, end, "mood"), energy = this.moodAvg(from, end, "energy"), sleep = this.sleepAvg(from, end);
    if (mood != null) well.push(((mood - 1) / 4) * 100);
    if (energy != null) well.push(((energy - 1) / 4) * 100);
    if (sleep != null) well.push(U.clamp((sleep / cfg.sleepTarget) * 100, 0, 100));
    if (well.length) parts.push({ key: "well", label: "Benessere", value: U.avg(well), w: 0.25 });

    const totalW = U.sum(parts.map((p) => p.w));
    const score = totalW ? U.sum(parts.map((p) => p.value * p.w)) / totalW : null;
    return { score, parts, mood, energy, sleep, focusMin, habits };
  },

  scoreLabel(s) {
    if (s == null) return { label: "Nessun dato", tone: "neutral" };
    if (s >= 75) return { label: "Ottimo ritmo", tone: "good" };
    if (s >= 50) return { label: "Buon ritmo", tone: "ok" };
    return { label: "Da riprendere", tone: "low" };
  }
};
