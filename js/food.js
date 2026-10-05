// ============================================================
// Alimentazione: piano dei pasti giorno per giorno, ricettario
// (alimenti, piatti con ingredienti, pasti salvati) e modelli di
// giorno/settimana da riapplicare. Niente calcoli nutrizionali:
// solo cosa, quando e quanto.
// Le righe del piano copiano nome, quantità e ingredienti: cambiare
// una ricetta non tocca i giorni già pianificati.
// L'abitudine "Dieta rispettata" si spunta da sola quando tutti i
// pasti in programma di un giorno sono segnati come mangiati.
// ============================================================
const Food = {
  tab: "plan",          // plan | book | templates
  day: null,            // giorno selezionato nel piano
  bookFilter: "all",
  pick: null,           // selettore aperto: { date, slot, extra, q, added: {} }
  target: null,         // scelta delle date per copie e modelli

  SLOTS: [["colazione", "Colazione"], ["spuntino_mattina", "Spuntino mattina"], ["pranzo", "Pranzo"],
    ["spuntino_pomeriggio", "Spuntino pomeriggio"], ["cena", "Cena"]],
  UNITS: ["g", "ml", "pz", "cucchiaio", "cucchiaino", "fetta", "porzione"],
  PLURAL: { cucchiaio: "cucchiai", cucchiaino: "cucchiaini", fetta: "fette", porzione: "porzioni" },
  KINDS: { food: "Alimento", dish: "Piatto", meal: "Pasto" },
  HABIT_NAME: "Dieta rispettata",

  // ---------- helper ----------
  slotLabel(k) { return (this.SLOTS.find(([s]) => s === k) || [k, k])[1]; },
  slotIdx(k) { return this.SLOTS.findIndex(([s]) => s === k); },
  sel() { return this.day || U.today(); },

  // Il pasto "di adesso", per aggiungere al volo un fuori programma
  currentSlot() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    return h < 10 ? "colazione" : h < 12 ? "spuntino_mattina" : h < 15.5 ? "pranzo" : h < 18.5 ? "spuntino_pomeriggio" : "cena";
  },

  qtyText(qty, unit) {
    if (qty == null || qty === "") return unit && unit !== "porzione" ? U.esc(unit) : "";
    const n = Number(qty);
    const u = unit ? (n !== 1 && this.PLURAL[unit] ? this.PLURAL[unit] : unit) : "";
    return `${U.num(n, 2)}${u ? " " + U.esc(u) : ""}`;
  },

  norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); },

  entriesOn(date, slot) {
    return Store.d.meal_entries
      .filter((e) => e.entry_date === date && (!slot || e.slot === slot))
      .sort((a, b) => this.slotIdx(a.slot) - this.slotIdx(b.slot) || a.position - b.position || a.created_at.localeCompare(b.created_at));
  },

  nextPos(date, slot) {
    const ps = Store.d.meal_entries.filter((e) => e.entry_date === date && e.slot === slot).map((e) => e.position || 0);
    return ps.length ? Math.max(...ps) + 1 : 0;
  },

  // null = niente in programma; true = tutti i pasti previsti mangiati; false = non ancora
  dayState(date) {
    const planned = Store.d.meal_entries.filter((e) => e.entry_date === date && !e.extra);
    if (!planned.length) return null;
    return planned.every((e) => e.eaten);
  },

  dayDot(date) {
    const list = Store.d.meal_entries.filter((e) => e.entry_date === date && !e.extra);
    if (!list.length) return "";
    const n = list.filter((e) => e.eaten).length;
    return n === list.length ? "done" : n ? "part" : "plan";
  },

  // Ingredienti di un piatto, scalati sulle porzioni
  itemsText(items, mult = 1) {
    return (items || []).map((i) => `${U.esc(i.name)}${i.qty != null && i.qty !== "" ? " " + this.qtyText(Number(i.qty) * mult, i.unit) : i.unit ? " " + U.esc(i.unit) : ""}`).join(", ");
  },

  entrySub(e) {
    if (!e.items || !e.items.length) return "";
    return this.itemsText(e.items, e.unit === "porzione" ? Number(e.qty) || 1 : 1);
  },

  foodSub(f) {
    if (f.kind === "dish") return this.itemsText(f.items) || "nessun ingrediente";
    if (f.kind === "meal") return (f.items || []).map((i) => `${U.esc(i.name)}${i.qty != null ? " " + this.qtyText(i.qty, i.unit) : ""}`).join(", ") || "vuoto";
    return this.qtyText(f.qty, f.unit);
  },

  usage() {
    const m = new Map();
    for (const e of Store.d.meal_entries) if (e.food_id) m.set(e.food_id, (m.get(e.food_id) || 0) + 1);
    return m;
  },

  sortedFoods() {
    return [...Store.d.foods].sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name, "it"));
  },

  // Righe del piano che nascono da una voce del ricettario (un pasto salvato si apre nelle sue righe)
  rowsFrom(food, over = null) {
    if (food.kind === "meal") return (food.items || []).map((i) => ({ food_id: i.food_id || null, name: i.name, qty: i.qty ?? null, unit: i.unit || null, items: i.items || [] }));
    if (food.kind === "dish") return [{ food_id: food.id, name: food.name, qty: over && over.qty != null ? over.qty : 1, unit: "porzione", items: food.items || [] }];
    return [{ food_id: food.id, name: food.name, qty: over && over.qty != null ? over.qty : food.qty ?? null, unit: over && over.unit ? over.unit : food.unit || null, items: [] }];
  },

  core(e) { return { food_id: e.food_id || null, name: e.name, qty: e.qty ?? null, unit: e.unit || null, items: e.items || [] }; },

  // "salmone 150 g", "2 uova", "150g di pollo" -> { name, qty, unit }
  parseQuick(text) {
    const units = { g: "g", gr: "g", grammi: "g", ml: "ml", pz: "pz", pezzi: "pz", pezzo: "pz", cucchiaio: "cucchiaio", cucchiai: "cucchiaio",
      cucchiaino: "cucchiaino", cucchiaini: "cucchiaino", fetta: "fetta", fette: "fetta", porzione: "porzione", porzioni: "porzione" };
    const t = String(text || "").trim().replace(/\s+/g, " ");
    const U_RE = "(g|gr|grammi|ml|pz|pezzi|pezzo|cucchiai|cucchiaio|cucchiaini|cucchiaino|fette|fetta|porzioni|porzione)";
    let m = t.match(new RegExp(`^(.+?)[ ,]+(\\d+(?:[.,]\\d+)?) ?${U_RE}?\\.?$`, "i"));
    let name, qty, unit;
    if (m) { name = m[1]; qty = m[2]; unit = m[3]; }
    else if ((m = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?) ?${U_RE}? (?:di |d')?(.+)$`, "i")))) { qty = m[1]; unit = m[2]; name = m[3]; }
    else return { name: t, qty: null, unit: null };
    qty = Number(String(qty).replace(",", "."));
    unit = unit ? units[unit.toLowerCase()] : qty >= 10 ? "g" : "pz";
    return { name: name.trim(), qty, unit };
  },

  // ---------- scritture ----------
  // Scrive righe nel piano. replace: "slot" | "day" | null = cosa svuotare prima nei giorni che ricevono righe
  write(rows, replace = null) {
    if (!rows.length) return U.toast("Niente da copiare");
    let del = [];
    if (replace) {
      const keys = new Set(rows.map((r) => replace === "slot" ? `${r.entry_date}|${r.slot}` : r.entry_date));
      del = Store.d.meal_entries.filter((e) => keys.has(replace === "slot" ? `${e.entry_date}|${e.slot}` : e.entry_date)).map((e) => e.id);
    }
    Store.removeMany("meal_entries", del);
    const pos = {};
    const full = rows.map((r) => {
      const k = `${r.entry_date}|${r.slot}`;
      if (!(k in pos)) pos[k] = this.nextPos(r.entry_date, r.slot);
      return { eaten: false, extra: false, ...r, position: pos[k]++ };
    });
    Store.insertMany("meal_entries", full);
    this.syncHabit(full.map((r) => r.entry_date));
  },

  add(date, slot, food, over = null, extra = false) {
    const rows = this.rowsFrom(food, over).map((r) => ({ ...r, entry_date: date, slot, eaten: extra, extra }));
    if (!rows.length) return U.toast("Questo pasto salvato è vuoto");
    this.write(rows);
  },

  toggle(id) {
    const e = Store.d.meal_entries.find((x) => x.id === id);
    if (!e) return;
    Store.update("meal_entries", id, { eaten: !e.eaten });
    this.syncHabit([e.entry_date]);
  },

  removeEntry(id) {
    const e = Store.d.meal_entries.find((x) => x.id === id);
    if (!e) return;
    Store.remove("meal_entries", id);
    this.syncHabit([e.entry_date]);
  },

  // ---------- abitudine "Dieta rispettata" ----------
  // Si crea da sola la prima volta che c'è un piano; se poi la archivi o la elimini, non torna.
  habit() {
    const id = Store.cfg().dietHabit;
    if (!id) return null;
    return Store.d.habits.find((h) => h.id === id && !h.archived) || null;
  },

  ensureHabit(date) {
    if (Store.cfg().dietHabit) return this.habit();
    let h = Store.d.habits.find((x) => !x.archived && x.name === this.HABIT_NAME);
    if (!h) h = Store.insert("habits", { name: this.HABIT_NAME, area: "salute", kind: "check", target: 1, step: 1, unit: null,
      days: [1, 2, 3, 4, 5, 6, 7], goal_id: null, start_date: date < U.today() ? date : U.today(), archived: false });
    Store.setSettings({ dietHabit: h.id });
    return h;
  },

  syncHabit(dates) {
    const today = U.today();
    for (const d of [...new Set(dates)]) {
      if (d > today) continue;
      const st = this.dayState(d);
      let h = this.habit();
      if (!h && st !== null) h = this.ensureHabit(d);
      if (!h) continue;
      const want = st ? 1 : 0, cur = Store.logIdx.get(`${h.id}|${d}`) || 0;
      if (cur !== want) Store.setLog(h.id, d, want);
    }
  },

  // ---------- obiettivo collegato (es. "Arrivare a 72 kg") ----------
  // Quello scelto in Impostazioni, altrimenti il primo obiettivo di peso attivo.
  // Non entra nella percentuale dell'obiettivo (che resta sul peso): si mostra accanto.
  goal() {
    const id = Store.cfg().dietGoal, act = Calc.activeGoals();
    return (id && act.find((g) => g.id === id)) || act.find((g) => g.weight_linked) || null;
  },

  // Giorni con un piano e quanti rispettati (oggi conta solo se già completo)
  adherence(from, to = U.today()) {
    const today = U.today();
    let planned = 0, ok = 0;
    for (const d of U.range(from, to < today ? to : today)) {
      const st = this.dayState(d);
      if (st === null || (d === today && !st)) continue;
      planned++;
      if (st) ok++;
    }
    return { planned, ok };
  },

  goalFrom(g) { return g.horizon === "recurring" ? Calc.periodRange(g.period)[0] : g.start_date; },

  bannerHTML() {
    const g = this.goal();
    if (!g) return "";
    const cfg = Store.cfg(), latest = Calc.latestWeight(), pct = Calc.weightProgress(g);
    const a = this.adherence(this.goalFrom(g)), h = this.habit(), streak = h ? Calc.streak(h) : 0;
    return `<div class="goal-banner food-banner" data-act="goal-open" data-id="${g.id}" role="button">
      <div><b>${U.esc(g.title)}</b><span>${latest ? `${U.num(latest.kg)} kg` : "nessuna pesata"}${cfg.weightTarget != null ? ` → ${U.num(cfg.weightTarget)} kg` : ""}</span></div>
      ${pct != null ? Charts.bar({ value: pct, color: "var(--orange-500)", h: 6 }) : ""}
      <p class="gb-sub">${a.planned ? `Dieta rispettata ${a.ok}/${a.planned} giorni` : "Pianifica i pasti e spuntali mentre mangi"}${streak >= 1 ? ` · ${Icon.svg("flame", 13)} serie ${streak}` : ""}</p>
    </div>`;
  },

  // Blocco nella scheda dell'obiettivo collegato
  goalBlockHTML(g) {
    const fg = this.goal();
    if (!fg || fg.id !== g.id) return "";
    const from = this.goalFrom(g), a = this.adherence(from), h = this.habit();
    const pct = a.planned ? (a.ok / a.planned) * 100 : 0;
    return `<div class="block">
      <div class="block-head"><h3>Alimentazione</h3><span class="muted small">${a.planned ? Math.round(pct) + "% dei giorni" : "–"}</span></div>
      ${a.planned ? Charts.bar({ value: pct, color: "var(--blue-500)", h: 8 }) : ""}
      <p class="muted small">${a.planned ? `Dieta rispettata <b>${a.ok} giorni su ${a.planned}</b> dal ${U.fmtShort(from)}${h && Calc.streak(h) ? ` · serie attuale ${Calc.streak(h)}` : ""}. Non cambia la percentuale dell'obiettivo, che resta sul peso: serve a leggerla.`
        : "Nessun giorno pianificato da quando è iniziato l'obiettivo."}</p>
      <div class="btn-row"><button class="btn ghost sm" data-act="go" data-id="food" data-close="1">${Icon.svg("bowl", 14)} Vai ad Alimentazione</button></div>
    </div>`;
  },

  // ---------- pagina ----------
  render(el) {
    const head = { plan: ["Il tuo <em>piano</em>"], book: ["Il tuo <em>ricettario</em>"], templates: ["I tuoi <em>modelli</em>"] }[this.tab];
    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">食事 · Alimentazione</p><h1 class="title">${head[0]}</h1></div>
        <button class="btn primary" data-act="food-new">${Icon.svg("plus", 18)}<span>Ricettario</span></button>
      </div>
      ${this.bannerHTML()}
      <div class="seg tabs4 food-tabs">${[["plan", "Piano"], ["book", "Ricettario"], ["templates", "Modelli"]].map(([k, l]) =>
        `<button class="${this.tab === k ? "on" : ""}" data-act="food-tab" data-id="${k}">${l}</button>`).join("")}</div>
      <div class="food-pane">${this[this.tab + "HTML"]()}</div>`;
  },

  weekLabel(mon) {
    const a = U.parse(mon), b = U.parse(U.addDays(mon, 6));
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${U.MONTHS[b.getMonth()]}` : `${U.fmtShort(mon)} – ${U.fmtShort(U.addDays(mon, 6))}`;
  },

  planHTML() {
    const day = this.sel(), today = U.today(), mon = U.mondayOf(day);
    const days = U.range(mon, U.addDays(mon, 6));
    const d = U.parse(day);
    return `
      <div class="food-week">
        <button class="icon-btn" data-act="food-week" data-dir="-1" aria-label="Settimana precedente">${Icon.svg("left", 20)}</button>
        <div class="fw-mid"><b>${this.weekLabel(mon)}</b>${U.mondayOf(today) !== mon ? `<button class="link" data-act="food-day" data-id="${today}">Oggi</button>` : ""}</div>
        <button class="icon-btn" data-act="food-week" data-dir="1" aria-label="Settimana successiva">${Icon.svg("right", 20)}</button>
      </div>
      <div class="day-strip">${days.map((x) => `<button class="${x === day ? "on" : ""} ${x === today ? "today" : ""}" data-act="food-day" data-id="${x}" aria-label="${U.fmtLong(x)}">
        <span>${U.DOW_SHORT[U.dow(x) - 1]}</span><b>${U.parse(x).getDate()}</b><i class="fd ${this.dayDot(x)}"></i></button>`).join("")}</div>
      <div class="day-title">
        <h2>${U.DOW_NAMES[d.getDay()]} ${d.getDate()} ${U.MONTHS_LONG[d.getMonth()]}</h2>
        <button class="btn ghost sm" data-act="food-day-menu">${Icon.svg("copy", 15)} Copia e modelli</button>
      </div>
      <div class="meals">${this.SLOTS.map(([k, l]) => this.slotHTML(day, k, l)).join("")}</div>`;
  },

  slotHTML(date, slot, label) {
    const list = this.entriesOn(date, slot);
    return `<section class="card meal-card">
      <div class="block-head"><h3>${label}</h3>
        ${list.length ? `<button class="icon-btn sm" data-act="food-slot-menu" data-slot="${slot}" aria-label="Azioni ${label}">${Icon.svg("dots", 18)}</button>` : ""}</div>
      ${list.length ? `<ul class="meal-list">${list.map((e) => this.entryHTML(e)).join("")}</ul>` : ""}
      <button class="link meal-add" data-act="food-pick" data-date="${date}" data-slot="${slot}">${Icon.svg("plus", 14)} Aggiungi</button>
    </section>`;
  },

  entryHTML(e) {
    const sub = this.entrySub(e);
    return `<li class="${e.eaten ? "eaten" : ""}">
      <button class="round sm ${e.eaten ? "on" : ""}" data-act="food-toggle" data-id="${e.id}" aria-label="${e.eaten ? "Segna come non mangiato" : "Segna come mangiato"}">${Icon.svg("check", 14)}</button>
      <span class="me-main" data-act="food-entry" data-id="${e.id}" role="button"><b>${U.esc(e.name)}${e.extra ? ` <i class="tag-extra">fuori programma</i>` : ""}</b>${sub ? `<small>${sub}</small>` : ""}</span>
      <span class="me-qty">${this.qtyText(e.qty, e.unit)}</span>
    </li>`;
  },

  bookHTML() {
    const all = this.sortedFoods();
    const list = all.filter((f) => this.bookFilter === "all" || f.kind === this.bookFilter);
    const uses = this.usage();
    return `
      <div class="chips-row filters">${[["all", "Tutto"], ["food", "Alimenti"], ["dish", "Piatti"], ["meal", "Pasti salvati"]].map(([k, l]) =>
        `<button class="pill ${this.bookFilter === k ? "on" : ""}" data-act="food-filter" data-id="${k}">${l}</button>`).join("")}</div>
      ${list.length ? `<div class="card stack"><ul class="food-book">${list.map((f) => `<li>
        <button class="icon-btn sm star ${f.favorite ? "on" : ""}" data-act="food-fav" data-id="${f.id}" aria-label="${f.favorite ? "Togli dai preferiti" : "Metti tra i preferiti"}">${Icon.svg("star", 16)}</button>
        <span data-act="food-edit" data-id="${f.id}" role="button"><b>${U.esc(f.name)}</b><small>${this.KINDS[f.kind]}${f.kind === "food" ? "" : " · "}${f.kind === "food" ? (f.qty != null || f.unit ? " · " + this.foodSub(f) : "") : this.foodSub(f)}</small></span>
        ${uses.get(f.id) ? `<span class="muted small">${uses.get(f.id)}×</span>` : ""}
      </li>`).join("")}</ul></div>`
        : UI.empty("bowl", all.length ? "Niente in questa categoria" : "Il ricettario è vuoto",
          "Aggiungi alimenti e piatti che mangi spesso: poi li metti nel piano con un tocco. Puoi anche scriverli direttamente quando pianifichi un pasto.",
          `<button class="btn primary" data-act="food-new">Aggiungi al ricettario</button>`)}`;
  },

  templatesHTML() {
    const list = [...Store.d.meal_templates].sort((a, b) => a.name.localeCompare(b.name, "it"));
    return list.length ? `<div class="list">${list.map((t) => `<article class="row-card">
        <div class="row-main"><h3>${U.esc(t.name)}</h3><p class="muted">${t.kind === "week" ? "Settimana" : "Giorno"} · ${t.entries.length} ${t.entries.length === 1 ? "elemento" : "elementi"}</p></div>
        <div class="row-side">
          <button class="btn primary sm" data-act="food-tpl-apply" data-id="${t.id}">Applica</button>
          <button class="icon-btn sm" data-act="food-tpl-rename" data-id="${t.id}" aria-label="Rinomina">${Icon.svg("edit", 16)}</button>
          <button class="icon-btn sm" data-act="food-tpl-delete" data-id="${t.id}" aria-label="Elimina">${Icon.svg("trash", 16)}</button>
        </div></article>`).join("")}</div>`
      : UI.empty("copy", "Nessun modello", "Pianifica un giorno o una settimana, poi da «Copia e modelli» salvala come modello: la riapplichi su altre date in un tocco.",
        `<button class="btn primary" data-act="food-tab" data-id="plan">Vai al piano</button>`);
  },

  // ---------- Oggi ----------
  todayHTML() {
    const today = U.today(), list = this.entriesOn(today);
    const planned = list.filter((e) => !e.extra), eaten = planned.filter((e) => e.eaten).length;
    const st = this.dayState(today);
    return `<section class="block area-food">
      <div class="block-head"><h2>Cosa mangi oggi</h2><button class="link" data-act="go" data-id="food">Piano ${Icon.svg("right", 14)}</button></div>
      ${list.length ? `<div class="card food-today">
        ${this.SLOTS.filter(([k]) => list.some((e) => e.slot === k)).map(([k, l]) => `<p class="ft-slot">${l}</p>
          <ul class="meal-list">${list.filter((e) => e.slot === k).map((e) => this.entryHTML(e)).join("")}</ul>`).join("")}
        <div class="ft-foot">
          <span class="muted small">${planned.length ? (st ? `${Icon.svg("check", 13)} Dieta rispettata` : `${eaten}/${planned.length} mangiati`) : ""}</span>
          <button class="btn ghost sm" data-act="food-extra">${Icon.svg("plus", 14)} Fuori programma</button>
        </div>
      </div>` : `<div class="card food-today empty-sm"><p class="muted small">Niente in programma per oggi.</p>
        <div class="btn-row"><button class="btn primary sm" data-act="go" data-id="food">Pianifica</button><button class="btn ghost sm" data-act="food-extra">${Icon.svg("plus", 14)} Segna cosa hai mangiato</button></div></div>`}
    </section>`;
  },

  // ---------- selettore rapido ----------
  openPicker(date, slot, extra = false) {
    this.pick = { date, slot, extra, q: "", added: {} };
    Sheet.open({
      title: extra ? "Fuori programma" : "Aggiungi",
      wide: true,
      body: `<div class="picker">
        <div class="chips-row filters pick-slots" id="pick-slots"></div>
        <input class="pick-search" id="pick-q" type="search" autocomplete="off" autofocus placeholder="Cerca, o scrivi «salmone 150 g»" data-act-input="food-q">
        <div id="pick-now"></div>
        <div id="pick-list" class="pick-list"></div>
      </div>`,
      onMount: (root) => {
        this.refreshPicker();
        root.querySelector("#pick-q").addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const first = root.querySelector("#pick-list [data-act=food-pick-add], #pick-list [data-act=food-pick-new]");
          if (first) first.click();
        });
      },
      onClose: () => { this.pick = null; }
    });
  },

  refreshPicker() {
    const p = this.pick;
    if (!p || !Sheet.isOpen()) return;
    const root = Sheet.el;
    const slots = root.querySelector("#pick-slots");
    if (!slots) return;
    slots.innerHTML = this.SLOTS.map(([k, l]) => `<button class="pill ${p.slot === k ? "on" : ""}" data-act="food-pick-slot" data-id="${k}">${l}</button>`).join("");
    const on = slots.querySelector(".on");
    if (on) slots.scrollLeft = on.offsetLeft - slots.clientWidth / 2 + on.offsetWidth / 2;
    const now = this.entriesOn(p.date, p.slot);
    root.querySelector("#pick-now").innerHTML = `<p class="pick-now"><b>${this.slotLabel(p.slot)} · ${U.fmtShort(p.date)}</b>${now.length ? ": " + now.map((e) => `${U.esc(e.name)} ${this.qtyText(e.qty, e.unit)}`).join(", ") : " · ancora vuoto"}</p>`;
    root.querySelector("#pick-list").innerHTML = this.pickListHTML();
  },

  pickRow(f, over) {
    const n = this.pick.added[f.id] || 0;
    const sub = over && over.qty != null && f.kind !== "meal" ? this.qtyText(over.qty, f.kind === "dish" ? "porzione" : over.unit) : this.foodSub(f);
    return `<button class="pick-row ${n ? "added" : ""}" data-act="food-pick-add" data-id="${f.id}">
      <span><b>${U.esc(f.name)}</b><small>${f.kind === "food" ? "" : this.KINDS[f.kind] + " · "}${sub}</small></span>
      ${n ? `<i class="pk-n">${n}×</i>` : ""}<i class="pk-plus">${Icon.svg(n ? "check" : "plus", 16)}</i></button>`;
  },

  pickListHTML() {
    const p = this.pick, foods = this.sortedFoods();
    if (p.q.trim()) {
      const parsed = this.parseQuick(p.q), q = this.norm(parsed.name);
      const hits = foods.filter((f) => this.norm(f.name).includes(q)).slice(0, 20);
      const exact = foods.some((f) => this.norm(f.name) === q);
      const over = parsed.qty != null ? parsed : null;
      return `${hits.map((f) => this.pickRow(f, over)).join("")}
        ${!exact && parsed.name ? `<div class="pick-new">
          <button class="btn primary sm" data-act="food-pick-new" data-save="1">${Icon.svg("plus", 14)} «${U.esc(parsed.name)}»${parsed.qty != null ? " " + this.qtyText(parsed.qty, parsed.unit) : ""} e salva nel ricettario</button>
          <button class="btn ghost sm" data-act="food-pick-new">Solo per questo pasto</button></div>` : ""}`;
    }
    if (!foods.length) return `<p class="muted small pick-hint">Il ricettario è vuoto. Scrivi qui sopra cosa mangi, per esempio «uova 2 pz» o «salmone 150 g»: lo aggiungo al pasto e lo salvo per le prossime volte.</p>`;
    const uses = this.usage();
    const top = foods.filter((f) => uses.get(f.id)).sort((a, b) => uses.get(b.id) - uses.get(a.id)).slice(0, 6);
    const topIds = new Set(top.map((f) => f.id));
    const sec = (title, list) => list.length ? `<p class="pick-sec">${title}</p>${list.map((f) => this.pickRow(f)).join("")}` : "";
    const rest = foods.filter((f) => !topIds.has(f.id));
    return sec("Più usati", top) + sec("Pasti salvati", rest.filter((f) => f.kind === "meal")) +
      sec("Piatti", rest.filter((f) => f.kind === "dish")) + sec("Alimenti", rest.filter((f) => f.kind === "food"));
  },

  pickAdd(id) {
    const p = this.pick, f = Store.d.foods.find((x) => x.id === id);
    if (!p || !f) return;
    const parsed = p.q.trim() ? this.parseQuick(p.q) : null;
    this.add(p.date, p.slot, f, parsed && parsed.qty != null ? parsed : null, p.extra);
    p.added[id] = (p.added[id] || 0) + 1;
    U.toast(`${f.name} → ${this.slotLabel(p.slot)}`);
    this.clearQuery();
  },

  pickNew(save) {
    const p = this.pick;
    if (!p) return;
    const parsed = this.parseQuick(p.q);
    if (!parsed.name) return;
    const name = parsed.name.charAt(0).toUpperCase() + parsed.name.slice(1);
    let food = null;
    if (save) food = Store.insert("foods", { kind: "food", name, qty: parsed.qty, unit: parsed.unit, items: [], favorite: false });
    const row = food ? this.rowsFrom(food)[0] : { food_id: null, name, qty: parsed.qty, unit: parsed.unit, items: [] };
    this.write([{ ...row, entry_date: p.date, slot: p.slot, eaten: p.extra, extra: p.extra }]);
    U.toast(`${name} → ${this.slotLabel(p.slot)}`);
    this.clearQuery();
  },

  clearQuery() {
    if (!this.pick) return;
    this.pick.q = "";
    const q = Sheet.el && Sheet.el.querySelector("#pick-q");
    if (q) { q.value = ""; if (window.innerWidth >= 1024) q.focus(); }
    this.refreshPicker();
  },

  // ---------- modifica di una riga del piano ----------
  openEntry(id) {
    const e = Store.d.meal_entries.find((x) => x.id === id);
    if (!e) return;
    Sheet.open({
      title: e.name,
      body: `<form class="form" id="entry-form">
        <label>Cosa<input name="name" maxlength="80" required value="${U.esc(e.name)}"></label>
        <div class="row2"><label>Quantità<input name="qty" type="number" step="any" min="0" inputmode="decimal" value="${e.qty ?? ""}"></label>
          <label>Unità<select name="unit"><option value="">—</option>${this.UNITS.map((u) => `<option ${u === e.unit ? "selected" : ""}>${u}</option>`).join("")}</select></label></div>
        ${e.items && e.items.length ? `<p class="muted small">Ingredienti: ${this.entrySub(e)}</p>` : ""}
        <div class="row2"><label>Pasto<select name="slot">${this.SLOTS.map(([k, l]) => `<option value="${k}" ${k === e.slot ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label>Giorno<input name="date" type="date" value="${e.entry_date}" required></label></div>
        <label class="check"><input name="eaten" type="checkbox" ${e.eaten ? "checked" : ""}><span><b>Mangiato</b></span></label>
        <div class="btn-row"><button class="btn primary" type="submit">Salva</button>
          <button class="btn ghost danger" type="button" data-act="food-entry-delete" data-id="${e.id}" data-close="1">${Icon.svg("trash", 16)} Togli dal piano</button></div>
      </form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        form.addEventListener("submit", (ev) => {
          ev.preventDefault();
          const f = new FormData(form);
          const qty = f.get("qty") === "" ? null : Number(String(f.get("qty")).replace(",", "."));
          const date = f.get("date") || e.entry_date, slot = f.get("slot");
          const patch = { name: (f.get("name") || "").trim() || e.name, qty, unit: f.get("unit") || null, eaten: f.get("eaten") === "on", entry_date: date, slot };
          if (date !== e.entry_date || slot !== e.slot) patch.position = this.nextPos(date, slot);
          const old = e.entry_date;
          Store.update("meal_entries", e.id, patch);
          this.syncHabit([old, date]);
          Sheet.close();
        });
      }
    });
  },

  // ---------- ricettario: modulo ----------
  ingRow(i = {}) {
    return `<div class="ing-row">
      <input name="ing-name" maxlength="60" placeholder="Ingrediente" list="food-names" value="${U.esc(i.name || "")}">
      <input name="ing-qty" type="number" step="any" min="0" inputmode="decimal" placeholder="Q.tà" value="${i.qty ?? ""}">
      <select name="ing-unit">${this.UNITS.filter((u) => u !== "porzione").map((u) => `<option ${u === (i.unit || "g") ? "selected" : ""}>${u}</option>`).join("")}</select>
      <button type="button" class="icon-btn sm" data-ing-del aria-label="Togli">${Icon.svg("x", 16)}</button></div>`;
  },

  mealRow(i) {
    return `<div class="ing-row meal-row" data-item='${U.esc(JSON.stringify(i))}'>
      <span class="mr-name">${U.esc(i.name)}</span>
      <input name="ing-qty" type="number" step="any" min="0" inputmode="decimal" value="${i.qty ?? ""}">
      <span class="mr-unit">${U.esc(i.unit || "")}</span>
      <button type="button" class="icon-btn sm" data-ing-del aria-label="Togli">${Icon.svg("x", 16)}</button></div>`;
  },

  openForm(id = null, kind = "food") {
    const f = id ? Store.d.foods.find((x) => x.id === id) : null;
    if (f) kind = f.kind;
    const others = this.sortedFoods().filter((x) => x.kind !== "meal" && (!f || x.id !== f.id));
    Sheet.open({
      title: f ? f.name : "Nel ricettario",
      wide: true,
      body: `<form class="form" id="food-form">
        ${f ? "" : UI.seg("kind", [["food", "Alimento"], ["dish", "Piatto"]], kind)}
        <label>Nome<input name="name" maxlength="80" required autofocus value="${U.esc(f ? f.name : "")}" placeholder="${kind === "dish" ? "Es. Frittata di zucchine" : kind === "meal" ? "Es. Colazione keto A" : "Es. Salmone"}"></label>
        <div class="k-food" ${kind === "food" ? "" : "hidden"}>
          <div class="row2"><label>Quantità abituale<input name="qty" type="number" step="any" min="0" inputmode="decimal" value="${f && f.kind === "food" ? f.qty ?? "" : ""}" placeholder="150"></label>
            <label>Unità<select name="unit">${this.UNITS.filter((u) => u !== "porzione").map((u) => `<option ${u === (f && f.unit || "g") ? "selected" : ""}>${u}</option>`).join("")}</select></label></div>
        </div>
        <div class="field k-dish" ${kind === "dish" ? "" : "hidden"}><span class="lbl">Ingredienti per una porzione</span>
          <div class="ing-rows" id="ing-rows">${(f && f.kind === "dish" ? f.items : [{}, {}]).map((i) => this.ingRow(i)).join("")}</div>
          <button type="button" class="link" id="ing-add">${Icon.svg("plus", 14)} Ingrediente</button>
          <datalist id="food-names">${others.filter((x) => x.kind === "food").map((x) => `<option value="${U.esc(x.name)}">`).join("")}</datalist>
        </div>
        ${kind === "meal" ? `<div class="field"><span class="lbl">Cosa c'è nel pasto</span>
          <div class="ing-rows" id="meal-rows">${(f.items || []).map((i) => this.mealRow(i)).join("")}</div>
          ${others.length ? `<select id="meal-add"><option value="">Aggiungi dal ricettario…</option>${others.map((x) => `<option value="${x.id}">${U.esc(x.name)}</option>`).join("")}</select>` : ""}
        </div>` : ""}
        <label class="check"><input name="favorite" type="checkbox" ${f && f.favorite ? "checked" : ""}><span><b>Preferito</b><small>Compare in cima quando aggiungi ai pasti.</small></span></label>
        <div class="btn-row"><button class="btn primary" type="submit">Salva</button>
          ${f ? `<button class="btn ghost danger" type="button" data-act="food-delete" data-id="${f.id}">${Icon.svg("trash", 16)} Elimina</button>` : ""}</div>
      </form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        UI.wire(form, (name, v) => {
          if (name !== "kind") return;
          form.querySelector(".k-food").hidden = v !== "food";
          form.querySelector(".k-dish").hidden = v !== "dish";
        });
        form.addEventListener("click", (e) => { const d = e.target.closest("[data-ing-del]"); if (d) d.parentElement.remove(); });
        const add = form.querySelector("#ing-add");
        if (add) add.addEventListener("click", () => {
          form.querySelector("#ing-rows").insertAdjacentHTML("beforeend", this.ingRow());
          form.querySelector("#ing-rows .ing-row:last-child input").focus();
        });
        const madd = form.querySelector("#meal-add");
        if (madd) madd.addEventListener("change", () => {
          const x = Store.d.foods.find((y) => y.id === madd.value);
          if (x) form.querySelector("#meal-rows").insertAdjacentHTML("beforeend", this.mealRow(this.rowsFrom(x)[0]));
          madd.value = "";
        });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const k = f ? f.kind : fd.get("kind") || "food";
          const num = (v) => v === "" || v == null ? null : Number(String(v).replace(",", "."));
          const row = { kind: k, name: (fd.get("name") || "").trim(), favorite: fd.get("favorite") === "on" };
          if (!row.name) return;
          if (k === "food") Object.assign(row, { qty: num(fd.get("qty")), unit: fd.get("unit") || null, items: [] });
          if (k === "dish") Object.assign(row, { qty: 1, unit: "porzione", items: [...form.querySelectorAll("#ing-rows .ing-row")].map((r) => ({
            name: r.querySelector("[name=ing-name]").value.trim(), qty: num(r.querySelector("[name=ing-qty]").value), unit: r.querySelector("[name=ing-unit]").value })).filter((i) => i.name) });
          if (k === "meal") row.items = [...form.querySelectorAll("#meal-rows .meal-row")].map((r) => ({ ...JSON.parse(r.dataset.item), qty: num(r.querySelector("[name=ing-qty]").value) }));
          if (f) Store.update("foods", f.id, row); else Store.insert("foods", row);
          Sheet.close();
          // La quantità aggiunta nel ricettario arriva anche alle pietanze in programma che non ne hanno ancora una
          const todo = f && k === "food" && row.qty != null
            ? Store.d.meal_entries.filter((e) => e.food_id === f.id && e.entry_date >= U.today() && e.qty == null) : [];
          todo.forEach((e) => Store.update("meal_entries", e.id, { qty: row.qty, unit: row.unit }));
          U.toast(todo.length ? `Quantità aggiunta anche a ${todo.length} ${todo.length === 1 ? "pietanza" : "pietanze"} in programma` : f ? "Ricettario aggiornato" : "Aggiunto al ricettario");
        });
      }
    });
  },

  // ---------- menu di copia e modelli ----------
  menu(title, items) {
    Sheet.open({ title, body: `<div class="menu-list">${items.map(([ic, l, act, extra = ""]) =>
      `<button class="menu-item" data-act="${act}" ${extra}>${Icon.svg(ic, 20)}<span>${l}</span>${Icon.svg("right", 16)}</button>`).join("")}</div>` });
  },

  dayMenu() {
    const day = this.sel();
    const hasDay = this.entriesOn(day).some((e) => !e.extra);
    const mon = U.mondayOf(day);
    const hasWeek = Store.d.meal_entries.some((e) => !e.extra && e.entry_date >= mon && e.entry_date <= U.addDays(mon, 6));
    const items = [];
    if (hasDay) items.push(["copy", "Copia questo giorno su altre date", "food-copy", `data-kind="day"`]);
    if (hasWeek) items.push(["copy", "Copia questa settimana su altre settimane", "food-copy", `data-kind="week"`]);
    if (hasDay) items.push(["star", "Salva il giorno come modello", "food-tpl-save", `data-kind="day"`]);
    if (hasWeek) items.push(["star", "Salva la settimana come modello", "food-tpl-save", `data-kind="week"`]);
    if (Store.d.meal_templates.length) items.push(["download", "Applica un modello", "food-tab", `data-id="templates" data-close="1"`]);
    if (hasDay) items.push(["trash", "Svuota questo giorno", "food-clear-day"]);
    if (!items.length) return U.toast("Pianifica qualcosa o salva un modello: poi potrai copiarlo");
    this.menu(`${U.DOW_NAMES[U.parse(day).getDay()]} ${U.fmtShort(day)}`, items);
  },

  slotMenu(slot) {
    this.menu(this.slotLabel(slot), [
      ["copy", "Copia questo pasto su altri giorni", "food-copy", `data-kind="slot" data-slot="${slot}"`],
      ["star", "Salva come pasto nel ricettario", "food-save-meal", `data-slot="${slot}"`],
      ["trash", "Svuota questo pasto", "food-clear-slot", `data-slot="${slot}"`]
    ]);
  },

  saveMeal(slot) {
    const list = this.entriesOn(this.sel(), slot).filter((e) => !e.extra);
    if (!list.length) return;
    const name = prompt("Nome del pasto", `${this.slotLabel(slot)} ${U.fmtShort(this.sel())}`);
    if (!name || !name.trim()) return;
    Store.insert("foods", { kind: "meal", name: name.trim(), qty: null, unit: null, items: list.map((e) => this.core(e)), favorite: true });
    Sheet.close();
    U.toast("Pasto salvato: lo trovi in cima quando aggiungi");
  },

  saveTemplate(kind) {
    const day = this.sel(), mon = U.mondayOf(day);
    const src = kind === "day" ? this.entriesOn(day) : Store.d.meal_entries.filter((e) => e.entry_date >= mon && e.entry_date <= U.addDays(mon, 6));
    const entries = src.filter((e) => !e.extra).sort((a, b) => a.entry_date.localeCompare(b.entry_date) || this.slotIdx(a.slot) - this.slotIdx(b.slot) || a.position - b.position)
      .map((e) => ({ ...(kind === "week" ? { dow: U.dow(e.entry_date) } : {}), slot: e.slot, ...this.core(e) }));
    if (!entries.length) return;
    const name = prompt("Nome del modello", kind === "day" ? "Giorno tipo" : "Settimana tipo");
    if (!name || !name.trim()) return;
    Store.insert("meal_templates", { name: name.trim(), kind, entries });
    Sheet.close();
    U.toast("Modello salvato");
  },

  // ---------- scelta delle date (copia o modello) ----------
  // mode: "days" (griglia di giorni) | "weeks" (elenco di settimane)
  openTargets({ title, mode, exclude = null, onApply, replaceScope }) {
    this.target = { selected: new Set(), onApply, replaceScope, mode };
    const start = U.mondayOf(this.sel() > U.today() ? this.sel() : U.today());
    let grid;
    if (mode === "days") {
      const days = U.range(start, U.addDays(start, 34));
      grid = `<div class="target-grid">${U.DOW_SHORT.map((l) => `<span class="tg-h">${l}</span>`).join("")}
        ${days.map((d) => `${U.parse(d).getDate() === 1 || d === start ? `<span class="tg-m">${U.MONTHS_LONG[U.parse(d).getMonth()]}</span>${d === start ? "" : U.DOW_SHORT.slice(0, U.dow(d) - 1).map(() => "<span></span>").join("")}` : ""}
          <button type="button" class="${d === exclude ? "src" : ""} ${this.dayDot(d) ? "has" : ""} ${d === U.today() ? "now" : ""}" data-act="food-target" data-id="${d}" aria-label="${U.fmtLong(d)}">${U.parse(d).getDate()}</button>`).join("")}</div>
        <p class="muted small">Il puntino indica i giorni che hanno già qualcosa in programma.</p>`;
    } else {
      const weeks = Array.from({ length: 8 }, (_, i) => U.addDays(start, i * 7));
      grid = `<div class="week-pick">${weeks.map((m) => {
        const has = Store.d.meal_entries.some((e) => e.entry_date >= m && e.entry_date <= U.addDays(m, 6));
        return `<button type="button" class="${m === exclude ? "src" : ""}" data-act="food-target" data-id="${m}"><span>Settimana ${this.weekLabel(m)}</span>${has ? `<small class="muted">già pianificata</small>` : ""}</button>`;
      }).join("")}</div>`;
    }
    Sheet.open({
      title, wide: true,
      body: `<div class="form targets">${grid}
        <label class="check tg-replace"><input type="checkbox" id="tg-replace" checked><span><b>Sostituisci quello che c'è già</b><small>${replaceScope === "slot" ? "Svuota quel pasto nei giorni scelti prima di copiare." : "Svuota i giorni scelti prima di copiare. Se lo togli, aggiungo in coda."}</small></span></label>
        <button class="btn primary wide" id="tg-go" data-act="food-target-go" disabled>Scegli ${mode === "days" ? "i giorni" : "le settimane"}</button></div>`,
      onClose: () => { this.target = null; }
    });
  },

  toggleTarget(el) {
    const t = this.target;
    if (!t) return;
    const id = el.dataset.id;
    if (t.selected.has(id)) t.selected.delete(id); else t.selected.add(id);
    el.classList.toggle("on", t.selected.has(id));
    const go = Sheet.el.querySelector("#tg-go"), n = t.selected.size;
    go.disabled = !n;
    go.textContent = n ? `Applica a ${n} ${t.mode === "days" ? (n === 1 ? "giorno" : "giorni") : (n === 1 ? "settimana" : "settimane")}` : `Scegli ${t.mode === "days" ? "i giorni" : "le settimane"}`;
  },

  applyTargets() {
    const t = this.target;
    if (!t || !t.selected.size) return;
    const replace = Sheet.el.querySelector("#tg-replace").checked ? t.replaceScope : null;
    const rows = t.onApply([...t.selected].sort());
    Sheet.close();
    this.write(rows, replace);
    if (rows.length) U.toast("Fatto");
  },

  copy(kind, slot) {
    const day = this.sel(), mon = U.mondayOf(day);
    if (kind === "week") {
      const src = Store.d.meal_entries.filter((e) => !e.extra && e.entry_date >= mon && e.entry_date <= U.addDays(mon, 6));
      return this.openTargets({ title: `Copia la settimana ${this.weekLabel(mon)}`, mode: "weeks", exclude: mon, replaceScope: "day",
        onApply: (weeks) => weeks.flatMap((w) => src.map((e) => ({ ...this.core(e), entry_date: U.addDays(w, U.diffDays(mon, e.entry_date)), slot: e.slot }))) });
    }
    const src = this.entriesOn(day, kind === "slot" ? slot : null).filter((e) => !e.extra);
    this.openTargets({ title: kind === "slot" ? `Copia ${this.slotLabel(slot).toLowerCase()} del ${U.fmtShort(day)}` : `Copia il ${U.fmtShort(day)}`,
      mode: "days", exclude: day, replaceScope: kind === "slot" ? "slot" : "day",
      onApply: (dates) => dates.flatMap((d) => src.map((e) => ({ ...this.core(e), entry_date: d, slot: e.slot }))) });
  },

  applyTemplate(id) {
    const tpl = Store.d.meal_templates.find((x) => x.id === id);
    if (!tpl) return;
    const strip = (e) => ({ food_id: e.food_id || null, name: e.name, qty: e.qty ?? null, unit: e.unit || null, items: e.items || [], slot: e.slot });
    if (tpl.kind === "week") this.openTargets({ title: `Applica «${tpl.name}»`, mode: "weeks", replaceScope: "day",
      onApply: (weeks) => weeks.flatMap((w) => tpl.entries.map((e) => ({ ...strip(e), entry_date: U.addDays(w, (e.dow || 1) - 1) }))) });
    else this.openTargets({ title: `Applica «${tpl.name}»`, mode: "days", replaceScope: "day",
      onApply: (dates) => dates.flatMap((d) => tpl.entries.map((e) => ({ ...strip(e), entry_date: d }))) });
  },

  clear(slot = null) {
    const day = this.sel();
    if (!confirm(slot ? `Svuotare ${this.slotLabel(slot).toLowerCase()} del ${U.fmtShort(day)}?` : `Svuotare tutto il ${U.fmtShort(day)}?`)) return;
    Store.removeMany("meal_entries", this.entriesOn(day, slot).map((e) => e.id));
    this.syncHabit([day]);
    Sheet.close();
  }
};

