// ============================================================
// Focus: caccia allo yokai. Mentre resti concentrato lo yokai si
// indebolisce; a fine timer viene sigillato (XP + ryo). Il tempo si
// calcola dall'orario di inizio. Cambio app: 10 secondi per tornare,
// altrimenti lo yokai scappa e ti colpisce (-HP). Schermo bloccato
// (dopo aver toccato «Blocco lo schermo»): il timer prosegue, nessun danno.
// Più yokai sigillati di fila = bonus a catena (fino a ×2).
// ============================================================
const Focus = {
  KEY: "kurashi-focus-run",
  GRACE_MS: 10000,
  STALE_MS: 20000,

  minutes: 25,
  kind: "hitodama",
  boss: null,         // se impostato: la sfida è al boss di zona, non a uno yokai comune
  link: "",           // "g:<id>" (obiettivo) oppure "h:<id>" (abitudine in minuti)
  run: null,          // {startedAt, durationMin, kind, boss, link, lastSeen}
  result: null,       // esito dell'ultima sfida, mostrato finché non ne avvii un'altra
  timer: null,
  hiddenAt: null,
  wake: null,
  lastStage: -1,

  // Se lo yokai scappa quando esci dall'app (di default sì; disattivabile dalle impostazioni)
  strict() { return Store.cfg().focusStrict !== false; },

  // Il browser non dice se l'utente ha bloccato lo schermo o cambiato app: per una pagina web
  // sono lo stesso evento. Quindi si dichiara: «Blocco lo schermo» valida la prossima uscita
  // (entro LOCK_WINDOW_MS); ogni altra uscita oltre GRACE_MS fa scappare lo yokai.
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

  // Al ritorno: assenza da schermo bloccato = nessuna conseguenza; cambio app oltre 10 secondi = danno
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

  // Disegno mostrato nel timer: il boss se lo stai sfidando, altrimenti lo yokai scelto
  art(kind, boss, p, size) { return boss ? Boss.svg(boss, false, size) : Yokai.svg(kind, p, "idle", size); },

  start() {
    this.result = null;
    this.run = { startedAt: Date.now(), durationMin: this.minutes, kind: this.kind, boss: this.boss, link: this.link, lastSeen: Date.now() };
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
    const stage = Math.round(p * 24);
    if (stage !== this.lastStage) {
      this.lastStage = stage;
      const y = document.getElementById("f-yokai");
      if (y) y.innerHTML = this.art(this.run.kind, this.run.boss, p, 130);
    }
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
    const base = { started_at: new Date(run.startedAt).toISOString(), duration_min: run.durationMin, creature: run.kind, boss: run.boss || null, goal_id: goalId, habit_id: habitId, milestone_id: milestoneId, label: null };

    if (success) {
      const chain = Calc.focusChain();
      const c = Calc.comboFor(run.durationMin, chain);
      // A terra (0 HP) si guadagna la metà dei ryo
      const tired = Game.totals().hp === 0;
      const ryo = tired ? Math.max(1, Math.round(c.ryo / 2)) : c.ryo;
      const bossInfo = run.boss && Game.boss(run.boss);
      const before = bossInfo ? Game.bossDamage(run.boss) : 0;
      const bdmg = bossInfo ? Math.round(run.durationMin * Game.atk() * c.mult) : 0;
      Store.insert("focus_sessions", { ...base, completed: true, xp: c.xp, ryo, dmg: bdmg });
      const habit = habitId && Store.d.habits.find((h) => h.id === habitId);
      if (habit && habit.kind === "qty" && (habit.unit || "").toLowerCase().startsWith("min")) {
        Store.setLog(habit.id, U.today(), Calc.value(habit, U.today()) + run.durationMin);
      }
      const bossDefeatedNow = bossInfo && before < bossInfo.hp && before + bdmg >= bossInfo.hp;
      this.result = { ok: true, xp: c.xp, ryo, mult: c.mult, chain: chain + 1, tired, kind: run.kind,
        boss: run.boss, bossLabel: bossInfo && bossInfo.label, bdmg, bossHp: bossInfo && bossInfo.hp, bossLeft: bossInfo && Math.max(0, bossInfo.hp - before - bdmg), bossDefeatedNow };
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    } else if (elapsed >= 15) {
      Store.insert("focus_sessions", { ...base, completed: false, xp: 0, ryo: 0 });
      this.result = { ok: false, dmg: Game.CFG.dmgFail, kind: run.kind, fresh: true, reason };
    }
    if (this.boss && Game.bossDefeated(this.boss)) this.boss = null;
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

  resultHTML() {
    const r = this.result;
    if (r.ok && r.boss) return `<div class="result ok boss"><b>${r.bossDefeatedNow ? `${r.bossLabel} sconfitto!` : "Colpo inferto!"}</b>
      <span>+${r.xp} XP · +${r.ryo} 両 · −${r.bdmg} HP a ${r.bossLabel}${r.bossDefeatedNow ? " · nuova zona sbloccata" : ` · ${r.bossLeft}/${r.bossHp} HP rimasti`}</span></div>`;
    if (r.ok) return `<div class="result ok"><b>Yokai sigillato!</b><span>+${r.xp} XP · +${r.ryo} 両${r.mult > 1 ? ` · bonus ×${r.mult.toFixed(1)}` : ""} · ${r.chain} di fila${r.tired ? " · ryo dimezzati: eri a terra" : ""}</span></div>`;
    return `<div class="result bad"><b>Lo yokai è scappato!</b><span>${r.reason === "left" ? "Sei uscito dall'app per più di 10 secondi e ti ha colpito" : "Hai rinunciato e ti ha colpito"}: −${r.dmg} HP. La serie riparte da zero.</span></div>`;
  },

  render(el) {
    const today = U.today();
    const cfg = Store.cfg();
    const t = Game.totals();
    const chain = Calc.focusChain();
    const next = Calc.comboFor(this.minutes, chain);
    const zones = Game.unlockedZones();
    const activeBoss = Game.activeBoss();
    if (this.boss && (!activeBoss || activeBoss.id !== this.boss)) this.boss = null;
    if (!zones.some((z) => z.id === this.kind)) this.kind = zones[0].id;
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
              <div id="f-yokai" class="timer-yokai ${running ? "wobble" : ""}">${this.art(running ? this.run.kind : this.kind, running ? this.run.boss : this.boss, p, 130)}</div>
              <div id="f-time" class="timer-time">${U.pad(Math.floor(rs / 60))}:${U.pad(rs % 60)}</div>
            </div>
          </div>

          ${running ? `
            <p class="timer-note">${this.strict()
              ? "Se cambi app hai 10 secondi per tornare, altrimenti lo yokai scappa e ti colpisce. Per bloccare lo schermo tocca prima il pulsante qui sotto: il timer va avanti e non prendi danno."
              : "Puoi cambiare app o bloccare lo schermo: il timer va avanti e lo yokai viene sigillato comunque."}</p>
            <div class="btn-row center-row">
              ${this.strict() ? `<button class="btn primary" data-act="focus-lock">${Icon.svg("lock", 16)} Blocco lo schermo</button>` : ""}
              <button class="btn ghost" data-act="focus-giveup">Rinuncia</button>
            </div>
          ` : `
            ${this.result ? this.resultHTML() : ""}
            <div class="dur">
              ${[15, 25, 45, 60].map((m) => `<button class="pill ${this.minutes === m ? "on" : ""}" data-act="focus-min" data-id="${m}">${m}′</button>`).join("")}
              <span class="dur-step"><button class="round plus sm" data-act="focus-step" data-id="-5" aria-label="Meno 5 minuti">${Icon.svg("minus", 14)}</button>
              <button class="round plus sm" data-act="focus-step" data-id="5" aria-label="Più 5 minuti">${Icon.svg("plus", 14)}</button></span>
            </div>
            <div class="trees-pick">${zones.map((z) => `<button class="tree-opt ${!this.boss && this.kind === z.id ? "on" : ""}" data-act="focus-kind" data-id="${z.id}" aria-label="${z.label}">${Yokai.svg(z.id, 0, "idle", 40)}<small>${z.label.split("-")[0]}</small></button>`).join("")}</div>
            ${activeBoss ? `<button class="boss-pick ${this.boss ? "on" : ""}" data-act="focus-boss" data-id="${activeBoss.id}">
              <div class="bp-art">${Boss.svg(activeBoss.id, false, 44)}</div>
              <div class="bp-info"><b>${activeBoss.label}</b> <span class="jp">${activeBoss.jp}</span>
                ${Charts.bar({ value: (Game.bossDamage(activeBoss.id) / activeBoss.hp) * 100, color: "var(--orange-500)", h: 5 })}
                <small>${Game.bossDamage(activeBoss.id)}/${activeBoss.hp} HP · attacco ${Game.atk()}</small></div>
            </button>` : `<p class="muted small center">${Game.allBossesDefeated() ? "Hai sconfitto tutti i boss. Sei leggendario." : `Sali al livello ${(Game.nextLockedZone() || {}).lvl} per affrontare il prossimo boss.`}</p>`}
            <label class="link-sel">Dedica questa sfida a<select data-act-change="focus-link">${this.linkOptions()}</select></label>
            <button class="btn primary big" data-act="focus-start">${Icon.svg("play", 18)} ${this.boss ? "Sfida il boss" : "Affronta lo yokai"}</button>
            <p class="muted small center">${chain > 0 ? `${chain} ${chain === 1 ? "yokai sigillato" : "yokai sigillati"} di fila · ` : ""}questa sfida: +${next.xp} XP · +${next.ryo} 両 (×${next.mult.toFixed(1)})${this.boss ? ` · −${Math.round(this.minutes * Game.atk() * next.mult)} HP al boss` : ""}</p>
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
            <p>Ogni sfida completata sigilla uno yokai: 1 XP al minuto e 1 ryo (両) ogni 5 minuti. Più yokai sigillati di fila, senza uscire, più il bonus cresce: +20% a ogni vittoria, fino a ×2. Se rinunci lo yokai scappa e perdi ${Game.CFG.dmgFail} HP o se esci dall'app per più di 10 secondi. Per bloccare lo schermo tocca «Blocco lo schermo»: il timer va avanti senza danni. Con XP e ryo sali di livello e compri equipaggiamento nel Dojo. Puoi anche dedicare la sfida al <b>boss</b> della zona: ogni sessione gli toglie danno (minuti × attacco dell'arma equipaggiata), finché non lo sconfiggi e sblocchi la zona successiva.</p>
          </section>
        </div>
      </div>

      <section class="block">
        <div class="block-head"><h2>Bestiario</h2><span class="muted small">ultime ${recent.length} sfide</span></div>
        ${recent.length ? `<div class="garden">${recent.map((s) => `<div class="plot ${s.completed ? "" : "escaped"}" data-tip="${U.fmtShort(U.dateOf(s.started_at))} · ${s.duration_min} min · ${s.boss ? (s.completed ? `−${s.dmg || 0} HP boss` : "boss: scappato") : (s.completed ? "sigillato" : "scappato")}">${s.boss ? Boss.svg(s.boss, false, 56) : Yokai.svg(s.creature || "hitodama", 1, s.completed ? "sealed" : "escaped", 56)}</div>`).join("")}</div>`
        : UI.empty("tree", "Nessuna sfida ancora", "Affronta il primo yokai: bastano 25 minuti senza distrazioni.")}
      </section>
      ${this.lockOverlay && running ? `<div class="lock-overlay" role="dialog" aria-label="Blocco schermo">
        <div class="lock-card">${Icon.svg("lock", 34)}
          <h2>Blocca pure lo schermo</h2>
          <p>Premi il tasto laterale ora. Il timer va avanti e non prendi danno. Hai 60 secondi.</p>
          <button class="btn ghost wide" data-act="focus-lock-cancel">Annulla</button>
        </div></div>` : ""}`;
    if (running) this.lastStage = -1;
  }
};

Actions["focus-start"] = () => Focus.start();
Actions["focus-lock"] = () => Focus.lockNow();
Actions["focus-lock-cancel"] = () => Focus.cancelLock();
Actions["focus-giveup"] = () => { if (confirm("Rinunciare? Lo yokai scapperà e perderai HP.")) Focus.finish(false, "giveup"); };
Actions["focus-min"] = (el) => { Focus.minutes = Number(el.dataset.id); App.render(); };
Actions["focus-step"] = (el) => { Focus.minutes = U.clamp(Focus.minutes + Number(el.dataset.id), 5, 180); App.render(); };
Actions["focus-kind"] = (el) => { Focus.kind = el.dataset.id; Focus.boss = null; App.render(); };
Actions["focus-boss"] = (el) => { Focus.boss = el.dataset.id; App.render(); };
Actions["focus-link"] = (el) => { Focus.link = el.value; };
