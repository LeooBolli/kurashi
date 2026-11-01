// ============================================================
// Focus: timer di concentrazione. Il tempo si calcola dall'orario di
// inizio (sopravvive a ricaricamenti e schermo bloccato). In modalità
// rigorosa (Store.cfg().focusStrict) cambiare app per più di 10 secondi
// interrompe la sessione; «Blocco lo schermo» rende innocua la prossima
// uscita (entro 60 secondi).
//
// Contratto pubblico (usato anche dalla Home):
//   Focus.init()                 riprende una sessione salvata e ascolta visibilità/uscita
//   Focus.run                    null oppure {startedAt, durationMin, link, lastSeen, ...}
//   Focus.elapsedSec()           secondi trascorsi della sessione in corso (0 se nessuna)
//   Focus.minutes                durata scelta per la prossima sessione (minuti)
//   Focus.start()                avvia una sessione con Focus.minutes e Focus.link
//   Focus.finish(success, reason) chiude la sessione (reason: "giveup" | "left") e la salva
//   Focus.render(el)             disegna la pagina Focus dentro el
// ============================================================
const Focus = {
  KEY: "kurashi-focus-run",
  GRACE_MS: 10000,
  STALE_MS: 20000,

  minutes: 25,
  tab: "over",        // scheda aperta nella pagina di un esame
  refocus: null,      // fase in cui riportare il cursore dopo aver aggiunto un argomento
  link: "",           // "g:<id>" (obiettivo), "m:<id>" (esame) oppure "h:<id>" (abitudine in minuti)
  run: null,          // {startedAt, durationMin, link, lastSeen}
  result: null,       // esito dell'ultima sessione, mostrato finché non ne avvii un'altra
  timer: null,
  wake: null,

  // Se uscire dall'app interrompe la sessione (di default sì; disattivabile dalle impostazioni)
  strict() { return Store.cfg().focusStrict !== false; },

  // Il browser non dice se l'utente ha bloccato lo schermo o cambiato app: per una pagina web
  // sono lo stesso evento. Quindi si dichiara: «Blocco lo schermo» valida la prossima uscita
  // (entro LOCK_WINDOW_MS); ogni altra uscita oltre GRACE_MS interrompe la sessione.
  LOCK_WINDOW_MS: 60000,
  lockOverlay: false,

  init() {
    try { this.run = JSON.parse(localStorage.getItem(this.KEY)); } catch { this.run = null; }
    if (this.run) {
      // Ripresa dopo blocco, cambio app o ricaricamento: si valuta com'è stata l'assenza
      if (this.run.hiddenAt) this.settleAbsence();
      else if (this.strict() && Date.now() - this.run.lastSeen > this.STALE_MS) this.finish(false, "left");
      if (this.run) this.startTicker();
    }
    document.addEventListener("visibilitychange", () => (document.hidden ? this.onHide() : this.settleAbsence()));
    window.addEventListener("pagehide", () => this.onHide());
  },

  onHide() {
    const r = this.run;
    if (!r || r.hiddenAt) return;
    r.hiddenAt = Date.now();
    r.lockAbsence = !!(r.lockIntentAt && Date.now() - r.lockIntentAt < this.LOCK_WINDOW_MS);
    this.save();
  },

  // Al ritorno: assenza da schermo bloccato = nessuna conseguenza; cambio app oltre 10 secondi = sessione interrotta
  settleAbsence() {
    const r = this.run;
    if (!r) return;
    if (r.hiddenAt) {
      const away = Date.now() - r.hiddenAt, locked = r.lockAbsence;
      r.hiddenAt = null; r.lockAbsence = false; r.lockIntentAt = null;
      this.lockOverlay = false;
      this.save();
      if (this.strict() && !locked && away > this.GRACE_MS) return this.finish(false, "left");
      if (this.run) App.render();
    }
    this.requestWake();
    this.tick();
  },

  lockNow() {
    if (!this.run) return;
    this.run.lockIntentAt = Date.now();
    this.lockOverlay = true;
    this.save();
    App.render();
  },
  cancelLock() {
    if (this.run) { this.run.lockIntentAt = null; this.save(); }
    this.lockOverlay = false;
    App.render();
  },

  save() {
    try {
      if (this.run) localStorage.setItem(this.KEY, JSON.stringify(this.run));
      else localStorage.removeItem(this.KEY);
    } catch { /* ignore */ }
  },

  async requestWake() {
    try { if ("wakeLock" in navigator) this.wake = await navigator.wakeLock.request("screen"); } catch { /* non supportato */ }
  },
  releaseWake() { try { if (this.wake) this.wake.release(); } catch { /* ignore */ } this.wake = null; },

  start() {
    this.result = null;
    this.run = { startedAt: Date.now(), durationMin: this.minutes, link: this.link, lastSeen: Date.now() };
    this.save();
    this.startTicker();
    this.requestWake();
    App.render();
  },

  // Sessione non collegata a niente (dai widget della Home)
  startFree(min) { this.minutes = min; this.link = ""; this.start(); },

  startTicker() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  },

  elapsedSec() { return this.run ? (Date.now() - this.run.startedAt) / 1000 : 0; },

  tick() {
    if (!this.run) return;
    const total = this.run.durationMin * 60;
    const el = this.elapsedSec();
    if (el >= total) return this.finish(true);
    this.run.lastSeen = Date.now();
    if (this.lockOverlay && this.run.lockIntentAt && Date.now() - this.run.lockIntentAt >= this.LOCK_WINDOW_MS) {
      this.run.lockIntentAt = null; this.lockOverlay = false; this.save(); App.render();
    }
    this.save();
    this.paint(el / total, total - el);
  },

  paint(p, remaining) {
    const t = document.getElementById("f-time");
    if (!t) return;
    const s = Math.ceil(remaining);
    t.textContent = `${U.pad(Math.floor(s / 60))}:${U.pad(s % 60)}`;
    const arc = document.getElementById("f-arc");
    if (arc) { arc.setAttribute("stroke-dasharray", `${(2 * Math.PI * 46 * p).toFixed(1)} 999`); arc.setAttribute("opacity", p > 0 ? 1 : 0); }
  },

  finish(success, reason = "giveup") {
    const run = this.run;
    if (!run) return;
    clearInterval(this.timer);
    this.releaseWake();
    this.lockOverlay = false;
    this.run = null;
    this.save();
    const elapsed = (Date.now() - run.startedAt) / 1000;
    const [type, id] = (run.link || "").split(":");
    const goalId = type === "g" ? id : null, habitId = type === "h" ? id : null, milestoneId = type === "m" ? id : null;
    const base = { started_at: new Date(run.startedAt).toISOString(), duration_min: run.durationMin, goal_id: goalId, habit_id: habitId, milestone_id: milestoneId, label: null };

    if (success) {
      Store.insert("focus_sessions", { ...base, completed: true });
      const habit = habitId && Store.d.habits.find((h) => h.id === habitId);
      if (habit && habit.kind === "qty" && (habit.unit || "").toLowerCase().startsWith("min")) {
        Store.setLog(habit.id, U.today(), Calc.value(habit, U.today()) + run.durationMin);
      }
      this.result = { ok: true, minutes: run.durationMin };
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    } else if (elapsed >= 15) {
      Store.insert("focus_sessions", { ...base, completed: false });
      this.result = { ok: false, reason, minutes: Math.floor(elapsed / 60) };
    }
    App.render();
  },

  // ---------- esami ----------
  playBtn(m, min) { return `<button class="icon-btn study-go" data-act="study-start" data-id="${U.esc(m.id)}" ${min ? `data-min="${min}"` : ""} aria-label="Inizia a studiare ${U.esc(m.title)}">${Icon.svg("playFill", 18)}</button>`; },
  star(m) { return `<button class="icon-btn study-star ${m.exam_fav ? "on" : ""}" data-act="study-fav" data-id="${U.esc(m.id)}" aria-pressed="${!!m.exam_fav}" aria-label="${m.exam_fav ? "Togli dagli esami in preparazione" : "Metti tra gli esami in preparazione"}: ${U.esc(m.title)}">${Icon.svg("star", 20)}</button>`; },
  whenText(m) {
    const days = m.exam_date ? U.diffDays(U.today(), m.exam_date) : null;
    return !m.exam_date ? "Data da fissare" : days < 0 ? `Appello passato: ${U.fmtShort(m.exam_date)}` : days === 0 ? "Oggi" : `${U.fmtShort(m.exam_date)} · tra ${days} ${days === 1 ? "giorno" : "giorni"}`;
  },
  hoursText(m) { return `${U.fmtMin(Calc.examMin(m))}${Number(m.exam_hours) > 0 ? ` su ${U.num(Number(m.exam_hours))} h` : ""}`; },

  // Oggi: le sessioni pianificate e quanto serve per restare in pari
  todayHTML(running) {
    const today = U.today(), slots = Calc.slotsOn(today), plan = Calc.examPlan(today), due = U.sum(plan.map((x) => x.due));
    const need = plan.length ? `<p class="muted small">${due ? `Per restare in pari: ${U.fmtMin(due)} oggi` : "Sei in pari per oggi"}${plan.length > 1 ? ` su ${plan.length} esami` : ""}.</p>` : "";
    return `<section class="card study-block">
      <div class="block-head"><h2 class="h3">Oggi</h2></div>
      ${slots.length ? `<ul class="study-slots">${slots.map((s) => `<li class="${s.done ? "done" : ""}"><span class="study-time">${U.esc(s.time)}</span><span class="study-t"><b>${U.esc(s.m.title)}</b><small>${s.done ? "Fatta" : U.fmtMin(s.min)}</small></span>${running || s.done ? "" : this.playBtn(s.m, s.min)}</li>`).join("")}</ul>` : `<p class="muted small">Nessuna sessione pianificata oggi.</p>`}
      ${need}
    </section>`;
  },
  favCard(m, running) {
    const hours = Number(m.exam_hours) || 0, pct = Math.round(Calc.msPct(m)), min = Calc.examMin(m);
    return `<li class="study-fav">
      <div class="study-fav-top">${this.star(m)}<button class="study-main" data-act="study-open" data-id="${U.esc(m.id)}"><span class="study-t"><b>${U.esc(m.title)}</b><small>${this.whenText(m)}</small></span></button>${running ? "" : this.playBtn(m)}</div>
      <div class="study-fav-num"><span>${this.hoursText(m)}</span><span>${pct}% argomenti</span></div>
      ${hours ? Charts.bar({ value: (min / (hours * 60)) * 100, color: "var(--blue-500)", h: 5 }) : ""}
    </li>`;
  },
  weekHTML() {
    const mon = U.mondayOf(U.today()), today = U.today();
    const days = U.range(mon, U.addDays(mon, 6)).map((d) => { const s = Calc.slotsOn(d); return { d, s, min: U.sum(s.map((x) => x.min)) }; });
    if (!days.some((x) => x.s.length)) return "";
    return `<section class="card study-block"><div class="block-head"><h2 class="h3">La settimana</h2><span class="muted small">${U.fmtMin(U.sum(days.map((x) => x.min)))} pianificate</span></div>
      <div class="study-week">${days.map((x) => `<div class="${x.d === today ? "today" : ""}"><b>${U.DOW_SHORT[U.dow(x.d) - 1]}</b><span>${x.min ? U.fmtMin(x.min) : "–"}</span></div>`).join("")}</div></section>`;
  },
  // In cima i preferiti, subito visibili; in fondo tutti gli esami, preferiti compresi
  boardHTML(running) {
    const all = Calc.exams(), favs = all.filter((m) => m.exam_fav), past = Calc.examsPassed();
    return `<section class="card study-block"><div class="block-head"><h2 class="h3">In preparazione</h2>${favs.length ? `<span class="muted small">${favs.length}</span>` : ""}</div>
        ${favs.length ? `<ul class="study-favs">${favs.map((m) => this.favCard(m, running)).join("")}</ul>` : `<p class="muted small">Tocca la stella sugli esami che stai preparando: li ritrovi qui.</p>`}
      </section>
      ${favs.length ? this.todayHTML(running) : ""}
      ${this.weekHTML()}
      <section class="card study-block">
        <div class="block-head"><h2 class="h3">Tutti gli esami</h2><span class="muted small">${all.length}</span></div>
        ${all.length ? `<ul class="study-rest">${all.map((m) => `<li>${this.star(m)}<button class="study-main" data-act="study-open" data-id="${U.esc(m.id)}"><span class="study-t"><b>${U.esc(m.title)}</b><small>${this.whenText(m)}${m.goal_id ? "" : " · Esterno"}</small></span>${Icon.svg("right", 16)}</button></li>`).join("")}</ul>` : `<p class="muted small">Nessun esame: aggiungine uno, o trasforma in esame una tappa di un obiettivo.</p>`}
        ${past.length ? `<div class="study-past"><h3>Superati</h3><div class="chips-row">${past.map((m) => `<button class="chip link" data-act="study-open" data-id="${U.esc(m.id)}">${U.esc(m.title)} · ${U.esc(m.exam_grade)}</button>`).join("")}</div></div>` : ""}
      </section>`;
  },

  // ---------- pagina del singolo esame (#/focus/<id>) ----------
  TABS: [["over", "Panoramica"], ["topics", "Argomenti"], ["slots", "Sessioni"]],
  examPage(el, m) {
    // non cancello una riga che stai scrivendo se arriva un aggiornamento di fondo
    const a = document.activeElement;
    if (a && a.matches(".study-page .inline-add input") && a.value) return;
    const pct = Math.round(Calc.msPct(m)), g = Store.d.goals.find((x) => x.id === m.goal_id), running = !!this.run;
    el.innerHTML = `<div class="study-page">
      <button class="btn ghost sm" data-act="go" data-id="focus">${Icon.svg("left", 14)} Studio</button>
      <div class="page-head study-head"><div><p class="eyebrow">${g ? U.esc(g.title) : "Esame esterno"}</p><h1 class="title">${U.esc(m.title)}</h1><p class="sub">${this.whenText(m)}</p></div>${this.star(m)}</div>
      <section class="card study-hero">
        ${Charts.ring({ value: pct / 100, size: 84, stroke: 8, color: "var(--blue-500)", inner: `<b>${pct}%</b>` })}
        <div class="study-t"><b>${this.hoursText(m)}</b><small>studiate</small></div>
        ${running ? "" : `<button class="btn primary" data-act="study-start" data-id="${U.esc(m.id)}">${Icon.svg("play", 16)} Studia ${this.minutes} min</button>`}
      </section>
      <div class="seg tabs4">${this.TABS.map(([k, l]) => `<button class="${this.tab === k ? "on" : ""}" data-act="study-tab" data-id="${k}" aria-pressed="${this.tab === k}">${l}</button>`).join("")}</div>
      <section class="card study-pane">${this[this.tab + "Pane"](m)}</section>
    </div>`;
    if (this.refocus) {
      const i = el.querySelector(`[data-phase="${this.refocus}"] input`);
      this.refocus = null;
      if (i) i.focus({ preventScroll: true });
    }
  },
  overPane(m) {
    return `${Goals.examFormHTML(m)}
      <div class="btn-row">${m.goal_id ? `<button class="btn ghost danger sm" data-act="ms-exam" data-id="${U.esc(m.id)}">Non è più un esame</button>` : `<button class="btn ghost danger sm" data-act="exam-delete" data-id="${U.esc(m.id)}">Elimina l'esame</button>`}</div>`;
  },
  topicsPane(m) { return Calc.EXAM_PHASES.map((p) => Goals.examPhaseHTML(m, p)).join(""); },
  slotsPane(m) {
    const slots = [...(m.exam_slots || [])].sort((a, b) => a.dow - b.dow || a.time.localeCompare(b.time));
    const planned = U.sum(slots.map((s) => s.min)), p = Calc.examPlan().find((x) => x.m.id === m.id);
    const note = !m.exam_fav ? "Le sessioni contano quando l'esame è tra quelli in preparazione: tocca la stella."
      : p ? `Pianificate ${U.fmtMin(planned)} a settimana; per arrivare pronto ne servono circa ${U.fmtMin(p.perDay * 7)}.` : "Con data e ore previste vedi se le sessioni bastano.";
    return `<p class="hint">${note}</p>
      ${slots.length ? `<ul class="study-slots">${slots.map((s) => `<li><span class="study-time">${U.esc(s.time)}</span><span class="study-t"><b>${U.DOW_NAMES[s.dow % 7]}</b><small>${U.fmtMin(s.min)}</small></span><button class="icon-btn sm" data-act="study-slot-del" data-id="${U.esc(m.id)}" data-slot="${U.esc(s.id)}" aria-label="Elimina la sessione di ${U.DOW_NAMES[s.dow % 7]} alle ${U.esc(s.time)}">${Icon.svg("x", 16)}</button></li>`).join("")}</ul>` : ""}
      <form class="form study-slot-form" data-act-submit="study-slot-add" data-id="${U.esc(m.id)}">
        <div class="row2"><label>Giorno<select name="dow">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<option value="${d}">${U.DOW_NAMES[d % 7]}</option>`).join("")}</select></label>
        <label>Ora<input type="time" name="time" value="18:00" required></label></div>
        <label>Minuti<input type="number" name="min" min="5" max="480" step="5" value="60" inputmode="numeric" required></label>
        <button class="btn ghost sm" type="submit">${Icon.svg("plus", 14)} Aggiungi sessione</button>
      </form>`;
  },

  // Esame indipendente: nessun obiettivo, gli argomenti si aggiungono poi nella sua scheda
  async newExam() {
    let form = null;
    const v = await Dialog.open({
      title: "Nuovo esame",
      text: "Per esami e certificazioni fuori dall'università. Quelli di un obiettivo si creano dalle sue tappe.",
      body: `<form class="form dialog-form"><label>Nome<input name="title" autofocus maxlength="120" autocomplete="off"></label>
        <div class="row2"><label>Data<input type="date" name="date"></label><label>Ore previste<input type="number" name="hours" min="0" max="2000" step="0.5" inputmode="decimal"></label></div></form>`,
      actions: `<button type="button" class="btn ghost" data-dialog-cancel>Annulla</button><button type="button" class="btn primary" data-dialog-ok>Crea esame</button>`,
      init: (box) => { form = box.querySelector("form"); },
      onKey: (k) => {
        if (k !== "ok") return null;
        const f = new FormData(form), title = String(f.get("title") || "").trim();
        if (!title) { U.toast("Scrivi il nome dell'esame"); return Dialog.KEEP; }
        return { title, date: f.get("date") || null, hours: f.get("hours") ? Number(f.get("hours")) : null };
      }
    });
    if (v) Store.insert("milestones", { goal_id: null, title: v.title, is_exam: true, exam_date: v.date, exam_hours: v.hours, done: false, done_at: null, position: 0 });
  },

  // ---------- vista ----------
  linkOptions() {
    const goals = Calc.activeGoals();
    const habits = Calc.activeHabits().filter((h) => h.kind === "qty" && (h.unit || "").toLowerCase().startsWith("min"));
    const exams = Calc.exams();
    return `<option value="">Nessun collegamento</option>
      ${goals.length ? `<optgroup label="Obiettivo">${goals.map((g) => `<option value="g:${g.id}" ${this.link === "g:" + g.id ? "selected" : ""}>${U.esc(g.title)}</option>`).join("")}</optgroup>` : ""}
      ${exams.length ? `<optgroup label="Esame">${exams.map((m) => `<option value="m:${m.id}" ${this.link === "m:" + m.id ? "selected" : ""}>${U.esc(m.title)}</option>`).join("")}</optgroup>` : ""}
      ${habits.length ? `<optgroup label="Abitudine (aggiunge i minuti)">${habits.map((h) => `<option value="h:${h.id}" ${this.link === "h:" + h.id ? "selected" : ""}>${U.esc(h.name)}</option>`).join("")}</optgroup>` : ""}`;
  },

  // Nome di ciò a cui è collegata una sessione (obiettivo, esame o abitudine)
  linkName(s) {
    const find = (list, id) => (id && list.find((x) => x.id === id)) || null;
    const g = find(Store.d.goals, s.goal_id), m = find(Store.d.milestones, s.milestone_id), h = find(Store.d.habits, s.habit_id);
    return g ? g.title : m ? m.title : h ? h.name : "";
  },

  resultHTML() {
    const r = this.result;
    if (r.ok) return `<div class="result ok"><b>Sessione completata</b><span>${U.fmtMin(r.minutes)} di concentrazione registrati.</span></div>`;
    return `<div class="result bad"><b>Sessione interrotta</b><span>${r.reason === "left" ? "Sei uscito dall'app per più di 10 secondi." : "Hai interrotto il timer."} La sessione resta nello storico come non completata.</span></div>`;
  },

  render(el) {
    const examId = (location.hash.match(/^#\/focus\/([\w-]+)/) || [])[1];
    const exam = examId && Store.d.milestones.find((x) => x.id === examId && x.is_exam);
    if (exam) return this.examPage(el, exam);
    const today = U.today();
    const cfg = Store.cfg();
    const weekMin = Calc.focusMinutes(U.mondayOf(today), today);
    const todayMin = Calc.focusMinutes(today, today);
    const todaySessions = Store.d.focus_sessions.filter((s) => U.dateOf(s.started_at) === today)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    const doneToday = todaySessions.filter((s) => s.completed).length;
    const running = !!this.run;
    const p = running ? U.clamp(this.elapsedSec() / (this.run.durationMin * 60), 0, 1) : 0;
    const remaining = running ? this.run.durationMin * 60 - this.elapsedSec() : this.minutes * 60;
    const rs = Math.ceil(remaining);
    // Ultimi 7 giorni, per il grafico a colonne accanto al timer
    const week = U.range(U.addDays(today, -6), today).map((d) => {
      const m = Calc.focusMinutes(d, d);
      return { label: U.DOW_SHORT[U.dow(d) - 1], v: m, tip: `${U.fmtShort(d)}: ${U.fmtMin(m)}`, color: d === today ? "var(--orange-500)" : null };
    });
    const goalPct = cfg.focusWeeklyMin ? Math.round((weekMin / cfg.focusWeeklyMin) * 100) : 0;
    const runLink = running ? this.linkName({ goal_id: (this.run.link || "").startsWith("g:") ? this.run.link.slice(2) : null,
      milestone_id: (this.run.link || "").startsWith("m:") ? this.run.link.slice(2) : null,
      habit_id: (this.run.link || "").startsWith("h:") ? this.run.link.slice(2) : null }) : "";

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Studio</p><h1 class="title">Verso gli <em>esami</em></h1></div>
        <button class="btn ghost" data-act="exam-new">${Icon.svg("plus", 16)}<span>Nuovo esame</span></button>
      </div>
      ${running ? "" : this.boardHTML(false)}
      <div class="focus-layout">
        <section class="card timer-card ${running ? "running" : ""}" aria-label="Timer">
          <div class="timer">
            <svg viewBox="0 0 100 100" class="timer-ring" aria-hidden="true">
              <circle cx="50" cy="50" r="46" fill="none" style="stroke:var(--line)" stroke-width="3"/>
              <circle id="f-arc" cx="50" cy="50" r="46" fill="none" style="stroke:var(--orange-500)" stroke-width="3" stroke-linecap="round" transform="rotate(-90 50 50)"
                stroke-dasharray="${(2 * Math.PI * 46 * p).toFixed(1)} 999" opacity="${p > 0 ? 1 : 0}"/>
            </svg>
            <div class="timer-in">
              <div id="f-time" class="timer-time" role="timer" aria-live="off">${U.pad(Math.floor(rs / 60))}:${U.pad(rs % 60)}</div>
              <p class="muted small center">${running ? `${this.run.durationMin} min${runLink ? ` · ${U.esc(runLink)}` : ""}` : `${this.minutes} min`}</p>
            </div>
          </div>

          ${running ? `
            <p class="timer-note">${this.strict()
              ? "Se cambi app hai 10 secondi per tornare, altrimenti la sessione viene interrotta. Per bloccare lo schermo tocca prima il pulsante qui sotto: il timer va avanti."
              : "Puoi cambiare app o bloccare lo schermo: il timer va avanti comunque."}</p>
            <div class="btn-row center-row">
              ${this.strict() ? `<button class="btn primary" data-act="focus-lock">${Icon.svg("lock", 16)} Blocco lo schermo</button>` : ""}
              <button class="btn ghost" data-act="focus-giveup">Interrompi la sessione</button>
            </div>
          ` : `
            ${this.result ? this.resultHTML() : ""}
            <div class="dur" role="group" aria-label="Durata">
              ${[15, 25, 45, 60].map((m) => `<button class="pill ${this.minutes === m ? "on" : ""}" data-act="focus-min" data-id="${m}" aria-pressed="${this.minutes === m}" aria-label="${m} minuti">${m}′</button>`).join("")}
              <span class="dur-step"><button class="round plus sm hit" data-act="focus-step" data-id="-5" aria-label="Meno 5 minuti">${Icon.svg("minus", 14)}</button>
              <button class="round plus sm hit" data-act="focus-step" data-id="5" aria-label="Più 5 minuti">${Icon.svg("plus", 14)}</button></span>
            </div>
            <label class="link-sel">Dedica questa sessione a<select data-act-change="focus-link">${this.linkOptions()}</select></label>
            <button class="btn primary big" data-act="focus-start">${Icon.svg("play", 18)} Avvia la sessione</button>
          `}
        </section>

        <div class="focus-side">
          <section class="card stats-mini">
            <div><b>${U.fmtMin(todayMin)}</b><span>oggi</span></div>
            <div><b>${doneToday}</b><span>${doneToday === 1 ? "sessione completata" : "sessioni completate"}</span></div>
            <div><b>${U.fmtMin(weekMin)}</b><span>questa settimana</span></div>
          </section>
          <section class="card">
            <div class="block-head"><h2 class="h3">Obiettivo della settimana</h2><span class="muted small">${goalPct}%</span></div>
            ${Charts.bar({ value: goalPct, color: "var(--blue-500)", h: 8 })}
            <p class="muted small focus-goal-note">${U.fmtMin(weekMin)} su ${U.fmtMin(cfg.focusWeeklyMin)} · si cambia in <button class="link" data-act="go" data-id="settings">Impostazioni</button></p>
          </section>
          <section class="card">
            <div class="block-head"><h2 class="h3">Ultimi 7 giorni</h2><span class="muted small">minuti al giorno</span></div>
            ${Charts.cols({ data: week, h: 130, aria: `Minuti di focus negli ultimi 7 giorni: ${week.map((w) => `${w.label} ${Math.round(w.v)}`).join(", ")}` })}
          </section>
          <section class="card">
            <div class="block-head"><h2 class="h3">Sessioni di oggi</h2>${todaySessions.length ? `<span class="muted small">${todaySessions.length}</span>` : ""}</div>
            ${todaySessions.length ? `<ul class="linked">${todaySessions.map((s) => {
              const name = this.linkName(s);
              return `<li>${Icon.svg(s.completed ? "check" : "x", 16)}<span>${U.fmtTime(s.started_at)} · ${U.fmtMin(s.duration_min)}${name ? ` · ${U.esc(name)}` : ""}<small class="muted"> · ${s.completed ? "completata" : "interrotta"}</small></span></li>`;
            }).join("")}</ul>` : `<p class="muted small">Ancora nessuna sessione oggi: scegli la durata e avvia.</p>`}
          </section>
        </div>
      </div>
      ${running ? this.boardHTML(true) : ""}
      ${this.lockOverlay && running ? `<div class="lock-overlay" role="dialog" aria-label="Blocco schermo">
        <div class="lock-card">${Icon.svg("lock", 34)}
          <h2>Blocca pure lo schermo</h2>
          <p>Premi il tasto laterale ora. Il timer va avanti e la sessione non viene interrotta. Hai 60 secondi.</p>
          <button class="btn ghost wide" data-act="focus-lock-cancel">Annulla</button>
        </div></div>` : ""}`;
  }
};

