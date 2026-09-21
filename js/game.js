// ============================================================
// Gioco: XP, livelli, HP, ryo (la moneta), negozio, yokai e eroe.
// Tutto è DERIVATO dai dati veri (abitudini, tappe, focus): niente
// contatori da tenere allineati, e se correggi un giorno passato
// anche XP e ryo si correggono. Nel database restano solo gli
// acquisti e l'equipaggiamento (dentro le impostazioni).
// ============================================================
const Game = {
  CFG: {
    xpHabit: 10, ryoHabit: 5,
    xpMilestone: 30, ryoMilestone: 15,
    xpGoal: 150, ryoGoal: 75,
    xpReview: 4, ryoReview: 2,   // ripasso di un'evidenziazione
    dmgFail: 12,          // HP persi quando lo yokai scappa
    dmgMissed: 2,         // HP persi per ogni abitudine prevista e saltata...
    dmgMissedCap: 5,      // ...fino a questo massimo al giorno
    windowDays: 7,        // le ferite guariscono da sole dopo 7 giorni
    potionCost: 40, potionHeal: 25
  },

  YOKAI: {
    hitodama: { label: "Hitodama", jp: "人魂", lvl: 1, note: "Fiamma errante" },
    chochin: { label: "Chōchin-obake", jp: "提灯", lvl: 3, note: "Lanterna dispettosa" },
    kasa: { label: "Kasa-obake", jp: "傘", lvl: 6, note: "Ombrello con un occhio solo" },
    oni: { label: "Oni", jp: "鬼", lvl: 10, note: "Il demone" }
  },

  SLOTS: { hat: "Copricapo", weapon: "Arma", pet: "Compagno", robe: "Veste" },

  ITEMS: {
    hachimaki: { slot: "hat", label: "Hachimaki", price: 30 },
    kasa: { slot: "hat", label: "Kasa di paglia", price: 80 },
    kabuto: { slot: "hat", label: "Kabuto", price: 200 },
    bokken: { slot: "weapon", label: "Bokken", price: 60 },
    fude: { slot: "weapon", label: "Pennello fude", price: 120 },
    katana: { slot: "weapon", label: "Katana", price: 250 },
    neko: { slot: "pet", label: "Neko", price: 100 },
    kitsune: { slot: "pet", label: "Kitsune", price: 150 },
    tanuki: { slot: "pet", label: "Tanuki", price: 180 },
    robe_orange: { slot: "robe", label: "Veste arancio", price: 40, color: "#F0A070" },
    robe_sand: { slot: "robe", label: "Veste sabbia", price: 60, color: "#E6D3B0" },
    robe_indigo: { slot: "robe", label: "Veste indaco", price: 80, color: "#5A6EA3" }
  },

  RANKS: [[1, "Novizio"], [3, "Apprendista"], [6, "Guerriero"], [10, "Samurai"], [15, "Maestro"], [20, "Leggenda"]],

  last: null,

  rank(level) {
    let r = this.RANKS[0][1];
    for (const [l, name] of this.RANKS) if (level >= l) r = name;
    return r;
  },

  // Dati del gioco salvati nelle impostazioni
  state() {
    return { owned: [], equipped: {}, potions: [], ...(Store.settings.game || {}) };
  },

  xpForLevel(l) { return 100 + 40 * (l - 1); },

  levelOf(xp) {
    let level = 1, rest = xp;
    while (rest >= this.xpForLevel(level)) { rest -= this.xpForLevel(level); level++; }
    return { level, into: rest, need: this.xpForLevel(level) };
  },

  unlockedYokai(level) { return Object.keys(this.YOKAI).filter((k) => this.YOKAI[k].lvl <= level); },

  totals() {
    const C = this.CFG, today = U.today();
    let xp = 0, earned = 0;

    const habits = new Map(Store.d.habits.map((h) => [h.id, h]));
    for (const l of Store.d.habit_logs) {
      const h = habits.get(l.habit_id);
      if (h && l.log_date <= today && Calc.isDone(h, l.log_date)) { xp += C.xpHabit; earned += C.ryoHabit; }
    }
    for (const s of Store.d.focus_sessions) {
      if (!s.completed) continue;
      xp += s.xp ?? s.duration_min;
      earned += s.ryo ?? Math.round(s.duration_min / 5);
    }
    for (const h of Store.d.highlights || []) {
      const n = h.times_reviewed || 0;
      xp += n * C.xpReview; earned += n * C.ryoReview;
    }
    for (const m of Store.d.milestones) if (m.done) { xp += C.xpMilestone; earned += C.ryoMilestone; }
    for (const g of Store.d.goals) if (g.status === "done") { xp += C.xpGoal; earned += C.ryoGoal; }

    const st = this.state();
    const spent = U.sum(st.owned.map((id) => (this.ITEMS[id] ? this.ITEMS[id].price : 0))) + st.potions.length * C.potionCost;
    const lv = this.levelOf(xp);
    const maxHp = 50 + 5 * (lv.level - 1);

    // Ferite degli ultimi 7 giorni: yokai scappati + abitudini saltate
    const from = U.addDays(today, -(C.windowDays - 1));
    let dmg = 0;
    for (const s of Store.d.focus_sessions) if (!s.completed && U.dateOf(s.started_at) >= from) dmg += C.dmgFail;
    for (const d of U.range(from, U.addDays(today, -1))) {
      const missed = Calc.habitsDueOn(d).filter((h) => !Calc.isDone(h, d)).length;
      dmg += Math.min(C.dmgMissedCap, missed * C.dmgMissed);
    }
    const heal = st.potions.filter((t) => U.dateOf(t) >= from).length * C.potionHeal;
    const hp = U.clamp(maxHp - dmg + heal, 0, maxHp);

    return { xp, earned, spent, ryo: Math.max(0, earned - spent), level: lv.level, into: lv.into, need: lv.need, hp, maxHp, dmg, rank: this.rank(lv.level) };
  },

  stats() {
    const done = Store.d.focus_sessions.filter((s) => s.completed);
    const byKind = {};
    for (const s of Store.d.focus_sessions) {
      const k = s.creature || "hitodama";
      byKind[k] = byKind[k] || { sealed: 0, escaped: 0 };
      byKind[k][s.completed ? "sealed" : "escaped"]++;
    }
    return { sealed: done.length, escaped: Store.d.focus_sessions.length - done.length, byKind };
  },

  // ---------- Traguardi (sbloccati in automatico) ----------
  achievements() {
    const t = this.totals(), s = this.stats(), st = this.state();
    const streak = Calc.bestOverallStreak();
    const bestEver = Math.max(0, ...Store.d.habits.map((h) => Calc.bestStreak(h)));
    const goalsDone = Store.d.goals.filter((g) => g.status === "done").length;
    const ms = Store.d.milestones.filter((m) => m.done).length;
    const reviews = U.sum((Store.d.highlights || []).map((h) => h.times_reviewed || 0));
    return [
      { id: "first", glyph: "封", label: "Primo sigillo", text: "Sigilla il tuo primo yokai", ok: s.sealed >= 1 },
      { id: "hunter", glyph: "狩", label: "Cacciatore", text: "10 yokai sigillati", ok: s.sealed >= 10, prog: [s.sealed, 10] },
      { id: "master", glyph: "師", label: "Maestro di yokai", text: "50 yokai sigillati", ok: s.sealed >= 50, prog: [s.sealed, 50] },
      { id: "week", glyph: "週", label: "Una settimana", text: "7 giorni di fila su un'abitudine", ok: Math.max(streak, bestEver) >= 7, prog: [Math.max(streak, bestEver), 7] },
      { id: "month", glyph: "月", label: "Un mese", text: "30 giorni di fila su un'abitudine", ok: bestEver >= 30, prog: [bestEver, 30] },
      { id: "lv5", glyph: "五", label: "Livello 5", text: "Raggiungi il livello 5", ok: t.level >= 5, prog: [t.level, 5] },
      { id: "lv10", glyph: "十", label: "Livello 10", text: "Raggiungi il livello 10", ok: t.level >= 10, prog: [t.level, 10] },
      { id: "goal", glyph: "達", label: "Traguardo", text: "Completa un obiettivo", ok: goalsDone >= 1 },
      { id: "steps", glyph: "歩", label: "Passo dopo passo", text: "Completa 10 tappe", ok: ms >= 10, prog: [ms, 10] },
      { id: "memory", glyph: "記", label: "Memoria", text: "Ripassa 50 evidenziazioni", ok: reviews >= 50, prog: [reviews, 50] },
      { id: "gear", glyph: "装", label: "Ben equipaggiato", text: "Possiedi 3 oggetti", ok: st.owned.length >= 3, prog: [st.owned.length, 3] },
      { id: "mind", glyph: "心", label: "Mente attenta", text: "7 check-in di umore", ok: Store.d.mood_logs.length >= 7, prog: [Store.d.mood_logs.length, 7] },
      { id: "body", glyph: "体", label: "In movimento", text: "10 allenamenti", ok: Store.d.workouts.length >= 10, prog: [Store.d.workouts.length, 10] }
    ];
  },

  // ---------- Negozio ----------
  buy(id) {
    const it = this.ITEMS[id], st = this.state(), t = this.totals();
    if (!it || st.owned.includes(id)) return;
    if (t.ryo < it.price) return U.toast(`Ti mancano ${it.price - t.ryo} ryo`);
    Store.setSettings({ game: { ...st, owned: [...st.owned, id], equipped: { ...st.equipped, [it.slot]: id } } });
    U.toast(`${it.label}: acquistato ed equipaggiato`);
  },

  equip(slot, id) {
    const st = this.state();
    const equipped = { ...st.equipped };
    if (id) equipped[slot] = id; else delete equipped[slot];
    Store.setSettings({ game: { ...st, equipped } });
  },

  potion() {
    const st = this.state(), t = this.totals(), C = this.CFG;
    if (t.hp >= t.maxHp) return U.toast("Sei già in piena salute");
    if (t.ryo < C.potionCost) return U.toast(`Ti mancano ${C.potionCost - t.ryo} ryo`);
    const cutoff = U.addDays(U.today(), -30);
    const potions = [...st.potions.filter((p) => U.dateOf(p) >= cutoff), new Date().toISOString()];
    Store.setSettings({ game: { ...st, potions } });
    U.toast(`Pozione bevuta: +${Math.min(C.potionHeal, t.maxHp - t.hp)} HP`);
  },

  // ---------- Feedback in tempo reale ----------
  init() {
    this.last = this.totals();
    Store.on(() => this.onChange());
  },

  onChange() {
    const t = this.totals(), l = this.last;
    this.last = t;
    if (!l) return;
    if (t.level > l.level) {
      U.toast(`Livello ${t.level}! Ora sei ${t.rank.toLowerCase()}`);
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      return;
    }
    const dx = t.xp - l.xp, dr = t.earned - l.earned;
    if (dx > 0 || dr > 0) U.toast(`+${dx} XP · +${dr} 両`);
    else if (t.hp < l.hp) U.toast(`−${l.hp - t.hp} HP`);
  }
};

