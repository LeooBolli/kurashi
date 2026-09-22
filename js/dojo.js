// ============================================================
// Dojo: il tuo eroe, negozio, bestiario e traguardi
// ============================================================
const Dojo = {
  tab: "shop",

  render(el) {
    const t = Game.totals(), st = Game.state(), s = Game.stats(), cfg = Store.cfg();
    const habitsDone = Store.d.habit_logs.filter((l) => { const h = Store.d.habits.find((x) => x.id === l.habit_id); return h && Calc.isDone(h, l.log_date); }).length;
    const ko = t.hp === 0;

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">道場 · Dojo</p><h1 class="title">Il tuo <em>eroe</em></h1></div>
      </div>

      <section class="hero-panel">
        <div class="hp-av">${Hero.svg(st.equipped, 170)}</div>
        <div class="hp-main">
          <p class="hp-name">${U.esc(cfg.name)}</p>
          <p class="hp-rank">Livello ${t.level} · ${t.rank}</p>
          <div class="hp-row"><span>XP</span>${Charts.bar({ value: (t.into / t.need) * 100, color: "var(--blue-500)", h: 10 })}<b>${t.into}/${t.need}</b></div>
          <div class="hp-row"><span>HP</span>${Charts.bar({ value: (t.hp / t.maxHp) * 100, color: "var(--orange-500)", h: 10 })}<b>${t.hp}/${t.maxHp}</b></div>
          <p class="hp-ryo"><b>${t.ryo}</b> 両 <small>ryo</small></p>
          ${t.regen ? `<p class="muted small">${Icon.svg("heart", 12)} Il cappello equipaggiato rigenera HP nel tempo</p>` : ""}
          ${t.hp < t.maxHp ? `<button class="link heal-link" data-act="shop-fullheal">${Icon.svg("heart", 14)} Ripristina la salute al massimo</button>` : ""}
          ${ko ? `<p class="hp-warn">Sei a terra: bevi una pozione o riposa. Le ferite guariscono da sole in ${Game.CFG.windowDays} giorni.</p>` : ""}
        </div>
      </section>

      <div class="kpis kpis4">
        ${Insights.tile("Yokai sigillati", s.sealed, "sessioni di focus completate")}
        ${Insights.tile("Yokai scappati", s.escaped, `${Game.CFG.dmgFail} HP ciascuno`)}
        ${Insights.tile("Serie più lunga", Calc.bestOverallStreak() + " gg", "su un'abitudine")}
        ${Insights.tile("Abitudini fatte", habitsDone, "in totale")}
      </div>

      <div class="seg tabs3 dojo-tabs">
        ${[["shop", "Negozio"], ["bestiary", "Bestiario"], ["badges", "Traguardi"]].map(([k, l]) => `<button class="${this.tab === k ? "on" : ""}" data-act="dojo-tab" data-id="${k}">${l}</button>`).join("")}
      </div>
      <div class="dojo-pane">${this[this.tab + "HTML"](t, st, s)}</div>

      <details class="how-xp"><summary>Come si guadagnano XP e ryo</summary>
        <ul>
          <li>Abitudine completata: <b>+${Game.CFG.xpHabit} XP · +${Game.CFG.ryoHabit} 両</b></li>
          <li>Yokai sigillato: <b>+1 XP al minuto · +1 両 ogni 5 minuti</b>, con bonus a catena fino a ×2</li>
          <li>Evidenziazione ripassata: <b>+${Game.CFG.xpReview} XP · +${Game.CFG.ryoReview} 両</b></li>
          <li>Libro finito: <b>+${Game.CFG.xpBook} XP · +${Game.CFG.ryoBook} 両</b></li>
          <li>Sottotappa: <b>+${Game.CFG.xpSubstep} XP · +${Game.CFG.ryoSubstep} 両</b></li>
          <li>Tappa completata: <b>+${Game.CFG.xpMilestone} XP · +${Game.CFG.ryoMilestone} 両</b> · obiettivo completato: <b>+${Game.CFG.xpGoal} XP · +${Game.CFG.ryoGoal} 両</b></li>
          <li>Sfida al boss: come una sfida normale, e in più gli infliggi <b>minuti × attacco dell'arma equipaggiata</b> di danno (bonus a catena incluso). Per sbloccare la zona successiva serve <b>sia</b> il livello richiesto <b>sia</b> aver sconfitto il boss di questa.</li>
          <li>Ferite (si curano da sole in ${Game.CFG.windowDays} giorni): yokai scappato (rinuncia, o uscita dall'app oltre 10 secondi) <b>−${Game.CFG.dmgFail} HP</b> · abitudine prevista e saltata <b>−${Game.CFG.dmgMissed} HP</b> (max ${Game.CFG.dmgMissedCap} al giorno)</li>
          <li>Ogni oggetto equipaggiato ha un potere: cappello = rigenerazione HP nel tempo, veste = HP massimi, compagno = bonus % a XP o ryo, arma = attacco. Cambiare equipaggiamento ricalcola subito XP, ryo e HP, come per il livello.</li>
        </ul>
      </details>`;
  },

  // ---------- negozio ----------
  // Descrizione breve del potere di un oggetto, per il badge nel negozio
  powerText(it) {
    if (it.atk) return `${Icon.svg("bolt", 11)} attacco ${it.atk}`;
    if (it.regenHours) return `${Icon.svg("heart", 11)} +1 HP ogni ${it.regenHours}h`;
    if (it.hpBonus) return `${Icon.svg("heart", 11)} +${it.hpBonus} HP max`;
    if (it.xpPct && it.ryoPct) return `${Icon.svg("star", 11)} +${Math.round(it.xpPct * 100)}% XP · +${Math.round(it.ryoPct * 100)}% 両`;
    if (it.xpPct) return `${Icon.svg("star", 11)} +${Math.round(it.xpPct * 100)}% XP`;
    if (it.ryoPct) return `${Icon.svg("star", 11)} +${Math.round(it.ryoPct * 100)}% 両`;
    return "";
  },

  shopHTML(t, st) {
    const sections = Object.entries(Game.SLOTS).map(([slot, label]) => {
      const items = Object.entries(Game.ITEMS).filter(([, it]) => it.slot === slot);
      return `<section class="shop-sec"><h3>${label}</h3><div class="shop-grid">${items.map(([id, it]) => {
        const owned = st.owned.includes(id), on = st.equipped[slot] === id;
        const locked = it.unlock && !Game.bossDefeated(it.unlock);
        const can = !locked && t.ryo >= it.price;
        const btn = owned
          ? `<button class="btn ${on ? "orange" : "ghost"} sm" data-act="shop-equip" data-slot="${slot}" data-id="${on ? "" : id}">${on ? "Equipaggiato ✓" : "Equipaggia"}</button>`
          : locked
            ? `<span class="lock-hint">${Icon.svg("lock", 12)} Sconfiggi ${Game.boss(it.unlock).label}</span>`
            : `<button class="btn ${can ? "primary" : "ghost"} sm" data-act="shop-buy" data-id="${id}" ${can ? "" : 'aria-disabled="true"'}>${it.price} 両</button>`;
        return `<div class="shop-item ${on ? "on" : ""} ${!owned && !can ? "dim" : ""} ${locked ? "locked" : ""}">
          <div class="si-prev">${Hero.svg({ ...st.equipped, [slot]: id }, 84)}</div>
          <b>${it.label}</b><span class="atk-badge">${this.powerText(it)}</span>${btn}</div>`;
      }).join("")}</div></section>`;
    }).join("");

    const potionOk = t.ryo >= Game.CFG.potionCost && t.hp < t.maxHp;
    return `${sections}
      <section class="shop-sec"><h3>Pozioni</h3>
        <div class="potion card">
          <i class="glyph big" style="background:var(--orange-100);color:var(--orange)">薬</i>
          <div><b>Pozione di guarigione</b><p class="muted small">Ripristina ${Game.CFG.potionHeal} HP subito.</p></div>
          <button class="btn ${potionOk ? "primary" : "ghost"} sm" data-act="shop-potion">${Game.CFG.potionCost} 両</button>
        </div>
      </section>`;
  },

  // ---------- bestiario ----------
  bestiaryHTML(t, st, s) {
    const unlocked = Game.unlockedZones().map((z) => z.id);
    return `<div class="bestiary">${Game.ZONES.map((z, i) => {
      const locked = !unlocked.includes(z.id), c = s.byKind[z.id] || { sealed: 0, escaped: 0 };
      const dmg = Game.bossDamage(z.boss.id), defeated = Game.bossDefeated(z.boss.id);
      const prevBeat = i === 0 || Game.bossDefeated(Game.ZONES[i - 1].boss.id);
      const lockReason = t.level < z.lvl ? `Zona bloccata: serve il livello ${z.lvl}${!prevBeat ? ` e sconfiggere ${Game.ZONES[i - 1].boss.label}` : ""}` : "Zona bloccata: sconfiggi il boss precedente";
      return `<div class="beast card ${locked ? "locked" : ""}">
        <div class="beast-art">${Yokai.svg(z.id, 0, "idle", 84)}</div>
        <div><b>${z.label}</b> <span class="jp">${z.jp}</span>
        <p class="muted small">${locked ? lockReason : z.note}</p>
        ${locked ? "" : `<p class="small"><b>${c.sealed}</b> sigillati · ${c.escaped} scappati</p>`}
        ${locked ? "" : `<div class="boss-line ${defeated ? "beat" : ""}">
          <div class="boss-art">${Boss.svg(z.boss.id, defeated, 46)}</div>
          <div class="boss-info"><b>${z.boss.label}</b> <span class="jp">${z.boss.jp}</span>
            ${defeated ? `<span class="boss-tag">${Icon.svg("check", 12)} Sconfitto</span>`
              : `${Charts.bar({ value: (dmg / z.boss.hp) * 100, color: "var(--orange-500)", h: 6 })}<small>${dmg}/${z.boss.hp} HP</small>`}</div>
        </div>`}</div>
      </div>`;
    }).join("")}</div>`;
  },

  // ---------- traguardi ----------
  badgesHTML() {
    const list = Game.achievements();
    return `<p class="muted small" style="margin-bottom:12px">${list.filter((a) => a.ok).length} di ${list.length} sbloccati</p>
      <div class="badges">${list.map((a) => `<div class="badge ${a.ok ? "ok" : ""}">
        <i class="glyph big">${a.glyph}</i>
        <div><b>${a.label}</b><p class="muted small">${a.text}</p>
          ${!a.ok && a.prog ? Charts.bar({ value: (a.prog[0] / a.prog[1]) * 100, color: "var(--blue-500)", h: 5 }) : ""}</div>
      </div>`).join("")}</div>`;
  }
};

Actions["dojo-tab"] = (el) => { Dojo.tab = el.dataset.id; App.render(); };
Actions["shop-buy"] = (el) => Game.buy(el.dataset.id);
Actions["shop-equip"] = (el) => Game.equip(el.dataset.slot, el.dataset.id || null);
Actions["shop-potion"] = () => Game.potion();
Actions["shop-fullheal"] = () => { if (confirm("Azzerare tutte le ferite e riportare gli HP al massimo?")) Game.fullHeal(); };
