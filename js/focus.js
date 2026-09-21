// ============================================================
// Focus: caccia allo yokai. Mentre resti concentrato lo yokai si
// indebolisce; a fine timer viene sigillato (XP + ryo). Se esci
// dall'app per più di 10 secondi scappa e ti colpisce (-HP).
// Più yokai sigillati di fila = bonus a catena (fino a ×2).
// ============================================================
const Focus = {
  KEY: "kurashi-focus-run",
  GRACE_MS: 10000,
  STALE_MS: 20000,

  minutes: 25,
  kind: "hitodama",
  link: "",           // "g:<id>" (obiettivo) oppure "h:<id>" (abitudine in minuti)
  run: null,          // {startedAt, durationMin, kind, link, lastSeen}
  result: null,       // esito dell'ultima sfida, mostrato finché non ne avvii un'altra
  timer: null,
  hiddenAt: null,
  wake: null,
  lastStage: -1,

  init() {
    try { this.run = JSON.parse(localStorage.getItem(this.KEY)); } catch { this.run = null; }
    if (this.run) {
      // Ripresa dopo un ricaricamento: se l'app è rimasta chiusa troppo a lungo, lo yokai è scappato
      if (Date.now() - this.run.lastSeen > this.STALE_MS) this.finish(false);
      else this.startTicker();
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.run) return;
      if (document.hidden) this.hiddenAt = Date.now();
      else {
        if (this.hiddenAt && Date.now() - this.hiddenAt > this.GRACE_MS) this.finish(false);
        this.hiddenAt = null;
        if (this.run) this.requestWake();
      }
    });
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
    this.run = { startedAt: Date.now(), durationMin: this.minutes, kind: this.kind, link: this.link, lastSeen: Date.now() };
    this.save();
    this.lastStage = -1;
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
    const stage = Math.round(p * 24);
    if (stage !== this.lastStage) {
      this.lastStage = stage;
      const y = document.getElementById("f-yokai");
      if (y) y.innerHTML = Yokai.svg(this.run.kind, p, "idle", 130);
    }
  },

  finish(success) {
    const run = this.run;
    if (!run) return;
    clearInterval(this.timer);
    this.releaseWake();
    this.run = null;
    this.save();
    const elapsed = (Date.now() - run.startedAt) / 1000;
    const [type, id] = (run.link || "").split(":");
    const goalId = type === "g" ? id : null, habitId = type === "h" ? id : null;
    const base = { started_at: new Date(run.startedAt).toISOString(), duration_min: run.durationMin, creature: run.kind, goal_id: goalId, habit_id: habitId, label: null };

    if (success) {
      const chain = Calc.focusChain();
      const c = Calc.comboFor(run.durationMin, chain);
      // A terra (0 HP) si guadagna la metà dei ryo
      const tired = Game.totals().hp === 0;
      const ryo = tired ? Math.max(1, Math.round(c.ryo / 2)) : c.ryo;
      Store.insert("focus_sessions", { ...base, completed: true, xp: c.xp, ryo });
      const habit = habitId && Store.d.habits.find((h) => h.id === habitId);
      if (habit && habit.kind === "qty" && (habit.unit || "").toLowerCase().startsWith("min")) {
        Store.setLog(habit.id, U.today(), Calc.value(habit, U.today()) + run.durationMin);
      }
      this.result = { ok: true, xp: c.xp, ryo, mult: c.mult, chain: chain + 1, tired, kind: run.kind };
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    } else if (elapsed >= 15) {
      Store.insert("focus_sessions", { ...base, completed: false, xp: 0, ryo: 0 });
      this.result = { ok: false, dmg: Game.CFG.dmgFail, kind: run.kind, fresh: true };
    }
    App.render();
  },

  // ---------- vista ----------
  linkOptions() {
    const goals = Calc.activeGoals();
    const habits = Calc.activeHabits().filter((h) => h.kind === "qty" && (h.unit || "").toLowerCase().startsWith("min"));
    return `<option value="">Nessun collegamento</option>
      ${goals.length ? `<optgroup label="Obiettivo">${goals.map((g) => `<option value="g:${g.id}" ${this.link === "g:" + g.id ? "selected" : ""}>${U.esc(g.title)}</option>`).join("")}</optgroup>` : ""}
      ${habits.length ? `<optgroup label="Abitudine (aggiunge i minuti)">${habits.map((h) => `<option value="h:${h.id}" ${this.link === "h:" + h.id ? "selected" : ""}>${U.esc(h.name)}</option>`).join("")}</optgroup>` : ""}`;
  },

  resultHTML() {
    const r = this.result;
    if (r.ok) return `<div class="result ok"><b>Yokai sigillato!</b><span>+${r.xp} XP · +${r.ryo} 両${r.mult > 1 ? ` · bonus ×${r.mult.toFixed(1)}` : ""} · ${r.chain} di fila${r.tired ? " · ryo dimezzati: eri a terra" : ""}</span></div>`;
    return `<div class="result bad"><b>Lo yokai è scappato!</b><span>Sei uscito dall'app e ti ha colpito: −${r.dmg} HP. La serie riparte da zero.</span></div>`;
  },

  render(el) {
    const today = U.today();
    const cfg = Store.cfg();
    const t = Game.totals();
    const chain = Calc.focusChain();
    const next = Calc.comboFor(this.minutes, chain);
    const unlocked = Game.unlockedYokai(t.level);
    if (!unlocked.includes(this.kind)) this.kind = "hitodama";
    const weekMin = Calc.focusMinutes(U.mondayOf(today), today);
    const todayMin = Calc.focusMinutes(today, today);
    const running = !!this.run;
    const p = running ? U.clamp(this.elapsedSec() / (this.run.durationMin * 60), 0, 1) : 0;
    const remaining = running ? this.run.durationMin * 60 - this.elapsedSec() : this.minutes * 60;
    const rs = Math.ceil(remaining);
    const hit = !!(this.result && this.result.fresh);
    if (this.result) this.result.fresh = false;
    const recent = [...Store.d.focus_sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 35);

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">集中 · Focus</p><h1 class="title">Caccia allo <em>yokai</em></h1></div>
        <div class="seeds" data-act="go" data-id="hero" role="button" data-tip="Apri il Dojo">Lv ${t.level} · <b>${t.ryo}</b> 両</div>
      </div>

      <div class="focus-layout">
        <section class="card timer-card ${running ? "running" : ""} ${hit ? "hit" : ""}">
          <div class="timer">
            <svg viewBox="0 0 100 100" class="timer-ring" aria-hidden="true">
              <circle cx="50" cy="50" r="46" fill="none" style="stroke:var(--line)" stroke-width="3"/>
              <circle id="f-arc" cx="50" cy="50" r="46" fill="none" style="stroke:var(--orange-500)" stroke-width="3" stroke-linecap="round" transform="rotate(-90 50 50)"
                stroke-dasharray="${(2 * Math.PI * 46 * p).toFixed(1)} 999" opacity="${p > 0 ? 1 : 0}"/>
            </svg>
            <div class="timer-in">
              <div id="f-yokai" class="timer-yokai ${running ? "wobble" : ""}">${Yokai.svg(running ? this.run.kind : this.kind, p, "idle", 130)}</div>
              <div id="f-time" class="timer-time">${U.pad(Math.floor(rs / 60))}:${U.pad(rs % 60)}</div>
            </div>
          </div>

          ${running ? `
            <p class="timer-note">Resta su questa schermata: lo yokai si indebolisce. Se esci per più di 10 secondi scappa e ti colpisce.</p>
            <button class="btn ghost" data-act="focus-giveup">Rinuncia</button>
          ` : `
            ${this.result ? this.resultHTML() : ""}
            <div class="dur">
              ${[15, 25, 45, 60].map((m) => `<button class="pill ${this.minutes === m ? "on" : ""}" data-act="focus-min" data-id="${m}">${m}′</button>`).join("")}
              <span class="dur-step"><button class="round plus sm" data-act="focus-step" data-id="-5" aria-label="Meno 5 minuti">${Icon.svg("minus", 14)}</button>
              <button class="round plus sm" data-act="focus-step" data-id="5" aria-label="Più 5 minuti">${Icon.svg("plus", 14)}</button></span>
            </div>
            <div class="trees-pick">${Object.entries(Game.YOKAI).map(([k, y]) => {
              const ok = t.level >= y.lvl;
              return `<button class="tree-opt ${this.kind === k ? "on" : ""} ${ok ? "" : "locked"}" ${ok ? `data-act="focus-kind" data-id="${k}"` : `data-tip="Compare dal livello ${y.lvl}"`} aria-label="${y.label}">${Yokai.svg(k, 0, "idle", 40)}<small>${ok ? y.label.split("-")[0] : "Liv " + y.lvl}</small></button>`;
            }).join("")}</div>
            <label class="link-sel">Dedica questa sfida a<select data-act-change="focus-link">${this.linkOptions()}</select></label>
            <button class="btn primary big" data-act="focus-start">${Icon.svg("play", 18)} Affronta lo yokai</button>
            <p class="muted small center">${chain > 0 ? `${chain} ${chain === 1 ? "yokai sigillato" : "yokai sigillati"} di fila · ` : ""}questa sfida: +${next.xp} XP · +${next.ryo} 両 (×${next.mult.toFixed(1)})</p>
          `}
        </section>

        <div class="focus-side">
          ${Hero.strip(t)}
          <section class="card stats-mini">
            <div><b>${U.fmtMin(todayMin)}</b><span>oggi</span></div>
            <div><b>${U.fmtMin(weekMin)}</b><span>questa settimana</span></div>
            <div><b>${chain}</b><span>di fila</span></div>
          </section>
          <section class="card">
            <div class="block-head"><h3>Obiettivo settimanale</h3><span class="muted small">${Math.round((weekMin / cfg.focusWeeklyMin) * 100)}%</span></div>
            ${Charts.bar({ value: (weekMin / cfg.focusWeeklyMin) * 100, color: "var(--blue-500)", h: 8 })}
            <p class="muted small">${U.fmtMin(weekMin)} su ${U.fmtMin(cfg.focusWeeklyMin)}. Puoi cambiarlo dalle impostazioni.</p>
          </section>
          <section class="card how">
            <h3>Come funziona</h3>
            <p>Ogni sfida completata sigilla uno yokai: 1 XP al minuto e 1 ryo (両) ogni 5 minuti. Più yokai sigillati di fila, senza uscire, più il bonus cresce: +20% a ogni vittoria, fino a ×2. Se esci lo yokai scappa e perdi ${Game.CFG.dmgFail} HP. Con XP e ryo sali di livello, sblocchi yokai più forti e compri equipaggiamento nel Dojo.</p>
          </section>
        </div>
      </div>

      <section class="block">
        <div class="block-head"><h2>Bestiario</h2><span class="muted small">ultime ${recent.length} sfide</span></div>
        ${recent.length ? `<div class="garden">${recent.map((s) => `<div class="plot ${s.completed ? "" : "escaped"}" data-tip="${U.fmtShort(U.dateOf(s.started_at))} · ${s.duration_min} min · ${s.completed ? "sigillato" : "scappato"}">${Yokai.svg(s.creature || "hitodama", 1, s.completed ? "sealed" : "escaped", 56)}</div>`).join("")}</div>`
        : UI.empty("tree", "Nessuna sfida ancora", "Affronta il primo yokai: bastano 25 minuti senza distrazioni.")}
      </section>`;
    if (running) this.lastStage = -1;
  }
};

Actions["focus-start"] = () => Focus.start();
Actions["focus-giveup"] = () => { if (confirm("Rinunciare? Lo yokai scapperà e perderai HP.")) Focus.finish(false); };
Actions["focus-min"] = (el) => { Focus.minutes = Number(el.dataset.id); App.render(); };
Actions["focus-step"] = (el) => { Focus.minutes = U.clamp(Focus.minutes + Number(el.dataset.id), 5, 180); App.render(); };
Actions["focus-kind"] = (el) => { Focus.kind = el.dataset.id; App.render(); };
Actions["focus-link"] = (el) => { Focus.link = el.value; };
