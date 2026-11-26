// ============================================================
// Store: cache locale + salvataggio ottimistico + realtime.
// Due backend con la stessa interfaccia:
//   - SbBackend    -> Supabase (uso reale)
//   - LocalBackend -> localStorage con dati demo (SUPABASE_URL vuoto)
// ============================================================
const DEMO = !window.APP_CONFIG.SUPABASE_URL;
const TABLES = ["habits", "goals", "milestones", "habit_logs", "focus_sessions",
  "mood_logs", "sleep_logs", "weight_logs", "workouts", "reading_items", "highlights",
  "foods", "meal_entries", "meal_templates", "finance_entries"];
// Tabelle di sezioni che partono spente: se il database non le ha ancora, l'app si apre lo stesso
const OPTIONAL_TABLES = ["finance_entries"];

const sb = DEMO ? null : window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

// Id delle righe nuove: un uuid v4 valido, così il server salva lo stesso id che usiamo qui.
// crypto.randomUUID esiste solo in contesti sicuri (https/localhost): altrimenti lo costruisco.
function newId() {
  const c = typeof crypto !== "undefined" ? crypto : null;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // versione 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ------------------------------------------------------------
// Chiavi esterne: rispecchiano "on delete cascade / set null" di supabase/schema.sql,
// così la cache locale e la demo si comportano come il database.
// ------------------------------------------------------------
const FKS = [
  { table: "milestones", col: "goal_id", ref: "goals", on: "cascade" },
  { table: "milestones", col: "parent_id", ref: "milestones", on: "cascade" },
  { table: "goals", col: "parent_goal_id", ref: "goals", on: "null" },
  { table: "habits", col: "goal_id", ref: "goals", on: "null" },
  { table: "focus_sessions", col: "goal_id", ref: "goals", on: "null" },
  { table: "habit_logs", col: "habit_id", ref: "habits", on: "cascade" },
  { table: "focus_sessions", col: "habit_id", ref: "habits", on: "null" },
  { table: "focus_sessions", col: "milestone_id", ref: "milestones", on: "null" },
  { table: "meal_entries", col: "food_id", ref: "foods", on: "null" }
];

// Elimina le righe "ids" da db[table] e applica a catena cascade / set null. Modifica db sul posto.
function cascadeDelete(db, table, ids) {
  const queue = [[table, new Set(ids)]];
  while (queue.length) {
    const [t, set] = queue.shift();
    if (!set.size || !db[t]) continue;
    db[t] = db[t].filter((x) => !set.has(x.id));
    for (const fk of FKS) {
      if (fk.ref !== t || !db[fk.table]) continue;
      if (fk.on === "null") {
        db[fk.table].forEach((x) => { if (set.has(x[fk.col])) x[fk.col] = null; });
      } else {
        const kids = new Set(db[fk.table].filter((x) => set.has(x[fk.col])).map((x) => x.id));
        if (kids.size) queue.push([fk.table, kids]);
      }
    }
  }
  return db;
}

// Tabelle che un'eliminazione su "table" può toccare (lei + quelle che la referenziano, a catena)
function touchedBy(table) {
  const out = new Set([table]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const fk of FKS) if (out.has(fk.ref) && !out.has(fk.table)) { out.add(fk.table); grew = true; }
  }
  return [...out];
}

// undefined non sopravvive al JSON: lo trasformo in null così la chiave si azzera anche sul server
const jsonPatch = (patch) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v]));

