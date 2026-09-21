// ============================================================
// Obiettivi: breve (1 mese), medio (4 mesi), lungo (1 anno o più).
// Avanzamento = milestone completate + costanza delle abitudini
// collegate; se non c'è né l'una né l'altra, si imposta a mano.
// ============================================================
const Goals = {
  tab: "short",
  openId: null,
  showDone: false,
  addingSub: null,     // id della tappa a cui si sta aggiungendo una sottotappa

  paceIcon(key) { return { ahead: "▲", on: "●", slight: "◐", behind: "▼", done: "✓" }[key]; },

  card(g) {
    const pace = Calc.goalPace(g);
    const left = Calc.daysLeft(g);
    const leftTxt = g.status === "done" ? "Completato" : left < 0 ? `Scaduto da ${-left} g` : left === 0 ? "Scade oggi" : left < 60 ? `${left} giorni` : `${Math.round(left / 30)} mesi`;
    const a = AREAS[g.area] || AREAS.progetti;
    const ms = Calc.milestonesOf(g);
    return `<article class="goal-card" data-act="goal-open" data-id="${g.id}">
      <div class="goal-top">${UI.areaChip(g.area, true)}<span class="pace ${pace.key}" data-tip="Atteso ${Math.round(pace.expected)}% · reale ${Math.round(pace.progress)}%">${this.paceIcon(pace.key)} ${pace.label}</span></div>
      <h3>${U.esc(g.title)}</h3>
      <div class="goal-prog">
        ${Charts.bar({ value: pace.progress, color: a.color, mark: g.status === "done" ? null : pace.expected, h: 8 })}
        <div class="goal-nums"><b>${Math.round(pace.progress)}%</b><span>${ms.length ? `${ms.filter((m) => Calc.msPct(m) === 100).length}/${ms.length} tappe · ` : ""}${leftTxt}</span></div>
      </div>
    </article>`;
  },

  render(el) {
    const all = Store.d.goals.filter((g) => g.status !== "archived");
    const active = all.filter((g) => g.status === "active");
    const done = all.filter((g) => g.status === "done");
    const col = (key) => {
      const h = HORIZONS[key];
      const list = active.filter((g) => g.horizon === key).sort((a, b) => a.due_date.localeCompare(b.due_date));
      return `<section class="goal-col ${this.tab === key ? "show" : ""}" data-col="${key}">
        <header class="col-head"><h2>${h.label}</h2><span class="muted">${h.sub}</span><span class="count">${list.length}</span></header>
        ${list.length ? list.map((g) => this.card(g)).join("") : `<div class="col-empty"><p>Nessun obiettivo ${h.label.toLowerCase()}.</p><button class="btn ghost sm" data-act="goal-new" data-id="${key}">Aggiungi</button></div>`}
      </section>`;
    };
    const total = active.length;
    const onTrack = active.filter((g) => ["ahead", "on"].includes(Calc.goalPace(g).key)).length;

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">目標 · Obiettivi</p><h1 class="title">Dove stai <em>andando</em></h1>
          ${total ? `<p class="sub">${onTrack} su ${total} in linea con il tempo</p>` : ""}</div>
        <button class="btn primary" data-act="goal-new">${Icon.svg("plus", 18)}<span>Nuovo</span></button>
      </div>
      <div class="seg tabs3" data-tabs="goals">${Object.entries(HORIZONS).map(([k, h]) =>
        `<button class="${this.tab === k ? "on" : ""}" data-act="goal-tab" data-id="${k}">${h.label}<small>${h.sub}</small></button>`).join("")}</div>
      <div class="goal-cols">${["short", "medium", "long"].map(col).join("")}</div>
      <p class="legend-note">La tacca sulla barra è dove dovresti essere in base al tempo trascorso.</p>
      ${done.length ? `<details class="archived"><summary>Completati (${done.length})</summary>${done.map((g) => `<div class="row-card slim" data-act="goal-open" data-id="${g.id}">${UI.glyph(g.area)}<div class="row-main"><h3>${U.esc(g.title)}</h3><p class="muted">${HORIZONS[g.horizon].label}</p></div></div>`).join("")}</details>` : ""}`;
  },

  // ---------- dettaglio ----------
  openDetail(id) {
    const g = Store.d.goals.find((x) => x.id === id);
    if (!g) return;
    this.openId = id;
    Sheet.open({ title: g.title, wide: true, body: this.detailHTML(g), onClose: () => { this.openId = null; this.addingSub = null; }, onMount: (root) => {
      root.addEventListener("submit", (e) => {
        if (e.target.id !== "ms-form") return;
        e.preventDefault();
        const input = e.target.querySelector("input");
        const title = input.value.trim();
        if (!title) return;
        Store.insert("milestones", { goal_id: id, title, done: false, done_at: null, position: Calc.milestonesOf(g).length });
        this.refreshDetail();
        const again = Sheet.el && Sheet.el.querySelector("#ms-form input");
        if (again) again.focus();
      });
    } });
  },

  refreshDetail() {
    if (!this.openId || !Sheet.isOpen()) return;
    const g = Store.d.goals.find((x) => x.id === this.openId);
    if (g) Sheet.setBody(this.detailHTML(g), g.title);
  },

  detailHTML(g) {
    const pace = Calc.goalPace(g);
    const ms = Calc.milestonesOf(g);
    const habits = Calc.habitsOfGoal(g);
    const a = AREAS[g.area] || AREAS.progetti;
    const free = Calc.activeHabits().filter((h) => h.goal_id !== g.id);
    const focusMin = U.sum(Calc.focusDone().filter((s) => s.goal_id === g.id).map((s) => s.duration_min));
    const usesManual = !ms.length && !habits.length;
    const cfg = Store.cfg();
    return `<div class="detail">
      <div class="chips-row">${UI.areaChip(g.area)}<span class="chip">${HORIZONS[g.horizon].label} · ${HORIZONS[g.horizon].sub}</span>
        <span class="pace ${pace.key}">${this.paceIcon(pace.key)} ${pace.label}</span></div>
      ${g.description ? `<p class="desc">${U.esc(g.description)}</p>` : ""}
      <div class="goal-hero">
        ${Charts.ring({ value: pace.progress / 100, size: 104, stroke: 9, color: a.color, inner: `<b>${Math.round(pace.progress)}%</b><small>completato</small>` })}
        <dl class="kv">
          <div><dt>Inizio</dt><dd>${U.fmtLong(g.start_date)}</dd></div>
          <div><dt>Scadenza</dt><dd>${U.fmtLong(g.due_date)}</dd></div>
          <div><dt>Atteso oggi</dt><dd>${Math.round(pace.expected)}%</dd></div>
          ${focusMin ? `<div><dt>Focus dedicato</dt><dd>${U.fmtMin(focusMin)}</dd></div>` : ""}
        </dl>
      </div>

      <div class="block">
        <div class="block-head"><h3>Tappe</h3><span class="muted small">${ms.filter((m) => Calc.msPct(m) === 100).length}/${ms.length}</span></div>
        <ul class="checklist steps">${ms.map((m) => this.stepHTML(m)).join("")}</ul>
        <form id="ms-form" class="inline-add"><input placeholder="Aggiungi una tappa…" maxlength="120"><button class="btn ghost sm" type="submit">Aggiungi</button></form>
        ${ms.length ? `<p class="muted small step-hint">Tocca ${Icon.svg("plus", 12)} su una tappa per dividerla in sottotappe: la sua percentuale sale a ogni sottotappa completata.</p>` : ""}
      </div>

      <div class="block">
        <div class="block-head"><h3>Abitudini collegate</h3></div>
        ${habits.length ? `<ul class="linked">${habits.map((h) => `<li>${UI.glyph(h.area)}<span>${U.esc(h.name)}<small class="muted"> · ${Habits.targetText(h)}</small></span>
          <button class="icon-btn sm" data-act="goal-unlink" data-id="${h.id}" aria-label="Scollega">${Icon.svg("x", 16)}</button></li>`).join("")}</ul>` : `<p class="muted small">Nessuna. Ogni giorno completato fa avanzare l'obiettivo.</p>`}
        <div class="btn-row">
          ${free.length ? `<select id="link-habit" data-act-change="goal-link-change"><option value="">Collega un'abitudine…</option>${free.map((h) => `<option value="${h.id}">${U.esc(h.name)}</option>`).join("")}</select>` : ""}
          <button class="btn ghost sm" data-act="goal-new-habit" data-id="${g.id}">${Icon.svg("plus", 16)} Nuova abitudine</button>
        </div>
      </div>

      ${usesManual ? `<div class="block"><div class="block-head"><h3>Avanzamento manuale</h3><span class="muted small">senza tappe o abitudini</span></div>
        <input type="range" min="0" max="100" step="5" value="${g.manual_progress}" data-act-change="goal-manual" data-id="${g.id}" class="range"></div>` : ""}

      <div class="btn-row">
        ${g.status === "done"
          ? `<button class="btn ghost" data-act="goal-reopen" data-id="${g.id}">Riapri obiettivo</button>`
          : `<button class="btn primary" data-act="goal-complete" data-id="${g.id}">${Icon.svg("check", 16)} Segna completato</button>`}
        <button class="btn ghost" data-act="goal-edit" data-id="${g.id}">${Icon.svg("edit", 16)} Modifica</button>
        ${cfg.notionDb ? `<button class="btn ghost" data-act="goal-notion" data-id="${g.id}">${Icon.svg("sync", 16)} ${g.notion_page_id ? "Aggiorna su Notion" : "Invia a Notion"}</button>` : ""}
        <button class="btn ghost danger" data-act="goal-delete" data-id="${g.id}">${Icon.svg("trash", 16)}</button>
      </div>
    </div>`;
  },

  // Una tappa con le sue sottotappe e la percentuale di completamento
  stepHTML(m) {
    const kids = Calc.childrenOf(m), pct = Calc.msPct(m);
    const state = pct >= 100 ? "on" : pct > 0 ? "part" : "";
    return `<li class="step ${pct >= 100 ? "done" : ""}">
      <div class="step-row">
        <button class="round sm ${state}" data-act="ms-toggle" data-id="${m.id}" aria-label="${pct >= 100 ? "Riapri la tappa" : "Completa la tappa"}">${Icon.svg("check", 14)}</button>
        <span class="step-title">${U.esc(m.title)}</span>
        ${kids.length ? `<em class="pct" data-tip="${kids.filter((k) => k.done).length} di ${kids.length} sottotappe">${Math.round(pct)}%</em>` : ""}
        <button class="icon-btn sm" data-act="ms-sub" data-id="${m.id}" aria-label="Aggiungi una sottotappa" data-tip="Aggiungi sottotappa">${Icon.svg("plus", 16)}</button>
        <button class="icon-btn sm" data-act="ms-delete" data-id="${m.id}" aria-label="Elimina la tappa">${Icon.svg("x", 16)}</button>
      </div>
      ${kids.length ? `${Charts.bar({ value: pct, color: "var(--blue-500)", h: 4 })}
      <ul class="subs">${kids.map((k) => `<li class="${k.done ? "done" : ""}">
        <button class="round xs ${k.done ? "on" : ""}" data-act="ms-toggle" data-id="${k.id}" aria-label="Completa la sottotappa">${Icon.svg("check", 11)}</button>
        <span>${U.esc(k.title)}</span>
        <button class="icon-btn xs" data-act="ms-delete" data-id="${k.id}" aria-label="Elimina la sottotappa">${Icon.svg("x", 14)}</button></li>`).join("")}</ul>` : ""}
      ${this.addingSub === m.id ? `<form class="inline-add sub-form" data-act-submit="ms-sub-add" data-id="${m.id}"><input placeholder="Nuova sottotappa…" maxlength="120" autocomplete="off"><button class="btn ghost sm" type="submit">Aggiungi</button></form>` : ""}
    </li>`;
  },

  // Allinea lo stato della tappa madre alle sue sottotappe (fatta = tutte fatte)
  syncParent(pid) {
    const p = Store.d.milestones.find((x) => x.id === pid);
    if (!p) return;
    const kids = Calc.childrenOf(p);
    if (!kids.length) return;
    const all = kids.every((k) => k.done);
    if (p.done !== all) Store.update("milestones", p.id, { done: all, done_at: all ? new Date().toISOString() : null });
  },

  // ---------- form ----------
  openForm(id = null, horizon = null) {
    const g = id ? Store.d.goals.find((x) => x.id === id) : null;
    const hz = g ? g.horizon : horizon || this.tab;
    const start = g ? g.start_date : U.today();
    const due = g ? g.due_date : U.addMonths(start, HORIZONS[hz].months);
    Sheet.open({
      title: g ? "Modifica obiettivo" : "Nuovo obiettivo",
      body: `<form id="goal-form" class="form">
        <label>Cosa vuoi ottenere?<input name="title" required autofocus maxlength="100" placeholder="Es. Correre una mezza maratona" value="${U.esc(g ? g.title : "")}"></label>
        <label>Area<select name="area">${UI.areaOptions(g ? g.area : "progetti")}</select></label>
        <div class="field"><span class="lbl">Orizzonte</span>${UI.seg("horizon", Object.entries(HORIZONS).map(([k, h]) => [k, `${h.label}<small>${h.sub}</small>`]), hz)}</div>
        <div class="row2">
          <label>Inizio<input type="date" name="start_date" required value="${start}"></label>
          <label>Scadenza<input type="date" name="due_date" required value="${due}"></label>
        </div>
        <label>Note<textarea name="description" rows="2" maxlength="300" placeholder="Perché è importante? Come capirai di esserci?">${U.esc(g ? g.description || "" : "")}</textarea></label>
        <button class="btn primary wide" type="submit">${g ? "Salva" : "Crea obiettivo"}</button>
      </form>`,
      onMount: (root) => {
        const form = root.querySelector("#goal-form");
        let dueTouched = !!g;
        form.elements.due_date.addEventListener("input", () => { dueTouched = true; });
        const sync = () => {
          if (dueTouched) return;
          form.elements.due_date.value = U.addMonths(form.elements.start_date.value || U.today(), HORIZONS[form.elements.horizon.value].months);
        };
        form.elements.start_date.addEventListener("change", sync);
        UI.wire(form, (name) => { if (name === "horizon") sync(); });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          if (f.get("due_date") <= f.get("start_date")) return U.toast("La scadenza deve essere dopo l'inizio");
          const row = {
            title: f.get("title").trim(), area: f.get("area"), horizon: f.get("horizon"),
            start_date: f.get("start_date"), due_date: f.get("due_date"), description: (f.get("description") || "").trim() || null
          };
          if (!row.title) return;
          if (g) { Store.update("goals", g.id, row); Sheet.close(); }
          else {
            const created = Store.insert("goals", { ...row, manual_progress: 0, status: "active", notion_page_id: null, done_at: null });
            this.tab = row.horizon;
            Goals.openDetail(created.id);
            U.toast("Obiettivo creato: aggiungi le prime tappe");
          }
        });
      }
    });
  }
};

Actions["goal-new"] = (el) => Goals.openForm(null, el.dataset.id || null);
Actions["goal-edit"] = (el) => Goals.openForm(el.dataset.id);
Actions["goal-open"] = (el) => Goals.openDetail(el.dataset.id);
Actions["goal-tab"] = (el) => { Goals.tab = el.dataset.id; App.render(); };
Actions["goal-complete"] = (el) => {
  Store.update("goals", el.dataset.id, { status: "done", done_at: new Date().toISOString() });
  Goals.refreshDetail();
  U.toast("Obiettivo completato. Bel lavoro!");
};
Actions["goal-reopen"] = (el) => { Store.update("goals", el.dataset.id, { status: "active", done_at: null }); Goals.refreshDetail(); };
Actions["goal-delete"] = (el) => {
  const g = Store.d.goals.find((x) => x.id === el.dataset.id);
  if (!confirm(`Eliminare "${g.title}"? Le abitudini collegate restano, ma vengono scollegate.`)) return;
  Store.remove("goals", g.id);
  Sheet.close();
};
Actions["ms-toggle"] = (el) => {
  const m = Store.d.milestones.find((x) => x.id === el.dataset.id);
  if (!m) return;
  const now = new Date().toISOString(), kids = Calc.childrenOf(m);
  if (kids.length) {
    // tappa con sottotappe: le completa (o riapre) tutte insieme
    const allDone = kids.every((k) => k.done);
    kids.forEach((k) => Store.update("milestones", k.id, { done: !allDone, done_at: !allDone ? now : null }));
    Store.update("milestones", m.id, { done: !allDone, done_at: !allDone ? now : null });
  } else {
    Store.update("milestones", m.id, { done: !m.done, done_at: !m.done ? now : null });
    if (m.parent_id) Goals.syncParent(m.parent_id);
  }
  Goals.refreshDetail();
};
Actions["ms-delete"] = (el) => {
  const m = Store.d.milestones.find((x) => x.id === el.dataset.id);
  if (!m) return;
  const kids = Calc.childrenOf(m).length;
  if (kids && !confirm(`Eliminare la tappa e le sue ${kids} sottotappe?`)) return;
  const pid = m.parent_id;
  Store.remove("milestones", m.id);
  if (pid) Goals.syncParent(pid);
  Goals.refreshDetail();
};
Actions["ms-sub"] = (el) => {
  Goals.addingSub = Goals.addingSub === el.dataset.id ? null : el.dataset.id;
  Goals.refreshDetail();
  const input = Sheet.el && Sheet.el.querySelector(".sub-form input");
  if (input) input.focus();
};
Actions["ms-sub-add"] = (form) => {
  const parent = Store.d.milestones.find((x) => x.id === form.dataset.id);
  const title = form.querySelector("input").value.trim();
  if (!parent || !title) return;
  Store.insert("milestones", { goal_id: parent.goal_id, parent_id: parent.id, title, done: false, done_at: null, position: Calc.childrenOf(parent).length });
  // la tappa madre torna "in corso" se era completa
  if (parent.done) Store.update("milestones", parent.id, { done: false, done_at: null });
  Goals.refreshDetail();
  const input = Sheet.el && Sheet.el.querySelector(".sub-form input");
  if (input) input.focus();
};
Actions["goal-unlink"] = (el) => { Store.update("habits", el.dataset.id, { goal_id: null }); Goals.refreshDetail(); };
Actions["goal-manual"] = (el) => Store.update("goals", el.dataset.id, { manual_progress: Number(el.value) });
Actions["goal-new-habit"] = (el) => Habits.openForm(null, el.dataset.id);
Actions["goal-link-change"] = (el) => {
  if (!el.value || !Goals.openId) return;
  Store.update("habits", el.value, { goal_id: Goals.openId });
  Goals.refreshDetail();
};