Store.on(() => Food.refreshPicker());

Actions["food-tab"] = (el) => { Food.tab = el.dataset.id; App.render(); window.scrollTo(0, 0); };
Actions["food-filter"] = (el) => { Food.bookFilter = el.dataset.id; App.render(); };
Actions["food-week"] = (el) => { Food.day = U.addDays(Food.sel(), 7 * Number(el.dataset.dir)); App.render(); };
Actions["food-day"] = (el) => { Food.day = el.dataset.id; App.render(); };
Actions["food-day-menu"] = () => Food.dayMenu();
Actions["food-slot-menu"] = (el) => Food.slotMenu(el.dataset.slot);
Actions["food-pick"] = (el) => Food.openPicker(el.dataset.date, el.dataset.slot);
Actions["food-extra"] = () => Food.openPicker(U.today(), Food.currentSlot(), true);
Actions["food-quick"] = () => Food.openPicker(U.today(), Food.currentSlot());
Actions["food-q"] = (el) => { if (Food.pick) { Food.pick.q = el.value; Food.refreshPicker(); } };
Actions["food-pick-slot"] = (el) => { if (Food.pick) { Food.pick.slot = el.dataset.id; Food.refreshPicker(); } };
Actions["food-pick-add"] = (el) => Food.pickAdd(el.dataset.id);
Actions["food-pick-new"] = (el) => Food.pickNew(!!el.dataset.save);
Actions["food-toggle"] = (el) => Food.toggle(el.dataset.id);
Actions["food-entry"] = (el) => Food.openEntry(el.dataset.id);
Actions["food-entry-delete"] = (el) => Food.removeEntry(el.dataset.id);
Actions["food-new"] = () => Food.openForm(null, "food");
Actions["food-edit"] = (el) => Food.openForm(el.dataset.id);
Actions["food-fav"] = (el) => { const f = Store.d.foods.find((x) => x.id === el.dataset.id); if (f) Store.update("foods", f.id, { favorite: !f.favorite }); };
Actions["food-delete"] = (el) => {
  if (!confirm("Eliminare dal ricettario? I giorni già pianificati restano come sono.")) return;
  Store.remove("foods", el.dataset.id);
  Sheet.close();
};
Actions["food-copy"] = (el) => Food.copy(el.dataset.kind, el.dataset.slot);
Actions["food-save-meal"] = (el) => Food.saveMeal(el.dataset.slot);
Actions["food-tpl-save"] = (el) => Food.saveTemplate(el.dataset.kind);
Actions["food-tpl-apply"] = (el) => Food.applyTemplate(el.dataset.id);
Actions["food-tpl-rename"] = (el) => {
  const t = Store.d.meal_templates.find((x) => x.id === el.dataset.id);
  const name = t && prompt("Nuovo nome", t.name);
  if (name && name.trim()) Store.update("meal_templates", t.id, { name: name.trim() });
};
Actions["food-tpl-delete"] = (el) => { if (confirm("Eliminare questo modello? I giorni già pianificati restano.")) Store.remove("meal_templates", el.dataset.id); };
Actions["food-target"] = (el) => Food.toggleTarget(el);
Actions["food-target-go"] = () => Food.applyTargets();
Actions["food-clear-day"] = () => Food.clear();
Actions["food-clear-slot"] = (el) => Food.clear(el.dataset.slot);