// Subito dopo il rinnovo del token, a volte il server dei dati ha l'orologio una frazione di
// secondo indietro rispetto a quello che ha emesso il token e lo rifiuta ("JWT issued at future").
// Non è una sessione scaduta: aspetto un attimo e riprovo la stessa lettura.
async function sbRead(query) {
  for (let i = 0; ; i++) {
    const res = await query();
    if (!res.error || i >= 2 || !/issued at future/i.test(res.error.message || "")) return res;
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
}

// Errore di una scrittura con lo stato HTTP attaccato (0 = la richiesta non è arrivata al server)
function fail({ error, status }) {
  if (error) throw Object.assign(error, { status: status || 0 });
}

const SbBackend = {
  async fetchAll(table) {
    // Supabase restituisce al massimo 1000 righe per richiesta: pagino.
    let out = [], from = 0;
    for (;;) {
      const { data, error } = await sbRead(() => sb.from(table).select("*")
        .order("created_at", { ascending: true }).order("id").range(from, from + 999));
      if (error) throw error;
      out = out.concat(data);
      if (data.length < 1000) return out;
      from += 1000;
    }
  },
  async insert(table, row) { fail(await sb.from(table).insert(row)); },
  async insertMany(table, rows) { fail(await sb.from(table).insert(rows)); },
  async removeMany(table, ids) { fail(await sb.from(table).delete().in("id", ids)); },
  async update(table, id, patch) { fail(await sb.from(table).update(patch).eq("id", id)); },
  async remove(table, id) { fail(await sb.from(table).delete().eq("id", id)); },
  async upsert(table, row, onConflict) { fail(await sb.from(table).upsert(row, { onConflict })); },
  async getSettings() {
    const { data, error } = await sbRead(() => sb.from("settings").select("data").maybeSingle());
    if (error) throw error;
    return (data && data.data) || {};
  },
  // Salva solo le chiavi cambiate (merge atomico sul server): due dispositivi che cambiano
  // impostazioni diverse non si sovrascrivono più. Restituisce le impostazioni complete.
  _rpcMissing: false,
  async patchSettings(patch) {
    if (!this._rpcMissing) {
      const { data, error, status } = await sb.rpc("kurashi_settings_patch", { patch });
      if (!error) return data || {};
      if (error.code === "PGRST202" || status === 404) this._rpcMissing = true; // funzione non ancora creata
      else throw Object.assign(error, { status: status || 0 });
    }
    // Ripiego (schema.sql non ancora rieseguito): leggo, unisco qui, salvo
    const current = await this.getSettings();
    const merged = { ...current, ...patch };
    fail(await sb.from("settings")
      .upsert({ user_id: Auth.uid(), data: merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
    return merged;
  },
  subscribe(onChange, onSettings, onReconnect) {
    const ch = sb.channel("kurashi-changes");
    TABLES.filter((t) => !Store.missing.has(t)).forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => onChange(t, p)));
    ch.on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (p) => onSettings(p));
    let broken = false;
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") { if (broken) onReconnect(); broken = false; }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") broken = true;
    });
  }
};

const LocalBackend = {
  KEY: "kurashi-demo-v4",
  db: null,
  _quotaWarned: false,
  load() {
    if (!this.db) {
      try { this.db = JSON.parse(localStorage.getItem(this.KEY)); } catch { this.db = null; }
      if (!this.db) { this.db = Demo.seed(); this.save(); }
      TABLES.forEach((t) => { if (!this.db[t]) this.db[t] = []; }); // tabelle aggiunte dopo il primo avvio
    }
    return this.db;
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.db)); } catch (e) {
      console.error(e);
      if (!this._quotaWarned) {
        this._quotaWarned = true;
        U.toast("Spazio del browser esaurito: le modifiche demo non vengono più salvate");
      }
    }
  },
  async fetchAll(t) { return structuredClone(this.load()[t] || []); },
  async insert(t, row) { this.load()[t].push(structuredClone(row)); this.save(); },
  async insertMany(t, rows) { this.load()[t].push(...structuredClone(rows)); this.save(); },
  async removeMany(t, ids) { cascadeDelete(this.load(), t, ids); this.save(); },
  async update(t, id, patch) {
    const r = this.load()[t].find((x) => x.id === id);
    if (r) Object.assign(r, structuredClone(patch));
    this.save();
  },
  async remove(t, id) { cascadeDelete(this.load(), t, [id]); this.save(); },
  async upsert(t, row, onConflict) {
    const keys = onConflict.split(",").filter((k) => k !== "user_id");
    const ex = this.load()[t].find((x) => keys.every((k) => x[k] === row[k]));
    if (ex) Object.assign(ex, structuredClone(row));
    else this.db[t].push({ id: newId(), created_at: new Date().toISOString(), ...structuredClone(row) });
    this.save();
  },
  async getSettings() { return structuredClone(this.load().settings || {}); },
  async patchSettings(patch) {
    const db = this.load();
    db.settings = { ...(db.settings || {}), ...structuredClone(patch) };
    this.save();
    return structuredClone(db.settings);
  },
  subscribe() {}
};

