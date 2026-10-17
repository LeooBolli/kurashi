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

  // ---------- vista ----------
  linkOptions() {
    const goals = Calc.activeGoals();
    const habits = Calc.activeHabits().filter((h) => h.kind === "qty" && (h.unit || "").toLowerCase().startsWith("min"));
    const exams = Store.d.milestones.filter((m) => m.is_exam);
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
        <div><p class="eyebrow">Focus</p><h1 class="title">Tempo di <em>concentrazione</em></h1></div>
      </div>

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
      ${this.lockOverlay && running ? `<div class="lock-overlay" role="dialog" aria-label="Blocco schermo">
        <div class="lock-card">${Icon.svg("lock", 34)}
          <h2>Blocca pure lo schermo</h2>
          <p>Premi il tasto laterale ora. Il timer va avanti e la sessione non viene interrotta. Hai 60 secondi.</p>
          <button class="btn ghost wide" data-act="focus-lock-cancel">Annulla</button>
        </div></div>` : ""}`;
  }
};

Actions["focus-start"] = () => Focus.start();
Actions["focus-lock"] = () => Focus.lockNow();
Actions["focus-lock-cancel"] = () => Focus.cancelLock();
Actions["focus-giveup"] = async () => {
  if (await UI.confirm({ title: "Interrompere la sessione?", text: "Resta nello storico come non completata.", confirmLabel: "Interrompi", cancelLabel: "Continua", danger: true })) Focus.finish(false, "giveup");
};
Actions["focus-min"] = (el) => { Focus.minutes = Number(el.dataset.id); App.render(); };
Actions["focus-step"] = (el) => { Focus.minutes = U.clamp(Focus.minutes + Number(el.dataset.id), 5, 180); App.render(); };
Actions["focus-link"] = (el) => { Focus.link = el.value; };