Actions["focus-start"] = () => Focus.start();
Actions["exam-new"] = () => Focus.newExam();
Actions["study-open"] = (el) => { Focus.tab = "over"; location.hash = `#/focus/${el.dataset.id}`; };
Actions["study-tab"] = (el) => { Focus.tab = el.dataset.id; App.render(); };
Actions["study-fav"] = (el) => { const m = Store.d.milestones.find((x) => x.id === el.dataset.id); if (m) Store.update("milestones", m.id, { exam_fav: !m.exam_fav }); };
Actions["study-start"] = (el) => {
  if (Focus.run) return;
  Focus.link = "m:" + el.dataset.id;
  if (el.dataset.min) Focus.minutes = Number(el.dataset.min);
  Focus.start();
  App.go("focus");
  window.scrollTo(0, 0);
};
Actions["study-slot-add"] = (form) => {
  const m = Store.d.milestones.find((x) => x.id === form.dataset.id), f = new FormData(form);
  if (!m) return;
  const slot = { id: Math.random().toString(36).slice(2, 10), dow: Number(f.get("dow")), time: f.get("time"), min: Number(f.get("min")) };
  Store.update("milestones", m.id, { exam_slots: [...(m.exam_slots || []), slot] });
};
Actions["study-slot-del"] = (el) => {
  const m = Store.d.milestones.find((x) => x.id === el.dataset.id);
  if (m) Store.update("milestones", m.id, { exam_slots: (m.exam_slots || []).filter((s) => s.id !== el.dataset.slot) });
};
Actions["focus-lock"] = () => Focus.lockNow();
Actions["focus-lock-cancel"] = () => Focus.cancelLock();
Actions["focus-giveup"] = async () => {
  if (await UI.confirm({ title: "Interrompere la sessione?", text: "Resta nello storico come non completata.", confirmLabel: "Interrompi", cancelLabel: "Continua", danger: true })) Focus.finish(false, "giveup");
};
Actions["focus-min"] = (el) => { Focus.minutes = Number(el.dataset.id); App.render(); };
Actions["focus-step"] = (el) => { Focus.minutes = U.clamp(Focus.minutes + Number(el.dataset.id), 5, 180); App.render(); };
Actions["focus-link"] = (el) => { Focus.link = el.value; };
