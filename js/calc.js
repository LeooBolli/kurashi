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
  milestonesOf(g) { return Store.d.milestones.filter((m) => m.goal_id === g.id).sort((a, b) => a.position - b.position); },
  habitsOfGoal(g) { return Store.d.habits.filter((h) => h.goal_id === g.id && !h.archived); },

  // Avanzamento 0..100 "a una certa data" (serve anche per confrontare le settimane)
  goalProgress(g, asOf = U.today()) {
    if (g.status === "done" && (!g.done_at || U.dateOf(g.done_at) <= asOf)) return 100;
    const parts = [];
    const ms = this.milestonesOf(g);
    if (ms.length) {
      const done = ms.filter((m) => m.done && (!m.done_at || U.dateOf(m.done_at) <= asOf)).length;
      parts.push((done / ms.length) * 100);
    }
    const hs = this.habitsOfGoal(g);
    if (hs.length) {
      // giorni completati / giorni previsti nell'intero periodo dell'obiettivo
      let planned = 0, credit = 0;
      const end = g.due_date;
      for (const d of U.range(g.start_date, end)) {
        for (const h of hs) {
          if (!this.isDue(h, d)) continue;
          planned++;
          if (d <= asOf) credit += this.credit(h, d);
        }
      }
      if (planned) parts.push((credit / planned) * 100);
    }
    if (!parts.length) return Number(g.manual_progress) || 0;
    return U.clamp(U.avg(parts), 0, 100);
  },

  // Quanto dovremmo essere avanti in base al tempo trascorso
  goalExpected(g, asOf = U.today()) {
    const total = Math.max(1, U.diffDays(g.start_date, g.due_date));
    return U.clamp((U.diffDays(g.start_date, asOf) / total) * 100, 0, 100);
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

  daysLeft(g) { return U.diffDays(U.today(), g.due_date); },

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
