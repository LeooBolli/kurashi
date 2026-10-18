// ============================================================
// Calc: tutta la logica dei KPI. Nessun accesso al DOM.
// ============================================================
const Calc = {
  // ---------- Abitudini ----------
  activeHabits() { return Store.d.habits.filter((h) => !h.archived); },

  // ---------- Ricorrenze ----------
  // h.repeat (facoltativo):
  //   {type:"week", every:N, from}     ogni N settimane, nei giorni di h.days (senza repeat: ogni settimana)
  //   {type:"monthdays", days:[1,15,-1]} giorni del mese (-1 = l'ultimo; il 31 nei mesi corti diventa l'ultimo)
  //   {type:"nth", nths:[1,3,-1], dow}  il primo/terzo/ultimo lunedì… del mese
  //   {type:"interval", every:N, from} ogni N giorni a partire da "from"
  //   {type:"times", count:N, per:"week"|"month"} N volte nella settimana/nel mese, quando vuoi
  // Le abitudini settimanali semplici valgono solo nel loro giorno; tutte le altre restano
  // in lista finché non le fai, fino alla prossima occorrenza (la loro "finestra").
  rep(h) { return h.repeat && h.repeat.type ? h.repeat : { type: "week", every: 1 }; },
  carries(h) { const r = this.rep(h); return !(r.type === "week" && (Number(r.every) || 1) === 1); },
  monthLen(d) { return new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0).getDate(); },

  occursOn(h, d) {
    if (d < h.start_date) return false;
    const r = this.rep(h), dow = U.dow(d), day = Number(d.slice(8, 10));
    const every = Math.max(1, Math.round(Number(r.every)) || 1);
    switch (r.type) {
      case "week":
        if (!(h.days || [1, 2, 3, 4, 5, 6, 7]).includes(dow)) return false;
        return every === 1 || Math.abs(U.diffDays(U.mondayOf(r.from || h.start_date), U.mondayOf(d)) / 7) % every === 0;
      case "monthdays": {
        const last = this.monthLen(d);
        return (r.days || []).some((x) => (Number(x) === -1 ? last : Math.min(Number(x), last)) === day);
      }
      case "nth": {
        if (dow !== Number(r.dow)) return false;
        const isLast = day + 7 > this.monthLen(d);
        return (r.nths || []).some((n) => (Number(n) === -1 ? isLast : Number(n) === Math.ceil(day / 7)));
      }
      case "interval": return Math.abs(U.diffDays(r.from || h.start_date, d)) % every === 0;
      default: return false;
    }
  },

  // Finestra dell'occorrenza che contiene d: { start, end, need }, oppure null (prima della prima occorrenza)
  _win: new Map(),
  window(h, d) {
    if (d < h.start_date) return null;
    const sig = `${h.id}|${h.start_date}|${(h.days || []).join()}|${JSON.stringify(h.repeat || null)}|${d}`;
    if (this._win.has(sig)) return this._win.get(sig);
    if (this._win.size > 20000) this._win.clear();
    const w = this._windowCalc(h, d);
    this._win.set(sig, w);
    return w;
  },
  _windowCalc(h, d) {
    const r = this.rep(h);
    if (r.type === "times") {
      const month = r.per === "month";
      const start = month ? d.slice(0, 8) + "01" : U.mondayOf(d);
      const end = month ? d.slice(0, 8) + U.pad(this.monthLen(d)) : U.addDays(start, 6);
      return { start: start < h.start_date ? h.start_date : start, end, need: Math.max(1, Math.round(Number(r.count)) || 1) };
    }
    if (!this.carries(h)) return this.occursOn(h, d) ? { start: d, end: d, need: 1 } : null;
    let start = d;
    for (let i = 0; !this.occursOn(h, start); i++) {
      if (start <= h.start_date || i > 800) return null;
      start = U.addDays(start, -1);
    }
    let next = U.addDays(d, 1);
    for (let i = 0; i < 800 && !this.occursOn(h, next); i++) next = U.addDays(next, 1);
    return { start, end: U.addDays(next, -1), need: 1 };
  },

  // Giorni completati tra from e to (compresi)
  doneIn(h, from, to) {
    let n = 0;
    for (let d = from; d <= to; d = U.addDays(d, 1)) if (this.isDone(h, d)) n++;
    return n;
  },

  // In lista quel giorno: nella finestra di un'occorrenza non ancora fatta (o fatta proprio quel giorno)
  isDue(h, date) {
    const w = this.window(h, date);
    if (!w) return false;
    return w.start === date || this.isDone(h, date) || this.doneIn(h, w.start, U.addDays(date, -1)) < w.need;
  },
  habitsDueOn(date) { return this.activeHabits().filter((h) => this.isDue(h, date)); },

  // Data da cui una ricorrente è in sospeso (non fatta), o null
  pendingSince(h, date = U.today()) {
    if (!this.carries(h) || this.rep(h).type === "times" || !this.isDue(h, date) || this.isDone(h, date)) return null;
    const w = this.window(h, date);
    return w && w.start < date ? w.start : null;
  },
  // Per le "N volte": quante fatte nel periodo corrente e quante ne servono
  periodCount(h, date = U.today()) {
    if (this.rep(h).type !== "times") return null;
    const w = this.window(h, date);
    return w ? { done: this.doneIn(h, w.start, date), need: w.need } : null;
  },

  // Peso di un giorno nelle statistiche: { due, credit }. Una ricorrente conta una volta per occorrenza:
  // il giorno in cui la fai, oppure l'ultimo giorno della finestra se non la fai; oggi conta se è ancora da fare.
  slot(h, d, today = U.today()) {
    const none = { due: 0, credit: 0 };
    const w = this.window(h, d);
    if (!w) return none;
    if (!this.carries(h)) return { due: 1, credit: this.credit(h, d) };
    const left = w.need - this.doneIn(h, w.start, U.addDays(d, -1));
    if (left <= 0) return none;
    const done = this.isDone(h, d);
    if (d === w.end) return { due: left, credit: done ? 1 : this.credit(h, d) };
    if (done) return { due: 1, credit: 1 };
    if (d === today) return { due: 1, credit: this.credit(h, d) };
    return none;
  },

  value(h, date) { return Store.logIdx.get(`${h.id}|${date}`) || 0; },
  isDone(h, date) { return this.value(h, date) >= (h.kind === "check" ? 1 : Number(h.target)); },

  // Credito 0..1: le abitudini quantitative contano anche per metà
  credit(h, date) {
    const v = this.value(h, date);
    if (h.kind === "check") return v >= 1 ? 1 : 0;
    return U.clamp(v / Number(h.target || 1), 0, 1);
  },

  dayStats(date, habits) {
    let due = 0, credit = 0, done = 0;
    for (const h of habits || this.activeHabits()) {
      const s = this.slot(h, date);
      if (!s.due) continue;
      due += s.due; credit += s.credit;
      if (this.isDone(h, date)) done++;
    }
    return { due, credit, done, pct: due ? credit / due : null };
  },

  // Percentuale (0..100) di completamento tra due date, o null se non c'era nulla in programma
  rate(from, to, habits) {
    const list = habits || this.activeHabits();
    let due = 0, credit = 0;
    for (const d of U.range(from, to)) {
      for (const h of list) { const s = this.slot(h, d); due += s.due; credit += s.credit; }
    }
    return due ? (credit / due) * 100 : null;
  },

  // Per le ricorrenti la serie conta le occorrenze fatte di fila (la finestra in corso non la interrompe)
  streak(h) {
    if (this.carries(h)) {
      const today = U.today();
      let n = 0, d = today, cur = true;
      for (let i = 0; i < 1500 && d >= h.start_date; i++) {
        const w = this.window(h, d);
        if (!w) break;
        const c = this.doneIn(h, w.start, cur ? today : w.end);
        if (c >= w.need) n += w.need;
        else if (cur) n += c;
        else break;
        cur = false;
        d = U.addDays(w.start, -1);
      }
      return n;
    }
    let d = U.today(), n = 0;
    if (this.isDue(h, d) && !this.isDone(h, d)) d = U.addDays(d, -1); // oggi non è ancora perso
    for (let i = 0; i < 1500 && d >= h.start_date; i++, d = U.addDays(d, -1)) {
      if (!this.isDue(h, d)) continue;
      if (this.isDone(h, d)) n++; else break;
    }
    return n;
  },

  bestStreak(h) {
    if (this.carries(h)) {
      const today = U.today();
      let best = 0, run = 0, d = h.start_date;
      for (let i = 0; i < 3000 && d <= today; i++) {
        const w = this.window(h, d);
        if (!w) { d = U.addDays(d, 1); continue; }
        const c = this.doneIn(h, w.start, w.end < today ? w.end : today);
        if (c >= w.need) run += w.need;
        else if (w.end >= today) run += c;
        else run = 0;
        best = Math.max(best, run);
        d = U.addDays(w.end, 1);
      }
      return best;
    }
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
  childGoals(g) { return Store.d.goals.filter((x) => x.parent_goal_id === g.id && x.id !== g.id && x.status !== "archived"); },
  // Tutti i discendenti (figli, nipoti…) di un obiettivo, come Set di id. Il "visto" ferma
  // eventuali cicli già presenti nei dati (A figlio di B e B figlio di A).
  descendantIds(g) {
    const out = new Set();
    if (!g || !g.id) return out;
    const stack = [g.id];
    while (stack.length) {
      const id = stack.pop();
      for (const x of Store.d.goals) {
        if (x.parent_goal_id === id && x.id !== g.id && !out.has(x.id)) { out.add(x.id); stack.push(x.id); }
      }
    }
    return out;
  },
  // Genitori possibili per un obiettivo: solo orizzonti più lunghi (breve→medio/lungo, medio→lungo),
  // mai sé stesso né un suo discendente (eviterebbe un ciclo)
  possibleParents(g) {
    const order = ["short", "medium", "long"];
    const i = order.indexOf(g ? g.horizon : "short");
    if (i < 0) return [];
    const longer = order.slice(i + 1);
    const banned = this.descendantIds(g);
    if (g && g.id) banned.add(g.id);
    return Store.d.goals.filter((x) => longer.includes(x.horizon) && x.status !== "archived" && !banned.has(x.id));
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
  // "seen" = obiettivi già sul percorso di calcolo: un ciclo nei dati non può ricorrere all'infinito
  goalProgress(g, asOf = U.today(), seen = new Set()) {
    if (g.horizon === "recurring") {
      const [from, to] = this.periodRange(g.period, asOf);
      return this.goalProgressParts(g, from, to, asOf, seen);
    }
    if (g.status === "done" && (!g.done_at || U.dateOf(g.done_at) <= asOf)) return 100;
    return this.goalProgressParts(g, g.start_date, g.due_date, asOf, seen);
  },

  // Le stesse fonti di avanzamento (tappe, abitudini, libri, obiettivi figli, peso), su un intervallo dato:
  // (gli obiettivi figli non contano per un obiettivo di peso, vedi sotto)
  // così i normali obiettivi (intero periodo) e quelli ricorrenti (periodo corrente) condividono la logica.
  goalProgressParts(g, from, to, asOf, seen = new Set()) {
    const path = new Set(seen);
    path.add(g.id);
    const parts = [];
    const ms = this.milestonesOf(g);
    if (ms.length) parts.push(U.avg(ms.map((m) => this.msPct(m, asOf))));
    const hs = this.habitsOfGoal(g);
    if (hs.length) {
      // giorni completati / giorni previsti nell'intervallo
      let planned = 0, credit = 0;
      for (const d of U.range(from, to)) {
        for (const h of hs) {
          const s = this.slot(h, d);
          planned += s.due;
          if (d <= asOf) credit += s.credit;
        }
      }
      if (planned) parts.push((credit / planned) * 100);
    }
    const bk = this.goalBooks(g, asOf, from, to);
    if (bk) parts.push(bk.pct);
    const wt = this.weightProgress(g, asOf, from);
    if (wt != null) parts.push(wt);
    // Un obiettivo di peso resta misurato solo sul peso: i figli (es. la dieta) si vedono ma non entrano nella media
    const kids = g.weight_linked ? [] : this.childGoals(g).filter((k) => !path.has(k.id));
    if (kids.length) parts.push(U.avg(kids.map((k) => this.goalProgress(k, asOf, path))));
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

  // Obiettivo di peso: quanto ti sei avvicinato al peso ideale (impostato in Impostazioni,
  // un'unica fonte di verità) rispetto al peso di partenza (l'ultima pesata registrata prima
  // dell'inizio dell'intervallo, o la prima disponibile).
  // Funziona sia per dimagrire sia per aumentare di peso: conta la distanza percorsa, in qualunque direzione.
  weightProgress(g, asOf = U.today(), from = g.start_date) {
    if (!g.weight_linked || Store.cfg().weightTarget == null) return null;
    const logs = [...Store.d.weight_logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    if (!logs.length) return null;
    const before = [...logs].filter((w) => w.log_date <= from).pop();
    const start = before ? Number(before.kg) : Number(logs[0].kg);
    const at = [...logs].filter((w) => w.log_date <= asOf).pop();
    const current = at ? Number(at.kg) : start;
    const target = Number(Store.cfg().weightTarget);
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
    else if (p < e - 5) { key = "slight"; label = "In ritardo"; }
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
