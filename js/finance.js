// ============================================================
// Finanze: ogni mese si compila quanto si è speso per ogni voce.
// Vale per uscite ed entrate: stessa tabella, voci diverse (kind "in").
// Le voci stanno in macro aree (come il database di Notion); macro aree e
// voci sono nelle impostazioni (financeGroups, financeCats), gli importi in
// finance_entries: una riga per mese e voce. Voce senza riga = da compilare,
// 0 = compilata, nessuna spesa. La sezione parte spenta (App.OPT_IN).
// Budget e rinnovi stanno nelle impostazioni (financeBudget, financeRenewals):
// un rinnovo è { id, label, amount, day, months }, months vuoto = ogni mese.
// ============================================================
const Finance = {
  month: null,    // primo giorno del mese aperto
  picked: false,  // mese scelto a mano con le frecce
  kind: "out",    // scheda aperta: "out" uscite, "in" entrate

  // ---------- Struttura ----------
  allGroups() {
    const s = Store.settings.financeGroups;
    return Array.isArray(s) ? s : FIN_GROUPS.filter((g) => !g.mine || Auth.isOwner());
  },
  allCats() {
    const s = Store.settings.financeCats;
    return Array.isArray(s) ? s : FIN_CATS.filter((c) => !c.mine || Auth.isOwner());
  },
  groups(kind = "out") { return this.allGroups().filter((g) => (g.kind || "out") === kind); },
  cats(kind = "out") { return this.allCats().filter((c) => (c.kind || "out") === kind); },
  kindOf(id) { const c = this.allCats().find((x) => x.id === id); return c && c.kind === "in" ? "in" : "out"; },
  group(id) {
    const g = this.allGroups().find((x) => x.id === id) || { id: "", label: "Altro", color: "#5F7684" };
    return /^#[0-9A-F]{6}$/i.test(g.color) ? g : { ...g, color: "#5F7684" };
  },
  saveCats(list) { Store.setSettings({ financeCats: list }); },
  saveGroups(list) { Store.setSettings({ financeGroups: list }); },
  newKey: () => "c_" + Math.random().toString(36).slice(2, 10),
  // Tessera con l'icona della voce, nel colore della macro area
  tile(c) {
    const icon = FIN_ICONS.includes(c.icon) ? c.icon : "coin";
    return `<span class="fin-tile" style="--a:${this.group(c.group).color}" aria-hidden="true">${Icon.svg(icon, 19, "", 1.9)}</span>`;
  },

  // ---------- Mesi ----------
  monthNow: () => U.today().slice(0, 8) + "01",
  monthName(m, year = false) { const d = U.parse(m); return U.MONTHS_LONG[d.getMonth()] + (year ? ` ${d.getFullYear()}` : ""); },
  rows(m, kind) { return (Store.d.finance_entries || []).filter((e) => e.month === m && (!kind || this.kindOf(e.category) === kind)); },
  entry(m, cat) { return this.rows(m).find((e) => e.category === cat); },
  // Voci di un mese: quelle attive più le archiviate che in quel mese hanno un importo
  catsFor(m, kind = "out") { const used = new Set(this.rows(m).map((e) => e.category)); return this.cats(kind).filter((c) => !c.off || used.has(c.id)); },
  filled(m, kind = "out") {
    const list = this.catsFor(m, kind), used = new Set(this.rows(m).map((e) => e.category));
    return { done: list.filter((c) => used.has(c.id)).length, total: list.length };
  },
  // Il mese da compilare: quello appena finito finché ha uscite vuote, poi quello in corso
  defaultMonth() {
    const prev = U.addMonths(this.monthNow(), -1), f = this.filled(prev);
    return f.total && f.done >= f.total ? this.monthNow() : prev;
  },
  // Il mese più recente con delle uscite: è quello che mostrano i widget
  lastMonth() {
    const all = (Store.d.finance_entries || []).filter((e) => this.kindOf(e.category) === "out").map((e) => e.month).sort();
    return all.length ? all[all.length - 1] : this.defaultMonth();
  },

  // ---------- Conti ----------
  total(m, kind = "out") { return U.sum(this.rows(m, kind).map((e) => Number(e.amount))); },
  // Entrate meno uscite; null finché il mese non ha entrate (sarebbe solo un numero negativo a caso)
  balance(m) { return this.rows(m, "in").length ? this.total(m, "in") - this.total(m) : null; },
  byGroup(m, kind = "out") {
    const cats = this.allCats(), sum = new Map();
    for (const e of this.rows(m, kind)) {
      const c = cats.find((x) => x.id === e.category), id = c ? c.group : "";
      sum.set(id, (sum.get(id) || 0) + Number(e.amount));
    }
    return [...sum].map(([id, total]) => ({ ...this.group(id), total })).filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
  },
  top(m) {
    const e = this.rows(m, "out").filter((x) => Number(x.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    return e ? { cat: this.allCats().find((c) => c.id === e.category) || { label: "Altro", group: "" }, amount: Number(e.amount) } : null;
  },
  monthsOf(year) { return [...new Set((Store.d.finance_entries || []).filter((e) => e.month.startsWith(year) && this.kindOf(e.category) === "out").map((e) => e.month))].sort(); },
  yearStats(year) {
    const list = this.monthsOf(year).map((m) => ({ m, total: this.total(m) }));
    const total = U.sum(list.map((x) => x.total));
    return { year, total, count: list.length, avg: list.length ? total / list.length : 0, top: list.reduce((a, x) => (!a || x.total > a.total ? x : a), null) };
  },
  // Quanto il mese si scosta dalla media dei mesi precedenti, in %; null se non c'è una media
  vsAverage(m) {
    const before = [...new Set((Store.d.finance_entries || []).filter((e) => e.month < m && this.kindOf(e.category) === "out").map((e) => e.month))];
    const avg = U.avg(before.map((x) => this.total(x)));
    return avg ? Math.round(((this.total(m) - avg) / avg) * 100) : null;
  },
  groupTotal(m, id) { const g = this.byGroup(m).find((x) => x.id === id); return g ? g.total : 0; },
  groupYear(year, id) { return U.sum(this.monthsOf(year).map((m) => this.groupTotal(m, id))); },
  // L'ultimo mese con sia entrate sia uscite: l'unico per cui il saldo vuol dire qualcosa
  lastBalanced() { return [...new Set((Store.d.finance_entries || []).map((e) => e.month))].sort().reverse().find((m) => this.rows(m, "in").length && this.rows(m, "out").length) || null; },
  saving(m) { const t = this.total(m, "in"); return t > 0 ? Math.round((this.balance(m) / t) * 100) : null; },
  budget() { const b = Number(Store.settings.financeBudget); return b > 0 ? b : null; },

  // ---------- Rinnovi ----------
  renewals() { return Array.isArray(Store.settings.financeRenewals) ? Store.settings.financeRenewals : []; },
  yearCost(r) { return Number(r.amount) * ((r.months || []).length || 12); },
  yearCosts() { return U.sum(this.renewals().map((r) => this.yearCost(r))); },
  // Prossimo addebito da oggi in poi; il giorno si adatta ai mesi più corti
  nextDate(r, today = U.today()) {
    const first = today.slice(0, 8) + "01";
    for (let i = 0; i < 14; i++) {
      const m = U.addMonths(first, i), d = U.parse(m), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if ((r.months || []).length && !r.months.includes(d.getMonth() + 1)) continue;
      const date = m.slice(0, 8) + U.pad(Math.min(Number(r.day) || 1, last));
      if (date >= today) return date;
    }
    return null;
  },
  upcoming(today) { return this.renewals().map((r) => ({ ...r, date: this.nextDate(r, today) })).filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date)); },

  series(n, end) { return Array.from({ length: n }, (_, i) => { const m = U.addMonths(end, i - n + 1); return { m, total: this.total(m), income: this.total(m, "in") }; }); },
  // Variazione % sul mese prima; null se il mese prima è vuoto
  delta(m, kind = "out") {
    const prev = this.total(U.addMonths(m, -1), kind);
    return prev > 0 ? Math.round(((this.total(m, kind) - prev) / prev) * 100) : null;
  },
  deltaText(m, kind = "out") {
    const d = this.delta(m, kind);
    return d == null ? "" : d === 0 ? "come il mese prima" : `${d > 0 ? "+" : "−"}${Math.abs(d)}% sul mese prima`;
  },

  // ---------- Importi ----------
  euro(n, dec = 2) { return `${Number(n).toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: "always" })} €`; },
  whole: (n) => Math.round(Number(n)).toLocaleString("it-IT", { useGrouping: "always" }),
  inputValue: (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }),
  // "1.234,56", "12,5", "12.50", "30 €" -> numero; vuoto -> null; non valido -> NaN
  parse(s) {
    let t = String(s ?? "").replace(/[€\s]/g, "");
    if (!t) return null;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    if (!/^\d+(\.\d{0,2})?$/.test(t)) return NaN;
    const v = Number(t);
    return v < 100000000 ? v : NaN;
  },
  setAmount(m, cat, value) {
    const e = this.entry(m, cat);
    if (value == null) { if (e) Store.remove("finance_entries", e.id); return; }
    if (e && Number(e.amount) === value) return;
    Store.upsert("finance_entries", { month: m, category: cat, amount: value }, "user_id,month,category");
  },

  // ---------- Pagina ----------
  render(el) {
    const root = el.querySelector(":scope > .fin");
    if (!this.month || (!root && !this.picked)) this.month = this.defaultMonth();
    const m = this.month, kind = this.kind, list = this.catsFor(m, kind), off = Store.missing.has("finance_entries");
    const key = JSON.stringify([m, kind, off, list, this.allGroups()]);
    // Stessa struttura: aggiorno solo i numeri, così il campo in cui stai scrivendo resta attivo
    if (root && root.dataset.key === key) {
      root.querySelector("#fin-sum").innerHTML = this.sumHTML(m);
      root.querySelector("#fin-side").innerHTML = this.sideHTML(m);
      root.querySelector("#fin-trend").innerHTML = this.trendHTML(m);
      root.querySelector("#fin-renew").innerHTML = this.renewHTML();
      root.querySelectorAll("[data-fin-cat]").forEach((i) => {
        if (i === document.activeElement) return;
        const e = this.entry(m, i.dataset.finCat);
        i.value = e ? this.inputValue(e.amount) : "";
      });
      return;
    }
    const now = this.monthNow();
    el.innerHTML = `<div class="fin">
      <div class="page-head">
        <div><p class="eyebrow">Finanze</p><h1 class="title">${kind === "in" ? "Entrate" : "Spese"} di <em>${this.monthName(m)}</em></h1></div>
        <button class="btn ghost" data-act="fin-manage">${Icon.svg("edit", 16)}<span>Voci</span></button>
      </div>
      ${off ? `<p class="card fin-alert">Manca un aggiornamento del database: esegui <b>supabase/migration-finanze.sql</b> su Supabase. Finché non c'è, gli importi non si possono salvare.</p>` : ""}
      <div class="fin-month">
        <button class="icon-btn" data-act="fin-month" data-dir="-1" aria-label="Mese precedente">${Icon.svg("left", 20)}</button>
        <b>${this.monthName(m, true)}</b>
        <button class="icon-btn" data-act="fin-month" data-dir="1" aria-label="Mese successivo" ${m >= now ? "disabled" : ""}>${Icon.svg("right", 20)}</button>
      </div>
      <section class="card fin-sum" id="fin-sum">${this.sumHTML(m)}</section>
      <div class="seg fin-kinds">${[["out", "Uscite"], ["in", "Entrate"]].map(([k, l]) => `<button class="${kind === k ? "on" : ""}" data-act="fin-kind" data-id="${k}" aria-pressed="${kind === k}">${l}</button>`).join("")}</div>
      <div class="grid2">
        <section class="card fin-table">
          <ul>${list.map((c) => this.rowHTML(m, c, off)).join("")}</ul>
          ${list.length ? "" : `<p class="muted small">Nessuna voce: aggiungine una da «Voci».</p>`}
        </section>
        <div class="fin-side" id="fin-side">${this.sideHTML(m)}</div>
      </div>
      <section class="card" id="fin-trend">${this.trendHTML(m)}</section>
      <section class="card" id="fin-renew">${this.renewHTML()}</section>
    </div>`;
    el.querySelector(".fin").dataset.key = key;
  },

  renewHTML() {
    const list = this.upcoming();
    return `<div class="block-head"><h2 class="h3">Rinnovi</h2>${list.length ? `<span class="muted small">${this.euro(this.yearCosts())} all'anno</span>` : ""}</div>
      ${list.length ? `<ul class="fin-renew">${list.map((r) => `<li><button class="fin-voce" data-act="fin-renew" data-id="${U.esc(r.id)}"><span class="fin-rdate">${U.fmtShort(r.date)}</span><span>${U.esc(r.label)}</span><b>${this.euro(r.amount)}</b>${Icon.svg("edit", 14)}</button></li>`).join("")}</ul>` : `<p class="muted small">Aggiungi abbonamenti e addebiti ricorrenti: li vedi qui in ordine di data.</p>`}
      <div class="btn-row"><button class="btn ghost sm" data-act="fin-renew">${Icon.svg("plus", 16)} Nuovo rinnovo</button></div>`;
  },

  sumHTML(m) {
    const b = this.balance(m);
    return `<div><span>Entrate</span><b>${this.rows(m, "in").length ? this.euro(this.total(m, "in")) : "–"}</b></div>
      <div><span>Uscite</span><b>${this.euro(this.total(m))}</b></div>
      <div class="fin-saldo"><span>Saldo</span><b>${b == null ? "–" : `${b < 0 ? "−" : "+"}${this.euro(Math.abs(b))}`}</b></div>`;
  },

  rowHTML(m, c, off) {
    const g = this.group(c.group), e = this.entry(m, c.id), id = `fin-${U.esc(c.id)}`;
    return `<li class="fin-row">
      ${this.tile(c)}
      <label class="fin-name" for="${id}">${U.esc(c.label)}</label>
      <span class="chip area-chip chip-sm fin-tag" style="--a:${g.color}">${U.esc(g.label)}</span>
      <span class="fin-amt"><input id="${id}" data-fin-cat="${U.esc(c.id)}" data-act-change="fin-amount" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" placeholder="–" aria-label="${U.esc(c.label)}, euro" value="${e ? this.inputValue(e.amount) : ""}" ${off ? "disabled" : ""}><i aria-hidden="true">€</i></span>
    </li>`;
  },

  sideHTML(m) {
    const k = this.kind, t = this.total(m, k), f = this.filled(m, k), groups = this.byGroup(m, k);
    return `<section class="card">
        <p class="fin-total">${this.euro(t)}</p>
        <p class="muted small">${this.deltaText(m, k) || (k === "in" ? "entrate del mese" : "uscite del mese")}</p>
        <div class="fin-prog">${Charts.bar({ value: f.total ? (f.done / f.total) * 100 : 0, color: "var(--deep)", h: 6 })}<span class="muted small">${f.done} di ${f.total} voci compilate</span></div>
        ${k === "out" ? `<button class="btn ghost sm fin-bud" data-act="fin-budget">${this.budget() ? `Budget ${this.euro(this.budget(), 0)}` : "Imposta il budget"}</button>` : ""}
      </section>
      <section class="card">
        <div class="block-head"><h2 class="h3">Macro aree</h2></div>
        ${groups.length ? `<ul class="fin-groups">${groups.map((g) => `<li><span class="fin-gname">${U.esc(g.label)}</span><b>${this.euro(g.total)}</b>${Charts.bar({ value: (g.total / t) * 100, color: g.color, h: 6 })}</li>`).join("")}</ul>` : `<p class="muted small">Si riempie mentre compili le voci.</p>`}
      </section>`;
  },

  // Con delle entrate: due linee a confronto. Senza: le colonne delle uscite.
  trendHTML(m) {
    const list = this.series(12, m), labels = list.map((x) => U.MONTHS[U.parse(x.m).getMonth()]), head = `<div class="block-head"><h2 class="h3">Ultimi 12 mesi</h2></div>`;
    if (list.some((x) => x.income > 0)) {
      return head + Charts.legend([{ color: "var(--blue)", label: "Entrate" }, { color: "var(--orange)", label: "Uscite" }]) + Charts.lines({
        series: [{ name: "Entrate", color: "var(--blue)", vals: list.map((x) => x.income || null) }, { name: "Uscite", color: "var(--orange)", vals: list.map((x) => x.total || null) }],
        labels, h: 170, min: 0, max: Math.max(...list.map((x) => Math.max(x.income, x.total))), labelEvery: 2, dec: 0, aria: "Entrate e uscite degli ultimi 12 mesi"
      });
    }
    return head + Charts.cols({ data: list.map((x, i) => ({ label: labels[i], v: x.total, tip: `${this.monthName(x.m, true)}: ${this.euro(x.total)}` })), h: 170, unit: "€", labelEvery: 2, aria: "Uscite degli ultimi 12 mesi" });
  },

  // ---------- Foglio «Voci» ----------
  title() { return this.kind === "in" ? "Voci delle entrate" : "Voci delle uscite"; },
  openManage() { Sheet.open({ title: this.title(), body: this.manageHTML() }); },
  refreshManage() { if (Sheet.isOpen()) Sheet.setBody(this.manageHTML()); },
  manageHTML() {
    const cats = this.cats(this.kind);
    const voce = (c) => `<li><button class="fin-voce ${c.off ? "off" : ""}" data-act="fin-cat" data-id="${U.esc(c.id)}">${this.tile(c)}<span>${U.esc(c.label)}</span>${c.off ? `<small>Archiviata</small>` : ""}${Icon.svg("edit", 14)}</button></li>`;
    return `<div class="fin-manage">${this.groups(this.kind).map((g) => { const x = this.group(g.id); return `<section>
        <button class="chip area-chip" style="--a:${x.color}" data-act="fin-group" data-id="${U.esc(g.id)}" aria-label="Modifica la macro area ${U.esc(g.label)}">${U.esc(g.label)} ${Icon.svg("edit", 12)}</button>
        <ul>${cats.filter((c) => c.group === g.id).map(voce).join("") || `<li class="muted small">Nessuna voce</li>`}</ul>
      </section>`; }).join("")}
      <div class="btn-row"><button class="btn primary" data-act="fin-cat">${Icon.svg("plus", 16)} Nuova voce</button><button class="btn ghost" data-act="fin-group">${Icon.svg("plus", 16)} Nuova macro area</button></div>
    </div>`;
  },

  // Voce con importi: si archivia (i mesi passati la conservano). Voce mai usata: si elimina.
  async editCat(id) {
    const kind = this.kind, cats = this.allCats(), c = cats.find((x) => x.id === id) || null, groups = this.groups(kind);
    if (!groups.length) return U.toast("Crea prima una macro area");
    const used = !!c && (Store.d.finance_entries || []).some((e) => e.category === id);
    let form = null, del = false;
    const v = await Dialog.open({
      title: c ? "Modifica voce" : "Nuova voce",
      body: `<form class="form dialog-form">
        <label>Nome<input name="label" autofocus maxlength="30" autocomplete="off" value="${U.esc(c ? c.label : "")}"></label>
        <label>Macro area<select name="group">${groups.map((g) => `<option value="${U.esc(g.id)}" ${c && c.group === g.id ? "selected" : ""}>${U.esc(g.label)}</option>`).join("")}</select></label>
        <fieldset class="area-opts icon-opts"><legend class="lbl">Icona</legend>${FIN_ICONS.map((v) => `<label class="area-opt"><input type="radio" name="icon" value="${v}" aria-label="${v}" ${v === (c && c.icon || "coin") ? "checked" : ""}><span>${Icon.svg(v, 20)}</span></label>`).join("")}</fieldset>
      </form>`,
      actions: `${c ? `<button type="button" class="btn ghost danger" data-fin-del>${c.off ? "Riattiva" : used ? "Archivia" : "Elimina"}</button>` : ""}<button type="button" class="btn ghost" data-dialog-cancel>Annulla</button><button type="button" class="btn primary" data-dialog-ok>${c ? "Salva" : "Crea voce"}</button>`,
      init: (box) => {
        form = box.querySelector("form");
        const d = box.querySelector("[data-fin-del]");
        if (d) d.addEventListener("click", () => { del = true; box.querySelector("[data-dialog-cancel]").click(); });
      },
      onKey: (k) => {
        if (k !== "ok") return del ? "del" : null;
        const f = new FormData(form), label = String(f.get("label") || "").trim().slice(0, 30);
        if (!label) { U.toast("Scrivi un nome per la voce"); return Dialog.KEEP; }
        return { label, icon: f.get("icon"), group: f.get("group") };
      }
    });
    if (!v) return;
    if (v === "del") {
      if (used || c.off) this.saveCats(cats.map((x) => (x.id === id ? { ...x, off: !x.off } : x)));
      else {
        if (!await UI.confirm({ title: `Eliminare «${c.label}»?`, text: "Non ha importi registrati.", confirmLabel: "Elimina", danger: true })) return;
        this.saveCats(cats.filter((x) => x.id !== id));
      }
    } else this.saveCats(c ? cats.map((x) => (x.id === id ? { ...x, ...v } : x)) : [...cats, { id: this.newKey(), ...v, ...(kind === "in" ? { kind } : {}) }]);
    this.refreshManage();
  },

  async editBudget() {
    const v = await UI.prompt({ title: "Budget mensile", label: "Euro al mese per tutte le uscite (vuoto = nessun budget)", value: this.budget() ? this.inputValue(this.budget()) : "", inputmode: "decimal" });
    if (v == null) return;
    const n = this.parse(v);
    if (Number.isNaN(n)) return U.toast("Importo non valido: scrivilo così, 700");
    Store.setSettings({ financeBudget: n || null });
  },

  async editRenewal(id) {
    const list = this.renewals(), r = list.find((x) => x.id === id) || null, months = r ? r.months || [] : [];
    let form = null, del = false;
    const v = await Dialog.open({
      title: r ? "Modifica rinnovo" : "Nuovo rinnovo",
      body: `<form class="form dialog-form">
        <label>Nome<input name="label" autofocus maxlength="30" autocomplete="off" value="${U.esc(r ? r.label : "")}"></label>
        <div class="row2"><label>Importo (€)<input name="amount" inputmode="decimal" autocomplete="off" value="${r ? this.inputValue(r.amount) : ""}"></label>
        <label>Giorno del mese<input name="day" type="number" min="1" max="31" inputmode="numeric" value="${r ? U.esc(r.day) : 1}"></label></div>
        <fieldset class="fin-months"><legend class="lbl">Mesi dell'addebito (nessuno = ogni mese)</legend>${U.MONTHS.map((n, i) => `<label><input type="checkbox" name="months" value="${i + 1}" ${months.includes(i + 1) ? "checked" : ""}><span>${n}</span></label>`).join("")}</fieldset>
      </form>`,
      actions: `${r ? `<button type="button" class="btn ghost danger" data-fin-del>Elimina</button>` : ""}<button type="button" class="btn ghost" data-dialog-cancel>Annulla</button><button type="button" class="btn primary" data-dialog-ok>${r ? "Salva" : "Crea"}</button>`,
      init: (box) => {
        form = box.querySelector("form");
        const d = box.querySelector("[data-fin-del]");
        if (d) d.addEventListener("click", () => { del = true; box.querySelector("[data-dialog-cancel]").click(); });
      },
      onKey: (k) => {
        if (k !== "ok") return del ? "del" : null;
        const f = new FormData(form), label = String(f.get("label") || "").trim().slice(0, 30), amount = this.parse(f.get("amount")), day = Math.round(Number(f.get("day")));
        if (!label) { U.toast("Scrivi un nome per il rinnovo"); return Dialog.KEEP; }
        if (amount == null || Number.isNaN(amount)) { U.toast("Importo non valido: scrivilo così, 12,99"); return Dialog.KEEP; }
        if (!(day >= 1 && day <= 31)) { U.toast("Il giorno va da 1 a 31"); return Dialog.KEEP; }
        return { label, amount, day, months: f.getAll("months").map(Number) };
      }
    });
    if (!v) return;
    const next = v === "del" ? list.filter((x) => x.id !== id) : r ? list.map((x) => (x.id === id ? { ...x, ...v } : x)) : [...list, { id: this.newKey(), ...v }];
    Store.setSettings({ financeRenewals: next });
  },

  async editGroup(id) {
    const kind = this.kind, groups = this.allGroups(), g = groups.find((x) => x.id === id) || null;
    const color = g ? this.group(id).color : AREA_COLORS.find((c) => !groups.some((x) => x.color === c)) || AREA_COLORS[0];
    const tips = g ? [] : FIN_SUGGESTED[kind].filter((t) => !groups.some((x) => x.label.toLowerCase() === t.toLowerCase()));
    let form = null, del = false;
    const v = await Dialog.open({
      title: g ? "Modifica macro area" : "Nuova macro area",
      body: `<form class="form dialog-form area-form">
        <label>Nome<input name="label" autofocus maxlength="24" autocomplete="off" value="${U.esc(g ? g.label : "")}"></label>
        ${tips.length ? `<div class="chips-row fin-tips">${tips.map((t) => `<button type="button" class="chip link" data-fin-tip>${U.esc(t)}</button>`).join("")}</div>` : ""}
        <fieldset class="area-opts color-opts"><legend class="lbl">Colore</legend>${AREA_COLORS.map((c, i) => `<label class="area-opt" style="--a:${c}"><input type="radio" name="color" value="${c}" aria-label="Colore ${i + 1}" ${c === color ? "checked" : ""}><span></span></label>`).join("")}</fieldset>
      </form>`,
      actions: `${g ? `<button type="button" class="btn ghost danger" data-fin-del>Elimina</button>` : ""}<button type="button" class="btn ghost" data-dialog-cancel>Annulla</button><button type="button" class="btn primary" data-dialog-ok>${g ? "Salva" : "Crea"}</button>`,
      init: (box) => {
        form = box.querySelector("form");
        form.addEventListener("click", (e) => { const t = e.target.closest("[data-fin-tip]"); if (t) form.elements.label.value = t.textContent; });
        const d = box.querySelector("[data-fin-del]");
        if (d) d.addEventListener("click", () => { del = true; box.querySelector("[data-dialog-cancel]").click(); });
      },
      onKey: (k) => {
        if (k !== "ok") return del ? "del" : null;
        const f = new FormData(form), label = String(f.get("label") || "").trim().slice(0, 24);
        if (!label) { U.toast("Scrivi un nome per la macro area"); return Dialog.KEEP; }
        if (groups.some((x) => x.label.toLowerCase() === label.toLowerCase() && x.id !== id)) { U.toast(`Esiste già «${label}»`); return Dialog.KEEP; }
        return { label, color: f.get("color") };
      }
    });
    if (!v) return;
    if (v === "del") {
      if (this.allCats().some((c) => c.group === id)) return U.toast("Prima sposta o elimina le sue voci");
      this.saveGroups(groups.filter((x) => x.id !== id));
    } else this.saveGroups(g ? groups.map((x) => (x.id === id ? { ...x, ...v } : x)) : [...groups, { id: this.newKey(), ...v, ...(kind === "in" ? { kind } : {}) }]);
    this.refreshManage();
  }
};

Actions["finance-open"] = () => App.go("finance");
Actions["fin-manage"] = () => Finance.openManage();
Actions["fin-cat"] = (el) => Finance.editCat(el.dataset.id);
Actions["fin-group"] = (el) => Finance.editGroup(el.dataset.id);
Actions["fin-budget"] = () => Finance.editBudget();
Actions["fin-renew"] = (el) => Finance.editRenewal(el.dataset.id);
Actions["fin-kind"] = (el) => { Finance.kind = el.dataset.id; App.render(); };
Actions["fin-month"] = (el) => {
  Finance.month = U.addMonths(Finance.month, Number(el.dataset.dir));
  Finance.picked = true;
  App.render();
};
Actions["fin-amount"] = (el) => {
  const v = Finance.parse(el.value);
  if (Number.isNaN(v)) {
    el.setAttribute("aria-invalid", "true");
    return U.toast("Importo non valido: scrivilo così, 123,45");
  }
  el.removeAttribute("aria-invalid");
  el.value = v == null ? "" : Finance.inputValue(v);
  Finance.setAmount(Finance.month, el.dataset.finCat, v);
};

// Invio porta alla voce successiva: si compila il mese di seguito
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.closest || !e.target.closest("[data-fin-cat]")) return;
  e.preventDefault();
  const all = [...document.querySelectorAll("[data-fin-cat]")], next = all[all.indexOf(e.target) + 1];
  if (next) next.focus(); else e.target.blur();
});
