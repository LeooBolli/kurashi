// ============================================================
// Impostazioni: obiettivi personali, integrazioni, esportazione
// ============================================================
const Settings = {
  csvName: "Log_abitudini",

  render(el) {
    const cfg = Store.cfg();
    const sets = Object.keys(Export.datasets());
    const hidSubmit = `<button type="submit" class="sr" tabindex="-1">Salva</button>`;
    el.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Impostazioni</p><h1 class="title">Su <em>misura</em></h1>
        <p class="sub">Le modifiche si salvano da sole.</p></div></div>
      <div class="settings">
        <section class="card">
          <h2 class="h3">Traguardi personali</h2>
          <p class="hint">Servono per calcolare il punteggio e i grafici.</p>
          <form class="form" data-act-submit="settings-save" data-autosave="settings-save">
            <label>Il tuo nome<input name="name" maxlength="30" autocomplete="given-name" value="${U.esc(cfg.name)}"></label>
            <div class="row2">
              <label>Focus a settimana (ore)<input name="focus" type="number" min="1" max="80" step="0.5" inputmode="decimal" value="${U.esc(cfg.focusWeeklyMin / 60)}"></label>
              <label>Sonno ideale (ore)<input name="sleep" type="number" min="4" max="12" step="0.25" inputmode="decimal" value="${U.esc(cfg.sleepTarget)}"></label>
            </div>
            <label>Peso ideale (kg, facoltativo)<input name="weight" type="number" min="20" max="300" step="0.1" inputmode="decimal" value="${U.esc(cfg.weightTarget ?? "")}">
              <small class="hint">Riga di riferimento nel grafico del peso, e valore a cui si collegano gli obiettivi di peso.</small></label>
            <label>Obiettivo collegato all'alimentazione<select name="dietGoal"><option value="">Automatico: il primo obiettivo di peso</option>${Calc.activeGoals().map((g) => `<option value="${U.esc(g.id)}" ${g.id === cfg.dietGoal ? "selected" : ""}>${U.esc(g.title)}</option>`).join("")}</select>
              <small class="hint">In Alimentazione vedi a che punto sei, e nell'obiettivo quanti giorni hai rispettato la dieta.</small></label>
            <label class="check"><input name="strict" type="checkbox" ${cfg.focusStrict ? "checked" : ""}>
              <span><b>Interrompi la sessione se esco dall'app</b><small class="hint">Se cambi app per più di 10 secondi la sessione di focus si interrompe. Per bloccare lo schermo tocca «Blocco lo schermo» nel timer. Disattivo: la sessione continua sempre.</small></span></label>
            <label>Evidenziazioni da ripassare al giorno<input name="recall" type="number" min="1" max="15" step="1" inputmode="numeric" value="${U.esc(cfg.recallPerDay)}"></label>
            ${hidSubmit}
          </form>
        </section>

        <section class="card">
          <h2 class="h3">Aree</h2>
          <p class="hint">Raggruppano abitudini e obiettivi. Le sei di base sono uguali per tutti; puoi aggiungere le tue, con nome, colore e icona.</p>
          <div class="chips-row area-base">${Object.keys(BASE_AREAS).map((k) => UI.areaChip(k)).join("")}</div>
          ${Areas.custom().length ? `<ul class="area-list">${Areas.custom().map((a) => `<li>${UI.areaChip(a.id)}
            <span class="muted small">${Areas.usageText(a.id)}</span>
            <span class="area-list-btns"><button class="btn ghost sm" data-act="area-edit" data-id="${U.esc(a.id)}" aria-label="Modifica l'area ${U.esc(a.label)}">${Icon.svg("edit", 16)}</button>
            <button class="btn ghost sm danger" data-act="area-delete" data-id="${U.esc(a.id)}" aria-label="Elimina l'area ${U.esc(a.label)}">${Icon.svg("trash", 16)}</button></span></li>`).join("")}</ul>` : ""}
          <div class="btn-row"><button class="btn primary" data-act="area-new">${Icon.svg("plus", 16)} Nuova area</button></div>
        </section>

        <section class="card">
          <h2 class="h3">Aspetto</h2>
          <p class="hint">Colori, vetro dei widget, luminosità e sfondo. Valgono su tutti i tuoi dispositivi; il tema chiaro o scuro si sceglie dall'interruttore in alto.</p>
          <div class="btn-row"><button class="btn primary" data-act="look-open">${Icon.svg("palette", 16)} Personalizza l'aspetto</button></div>
          <form class="form" data-act-submit="weather-save" data-autosave="weather-save">
            <label>Città per il meteo<input name="city" maxlength="60" autocomplete="address-level2" placeholder="Vuoto = posizione del dispositivo" value="${U.esc(cfg.weatherCity || "")}">
              <small class="hint">Lascia vuoto per usare la posizione del dispositivo (il browser ti chiede il permesso). Il meteo arriva da Open-Meteo, gratuito e senza account.</small></label>
            ${hidSubmit}
          </form>
        </section>

        ${Auth.isOwner() ? `<section class="card">
          <h2 class="h3">Integrazioni</h2>
          <p class="hint">Le chiavi API non stanno mai in questa app: restano come segreti nella funzione Supabase (vedi README).</p>
          <div class="integ">
            <div class="integ-row"><div><b>Raindrop.io</b><span class="hint">Importa i bookmark nella sezione Lettura</span></div>
              <button class="btn ghost sm" data-act="raindrop-test">Verifica</button></div>
            <form class="form inline" data-act-submit="raindrop-save" data-autosave="raindrop-save">
              <label>ID collezione (0 = tutte)<input name="collection" type="number" min="-1" inputmode="numeric" value="${U.esc(cfg.raindropCollection ?? 0)}"></label>
              ${hidSubmit}
            </form>
            <div class="integ-row"><div><b>Notion</b><span class="hint">Invia i tuoi obiettivi a un database Notion</span></div>
              <button class="btn ghost sm" data-act="notion-test">Verifica</button></div>
            <form class="form inline" data-act-submit="notion-save" data-autosave="notion-save">
              <label>ID database Notion<input name="db" maxlength="80" placeholder="32 caratteri dall'URL del database" value="${U.esc(cfg.notionDb || "")}"></label>
              ${hidSubmit}
            </form>
            ${cfg.notionDb ? `<button class="btn ghost" data-act="notion-sync-all">${Icon.svg("sync", 16)} Invia tutti gli obiettivi a Notion</button>` : ""}
            <p id="integ-status" class="hint" role="status" aria-live="polite"></p>
          </div>
        </section>` : ""}

        <section class="card">
          <h2 class="h3">Esporta i tuoi dati</h2>
          <p class="hint">Tutto quello che hai registrato, sempre tuo.</p>
          <div class="btn-row">
            <button class="btn primary" data-act="export-xlsx">${Icon.svg("download", 16)} Excel (tutti i fogli)</button>
          </div>
          <div class="csv-row">
            <select id="csv-name" aria-label="Tabella da esportare in CSV">${sets.map((s) => `<option value="${U.esc(s)}" ${s === this.csvName ? "selected" : ""}>${U.esc(s.replace(/_/g, " "))}</option>`).join("")}</select>
            <button class="btn ghost" data-act="export-csv">${Icon.svg("download", 16)} CSV</button>
          </div>
        </section>

        <section class="card">
          <h2 class="h3">Account</h2>
          <p class="hint">${DEMO ? "Modalità demo: i dati sono solo in questo browser. Compila js/config.js per collegare Supabase." : "Connesso con Supabase. I tuoi dati sono visibili solo a te."}</p>
          ${DEMO ? `<button class="btn danger-solid" data-act="demo-reset">${Icon.svg("trash", 16)} Azzera dati demo</button>`
            : `<button class="btn ghost" data-act="logout">${Icon.svg("logout", 16)} Esci</button>`}
        </section>
      </div>`;
  },

  // Salvataggio automatico: ogni form con data-autosave="azione" si salva poco dopo una modifica.
  // Dopo il salvataggio la pagina si ridisegna: il focus torna sullo stesso campo.
  _t: null,
  autosave(form) {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      if (!form.isConnected || !Actions[form.dataset.autosave]) return;
      const a = document.activeElement, name = a && form.contains(a) ? a.name : null, act = form.dataset.autosave;
      Actions[act](form, { silent: false });
      if (!name) return;
      requestAnimationFrame(() => {
        if (document.activeElement && document.activeElement !== document.body) return;
        const again = document.querySelector(`form[data-autosave="${act}"] [name="${name}"]`);
        if (again) again.focus({ preventScroll: true });
      });
    }, 350);
  },

  status(msg) { const s = document.getElementById("integ-status"); if (s) s.textContent = msg; },

  async call(body) {
    if (DEMO) throw new Error("Disponibile dopo aver collegato Supabase");
    const { data, error } = await sb.functions.invoke("integrations", { body });
    if (error) throw new Error(error.message || "Funzione non raggiungibile");
    if (data && data.error) throw new Error(data.error);
    return data;
  },

  async pushGoal(g) {
    const cfg = Store.cfg();
    const p = Calc.goalPace(g);
    const data = await this.call({
      action: "notion_upsert_goal", databaseId: cfg.notionDb,
      goal: {
        pageId: g.notion_page_id, title: g.title, area: (AREAS[g.area] || AREAS.progetti).label, horizon: HORIZONS[g.horizon].label,
        progress: Math.round(p.progress), due: g.due_date, status: g.status === "done" ? "Completato" : "In corso", note: g.description || ""
      }
    });
    if (data.pageId && data.pageId !== g.notion_page_id) Store.update("goals", g.id, { notion_page_id: data.pageId });
    return data;
  }
};

// I form delle impostazioni usano data-act-submit (gestito in app.js)
Actions["settings-save"] = (form) => {
  const f = new FormData(form);
  Store.setSettings({
    name: (f.get("name") || "").trim() || Auth.profile().name || "",
    focusWeeklyMin: Math.round((Number(f.get("focus")) || 10) * 60),
    sleepTarget: Number(f.get("sleep")) || 8,
    weightTarget: f.get("weight") ? Number(f.get("weight")) : null,
    recallPerDay: U.clamp(Math.round(Number(f.get("recall")) || 5), 1, 15),
    focusStrict: f.get("strict") === "on",
    dietGoal: f.get("dietGoal") || null
  });
  U.toast("Salvato");
};

// I campi delle impostazioni si salvano da soli (al cambio di valore)
document.addEventListener("change", (e) => {
  const form = e.target.closest && e.target.closest("form[data-autosave]");
  if (form) Settings.autosave(form);
});

Actions["demo-reset"] = async () => {
  const ok = await UI.confirm({ title: "Azzerare i dati demo?", text: "Tutto quello che hai inserito in questo browser viene cancellato e si riparte dai dati di esempio.", confirmLabel: "Azzera", danger: true });
  if (!ok) return;
  try { localStorage.removeItem(LocalBackend.KEY); } catch { /* storage bloccato */ }
  if (Auth.clearDeviceData) Auth.clearDeviceData();
  location.reload();
};
Actions["raindrop-save"] = (form) => { Store.setSettings({ raindropCollection: Number(new FormData(form).get("collection")) || 0 }); U.toast("Salvato"); };
Actions["notion-save"] = (form) => {
  const raw = (new FormData(form).get("db") || "").trim();
  // accetta anche l'URL intero: prende i 32 caratteri esadecimali
  const m = raw.replace(/-/g, "").match(/[0-9a-f]{32}/i);
  Store.setSettings({ notionDb: m ? m[0] : raw });
  U.toast("Salvato");
};
Actions["raindrop-test"] = async () => {
  Settings.status("Controllo Raindrop…");
  try { const d = await Settings.call({ action: "raindrop_ping" }); Settings.status(`Raindrop collegato${d.user ? " come " + d.user : ""}.`); }
  catch (e) { Settings.status("Raindrop: " + e.message); }
};
Actions["notion-test"] = async () => {
  Settings.status("Controllo Notion…");
  try { const d = await Settings.call({ action: "notion_ping", databaseId: Store.cfg().notionDb }); Settings.status(`Notion collegato: database "${d.title}".`); }
  catch (e) { Settings.status("Notion: " + e.message); }
};
Actions["notion-sync-all"] = async () => {
  const goals = Store.d.goals.filter((g) => g.status !== "archived");
  let ok = 0;
  for (const g of goals) {
    Settings.status(`Invio ${ok + 1}/${goals.length}…`);
    try { await Settings.pushGoal(g); ok++; } catch (e) { Settings.status("Notion: " + e.message); return; }
  }
  Settings.status(`${ok} obiettivi inviati a Notion.`);
};
Actions["goal-notion"] = async (el) => {
  const g = Store.d.goals.find((x) => x.id === el.dataset.id);
  try { await Settings.pushGoal(g); U.toast("Obiettivo inviato a Notion"); Goals.refreshDetail(); }
  catch (e) { U.toast("Notion: " + e.message); }
};
Actions["export-xlsx"] = () => Export.excel();
Actions["export-csv"] = () => { Settings.csvName = document.getElementById("csv-name").value; Export.csv(Settings.csvName); };
Actions["logout"] = () => Auth.logout();

// ---------- Aree personali (settings.data.customAreas = [{ id, label, color, icon }]) ----------
const Areas = {
  custom() { return (Store.settings.customAreas || []).filter((a) => AREAS[a.id]); },

  uses(id) {
    return { habits: Store.d.habits.filter((h) => h.area === id), goals: Store.d.goals.filter((g) => g.area === id) };
  },

  usageText(id) {
    const { habits, goals } = this.uses(id);
    const parts = [];
    if (habits.length) parts.push(`${habits.length} ${habits.length === 1 ? "abitudine" : "abitudini"}`);
    if (goals.length) parts.push(`${goals.length} ${goals.length === 1 ? "obiettivo" : "obiettivi"}`);
    return parts.join(" · ") || "non ancora usata";
  },

  // Restituisce l'id della nuova area, o null se annullata
  async create() {
    const v = await UI.areaDialog();
    if (!v) return null;
    const id = "c_" + Math.random().toString(36).slice(2, 10);
    Store.setSettings({ customAreas: [...(Store.settings.customAreas || []), { id, ...v }] });
    U.toast(`Area «${v.label}» creata`);
    return id;
  },

  async edit(id) {
    const a = AREAS[id];
    if (!a || !a.custom) return;
    const v = await UI.areaDialog({ id, ...a });
    if (!v) return;
    Store.setSettings({ customAreas: (Store.settings.customAreas || []).map((x) => (x.id === id ? { ...x, ...v } : x)) });
  },

  // Prima di eliminare un'area usata chiedo dove spostare le sue abitudini e i suoi obiettivi
  async remove(id) {
    const a = AREAS[id];
    if (!a || !a.custom) return;
    const { habits, goals } = this.uses(id);
    if (habits.length || goals.length) {
      let sel = null;
      const target = await Dialog.open({
        title: `Eliminare l'area «${a.label}»?`,
        text: `È usata da: ${this.usageText(id)}. Prima di eliminarla, scegli l'area in cui spostare tutto.`,
        body: `<form class="form dialog-form"><label>Sposta in<select name="to">${Object.entries(AREAS).filter(([k]) => k !== id)
          .map(([k, x]) => `<option value="${k}">${U.esc(x.label)}</option>`).join("")}</select></label></form>`,
        actions: `<button type="button" class="btn ghost" data-dialog-cancel>Annulla</button><button type="button" class="btn danger-solid" data-dialog-ok>Sposta ed elimina</button>`,
        init: (box) => { sel = box.querySelector("select"); },
        onKey: (k) => (k === "ok" ? sel.value : null)
      });
      if (!target || !AREAS[target]) return;
      habits.forEach((h) => Store.update("habits", h.id, { area: target }));
      goals.forEach((g) => Store.update("goals", g.id, { area: target }));
    } else {
      const ok = await UI.confirm({ title: `Eliminare l'area «${a.label}»?`, text: "Non la usa nessuna abitudine né obiettivo.", confirmLabel: "Elimina", danger: true });
      if (!ok) return;
    }
    if (Habits.filter === id) Habits.filter = "all";
    Store.setSettings({ customAreas: (Store.settings.customAreas || []).filter((x) => x.id !== id) });
    U.toast(`Area «${a.label}» eliminata`);
  }
};

Actions["area-new"] = () => Areas.create();
Actions["area-edit"] = (el) => Areas.edit(el.dataset.id);
Actions["area-delete"] = (el) => Areas.remove(el.dataset.id);
// Dal selettore di un form: crea l'area e la seleziona subito
Actions["area-new-inline"] = async (el) => {
  const wrap = el.closest("[data-area-wrap]");
  const id = await Areas.create();
  if (!id || !wrap || !wrap.isConnected) return;
  wrap.outerHTML = UI.areaPicker(wrap.dataset.areaWrap, id, wrap.dataset.label);
  const on = document.querySelector(`[data-area-pick="${wrap.dataset.areaWrap}"] [data-value="${id}"]`);
  if (on) on.focus({ preventScroll: true });
};
