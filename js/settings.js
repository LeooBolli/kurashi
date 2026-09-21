// ============================================================
// Impostazioni: obiettivi personali, integrazioni, esportazione
// ============================================================
const Settings = {
  csvName: "Log_abitudini",

  render(el) {
    const cfg = Store.cfg();
    const sets = Object.keys(Export.datasets());
    el.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">設定 · Impostazioni</p><h1 class="title">Su <em>misura</em></h1></div></div>
      <div class="settings">
        <section class="card">
          <h3>Traguardi personali</h3>
          <p class="muted small">Servono per calcolare il punteggio e i grafici.</p>
          <form class="form" data-act-submit="settings-save">
            <label>Il tuo nome<input name="name" maxlength="30" value="${U.esc(cfg.name)}"></label>
            <div class="row2">
              <label>Focus a settimana (ore)<input name="focus" type="number" min="1" max="80" step="0.5" value="${cfg.focusWeeklyMin / 60}"></label>
              <label>Sonno ideale (ore)<input name="sleep" type="number" min="4" max="12" step="0.25" value="${cfg.sleepTarget}"></label>
            </div>
            <label>Peso obiettivo (kg, facoltativo)<input name="weight" type="number" min="20" max="300" step="0.1" value="${cfg.weightTarget ?? ""}"></label>
            <label class="check"><input name="strict" type="checkbox" ${cfg.focusStrict ? "checked" : ""}>
              <span><b>Lo yokai scappa se esco dall'app</b><small>Se cambi app per più di 10 secondi perdi HP. Per bloccare lo schermo tocca «Blocco lo schermo» nel timer. Disattivo: nessun danno, mai.</small></span></label>
            <label>Evidenziazioni da ripassare al giorno<input name="recall" type="number" min="1" max="15" step="1" value="${cfg.recallPerDay}"></label>
            <button class="btn primary" type="submit">Salva</button>
          </form>
        </section>

        <section class="card">
          <h3>Integrazioni</h3>
          <p class="muted small">Le chiavi API non stanno mai in questa app: restano come segreti nella funzione Supabase (vedi README).</p>
          <div class="integ">
            <div class="integ-row"><div><b>Raindrop.io</b><span class="muted small">Importa i bookmark nella sezione Lettura</span></div>
              <button class="btn ghost sm" data-act="raindrop-test">Verifica</button></div>
            <form class="form inline" data-act-submit="raindrop-save">
              <label>ID collezione (0 = tutte)<input name="collection" type="number" min="-1" value="${cfg.raindropCollection ?? 0}"></label>
              <button class="btn ghost sm" type="submit">Salva</button>
            </form>
            <div class="integ-row"><div><b>Notion</b><span class="muted small">Invia i tuoi obiettivi a un database Notion</span></div>
              <button class="btn ghost sm" data-act="notion-test">Verifica</button></div>
            <form class="form inline" data-act-submit="notion-save">
              <label>ID database Notion<input name="db" maxlength="80" placeholder="32 caratteri dall'URL del database" value="${U.esc(cfg.notionDb || "")}"></label>
              <button class="btn ghost sm" type="submit">Salva</button>
            </form>
            ${cfg.notionDb ? `<button class="btn ghost" data-act="notion-sync-all">${Icon.svg("sync", 16)} Invia tutti gli obiettivi a Notion</button>` : ""}
            <p id="integ-status" class="muted small"></p>
          </div>
        </section>

        <section class="card">
          <h3>Esporta i tuoi dati</h3>
          <p class="muted small">Tutto quello che hai registrato, sempre tuo.</p>
          <div class="btn-row">
            <button class="btn primary" data-act="export-xlsx">${Icon.svg("download", 16)} Excel (tutti i fogli)</button>
          </div>
          <div class="csv-row">
            <select id="csv-name">${sets.map((s) => `<option value="${s}" ${s === this.csvName ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`).join("")}</select>
            <button class="btn ghost" data-act="export-csv">${Icon.svg("download", 16)} CSV</button>
          </div>
        </section>

        <section class="card">
          <h3>Account</h3>
          <p class="muted small">${DEMO ? "Modalità demo: i dati sono solo in questo browser. Compila js/config.js per collegare Supabase." : "Connesso con Supabase. I tuoi dati sono visibili solo a te."}</p>
          <button class="btn ghost" data-act="logout">${Icon.svg("logout", 16)} ${DEMO ? "Azzera dati demo" : "Esci"}</button>
        </section>
      </div>`;
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
        pageId: g.notion_page_id, title: g.title, area: AREAS[g.area].label, horizon: HORIZONS[g.horizon].label,
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
    name: (f.get("name") || "").trim() || window.APP_CONFIG.USER_NAME,
    focusWeeklyMin: Math.round((Number(f.get("focus")) || 10) * 60),
    sleepTarget: Number(f.get("sleep")) || 8,
    weightTarget: f.get("weight") ? Number(f.get("weight")) : null,
    recallPerDay: U.clamp(Math.round(Number(f.get("recall")) || 5), 1, 15),
    focusStrict: f.get("strict") === "on"
  });
  U.toast("Impostazioni salvate");
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