// ---- Yokai (spiriti da sigillare durante il focus) --------------------------
const Yokai = {
  face(kind, angry) {
    const eye = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/><circle cx="${cx + (angry ? 0 : 1)}" cy="${cy + 1}" r="${r * 0.5}" fill="#23272E"/>`;
    return { eye };
  },

  // progress 0..1 = quanto è indebolito; state: idle | sealed | escaped
  svg(kind = "hitodama", progress = 0, state = "idle", size = 100) {
    const s = state === "idle" ? 1 - 0.45 * progress : state === "sealed" ? 0.82 : 1.05;
    const op = state === "idle" ? 1 - 0.3 * progress : 1;
    const { eye } = this.face(kind, state === "escaped");
    const shapes = {
      hitodama: `<path d="M50 8C60 26 80 40 80 62A30 30 0 0 1 20 62C20 40 40 26 50 8Z" fill="#86AED6"/>
        <path d="M50 32C56 44 66 52 66 64A16 16 0 0 1 34 64C34 52 44 44 50 32Z" fill="#BAD3EA"/>
        ${eye(42, 62, 5)}${eye(58, 62, 5)}<path d="M44 74Q50 78 56 74" stroke="#23272E" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      chochin: `<rect x="22" y="26" width="56" height="62" rx="24" fill="#F0A070"/>
        <path d="M24 44Q50 52 76 44M22 58Q50 66 78 58M24 72Q50 80 76 72" stroke="#D97F45" stroke-width="2" fill="none"/>
        <rect x="36" y="18" width="28" height="9" rx="3" fill="#3E434B"/><rect x="36" y="84" width="28" height="8" rx="3" fill="#3E434B"/>
        ${eye(50, 50, 10)}<path d="M38 66Q50 74 62 66" stroke="#3E434B" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M47 70Q48 82 54 80Q57 75 56 70Z" fill="#E86A8A"/>`,
      kasa: `<path d="M8 48Q50 -8 92 48Q71 41 50 48Q29 41 8 48Z" fill="#6E96C1"/>
        <path d="M50 8V46M50 10L27 44M50 10L73 44" stroke="#5478A3" stroke-width="1.5" fill="none"/>
        <rect x="37" y="46" width="26" height="34" rx="12" fill="#A9C7E6"/>
        ${eye(50, 58, 7)}<path d="M46 70Q47 80 52 78Q54 74 54 70Z" fill="#E86A8A"/>
        <path d="M50 80V88" stroke="#3E434B" stroke-width="4"/><path d="M40 91H60" stroke="#3E434B" stroke-width="5" stroke-linecap="round"/>`,
      oni: `<circle cx="50" cy="60" r="32" fill="#E8792F"/>
        <path d="M31 38L27 10L45 30ZM69 38L73 10L55 30Z" fill="#F6E3C8"/>
        ${eye(39, 58, 6.5)}${eye(61, 58, 6.5)}
        <path d="M28 46L46 53M72 46L54 53" stroke="#23272E" stroke-width="4" stroke-linecap="round"/>
        <path d="M35 74Q50 86 65 74Q50 78 35 74Z" fill="#3E434B"/><path d="M42 76L44 83L47 77ZM58 76L56 83L53 77Z" fill="#fff"/>`
    };
    const stamp = state === "sealed"
      ? `<g transform="translate(62 54) rotate(-10)"><rect width="32" height="32" rx="7" fill="#E8792F"/><text x="16" y="25" font-size="22" text-anchor="middle" fill="#fff" font-family="Shippori Mincho,serif" font-weight="700">封</text></g>` : "";
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${(Game.YOKAI[kind] || {}).label || "Yokai"}">
      <ellipse cx="50" cy="94" rx="28" ry="3.2" fill="#000" opacity=".06"/>
      <g transform="translate(50 92) scale(${s.toFixed(3)}) translate(-50 -92)" opacity="${op.toFixed(2)}">${shapes[kind] || shapes.hitodama}</g>${stamp}</svg>`;
  }
};

// ---- Eroe (avatar minimale con equipaggiamento) -----------------------------
const Hero = {
  svg(eq = {}, size = 140) {
    const robe = (Game.ITEMS[eq.robe] && Game.ITEMS[eq.robe].color) || "#7FA6CE";
    const hats = {
      hachimaki: `<path d="M48 55Q70 47 92 55L92 61Q70 53 48 61Z" fill="#E8792F"/><path d="M92 58l10 6M92 58l8 12" stroke="#E8792F" stroke-width="3.5" stroke-linecap="round"/>`,
      kasa: `<path d="M26 58Q70 8 114 58Q70 50 26 58Z" fill="#E8CF98"/><path d="M40 55Q70 28 100 55" stroke="#C8AE72" stroke-width="1.5" fill="none"/>`,
      kabuto: `<path d="M46 60Q46 30 70 30Q94 30 94 60L86 55Q70 47 54 55Z" fill="#5B6069"/><path d="M70 30L58 12M70 30L82 12" stroke="#E6C25A" stroke-width="3" stroke-linecap="round" fill="none"/>`
    };
    const weapons = {
      bokken: `<path d="M101 124L113 66" stroke="#B08A6A" stroke-width="6" stroke-linecap="round"/>`,
      fude: `<path d="M102 124L110 78" stroke="#23272E" stroke-width="3.5" stroke-linecap="round"/><path d="M110 78Q105 66 112 56Q117 68 110 78Z" fill="#23272E"/>`,
      katana: `<path d="M101 124L114 62" stroke="#CBD5DF" stroke-width="4.5" stroke-linecap="round"/><rect x="95" y="111" width="13" height="4" rx="2" fill="#E6C25A" transform="rotate(-12 101 113)"/>`
    };
    const pets = {
      neko: `<ellipse cx="24" cy="132" rx="15" ry="9" fill="#F0A070"/><circle cx="24" cy="118" r="10" fill="#F0A070"/><path d="M16 112L15 101L23 107ZM32 112L33 101L25 107Z" fill="#F0A070"/><circle cx="21" cy="118" r="1.5" fill="#23272E"/><circle cx="27" cy="118" r="1.5" fill="#23272E"/><path d="M38 130Q47 124 44 115" stroke="#F0A070" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      kitsune: `<ellipse cx="24" cy="132" rx="14" ry="9" fill="#F0954F"/><path d="M14 122L24 106L34 122Z" fill="#F0954F"/><path d="M16 114L15 102L23 108ZM32 114L33 102L25 108Z" fill="#F0954F"/><path d="M18 122L24 128L30 122Z" fill="#fff"/><circle cx="21" cy="118" r="1.4" fill="#23272E"/><circle cx="27" cy="118" r="1.4" fill="#23272E"/><path d="M36 134Q56 132 52 112Q50 126 36 126Z" fill="#F0954F"/><path d="M52 112Q54 118 50 122Q50 116 52 112Z" fill="#fff"/>`,
      tanuki: `<ellipse cx="24" cy="132" rx="15" ry="9" fill="#9A8676"/><circle cx="24" cy="118" r="10.5" fill="#9A8676"/><circle cx="16" cy="109" r="3.5" fill="#6E5F52"/><circle cx="32" cy="109" r="3.5" fill="#6E5F52"/><ellipse cx="24" cy="118" rx="9" ry="4" fill="#4A4038"/><circle cx="21" cy="118" r="1.4" fill="#fff"/><circle cx="27" cy="118" r="1.4" fill="#fff"/><path d="M38 130Q46 128 44 122" stroke="#9A8676" stroke-width="4.5" fill="none" stroke-linecap="round"/>`
    };
    return `<svg viewBox="0 0 140 150" width="${size}" height="${Math.round(size * 150 / 140)}" role="img" aria-label="Il tuo eroe">
      <ellipse cx="70" cy="141" rx="36" ry="5" fill="#000" opacity=".07"/>
      ${pets[eq.pet] || ""}
      <path d="M50 94Q39 108 45 124" stroke="${robe}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M90 94Q101 108 100 122" stroke="${robe}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M44 139L48 88Q70 78 92 88L96 139Z" fill="${robe}"/>
      <path d="M48 96L70 118L92 96" stroke="#fff" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>
      <rect x="47" y="112" width="46" height="8" rx="3" fill="#23272E" opacity=".85"/>
      <circle cx="45" cy="124" r="5" fill="#F4DCC6"/><circle cx="100" cy="124" r="5" fill="#F4DCC6"/>
      ${weapons[eq.weapon] || ""}
      <circle cx="70" cy="64" r="22" fill="#F4DCC6"/>
      <path d="M47 62Q48 40 70 40Q92 40 93 62Q82 50 70 50Q58 50 47 62Z" fill="#2B2E35"/>
      <circle cx="62" cy="68" r="2.3" fill="#23272E"/><circle cx="78" cy="68" r="2.3" fill="#23272E"/>
      <path d="M64 76Q70 81 76 76" stroke="#23272E" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="56" cy="74" r="3.5" fill="#F0A070" opacity=".35"/><circle cx="84" cy="74" r="3.5" fill="#F0A070" opacity=".35"/>
      ${hats[eq.hat] || ""}
    </svg>`;
  },

  // Barra compatta livello / XP / HP / ryo (usata in Oggi e nel Dojo)
  strip(t) {
    const eq = Game.state().equipped;
    return `<div class="hero-strip" data-act="go" data-id="hero" role="button" aria-label="Apri il Dojo">
      <div class="hs-av">${this.svg(eq, 54)}</div>
      <div class="hs-main">
        <div class="hs-top"><b>Lv ${t.level}</b><span>${t.rank}</span><em>${t.ryo} 両</em></div>
        <div class="hs-bars">
          <div class="hs-bar" data-tip="XP ${t.into}/${t.need}">${Charts.bar({ value: (t.into / t.need) * 100, color: "var(--blue-500)", h: 6 })}<small>XP</small></div>
          <div class="hs-bar" data-tip="HP ${t.hp}/${t.maxHp}">${Charts.bar({ value: (t.hp / t.maxHp) * 100, color: "var(--orange-500)", h: 6 })}<small>HP</small></div>
        </div>
      </div>
    </div>`;
  }
};
