// ============================================================
// Abitudini: lista, dettaglio (streak + mappa di calore), form
// ============================================================
const Habits = {
  filter: "all",
  openId: null,

  daysText(h) {
    const r = Calc.rep(h), every = Math.max(1, Number(r.every) || 1);
    const names = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
    const list = (a) => a.length > 1 ? `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}` : a[0] || "";
    if (r.type === "monthdays") {
      const ds = (r.days || []).slice().sort((a, b) => (a === -1) - (b === -1) || a - b).map((x) => (x === -1 ? "l'ultimo" : `il ${x}`));
      return `ogni mese ${list(ds)}`;
    }
    if (r.type === "nth") {
      const ord = { 1: "primo", 2: "secondo", 3: "terzo", 4: "quarto", "-1": "l'ultimo" };
      const ns = list((r.nths || []).slice().sort((a, b) => (a === -1) - (b === -1) || a - b).map((n) => ord[n]));
      return `${ns.startsWith("l'") ? "" : "il "}${ns} ${this.DOW_LONG[(Number(r.dow) || 1) - 1]} del mese`;
    }
    if (r.type === "interval") return every === 1 ? "ogni giorno" : `ogni ${every} giorni`;
    if (r.type === "times") { const c = Number(r.count) || 1; return `${c === 1 ? "una volta" : `${c} volte`} ${r.per === "month" ? "al mese" : "a settimana"}`; }
    const d = h.days || [1, 2, 3, 4, 5, 6, 7];
    const days = d.length === 7 ? "ogni giorno" : d.slice().sort().map((x) => names[x - 1]).join(" · ");
    return every === 1 ? days : `ogni ${every} settimane · ${d.length === 7 ? "tutti i giorni" : days}`;
  },
  // Per le ricorrenti non in lista oggi: quando ricompare
  nextText(h, today) {
    for (let d = U.addDays(today, 1), i = 0; i < 400; i++, d = U.addDays(d, 1)) if (Calc.isDue(h, d)) return `Ricompare ${U.fmtLong(d)}.`;
    return "Niente in programma.";
  },
  DOW_LONG: ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"],

  // Stato di oggi delle ricorrenti: "in sospeso dal 15 ott" / "1 di 2 questo mese"
  pendingText(h, date = U.today()) {
    const since = Calc.pendingSince(h, date);
    if (since) return `in sospeso dal ${U.fmtShort(since)}`;
    const pc = Calc.periodCount(h, date);
    return pc ? `${Math.min(pc.done, pc.need)} di ${pc.need} ${Calc.rep(h).per === "month" ? "questo mese" : "questa settimana"}` : "";
  },

  targetText(h) {
    return h.kind === "check" ? this.daysText(h) : `${U.num(h.target)} ${U.esc(h.unit || "")} · ${this.daysText(h)}`;
  },

  valueText(h, date) {
    const v = Calc.value(h, date);
    return h.kind === "check" ? (v >= 1 ? "Fatto" : "Da fare") : `${U.num(v)} / ${U.num(h.target)} ${U.esc(h.unit || "")}`;
  },

  // Sette pallini: ultimi 7 giorni
  weekDots(h) {
    const today = U.today();
    return `<span class="wdots">${U.range(U.addDays(today, -6), today).map((d) => {
      if (!Calc.isDue(h, d)) return `<i class="wd off" data-tip="${U.fmtShort(d)}: riposo"></i>`;
      const c = Calc.credit(h, d);
      const cls = c >= 1 ? "full" : c > 0 ? "half" : "";
      return `<i class="wd ${cls}" data-tip="${U.fmtShort(d)}: ${Math.round(c * 100)}%"></i>`;
    }).join("")}</span>`;
  },

  // Pulsante di azione rapida per oggi (spunta o +step)
  quick(h, date = U.today()) {
    if (!Calc.isDue(h, date)) return `<span class="rest">riposo</span>`;
    if (h.kind === "check") {
      const on = Calc.isDone(h, date);
      return `<button class="round hit ${on ? "on" : ""}" data-act="habit-toggle" data-id="${U.esc(h.id)}" aria-pressed="${on}" aria-label="${U.esc(h.name)}: ${on ? "segna come non fatta" : "segna come fatta"}">${Icon.svg("check", 18)}</button>`;
    }
    const done = Calc.isDone(h, date);
    return `<button class="round plus hit ${done ? "on" : ""}" data-act="habit-inc" data-id="${U.esc(h.id)}" data-dir="1" aria-label="${U.esc(h.name)}: aggiungi ${U.num(h.step)} ${U.esc(h.unit || "")}">${Icon.svg(done ? "check" : "plus", 18)}</button>`;
  },

  render(el) {
    const today = U.today();
    const all = Calc.activeHabits();
    const list = all.filter((h) => this.filter === "all" || h.area === this.filter);
    const usedAreas = [...new Set(all.map((h) => h.area))];
    const archived = Store.d.habits.filter((h) => h.archived);

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Abitudini</p><h1 class="title">Le tue <em>abitudini</em></h1></div>
        <button class="btn primary" data-act="habit-new">${Icon.svg("plus", 18)}<span>Nuova</span></button>
      </div>
      ${usedAreas.length > 1 ? `<div class="chips-row filters">
        <button class="pill ${this.filter === "all" ? "on" : ""}" data-act="habit-filter" data-id="all" aria-pressed="${this.filter === "all"}">Tutte</button>
        ${usedAreas.filter((a) => AREAS[a]).map((a) => `<button class="pill ${this.filter === a ? "on" : ""}" data-act="habit-filter" data-id="${U.esc(a)}" aria-pressed="${this.filter === a}">${UI.areaIcon(a, 14)} ${U.esc(AREAS[a].label)}</button>`).join("")}
      </div>` : ""}
      ${list.length ? `<div class="list">${list.map((h) => {
        const streak = Calc.streak(h), unit = Calc.carries(h) ? "volte" : "giorni", pend = this.pendingText(h, today);
        return `<article class="row-card" data-act="habit-open" data-id="${U.esc(h.id)}" role="button" tabindex="0" aria-label="${U.esc(h.name)}: apri il dettaglio">
          ${UI.glyph(h.area)}
          <div class="row-main">
            <h2 class="row-title">${U.esc(h.name)}</h2>
            <p>${Calc.isDue(h, today) ? this.valueText(h, today) : "Oggi riposo"}${pend ? ` · <b class="pending">${pend}</b>` : ""} · <span class="muted">${this.daysText(h)}</span></p>
            ${this.weekDots(h)}
          </div>
          <div class="row-side">
            ${streak >= 2 ? `<span class="streak" data-tip="${streak} ${unit} di fila" aria-label="Serie di ${streak} ${unit}">${Icon.svg("flame", 15)}${streak}</span>` : ""}
            ${this.quick(h)}
          </div>
        </article>`;
      }).join("")}</div>` : UI.empty("habit", "Nessuna abitudine", "Inizia con una sola: piccola e chiara. Il resto viene dopo.",
        `<button class="btn primary" data-act="habit-new">Crea la prima abitudine</button>`)}
      ${archived.length ? `<details class="archived"><summary>Archiviate (${archived.length})</summary>
        ${archived.map((h) => `<div class="row-card slim" data-act="habit-open" data-id="${U.esc(h.id)}" role="button" tabindex="0" aria-label="${U.esc(h.name)} (archiviata): apri il dettaglio">${UI.glyph(h.area)}<div class="row-main"><h2 class="row-title">${U.esc(h.name)}</h2></div>
        <button class="btn ghost sm" data-act="habit-restore" data-id="${U.esc(h.id)}">Ripristina</button></div>`).join("")}</details>` : ""}`;
  },

  // ---------- dettaglio ----------
  openDetail(id) {
    const h = Store.d.habits.find((x) => x.id === id);
    if (!h) return;
    this.openId = id;
    Sheet.open({ title: h.name, body: this.detailHTML(h), onClose: () => { this.openId = null; } });
  },

  refreshDetail() {
    if (!this.openId || !Sheet.isOpen()) return;
    const h = Store.d.habits.find((x) => x.id === this.openId);
    if (h) Sheet.setBody(this.detailHTML(h), h.name);
  },

  detailHTML(h) {
    const today = U.today();
    const goal = h.goal_id ? Store.d.goals.find((g) => g.id === h.goal_id) : null;
    const cells = {};
    for (const d of U.range(U.addDays(U.mondayOf(today), -14 * 7), today)) {
      if (!Calc.isDue(h, d)) { cells[d] = null; continue; }
      const s = Calc.slot(h, d);
      cells[d] = s.due ? s.credit / s.due : Calc.credit(h, d);
    }
    const r7 = Calc.rate(U.addDays(today, -6), today, [h]), r30 = Calc.rate(U.addDays(today, -29), today, [h]);
    const due = Calc.isDue(h, today);
    const v = Calc.value(h, today);
    return `
      <div class="detail" data-habit="${U.esc(h.id)}">
        <div class="chips-row">${UI.areaChip(h.area)}<span class="chip">${this.targetText(h)}</span>${goal ? `<span class="chip">${Icon.svg("goal", 14)} ${U.esc(goal.title)}</span>` : ""}</div>
        <div class="stats4">
          <div><b>${Calc.streak(h)}</b><span>serie attuale${Calc.carries(h) ? " (volte)" : ""}</span></div>
          <div><b>${Calc.bestStreak(h)}</b><span>record</span></div>
          <div><b>${r7 == null ? "–" : Math.round(r7) + "%"}</b><span>7 giorni</span></div>
          <div><b>${r30 == null ? "–" : Math.round(r30) + "%"}</b><span>30 giorni</span></div>
        </div>
        ${due ? `<div class="today-ctl">
          <span class="lbl">Oggi${this.pendingText(h, today) ? ` · ${this.pendingText(h, today)}` : ""}</span>
          ${h.kind === "check"
            ? `<button class="btn ${Calc.isDone(h, today) ? "orange" : "primary"} wide" data-act="habit-toggle" data-id="${h.id}">${Calc.isDone(h, today) ? "Fatto ✓ (tocca per annullare)" : "Segna come fatta"}</button>`
            : `<div class="stepper">
                <button class="round plus" data-act="habit-inc" data-id="${h.id}" data-dir="-1" aria-label="Diminuisci">${Icon.svg("minus", 18)}</button>
                <label class="stepper-v"><input type="number" inputmode="decimal" step="any" min="0" value="${v}" data-act-change="habit-set" data-id="${h.id}"><small>/ ${U.num(h.target)} ${U.esc(h.unit || "")}</small></label>
                <button class="round plus" data-act="habit-inc" data-id="${h.id}" data-dir="1" aria-label="Aumenta">${Icon.svg("plus", 18)}</button>
              </div>`}
        </div>` : `<p class="muted center">${Calc.carries(h) ? this.nextText(h, today) : "Oggi è un giorno di riposo per questa abitudine."}</p>`}
        <div class="block">
          <div class="block-head"><h3>Ultime 15 settimane</h3><span class="muted small">tocca un giorno per correggerlo</span></div>
          <div class="heat-wrap">${Charts.heat({ cells, weeks: 15, onCell: true, name: `Andamento di ${h.name}`, start: h.start_date || null })}</div>
        </div>
        <div class="btn-row">
          <button class="btn ghost" data-act="habit-edit" data-id="${h.id}">${Icon.svg("edit", 16)} Modifica</button>
          <button class="btn ghost" data-act="habit-archive" data-id="${h.id}">${h.archived ? "Ripristina" : "Archivia"}</button>
          <button class="btn ghost danger" data-act="habit-delete" data-id="${h.id}">${Icon.svg("trash", 16)} Elimina</button>
        </div>
      </div>`;
  },

  // ---------- azioni sui valori ----------
  toggle(id, date = U.today()) {
    const h = Store.d.habits.find((x) => x.id === id);
    if (!h) return;
    Store.setLog(id, date, Calc.isDone(h, date) ? 0 : (h.kind === "check" ? 1 : Number(h.target)));
  },
  inc(id, dir, date = U.today()) {
    const h = Store.d.habits.find((x) => x.id === id);
    if (!h) return;
    Store.setLog(id, date, Calc.value(h, date) + dir * Number(h.step || 1));
    if (dir > 0 && Calc.isDone(h, date) && Calc.value(h, date) - Number(h.step || 1) < Number(h.target)) U.toast(`${h.name}: obiettivo di oggi raggiunto`);
  },

  // ---------- form ----------
  openForm(id = null, goalId = null) {
    const h = id ? Store.d.habits.find((x) => x.id === id) : null;
    const days = h ? h.days : [1, 2, 3, 4, 5, 6, 7];
    const kind = h ? h.kind : "check";
    const r = h ? Calc.rep(h) : { type: "week", every: 1 };
    const mode = r.type === "monthdays" || r.type === "nth" ? "month" : r.type;
    const every = Math.max(1, Number(r.every) || 1), from = r.from || U.today();
    const mdays = r.type === "monthdays" ? r.days || [] : [1];
    const nths = r.type === "nth" ? r.nths || [] : [1], ndow = r.type === "nth" ? Number(r.dow) || 1 : 1;
    const toggles = (cls, items, on) => `<div class="days wrap">${items.map(([v, l]) => `<button type="button" class="day ${cls} ${on.includes(v) ? "on" : ""}" data-v="${v}" aria-pressed="${on.includes(v)}">${l}</button>`).join("")}</div>`;
    const ordinals = [[1, "1°"], [2, "2°"], [3, "3°"], [4, "4°"], [-1, "Ultimo"]];
    const goals = Store.d.goals.filter((g) => g.status === "active");
    const body = `
      <form id="habit-form" class="form">
        <label>Nome<input name="name" required autofocus maxlength="80" placeholder="Es. Bere acqua" value="${U.esc(h ? h.name : "")}"></label>
        <div class="field"><span class="lbl" id="habit-area-l">Area</span>${UI.areaPicker("area", h ? h.area : "salute")}</div>
        <div class="field"><span class="lbl">Tipo</span>${UI.seg("kind", [["check", "Sì / No"], ["qty", "Quantità"]], kind)}</div>
        <div class="qty-only ${kind === "qty" ? "" : "hidden"}">
          <div class="row2">
            <label>Obiettivo giornaliero<input name="target" type="number" step="any" min="0.01" inputmode="decimal" value="${h ? h.target : 8}"></label>
            <label>Unità<input name="unit" list="units" maxlength="20" placeholder="bicchieri" value="${U.esc(h ? h.unit || "" : "")}"></label>
          </div>
          <label>Incremento del tasto +<input name="step" type="number" step="any" min="0.01" inputmode="decimal" value="${h ? h.step : 1}"></label>
          <datalist id="units"><option value="bicchieri"><option value="min"><option value="pagine"><option value="km"><option value="ore"><option value="ripetizioni"></datalist>
        </div>
        <div class="field"><span class="lbl">Si ripete</span>${UI.seg("rmode", [["week", "Settimana"], ["month", "Mese"], ["interval", "Ogni N giorni"], ["times", "N volte"]], mode)}</div>
        <div class="rep" data-rep="week">
          <div class="field"><span class="lbl">Giorni</span>
            <div class="days">${U.DOW_SHORT.map((l, i) => `<button type="button" class="day wday ${days.includes(i + 1) ? "on" : ""}" data-day="${i + 1}">${l}</button>`).join("")}</div>
          </div>
          <div class="row2">
            <label>Ogni quante settimane<input name="wevery" type="number" min="1" max="52" inputmode="numeric" value="${r.type === "week" ? every : 1}"></label>
            <label class="from-only">A partire dalla settimana del<input name="wfrom" type="date" value="${U.esc(from)}"></label>
          </div>
        </div>
        <div class="rep" data-rep="month">
          <div class="field">${UI.seg("mmode", [["monthdays", "Giorni del mese"], ["nth", "Es. primo lunedì"]], r.type === "nth" ? "nth" : "monthdays")}</div>
          <div class="mrep" data-mrep="monthdays">
            ${toggles("mday", [...Array.from({ length: 31 }, (_, i) => [i + 1, String(i + 1)]), [-1, "Ultimo"]], mdays)}
            <p class="muted small">Il 29, 30 e 31 nei mesi più corti diventano l'ultimo giorno.</p>
          </div>
          <div class="mrep" data-mrep="nth">
            ${toggles("nth", ordinals, nths)}
            <div class="days">${U.DOW_SHORT.map((l, i) => `<button type="button" class="day ndow ${ndow === i + 1 ? "on" : ""}" data-v="${i + 1}" aria-pressed="${ndow === i + 1}">${l}</button>`).join("")}</div>
          </div>
        </div>
        <div class="rep" data-rep="interval">
          <div class="row2">
            <label>Ogni quanti giorni<input name="ievery" type="number" min="1" max="365" inputmode="numeric" value="${r.type === "interval" ? every : 3}"></label>
            <label>La prima volta il<input name="ifrom" type="date" value="${U.esc(from)}"></label>
          </div>
        </div>
        <div class="rep" data-rep="times">
          <div class="row2">
            <label>Quante volte<input name="tcount" type="number" min="1" max="31" inputmode="numeric" value="${r.type === "times" ? Number(r.count) || 1 : 2}"></label>
            <div class="field"><span class="lbl">Ogni</span>${UI.seg("tper", [["week", "Settimana"], ["month", "Mese"]], r.per === "week" ? "week" : "month")}</div>
          </div>
          <p class="muted small">Nei giorni che vuoi tu: resta in lista finché non le hai fatte tutte.</p>
        </div>
        <p class="muted small rep-note">Se non la fai nel giorno previsto resta in lista, in sospeso, finché non la fai o non arriva la volta dopo.</p>
        <label>Contribuisce all'obiettivo
          <select name="goal_id"><option value="">Nessuno</option>${goals.map((g) => `<option value="${g.id}" ${((h && h.goal_id) || goalId) === g.id ? "selected" : ""}>${U.esc(g.title)}</option>`).join("")}</select>
        </label>
        <button class="btn primary wide" type="submit">${h ? "Salva modifiche" : "Crea abitudine"}</button>
      </form>`;
    Sheet.open({
      title: h ? "Modifica abitudine" : "Nuova abitudine", body,
      onMount: (root) => {
        const form = root.querySelector("#habit-form");
        const showRep = () => {
          const m = form.elements.rmode.value, mm = form.elements.mmode.value;
          form.querySelectorAll(".rep").forEach((x) => x.classList.toggle("hidden", x.dataset.rep !== m));
          form.querySelectorAll(".mrep").forEach((x) => x.classList.toggle("hidden", x.dataset.mrep !== mm));
          const weekly1 = m === "week" && (Number(form.elements.wevery.value) || 1) === 1;
          form.querySelector(".from-only").classList.toggle("hidden", weekly1);
          form.querySelector(".rep-note").classList.toggle("hidden", weekly1);
        };
        showRep();
        form.elements.wevery.addEventListener("input", showRep);
        UI.wire(form, (name, val) => {
          if (name === "kind") form.querySelector(".qty-only").classList.toggle("hidden", val !== "qty");
          if (name === "rmode" || name === "mmode") showRep();
        });
        form.addEventListener("click", (e) => {
          const b = e.target.closest(".day");
          if (!b) return;
          if (b.classList.contains("ndow")) form.querySelectorAll(".ndow").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
          else { b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); }
        });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          const on = (cls) => [...form.querySelectorAll(`.${cls}.on`)].map((b) => Number(b.dataset.v || b.dataset.day));
          const int = (k, min, max) => U.clamp(Math.round(Number(f.get(k)) || min), min, max);
          const m = f.get("rmode");
          let dayList = [1, 2, 3, 4, 5, 6, 7], repeat = null;
          if (m === "week") {
            dayList = on("wday");
            if (!dayList.length) return U.toast("Scegli almeno un giorno");
            const n = int("wevery", 1, 52);
            if (n > 1) repeat = { type: "week", every: n, from: f.get("wfrom") || U.today() };
          } else if (m === "month" && f.get("mmode") === "nth") {
            const ns = on("nth");
            if (!ns.length) return U.toast("Scegli almeno una settimana del mese");
            repeat = { type: "nth", nths: ns, dow: on("ndow")[0] || 1 };
          } else if (m === "month") {
            const ds = on("mday");
            if (!ds.length) return U.toast("Scegli almeno un giorno del mese");
            repeat = { type: "monthdays", days: ds };
          } else if (m === "interval") {
            repeat = { type: "interval", every: int("ievery", 1, 365), from: f.get("ifrom") || U.today() };
          } else if (m === "times") {
            repeat = { type: "times", count: int("tcount", 1, 31), per: f.get("tper") === "week" ? "week" : "month" };
          }
          const isQty = f.get("kind") === "qty";
          const row = {
            name: f.get("name").trim(), area: f.get("area"), kind: f.get("kind"),
            target: isQty ? Math.max(0.01, Number(f.get("target")) || 1) : 1,
            step: isQty ? Math.max(0.01, Number(f.get("step")) || 1) : 1,
            unit: isQty ? (f.get("unit") || "").trim() : null,
            days: dayList, repeat, goal_id: f.get("goal_id") || null
          };
          if (!row.name) return;
          if (h) Store.update("habits", h.id, row);
          else Store.insert("habits", { ...row, start_date: U.today(), archived: false });
          Sheet.close();
          U.toast(h ? "Abitudine aggiornata" : "Abitudine creata");
        });
      }
    });
  }
};

Actions["habit-new"] = () => Habits.openForm();
Actions["habit-edit"] = (el) => Habits.openForm(el.dataset.id);
Actions["habit-open"] = (el) => Habits.openDetail(el.dataset.id);
Actions["habit-filter"] = (el) => { Habits.filter = el.dataset.id; App.render(); };
Actions["habit-toggle"] = (el) => { Habits.toggle(el.dataset.id); Habits.refreshDetail(); };
Actions["habit-inc"] = (el) => { Habits.inc(el.dataset.id, Number(el.dataset.dir)); Habits.refreshDetail(); };
Actions["habit-set"] = (el) => { Store.setLog(el.dataset.id, U.today(), Number(el.value) || 0); Habits.refreshDetail(); };
Actions["habit-archive"] = (el) => {
  const h = Store.d.habits.find((x) => x.id === el.dataset.id);
  Store.update("habits", h.id, { archived: !h.archived });
  Sheet.close();
  U.toast(h.archived ? "Abitudine archiviata" : "Abitudine ripristinata");
};
Actions["habit-restore"] = (el) => Store.update("habits", el.dataset.id, { archived: false });
Actions["habit-delete"] = async (el) => {
  const h = Store.d.habits.find((x) => x.id === el.dataset.id);
  if (!h) return;
  const ok = await UI.confirm({ title: `Eliminare «${h.name}»?`, text: "Si cancella anche tutto il suo storico. Non si può annullare.", confirmLabel: "Elimina", danger: true });
  if (!ok) return;
  Store.remove("habits", h.id);
  Sheet.close();
};
// Correzione di un giorno passato dalla mappa di calore
Actions["heat-cell"] = async (el) => {
  const box = el.closest("[data-habit]");
  if (!box) return;
  const h = Store.d.habits.find((x) => x.id === box.dataset.habit);
  const date = el.dataset.date;
  if (!h || !Calc.isDue(h, date)) return U.toast("Quel giorno non era in programma");
  if (h.kind === "check") Habits.toggle(h.id, date);
  else {
    const val = await UI.prompt({ title: U.fmtLong(date), label: `Quanti ${h.unit || ""}? (obiettivo ${U.num(h.target)})`, value: String(Calc.value(h, date)), inputmode: "decimal" });
    if (val === null) return;
    Store.setLog(h.id, date, Number(String(val).replace(",", ".")) || 0);
  }
  Habits.refreshDetail();
};
