// ============================================================
// Obiettivi: breve (1 mese), medio (4 mesi), lungo (1 anno o più).
// Avanzamento = milestone completate + costanza delle abitudini
// collegate; se non c'è né l'una né l'altra, si imposta a mano.
// ============================================================
const Goals = {
  tab: "short",
  openId: null,
  examId: null,        // id della tappa-esame aperta nel gestore (dentro lo stesso Sheet)
  showDone: false,
  addingSub: null,     // id della tappa a cui si sta aggiungendo una sottotappa

  paceIcon(key) { return { ahead: "▲", on: "●", slight: "◐", behind: "▼", done: "✓" }[key]; },

  card(g) {
    const pace = Calc.goalPace(g);
    const left = Calc.daysLeft(g);
    const leftTxt = g.status === "done" ? "Completato" : g.horizon === "recurring" ? (left === 0 ? "Ultimo giorno" : `${left} giorni al periodo`) : left < 0 ? `Scaduto da ${-left} g` : left === 0 ? "Scade oggi" : left < 60 ? `${left} giorni` : `${Math.round(left / 30)} mesi`;
    const a = AREAS[g.area] || AREAS.progetti;
    const ms = Calc.milestonesOf(g);
    const kids = Calc.childGoals(g);
    return `<article class="goal-card" data-act="goal-open" data-id="${g.id}">
      <div class="goal-top">${UI.areaChip(g.area, true)}<span class="pace ${pace.key}" data-tip="Atteso ${Math.round(pace.expected)}% · reale ${Math.round(pace.progress)}%">${this.paceIcon(pace.key)} ${pace.label}</span></div>
      <h3>${U.esc(g.title)}</h3>
      <div class="goal-prog">
        ${Charts.bar({ value: pace.progress, color: a.color, mark: g.status === "done" ? null : pace.expected, h: 8 })}
        <div class="goal-nums"><b>${Math.round(pace.progress)}%</b><span>${ms.length ? `${ms.filter((m) => Calc.msPct(m) === 100).length}/${ms.length} tappe · ` : ""}${kids.length ? `${kids.filter((k) => k.status === "done").length}/${kids.length} figli · ` : ""}${Calc.goalBooks(g) ? `${Calc.goalBooks(g).count}/${Calc.goalBooks(g).target} libri · ` : ""}${leftTxt}</span></div>
      </div>
      ${g.horizon === "recurring" ? `<div class="period-dots">${Calc.periodHistory(g, 7).map((p) => `<i class="pd ${p.pct >= 100 ? "on" : p.pct > 0 ? "part" : ""} ${p.current ? "cur" : ""}" data-tip="${U.fmtShort(p.from)}–${U.fmtShort(p.to)}: ${Math.round(p.pct)}%"></i>`).join("")}</div>` : ""}
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
      <div class="seg tabs4" data-tabs="goals">${Object.entries(HORIZONS).map(([k, h]) =>
        `<button class="${this.tab === k ? "on" : ""}" data-act="goal-tab" data-id="${k}">${h.label}<small>${h.sub}</small></button>`).join("")}</div>
      <div class="goal-cols">${["short", "medium", "long", "recurring"].map(col).join("")}</div>
      <p class="legend-note">La tacca sulla barra è dove dovresti essere in base al tempo trascorso.</p>
      ${done.length ? `<details class="archived"><summary>Completati (${done.length})</summary>${done.map((g) => `<div class="row-card slim" data-act="goal-open" data-id="${g.id}">${UI.glyph(g.area)}<div class="row-main"><h3>${U.esc(g.title)}</h3><p class="muted">${HORIZONS[g.horizon].label}</p></div></div>`).join("")}</details>` : ""}`;
  },

  // ---------- dettaglio ----------
  openDetail(id) {
    const g = Store.d.goals.find((x) => x.id === id);
    if (!g) return;
    this.openId = id;
    Sheet.open({ title: g.title, wide: true, body: this.detailHTML(g), onClose: () => { this.openId = null; this.examId = null; this.addingSub = null; }, onMount: (root) => {
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
    const bk = Calc.goalBooks(g);
    const kids = Calc.childGoals(g);
    const parent = g.parent_goal_id ? Store.d.goals.find((x) => x.id === g.parent_goal_id) : null;
    const canHaveKids = g.horizon === "medium" || g.horizon === "long";
    const usesManual = !ms.length && !habits.length && !bk && !kids.length && g.weight_target == null;
    const cfg = Store.cfg();
    const period = g.horizon === "recurring" ? Calc.periodRange(g.period) : null;
    return `<div class="detail">
      <div class="chips-row">${UI.areaChip(g.area)}<span class="chip">${HORIZONS[g.horizon].label} · ${HORIZONS[g.horizon].sub}</span>
        <span class="pace ${pace.key}">${this.paceIcon(pace.key)} ${pace.label}</span>
        ${parent ? `<button class="chip link" data-act="goal-open" data-id="${parent.id}">${Icon.svg("right", 12)} ${U.esc(parent.title)}</button>` : ""}</div>
      ${g.description ? `<p class="desc">${U.esc(g.description)}</p>` : ""}
      <div class="goal-hero">
        ${Charts.ring({ value: pace.progress / 100, size: 104, stroke: 9, color: a.color, inner: `<b>${Math.round(pace.progress)}%</b><small>completato</small>` })}
        <dl class="kv">
          ${period ? `<div><dt>Periodo</dt><dd>${U.fmtShort(period[0])} – ${U.fmtShort(period[1])}</dd></div>`
            : `<div><dt>Inizio</dt><dd>${U.fmtLong(g.start_date)}</dd></div><div><dt>Scadenza</dt><dd>${U.fmtLong(g.due_date)}</dd></div>`}
          <div><dt>Atteso oggi</dt><dd>${Math.round(pace.expected)}%</dd></div>
          ${focusMin ? `<div><dt>Focus dedicato</dt><dd>${U.fmtMin(focusMin)}</dd></div>` : ""}
        </dl>
      </div>
      ${period ? `<div class="period-dots lg">${Calc.periodHistory(g, 11).map((p) => `<i class="pd ${p.pct >= 100 ? "on" : p.pct > 0 ? "part" : ""} ${p.current ? "cur" : ""}" data-tip="${U.fmtShort(p.from)}–${U.fmtShort(p.to)}: ${Math.round(p.pct)}%"></i>`).join("")}</div>` : ""}

      <div class="block">
        <div class="block-head"><h3>Tappe</h3><span class="muted small">${ms.filter((m) => Calc.msPct(m) === 100).length}/${ms.length}</span></div>
        <ul class="checklist steps">${ms.map((m) => this.stepHTML(m)).join("")}</ul>
        <form id="ms-form" class="inline-add"><input placeholder="Aggiungi una tappa…" maxlength="120"><button class="btn ghost sm" type="submit">Aggiungi</button></form>
        ${ms.length ? `<p class="muted small step-hint">Tocca ${Icon.svg("plus", 12)} su una tappa per dividerla in sottotappe, o ${Icon.svg("book", 12)} per gestirla come esame.</p>` : ""}
      </div>

      ${bk ? `<div class="block">
        <div class="block-head"><h3>Libri letti</h3><span class="muted small">${bk.count}/${bk.target}</span></div>
        ${Charts.bar({ value: bk.pct, color: "var(--orange-500)", h: 8 })}
        ${bk.done.length ? `<ul class="book-mini">${bk.done.slice(0, 8).map((r) => `<li>${Reading.cover(r)}<span><b>${U.esc(r.title)}</b><small>${U.esc(r.author || "")}${r.author ? " · " : ""}finito il ${U.fmtShort(U.dateOf(r.done_at))}</small></span></li>`).join("")}</ul>`
          : `<p class="muted small">Nessun libro finito dal ${U.fmtShort(g.start_date)}. Quando finisci un libro in Lettura viene contato qui e fa avanzare l'obiettivo.</p>`}
        <div class="btn-row"><button class="btn ghost sm" data-act="go" data-id="reading" data-close="1">${Icon.svg("book", 14)} Vai a Lettura</button></div>
      </div>` : ""}

      ${g.weight_target != null ? this.weightBlockHTML(g) : ""}

      <div class="block">
        <div class="block-head"><h3>Abitudini collegate</h3></div>
        ${habits.length ? `<ul class="linked">${habits.map((h) => `<li>${UI.glyph(h.area)}<span>${U.esc(h.name)}<small class="muted"> · ${Habits.targetText(h)}</small></span>
          <button class="icon-btn sm" data-act="goal-unlink" data-id="${h.id}" aria-label="Scollega">${Icon.svg("x", 16)}</button></li>`).join("")}</ul>` : `<p class="muted small">Nessuna. Ogni giorno completato fa avanzare l'obiettivo.</p>`}
        <div class="btn-row">
          ${free.length ? `<select id="link-habit" data-act-change="goal-link-change"><option value="">Collega un'abitudine…</option>${free.map((h) => `<option value="${h.id}">${U.esc(h.name)}</option>`).join("")}</select>` : ""}
          <button class="btn ghost sm" data-act="goal-new-habit" data-id="${g.id}">${Icon.svg("plus", 16)} Nuova abitudine</button>
        </div>
      </div>

      ${canHaveKids ? `<div class="block">
        <div class="block-head"><h3>Obiettivi collegati</h3></div>
        ${kids.length ? `<ul class="linked">${kids.map((k) => `<li data-act="goal-open" data-id="${k.id}" role="button"><span>${U.esc(k.title)}<small class="muted"> · ${HORIZONS[k.horizon].label} · ${Math.round(Calc.goalProgress(k))}%</small></span>${Icon.svg("right", 14)}</li>`).join("")}</ul>`
          : `<p class="muted small">Nessuno. Collega un obiettivo a breve o medio termine a questo scegliendolo come "genitore" dal suo modulo di modifica.</p>`}
      </div>` : ""}

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

  setBooks(id, n) {
    const map = { ...(Store.cfg().goalBooks || {}) };
    if (n > 0) map[id] = n; else delete map[id];
    Store.setSettings({ goalBooks: map });
  },

  // Peso di partenza: l'ultima pesata registrata prima dell'inizio, o la prima disponibile
  weightStart(g) {
    const logs = [...Store.d.weight_logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    if (!logs.length) return null;
    const before = [...logs].filter((w) => w.log_date <= g.start_date).pop();
    return before ? Number(before.kg) : Number(logs[0].kg);
  },

  weightBlockHTML(g) {
    const logs = Store.d.weight_logs;
    const start = this.weightStart(g);
    const latest = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date)).pop();
    const current = latest ? Number(latest.kg) : start;
    const pct = Calc.weightProgress(g);
    return `<div class="block">
      <div class="block-head"><h3>Peso</h3><span class="muted small">${pct == null ? "–" : Math.round(pct) + "%"}</span></div>
      ${pct != null ? Charts.bar({ value: pct, color: "var(--blue-500)", h: 8 }) : ""}
      <p class="muted small">${start != null && current != null
        ? `${U.num(start)} kg → <b>${U.num(current)} kg</b> · obiettivo ${U.num(g.weight_target)} kg`
        : "Registra almeno una pesata in Benessere → Peso per iniziare a tracciare questo obiettivo."}</p>
      <div class="btn-row"><button class="btn ghost sm" data-act="go" data-id="body" data-close="1">${Icon.svg("scale", 14)} Vai a Benessere</button></div>
    </div>`;
  },

  // Una tappa con le sue sottotappe e la percentuale di completamento (o il gestore esame, se lo è)
  stepHTML(m) {
    if (m.is_exam) return this.examStepHTML(m);
    const kids = Calc.childrenOf(m), pct = Calc.msPct(m);
    const state = pct >= 100 ? "on" : pct > 0 ? "part" : "";
    return `<li class="step ${pct >= 100 ? "done" : ""}">
      <div class="step-row">
        <button class="round sm ${state}" data-act="ms-toggle" data-id="${m.id}" aria-label="${pct >= 100 ? "Riapri la tappa" : "Completa la tappa"}">${Icon.svg("check", 14)}</button>
        <span class="step-title">${U.esc(m.title)}</span>
        ${kids.length ? `<em class="pct" data-tip="${kids.filter((k) => k.done).length} di ${kids.length} sottotappe">${Math.round(pct)}%</em>` : ""}
        <button class="icon-btn sm" data-act="ms-exam" data-id="${m.id}" aria-label="Gestisci come esame" data-tip="È un esame">${Icon.svg("book", 16)}</button>
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

  // Riga compatta di una tappa-esame nella lista tappe: percentuale complessiva + link al gestore
  examStepHTML(m) {
    const pct = Calc.msPct(m);
    return `<li class="step exam ${pct >= 100 ? "done" : ""}" data-act="exam-open" data-id="${m.id}" role="button">
      <div class="step-row">
        <span class="exam-badge">${Icon.svg("book", 14)}</span>
        <span class="step-title">${U.esc(m.title)}</span>
        <em class="pct">${Math.round(pct)}%</em>
        ${Icon.svg("right", 16)}
      </div>
      ${Charts.bar({ value: pct, color: "var(--blue-500)", h: 4 })}
    </li>`;
  },

  // ---------- gestione del singolo esame ----------
  PHASE_LABELS: { studio: "Primo studio", ripasso: "Ripasso", preparazione: "Preparazione esame" },

  openExam(id) {
    const m = Store.d.milestones.find((x) => x.id === id);
    if (!m) return;
    this.examId = id;
    Sheet.setBody(this.examManagerHTML(m), m.title);
  },

  refreshExam() {
    if (!this.examId || !Sheet.isOpen()) return;
    const m = Store.d.milestones.find((x) => x.id === this.examId);
    if (m) Sheet.setBody(this.examManagerHTML(m), m.title); else this.examId = null;
  },

  examManagerHTML(m) {
    const g = Store.d.goals.find((x) => x.id === m.goal_id);
    const pct = Calc.msPct(m);
    const studyMin = U.sum(Calc.focusDone().filter((s) => s.milestone_id === m.id).map((s) => s.duration_min));
    return `<div class="detail exam-detail">
      ${g ? `<div class="chips-row"><span class="chip">${U.esc(g.title)}</span></div>` : ""}
      <div class="goal-hero">
        ${Charts.ring({ value: pct / 100, size: 96, stroke: 9, color: "var(--blue-500)", inner: `<b>${Math.round(pct)}%</b><small>completato</small>` })}
        <dl class="kv">
          <div><dt>Appello</dt><dd>${m.exam_date ? U.fmtLong(m.exam_date) : "non fissato"}</dd></div>
          <div><dt>CFU</dt><dd>${m.exam_cfu ?? "–"}</dd></div>
          <div><dt>Voto</dt><dd>${U.esc(m.exam_grade || "–")}</dd></div>
          ${studyMin ? `<div><dt>Focus dedicato</dt><dd>${U.fmtMin(studyMin)}</dd></div>` : ""}
        </dl>
      </div>

      <form class="form" data-act-submit="exam-meta-save" data-id="${m.id}">
        <div class="row2">
          <label>Data appello<input type="date" name="exam_date" value="${m.exam_date || ""}"></label>
          <label>CFU<input type="number" name="exam_cfu" min="0" max="60" step="0.5" value="${m.exam_cfu ?? ""}"></label>
        </div>
        <label>Voto (anche atteso)<input name="exam_grade" maxlength="10" placeholder="Es. 28, o «atteso 27»" value="${U.esc(m.exam_grade || "")}"></label>
        <button class="btn ghost sm" type="submit">Salva</button>
      </form>

      ${Calc.EXAM_PHASES.map((p) => this.examPhaseHTML(m, p)).join("")}

      <div class="btn-row">
        <button class="btn ghost sm" data-act="go" data-id="focus" data-close="1">${Icon.svg("tree", 14)} Dedica una sessione di focus</button>
      </div>
      <div class="btn-row">
        <button class="btn ghost wide" data-act="exam-back">${Icon.svg("left", 14)} Torna all'obiettivo</button>
        <button class="btn ghost danger sm" data-act="ms-exam" data-id="${m.id}">Non è più un esame</button>
      </div>
    </div>`;
  },

  examPhaseHTML(m, phase) {
    const items = Calc.childrenOf(m).filter((k) => k.phase === phase);
    const pct = Calc.examPhasePct(m, phase);
    return `<div class="block exam-phase">
      <div class="block-head"><h3>${this.PHASE_LABELS[phase]}</h3><span class="muted small">${Math.round(pct)}%</span></div>
      ${Charts.bar({ value: pct, color: "var(--orange-500)", h: 6 })}
      ${items.length ? `<ul class="checklist steps sm">${items.map((k) => `<li class="step ${k.done ? "done" : ""}"><div class="step-row">
        <button class="round xs ${k.done ? "on" : ""}" data-act="ms-toggle" data-id="${k.id}" aria-label="Completa">${Icon.svg("check", 11)}</button>
        <span class="step-title">${U.esc(k.title)}</span>
        <button class="icon-btn sm" data-act="ms-delete" data-id="${k.id}" aria-label="Elimina">${Icon.svg("x", 14)}</button>
      </div></li>`).join("")}</ul>` : `<p class="muted small">Nessun argomento ancora.</p>`}
      <form class="inline-add" data-act-submit="exam-topic-add" data-id="${m.id}" data-phase="${phase}"><input placeholder="Aggiungi un argomento…" maxlength="120" autocomplete="off"><button class="btn ghost sm" type="submit">Aggiungi</button></form>
    </div>`;
  },

  // Allinea lo stato della tappa madre alle sue sottotappe/argomenti (fatta = tutti fatti)
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
    const hz = g ? g.horizon : horizon || this.tab || "short";
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
          <label data-field="due">Scadenza<input type="date" name="due_date" required value="${due}"></label>
          <label data-field="period" class="hidden">Periodo<select name="period">${Object.entries(PERIODS).map(([k, p]) => `<option value="${k}" ${g && g.period === k ? "selected" : ""}>${p.label}</option>`).join("")}</select></label>
        </div>
        <div data-field="parent"><label>Fa parte di (facoltativo)<select name="parent_goal_id"></select></label>
          <small class="muted">L'avanzamento di questo obiettivo concorre anche a quello del genitore.</small></div>
        <label>Libri da leggere (collega la Lettura)<input name="books" type="number" min="0" max="500" inputmode="numeric" placeholder="Es. 12 (lascia vuoto se non serve)" value="${g && Calc.booksTarget(g) ? Calc.booksTarget(g) : ""}">
          <small class="muted">Ogni libro che finisci in Lettura dentro il periodo dell'obiettivo fa avanzare la percentuale.</small></label>
        <label>Peso obiettivo in kg (collega Benessere → Peso)<input name="weight_target" type="number" min="20" max="400" step="0.1" placeholder="Es. 75 (lascia vuoto se non serve)" value="${g && g.weight_target != null ? g.weight_target : ""}">
          <small class="muted">L'avanzamento tiene conto della distanza dal peso registrato più vicino all'inizio, verso questo obiettivo.</small></label>
        <label>Note<textarea name="description" rows="2" maxlength="300" placeholder="Perché è importante? Come capirai di esserci?">${U.esc(g ? g.description || "" : "")}</textarea></label>
        <button class="btn primary wide" type="submit">${g ? "Salva" : "Crea obiettivo"}</button>
      </form>`,
      onMount: (root) => {
        const form = root.querySelector("#goal-form");
        let dueTouched = !!g;
        form.elements.due_date.addEventListener("input", () => { dueTouched = true; });
        const parentSelect = form.elements.parent_goal_id;
        let curParent = g ? (g.parent_goal_id || "") : "";
        parentSelect.addEventListener("change", () => { curParent = parentSelect.value; });
        const refreshParents = () => {
          const opts = Calc.possibleParents({ horizon: form.elements.horizon.value, id: g && g.id });
          root.querySelector('[data-field="parent"]').classList.toggle("hidden", !opts.length);
          parentSelect.innerHTML = `<option value="">Nessuno</option>${opts.map((o) => `<option value="${o.id}" ${o.id === curParent ? "selected" : ""}>${U.esc(o.title)}</option>`).join("")}`;
        };
        const sync = () => {
          const rec = form.elements.horizon.value === "recurring";
          root.querySelector('[data-field="due"]').classList.toggle("hidden", rec);
          root.querySelector('[data-field="period"]').classList.toggle("hidden", !rec);
          if (!rec && !dueTouched) form.elements.due_date.value = U.addMonths(form.elements.start_date.value || U.today(), HORIZONS[form.elements.horizon.value].months);
          refreshParents();
        };
        form.elements.start_date.addEventListener("change", sync);
        UI.wire(form, (name) => { if (name === "horizon") sync(); });
        sync();
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          const hzVal = f.get("horizon"), recurring = hzVal === "recurring";
          if (!recurring && f.get("due_date") <= f.get("start_date")) return U.toast("La scadenza deve essere dopo l'inizio");
          if (recurring && !f.get("period")) return U.toast("Scegli un periodo");
          const row = {
            title: f.get("title").trim(), area: f.get("area"), horizon: hzVal,
            start_date: f.get("start_date"), due_date: recurring ? U.addMonths(f.get("start_date"), 12) : f.get("due_date"),
            period: recurring ? f.get("period") : null,
            parent_goal_id: f.get("parent_goal_id") || null,
            weight_target: f.get("weight_target") ? Number(f.get("weight_target")) : null,
            description: (f.get("description") || "").trim() || null
          };
          if (!row.title) return;
          const books = Math.max(0, Math.round(Number(f.get("books")) || 0));
          if (g) { Store.update("goals", g.id, row); this.setBooks(g.id, books); Sheet.close(); }
          else {
            const created = Store.insert("goals", { ...row, manual_progress: 0, status: "active", notion_page_id: null, done_at: null });
            this.setBooks(created.id, books);
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
  Goals.setBooks(g.id, 0);
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
  Goals.refreshExam();
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
  Goals.refreshExam();
};
Actions["ms-exam"] = (el) => {
  const m = Store.d.milestones.find((x) => x.id === el.dataset.id);
  if (!m) return;
  if (m.is_exam) {
    if (!confirm("Non è più un esame: gli argomenti restano come sottotappe semplici. Continuare?")) return;
    Store.update("milestones", m.id, { is_exam: false });
    Goals.examId = null;
    Goals.refreshDetail();
  } else {
    Store.update("milestones", m.id, { is_exam: true });
    Goals.refreshDetail();
    U.toast("Ora è un esame: tocca la tappa per gestirlo");
  }
};
Actions["exam-open"] = (el) => Goals.openExam(el.dataset.id);
Actions["exam-back"] = () => { Goals.examId = null; Goals.refreshDetail(); };
Actions["exam-meta-save"] = (form) => {
  const f = new FormData(form);
  Store.update("milestones", form.dataset.id, {
    exam_date: f.get("exam_date") || null,
    exam_cfu: f.get("exam_cfu") ? Number(f.get("exam_cfu")) : null,
    exam_grade: (f.get("exam_grade") || "").trim() || null
  });
  Goals.refreshExam();
  U.toast("Salvato");
};
Actions["exam-topic-add"] = (form) => {
  const m = Store.d.milestones.find((x) => x.id === form.dataset.id);
  const title = form.querySelector("input").value.trim();
  if (!m || !title) return;
  Store.insert("milestones", { goal_id: m.goal_id, parent_id: m.id, phase: form.dataset.phase, title, done: false, done_at: null, position: Calc.childrenOf(m).length });
  Goals.refreshExam();
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
