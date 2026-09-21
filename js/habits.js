// ============================================================
// Abitudini: lista, dettaglio (streak + mappa di calore), form
// ============================================================
const Habits = {
  filter: "all",
  openId: null,

  daysText(h) {
    const d = h.days || [1, 2, 3, 4, 5, 6, 7];
    if (d.length === 7) return "ogni giorno";
    const names = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
    return d.slice().sort().map((x) => names[x - 1]).join(" · ");
  },

  targetText(h) {
    return h.kind === "check" ? this.daysText(h) : `${U.num(h.target)} ${h.unit || ""} · ${this.daysText(h)}`;
  },

  valueText(h, date) {
    const v = Calc.value(h, date);
    return h.kind === "check" ? (v >= 1 ? "Fatto" : "Da fare") : `${U.num(v)} / ${U.num(h.target)} ${h.unit || ""}`;
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
      return `<button class="round ${on ? "on" : ""}" data-act="habit-toggle" data-id="${h.id}" aria-label="${on ? "Segna come non fatta" : "Segna come fatta"}">${Icon.svg("check", 18)}</button>`;
    }
    const done = Calc.isDone(h, date);
    return `<button class="round plus ${done ? "on" : ""}" data-act="habit-inc" data-id="${h.id}" data-dir="1" aria-label="Aggiungi ${U.num(h.step)} ${U.esc(h.unit || "")}">${Icon.svg(done ? "check" : "plus", 18)}</button>`;
  },

  render(el) {
    const today = U.today();
    const all = Calc.activeHabits();
    const list = all.filter((h) => this.filter === "all" || h.area === this.filter);
    const usedAreas = [...new Set(all.map((h) => h.area))];
    const archived = Store.d.habits.filter((h) => h.archived);

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">習慣 · Abitudini</p><h1 class="title">Le tue <em>abitudini</em></h1></div>
        <button class="btn primary" data-act="habit-new">${Icon.svg("plus", 18)}<span>Nuova</span></button>
      </div>
      ${usedAreas.length > 1 ? `<div class="chips-row filters">
        <button class="pill ${this.filter === "all" ? "on" : ""}" data-act="habit-filter" data-id="all">Tutte</button>
        ${usedAreas.map((a) => `<button class="pill ${this.filter === a ? "on" : ""}" data-act="habit-filter" data-id="${a}">${AREAS[a].glyph} ${AREAS[a].label}</button>`).join("")}
      </div>` : ""}
      ${list.length ? `<div class="list">${list.map((h) => {
        const streak = Calc.streak(h);
        return `<article class="row-card" data-act="habit-open" data-id="${h.id}">
          ${UI.glyph(h.area)}
          <div class="row-main">
            <h3>${U.esc(h.name)}</h3>
            <p>${Calc.isDue(h, today) ? this.valueText(h, today) : "Oggi riposo"} · <span class="muted">${this.daysText(h)}</span></p>
            ${this.weekDots(h)}
          </div>
          <div class="row-side">
            ${streak >= 2 ? `<span class="streak" data-tip="${streak} giorni di fila">${Icon.svg("flame", 15)}${streak}</span>` : ""}
            ${this.quick(h)}
          </div>
        </article>`;
      }).join("")}</div>` : UI.empty("habit", "Nessuna abitudine", "Inizia con una sola: piccola e chiara. Il resto viene dopo.",
        `<button class="btn primary" data-act="habit-new">Crea la prima abitudine</button>`)}
      ${archived.length ? `<details class="archived"><summary>Archiviate (${archived.length})</summary>
        ${archived.map((h) => `<div class="row-card slim" data-act="habit-open" data-id="${h.id}">${UI.glyph(h.area)}<div class="row-main"><h3>${U.esc(h.name)}</h3></div>
        <button class="btn ghost sm" data-act="habit-restore" data-id="${h.id}">Ripristina</button></div>`).join("")}</details>` : ""}`;
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
    for (const d of U.range(U.addDays(U.mondayOf(today), -14 * 7), today)) cells[d] = Calc.isDue(h, d) ? Calc.credit(h, d) : null;
    const r7 = Calc.rate(U.addDays(today, -6), today, [h]), r30 = Calc.rate(U.addDays(today, -29), today, [h]);
    const due = Calc.isDue(h, today);
    const v = Calc.value(h, today);
    return `
      <div class="detail" data-habit="${h.id}">
        <div class="chips-row">${UI.areaChip(h.area)}<span class="chip">${this.targetText(h)}</span>${goal ? `<span class="chip">${Icon.svg("goal", 14)} ${U.esc(goal.title)}</span>` : ""}</div>
        <div class="stats4">
          <div><b>${Calc.streak(h)}</b><span>serie attuale</span></div>
          <div><b>${Calc.bestStreak(h)}</b><span>record</span></div>
          <div><b>${r7 == null ? "–" : Math.round(r7) + "%"}</b><span>7 giorni</span></div>
          <div><b>${r30 == null ? "–" : Math.round(r30) + "%"}</b><span>30 giorni</span></div>
        </div>
        ${due ? `<div class="today-ctl">
          <span class="lbl">Oggi</span>
          ${h.kind === "check"
            ? `<button class="btn ${Calc.isDone(h, today) ? "orange" : "primary"} wide" data-act="habit-toggle" data-id="${h.id}">${Calc.isDone(h, today) ? "Fatto ✓ (tocca per annullare)" : "Segna come fatta"}</button>`
            : `<div class="stepper">
                <button class="round plus" data-act="habit-inc" data-id="${h.id}" data-dir="-1" aria-label="Diminuisci">${Icon.svg("minus", 18)}</button>
                <label class="stepper-v"><input type="number" inputmode="decimal" step="any" min="0" value="${v}" data-act-change="habit-set" data-id="${h.id}"><small>/ ${U.num(h.target)} ${U.esc(h.unit || "")}</small></label>
                <button class="round plus" data-act="habit-inc" data-id="${h.id}" data-dir="1" aria-label="Aumenta">${Icon.svg("plus", 18)}</button>
              </div>`}
        </div>` : `<p class="muted center">Oggi è un giorno di riposo per questa abitudine.</p>`}
        <div class="block">
          <div class="block-head"><h3>Ultime 15 settimane</h3><span class="muted small">tocca un giorno per correggerlo</span></div>
          <div class="heat-wrap">${Charts.heat({ cells, weeks: 15, onCell: true, name: `Andamento di ${h.name}` })}</div>
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
    const goals = Store.d.goals.filter((g) => g.status === "active");
    const body = `
      <form id="habit-form" class="form">
        <label>Nome<input name="name" required autofocus maxlength="80" placeholder="Es. Bere acqua" value="${U.esc(h ? h.name : "")}"></label>
        <label>Area<select name="area">${UI.areaOptions(h ? h.area : "salute")}</select></label>
        <div class="field"><span class="lbl">Tipo</span>${UI.seg("kind", [["check", "Sì / No"], ["qty", "Quantità"]], kind)}</div>
        <div class="qty-only ${kind === "qty" ? "" : "hidden"}">
          <div class="row2">
            <label>Obiettivo giornaliero<input name="target" type="number" step="any" min="0.01" inputmode="decimal" value="${h ? h.target : 8}"></label>
            <label>Unità<input name="unit" list="units" maxlength="20" placeholder="bicchieri" value="${U.esc(h ? h.unit || "" : "")}"></label>
          </div>
          <label>Incremento del tasto +<input name="step" type="number" step="any" min="0.01" inputmode="decimal" value="${h ? h.step : 1}"></label>
          <datalist id="units"><option value="bicchieri"><option value="min"><option value="pagine"><option value="km"><option value="ore"><option value="ripetizioni"></datalist>
        </div>
        <div class="field"><span class="lbl">Giorni</span>
          <div class="days">${U.DOW_SHORT.map((l, i) => `<button type="button" class="day ${days.includes(i + 1) ? "on" : ""}" data-day="${i + 1}">${l}</button>`).join("")}</div>
        </div>
        <label>Contribuisce all'obiettivo
          <select name="goal_id"><option value="">Nessuno</option>${goals.map((g) => `<option value="${g.id}" ${((h && h.goal_id) || goalId) === g.id ? "selected" : ""}>${U.esc(g.title)}</option>`).join("")}</select>
        </label>
        <button class="btn primary wide" type="submit">${h ? "Salva modifiche" : "Crea abitudine"}</button>
      </form>`;
    Sheet.open({
      title: h ? "Modifica abitudine" : "Nuova abitudine", body,
      onMount: (root) => {
        const form = root.querySelector("#habit-form");
        UI.wire(form, (name, val) => { if (name === "kind") form.querySelector(".qty-only").classList.toggle("hidden", val !== "qty"); });
        form.addEventListener("click", (e) => { const b = e.target.closest(".day"); if (b) b.classList.toggle("on"); });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          const dayList = [...form.querySelectorAll(".day.on")].map((b) => Number(b.dataset.day));
          if (!dayList.length) return U.toast("Scegli almeno un giorno");
          const isQty = f.get("kind") === "qty";
          const row = {
            name: f.get("name").trim(), area: f.get("area"), kind: f.get("kind"),
            target: isQty ? Math.max(0.01, Number(f.get("target")) || 1) : 1,
            step: isQty ? Math.max(0.01, Number(f.get("step")) || 1) : 1,
            unit: isQty ? (f.get("unit") || "").trim() : null,
            days: dayList, goal_id: f.get("goal_id") || null
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
Actions["habit-delete"] = (el) => {
  const h = Store.d.habits.find((x) => x.id === el.dataset.id);
  if (!confirm(`Eliminare "${h.name}" e tutto il suo storico? Non si può annullare.`)) return;
  Store.remove("habits", h.id);
  Sheet.close();
};
// Correzione di un giorno passato dalla mappa di calore
Actions["heat-cell"] = (el) => {
  const box = el.closest("[data-habit]");
  if (!box) return;
  const h = Store.d.habits.find((x) => x.id === box.dataset.habit);
  const date = el.dataset.date;
  if (!h || !Calc.isDue(h, date)) return U.toast("Quel giorno non era in programma");
  if (h.kind === "check") Habits.toggle(h.id, date);
  else {
    const val = prompt(`${U.fmtLong(date)}: quanti ${h.unit || ""}? (obiettivo ${U.num(h.target)})`, Calc.value(h, date));
    if (val === null) return;
    Store.setLog(h.id, date, Number(String(val).replace(",", ".")) || 0);
  }
  Habits.refreshDetail();
};