const Store = {
  d: {},
  settings: {},
  logIdx: new Map(),
  listeners: [],
  pending: 0,
  missing: new Set(), // tabelle facoltative assenti dal database
  chain: Promise.resolve(),
  backend: DEMO ? LocalBackend : SbBackend,
  _reloadT: {},
  _pendingT: {},     // scritture in corso per tabella
  _wseq: {},         // contatore di modifiche per tabella: scarta i caricamenti superati
  _inflight: new Map(), // "tabella|id" -> scritture mie non ancora "assestate" (per ignorare l'eco realtime)
  _settingsPending: 0,
  _settingsDirty: false,
  _emitQueued: false,
  outbox: [],        // scritture non ancora confermate dal server, in ordine (salvate anche sul dispositivo)
  _flushing: false,
  _retryT: null,
  _retryN: 0,
  _offline: false,   // ho già avvisato che manca la rete

  on(fn) { this.listeners.push(fn); },

  // L'indice si aggiorna subito (Calc lo usa in modo sincrono); lo schermo una volta per frame
  emit() {
    if (typeof syncAreas === "function") syncAreas(this.settings && this.settings.customAreas);
    this.reindex();
    if (this._emitQueued) return;
    this._emitQueued = true;
    // requestAnimationFrame si ferma a scheda nascosta: un timer di riserva garantisce l'aggiornamento
    let done = false, timer = null;
    const run = () => {
      if (done) return;
      done = true; clearTimeout(timer);
      this._emitQueued = false;
      this.listeners.forEach((fn) => fn());
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    timer = setTimeout(run, 100);
  },

  reindex() {
    this.logIdx.clear();
    for (const l of this.d.habit_logs || []) this.logIdx.set(`${l.habit_id}|${l.log_date}`, Number(l.value));
  },

  async loadAll() {
    await Promise.all(TABLES.map(async (t) => {
      try { this.d[t] = await this.backend.fetchAll(t); } catch (e) {
        if (OPTIONAL_TABLES.includes(t) && /does not exist|schema cache|42P01|PGRST205/i.test(`${e.code} ${e.message}`)) { this.d[t] = []; this.missing.add(t); return; }
        e.table = t; throw e;
      }
    }));
    this.settings = await this.backend.getSettings();
    this.restoreOutbox();
    this.emit();
    this.backend.subscribe(
      (t, p) => this.applyRemote(t, p),
      (p) => this.applyRemoteSettings(p),
      () => this.refreshAll()
    );
    this.watchResume();
    this.flush();
  },

  // ---------- Ricarica dal server ----------
  // Ricarica una tabella (fallback del realtime, ritorno sull'app, errori di scrittura).
  // Se nel frattempo è partita una mia scrittura su quella tabella il risultato è vecchio: lo scarto e riprovo.
  reloadTable(t, delay = 350) {
    clearTimeout(this._reloadT[t]);
    this._reloadT[t] = setTimeout(async () => {
      if (this._pendingT[t] > 0) return this.reloadTable(t); // prima finisco di scrivere le mie modifiche
      const seq = this._wseq[t] || 0;
      let rows;
      try { rows = await this.backend.fetchAll(t); } catch (e) { console.error(e); return; }
      if ((this._wseq[t] || 0) !== seq || this._pendingT[t] > 0) return this.reloadTable(t);
      this.d[t] = rows;
      this.emit();
    }, delay);
  },

  async reloadSettings() {
    if (this._settingsPending > 0) { this._settingsDirty = true; return; }
    try {
      const s = await this.backend.getSettings();
      if (this._settingsPending > 0) { this._settingsDirty = true; return; }
      this.settings = s;
      this.emit();
    } catch (e) { console.error(e); }
  },

  // Tutto da capo (impostazioni + tabelle), con un piccolo ritardo per raggruppare più richiami
  refreshAll() {
    if (DEMO) return;
    clearTimeout(this._refreshT);
    this._refreshT = setTimeout(() => {
      this.reloadSettings();
      TABLES.forEach((t) => this.reloadTable(t, 0));
    }, 500);
  },

  // Quando l'app torna in primo piano (dopo almeno 30 s) o torna la rete, riallineo i dati:
  // il realtime può aver perso eventi mentre il telefono dormiva.
  watchResume() {
    if (DEMO || this._watching) return;
    this._watching = true;
    let hiddenAt = null;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (this.outbox.length) { hiddenAt = null; this.flush(); }
      else if (hiddenAt != null && Date.now() - hiddenAt >= 30000) { hiddenAt = null; this.refreshAll(); }
      else hiddenAt = null;
    });
    window.addEventListener("online", () => { this.flush(); this.refreshAll(); });
  },

  // ---------- Realtime ----------
  _key: (t, id) => `${t}|${id}`,
  markInflight(t, ids) {
    for (const id of ids) { const k = this._key(t, id); this._inflight.set(k, (this._inflight.get(k) || 0) + 1); }
  },
  // L'eco di una mia scrittura può arrivare poco dopo la risposta: la ignoro ancora per un attimo
  settleInflight(t, ids) {
    setTimeout(() => {
      for (const id of ids) {
        const k = this._key(t, id), n = (this._inflight.get(k) || 0) - 1;
        if (n > 0) this._inflight.set(k, n); else this._inflight.delete(k);
      }
    }, 1500);
  },
  isEcho(t, id) { return this._inflight.has(this._key(t, id)); },

  // Applica direttamente la modifica arrivata (niente ricarica dell'intera tabella)
  applyRemote(t, p) {
    if (!p || !this.d[t]) return;
    const ev = p.eventType, nw = p.new || {}, old = p.old || {};
    if ((p.errors && p.errors.length) || !ev) return this.reloadTable(t);
    if (ev === "DELETE") {
      if (!old.id) return this.reloadTable(t);
      if (this.isEcho(t, old.id) || !this.d[t].some((x) => x.id === old.id)) return;
      this._wseq[t] = (this._wseq[t] || 0) + 1;
      cascadeDelete(this.d, t, [old.id]);
      return this.emit();
    }
    if (!nw.id) return this.reloadTable(t);
    if (this.isEcho(t, nw.id)) return;
    if (this._pendingT[t] > 0) return this.reloadTable(t); // sto scrivendo su questa tabella: riallineo dopo
    if (old.id && old.id !== nw.id) this.d[t] = this.d[t].filter((x) => x.id !== old.id);
    const ex = this.d[t].find((x) => x.id === nw.id);
    if (ex) Object.assign(ex, nw); // le colonne grandi non cambiate possono mancare: tengo le mie
    else {
      // Un UPDATE di una riga che non ho, con meno colonne del solito: payload incompleto
      const sample = this.d[t][0];
      if (ev === "UPDATE" && sample && Object.keys(nw).length < Object.keys(sample).length) return this.reloadTable(t);
      this.d[t].push(nw);
    }
    this._wseq[t] = (this._wseq[t] || 0) + 1;
    this.emit();
  },

  applyRemoteSettings(p) {
    // Mentre salvo le mie impostazioni ignoro gli eventi (sono il mio eco, o li recupero dopo)
    if (this._settingsPending > 0) { this._settingsDirty = true; return; }
    const data = p && p.new && p.new.data;
    if (!data || typeof data !== "object") return this.reloadSettings();
    if (JSON.stringify(data) === JSON.stringify(this.settings)) return;
    this.settings = data;
    this.emit();
  },

  // ---------- Scritture ----------
  // Ogni modifica diventa un'operazione nella coda "outbox": parte subito, una alla volta e
  // nell'ordine in cui le fai, ed esce dalla coda solo quando il server l'ha confermata.
  // Senza rete resta in coda (salvata anche sul dispositivo, così sopravvive alla chiusura
  // dell'app) e riparte da sola: al ritorno della rete, dell'app in primo piano, o a tempo.
  // "tables" = tabelle che la scrittura tocca, "ids" = righe scritte (per riconoscere l'eco realtime).
  OUTBOX_KEY: "kurashi-outbox-",
  RETRY_S: [2, 5, 10, 20, 30, 60],
  MAX_SERVER_TRIES: 8, // errori del server (non di rete): dopo tanti tentativi lascio perdere

  outboxKey() { return this.OUTBOX_KEY + Auth.uid(); },

  // Solo col server vero: la demo salva già tutto nel browser e non può restare offline
  persists() { return this.backend !== LocalBackend; },

  saveOutbox() {
    if (this.persists()) {
      try {
        if (this.outbox.length) localStorage.setItem(this.outboxKey(), JSON.stringify(this.outbox));
        else localStorage.removeItem(this.outboxKey());
      } catch (e) { console.error(e); }
    }
    this.showSync();
  },

  // Conta l'operazione fra le scritture in corso (d = +1 entra, -1 esce)
  track(op, d) {
    if (op.kind === "settings") { this._settingsPending += d; return; }
    this.pending += d;
    op.tables.forEach((t) => { this._pendingT[t] = (this._pendingT[t] || 0) + d; this._wseq[t] = (this._wseq[t] || 0) + 1; });
    if (d > 0) this.markInflight(op.tables[0], op.ids); else this.settleInflight(op.tables[0], op.ids);
  },

  enqueue(op, tables = [], ids = []) {
    Object.assign(op, { tables, ids, tries: 0, at: Date.now() });
    this.outbox.push(op);
    this.track(op, +1);
    this.saveOutbox();
    this.flush();
  },

  runOp(op) {
    const b = this.backend;
    switch (op.kind) {
      case "insert": return b.insert(op.table, op.row);
      case "insertMany": return b.insertMany(op.table, op.rows);
      case "update": return b.update(op.table, op.id, op.patch);
      case "remove": return b.remove(op.table, op.id);
      case "removeMany": return b.removeMany(op.table, op.ids);
      case "upsert": return b.upsert(op.table, op.row, op.keys);
      case "settings": return b.patchSettings(op.patch).then((m) => { op.merged = m; });
      default: return Promise.resolve();
    }
  },

  // La richiesta non è arrivata (o il server è momentaneamente giù): si riprova più tardi
  isTransient(e, op) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    const msg = `${(e && e.code) || ""} ${(e && (e.message || e.details)) || e || ""}`;
    if (/Failed to fetch|NetworkError|Load failed|network|timed? ?out|aborted|fetch failed|ECONN/i.test(msg)) return true;
    const st = Number(e && e.status) || 0;
    const server = st >= 500 || st === 408 || st === 429 || st === 401 || /JWT|PGRST30[0-3]/i.test(msg);
    return server && op.tries < this.MAX_SERVER_TRIES;
  },

  flush() {
    if (this._flushing) return this.chain;
    this._flushing = true;
    clearTimeout(this._retryT);
    this.chain = (async () => {
      while (this.outbox.length) {
        const op = this.outbox[0];
        let failed = null;
        try { await this.runOp(op); } catch (e) { failed = e; }
        if (failed) {
          if (this.isTransient(failed, op)) {
            op.tries++;
            this.saveOutbox();
            this.waitForNetwork();
            return;
          }
          // Inserimento già arrivato al tentativo precedente (era andata persa solo la risposta)
          const dup = op.tries > 0 && /^(insert|insertMany)$/.test(op.kind) && failed.code === "23505";
          if (!dup) { console.error(failed); this.drop(op, failed); continue; }
        }
        this.outbox.shift();
        this.track(op, -1);
        this.saveOutbox();
        if (op.kind === "settings") this.settingsSaved(op.merged);
      }
      this._retryN = 0;
      if (this._offline) { this._offline = false; U.toast("Connessione tornata: modifiche salvate"); }
    })().finally(() => { this._flushing = false; });
    return this.chain;
  },

  // Il server ha rifiutato la modifica: la tolgo dalla coda e riallineo con quello che c'è davvero
  drop(op, e) {
    this.outbox.shift();
    this.track(op, -1);
    this.saveOutbox();
    const msg = String((e && (e.message || e.details)) || "");
    U.toast(/column|schema cache|does not exist|PGRST2/i.test(msg)
      ? "Manca un aggiornamento del database: esegui di nuovo supabase/schema.sql su Supabase"
      : op.kind === "settings" ? "Non sono riuscito a salvare le impostazioni: riprovo a sincronizzare"
      : "Non sono riuscito a salvare: riprovo a sincronizzare");
    if (op.kind === "settings") { this._settingsDirty = true; this.settingsSaved(null); }
    else op.tables.forEach((t) => this.reloadTable(t));
  },

  settingsSaved(merged) {
    if (this._settingsPending > 0) return;
    if (this._settingsDirty) { this._settingsDirty = false; this.reloadSettings(); return; }
    if (merged && JSON.stringify(merged) !== JSON.stringify(this.settings)) { this.settings = merged; this.emit(); }
  },

  waitForNetwork() {
    if (!this._offline) {
      this._offline = true;
      U.toast("Sei offline: le modifiche restano sul dispositivo e le salvo appena torna la rete");
    }
    const s = this.RETRY_S[Math.min(this._retryN++, this.RETRY_S.length - 1)];
    clearTimeout(this._retryT);
    this._retryT = setTimeout(() => this.flush(), s * 1000);
  },

  // Dopo il caricamento: rimetto nei dati le modifiche che non erano ancora arrivate al server
  restoreOutbox() {
    if (!this.persists()) return;
    let ops = [];
    try { ops = JSON.parse(localStorage.getItem(this.outboxKey()) || "[]"); } catch { ops = []; }
    if (!Array.isArray(ops) || !ops.length) return;
    for (const op of ops) {
      if (!op || !op.kind) continue;
      if (op.kind !== "settings" && (!op.table || !this.d[op.table])) continue; // tabella non più presente
      this.applyLocal(op);
      this.outbox.push(op);
      this.track(op, +1);
    }
    this.saveOutbox();
  },

  applyLocal(op) {
    const rows = this.d[op.table];
    const add = (r) => { if (!rows.some((x) => x.id === r.id)) rows.push(structuredClone(r)); };
    switch (op.kind) {
      case "insert": add(op.row); break;
      case "insertMany": op.rows.forEach(add); break;
      case "update": { const r = rows.find((x) => x.id === op.id); if (r) Object.assign(r, op.patch); break; }
      case "remove": cascadeDelete(this.d, op.table, [op.id]); break;
      case "removeMany": cascadeDelete(this.d, op.table, op.ids); break;
      case "upsert": {
        const ks = op.keys.split(",").filter((k) => k !== "user_id");
        const r = rows.find((x) => x.id === op.row.id) || rows.find((x) => ks.every((k) => x[k] === op.row[k]));
        if (r) Object.assign(r, op.row); else rows.push({ created_at: new Date().toISOString(), ...structuredClone(op.row) });
        break;
      }
      case "settings": this.settings = { ...this.settings, ...op.patch }; break;
    }
  },

  // Etichetta "N modifiche da salvare": compare solo se un salvataggio tarda (più di 2 s) o non riesce
  showSync() {
    clearTimeout(this._syncT);
    const el = typeof document !== "undefined" && document.getElementById("sync-pill");
    if (!el) return;
    const n = this.outbox.length;
    const late = n && this.outbox.some((op) => op.tries > 0 || Date.now() - op.at > 2000);
    el.hidden = !late;
    if (late) el.querySelector("b").textContent = n === 1 ? "1 modifica da salvare" : `${n} modifiche da salvare`;
    else if (n) this._syncT = setTimeout(() => this.showSync(), 2100);
  },

  insert(table, row) {
    const full = { id: newId(), created_at: new Date().toISOString(), ...row };
    this.d[table].push(full);
    this.emit();
    this.enqueue({ kind: "insert", table, row: { ...full } }, [table], [full.id]);
    return full;
  },

  // Più righe con un solo salvataggio e un solo aggiornamento dello schermo (es. copia di una settimana)
  insertMany(table, rows) {
    if (!rows.length) return [];
    const now = new Date().toISOString();
    const full = rows.map((r) => ({ id: newId(), created_at: now, ...r }));
    this.d[table].push(...full);
    this.emit();
    this.enqueue({ kind: "insertMany", table, rows: full.map((r) => ({ ...r })) }, [table], full.map((r) => r.id));
    return full;
  },

  removeMany(table, ids) {
    if (!ids.length) return;
    cascadeDelete(this.d, table, ids);
    this.emit();
    this.enqueue({ kind: "removeMany", table, ids: [...ids] }, touchedBy(table), ids);
  },

  update(table, id, patch) {
    const r = this.d[table].find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    this.emit();
    this.enqueue({ kind: "update", table, id, patch: { ...patch } }, [table], [id]);
  },

  remove(table, id) {
    cascadeDelete(this.d, table, [id]);
    this.emit();
    this.enqueue({ kind: "remove", table, id }, touchedBy(table), [id]);
  },

  // Riga unica per chiave (es. un solo peso al giorno). Mando anche l'id locale:
  // se la riga è nuova il server salva lo stesso id che vedo qui.
  upsert(table, row, keys) {
    const ks = keys.split(",").filter((k) => k !== "user_id");
    let ex = this.d[table].find((x) => ks.every((k) => x[k] === row[k]));
    if (ex) Object.assign(ex, row);
    else { ex = { id: newId(), created_at: new Date().toISOString(), ...row }; this.d[table].push(ex); }
    this.emit();
    const payload = { ...row, id: ex.id };
    if (keys.includes("user_id")) payload.user_id = Auth.uid();
    this.enqueue({ kind: "upsert", table, row: payload, keys }, [table], [ex.id]);
  },

  setLog(habitId, date, value) {
    value = Math.max(0, Math.round(value * 100) / 100);
    this.upsert("habit_logs", { habit_id: habitId, log_date: date, value }, "habit_id,log_date");
  },

  // Salva solo le chiavi cambiate; quando l'ultima scrittura finisce adotto la versione
  // unita del server (che contiene anche ciò che un altro dispositivo ha cambiato nel frattempo).
  setSettings(patch) {
    patch = jsonPatch(patch);
    this.settings = { ...this.settings, ...patch };
    this.emit();
    this.enqueue({ kind: "settings", patch });
  },

  // Impostazioni con valori di default
  cfg() {
    return { focusWeeklyMin: 600, sleepTarget: 8, weightTarget: null, raindropCollection: 0, goalBooks: {}, dietGoal: null, dietHabit: null, recallPerDay: 5, focusStrict: true, name: Auth.profile().name || "", ...this.settings };
  }
};
