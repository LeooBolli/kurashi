// ============================================================
// Store: cache locale + salvataggio ottimistico + realtime.
// Due backend con la stessa interfaccia:
//   - SbBackend    -> Supabase (uso reale)
//   - LocalBackend -> localStorage con dati demo (SUPABASE_URL vuoto)
// ============================================================
const DEMO = !window.APP_CONFIG.SUPABASE_URL;
const TABLES = ["habits", "goals", "milestones", "habit_logs", "focus_sessions",
  "mood_logs", "sleep_logs", "weight_logs", "workouts", "reading_items", "highlights",
  "foods", "meal_entries", "meal_templates"];

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

const SbBackend = {
  async fetchAll(table) {
    // Supabase restituisce al massimo 1000 righe per richiesta: pagino.
    let out = [], from = 0;
    for (;;) {
      const { data, error } = await sb.from(table).select("*")
        .order("created_at", { ascending: true }).order("id").range(from, from + 999);
      if (error) throw error;
      out = out.concat(data);
      if (data.length < 1000) return out;
      from += 1000;
    }
  },
  async insert(table, row) {
    const { error } = await sb.from(table).insert(row);
    if (error) throw error;
  },
  async insertMany(table, rows) {
    const { error } = await sb.from(table).insert(rows);
    if (error) throw error;
  },
  async removeMany(table, ids) {
    const { error } = await sb.from(table).delete().in("id", ids);
    if (error) throw error;
  },
  async update(table, id, patch) {
    const { error } = await sb.from(table).update(patch).eq("id", id);
    if (error) throw error;
  },
  async remove(table, id) {
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) throw error;
  },
  async upsert(table, row, onConflict) {
    const { error } = await sb.from(table).upsert(row, { onConflict });
    if (error) throw error;
  },
  async getSettings() {
    const { data, error } = await sb.from("settings").select("data").maybeSingle();
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
      else throw error;
    }
    // Ripiego (schema.sql non ancora rieseguito): leggo, unisco qui, salvo
    const current = await this.getSettings();
    const merged = { ...current, ...patch };
    const { error } = await sb.from("settings")
      .upsert({ user_id: Auth.uid(), data: merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    return merged;
  },
  subscribe(onChange, onSettings, onReconnect) {
    const ch = sb.channel("kurashi-changes");
    TABLES.forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => onChange(t, p)));
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
  chain: Promise.resolve(),
  backend: DEMO ? LocalBackend : SbBackend,
  _reloadT: {},
  _pendingT: {},     // scritture in corso per tabella
  _wseq: {},         // contatore di modifiche per tabella: scarta i caricamenti superati
  _inflight: new Map(), // "tabella|id" -> scritture mie non ancora "assestate" (per ignorare l'eco realtime)
  _settingsPending: 0,
  _settingsDirty: false,
  _emitQueued: false,

  on(fn) { this.listeners.push(fn); },

  // L'indice si aggiorna subito (Calc lo usa in modo sincrono); lo schermo una volta per frame
  emit() {
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
      try { this.d[t] = await this.backend.fetchAll(t); } catch (e) { e.table = t; throw e; }
    }));
    this.settings = await this.backend.getSettings();
    this.emit();
    this.backend.subscribe(
      (t, p) => this.applyRemote(t, p),
      (p) => this.applyRemoteSettings(p),
      () => this.refreshAll()
    );
    this.watchResume();
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
      else if (hiddenAt != null && Date.now() - hiddenAt >= 30000) { hiddenAt = null; this.refreshAll(); }
      else hiddenAt = null;
    });
    window.addEventListener("online", () => this.refreshAll());
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
  // Partono una alla volta, nell'ordine in cui le fai. "tables" = tabelle che la scrittura tocca,
  // "ids" = righe scritte (per riconoscere l'eco realtime).
  enqueue(fn, tables = [], ids = []) {
    const main = tables[0];
    this.pending++;
    tables.forEach((t) => { this._pendingT[t] = (this._pendingT[t] || 0) + 1; this._wseq[t] = (this._wseq[t] || 0) + 1; });
    if (main) this.markInflight(main, ids);
    this.chain = this.chain.then(fn).catch((e) => {
      console.error(e);
      const msg = String((e && (e.message || e.details)) || "");
      U.toast(/column|schema cache|does not exist|PGRST/i.test(msg)
        ? "Manca un aggiornamento del database: esegui di nuovo supabase/schema.sql su Supabase"
        : "Non sono riuscito a salvare: riprovo a sincronizzare");
      tables.forEach((t) => this.reloadTable(t));
    }).finally(() => {
      this.pending--;
      tables.forEach((t) => { this._pendingT[t]--; this._wseq[t] = (this._wseq[t] || 0) + 1; });
      if (main) this.settleInflight(main, ids);
    });
  },

  insert(table, row) {
    const full = { id: newId(), created_at: new Date().toISOString(), ...row };
    this.d[table].push(full);
    this.emit();
    const copy = { ...full };
    this.enqueue(() => this.backend.insert(table, copy), [table], [full.id]);
    return full;
  },

  // Più righe con un solo salvataggio e un solo aggiornamento dello schermo (es. copia di una settimana)
  insertMany(table, rows) {
    if (!rows.length) return [];
    const now = new Date().toISOString();
    const full = rows.map((r) => ({ id: newId(), created_at: now, ...r }));
    this.d[table].push(...full);
    this.emit();
    const copy = full.map((r) => ({ ...r }));
    this.enqueue(() => this.backend.insertMany(table, copy), [table], full.map((r) => r.id));
    return full;
  },

  removeMany(table, ids) {
    if (!ids.length) return;
    cascadeDelete(this.d, table, ids);
    this.emit();
    this.enqueue(() => this.backend.removeMany(table, ids), touchedBy(table), ids);
  },

  update(table, id, patch) {
    const r = this.d[table].find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    this.emit();
    const copy = { ...patch };
    this.enqueue(() => this.backend.update(table, id, copy), [table], [id]);
  },

  remove(table, id) {
    cascadeDelete(this.d, table, [id]);
    this.emit();
    this.enqueue(() => this.backend.remove(table, id), touchedBy(table), [id]);
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
    this.enqueue(() => this.backend.upsert(table, payload, keys), [table], [ex.id]);
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
    this._settingsPending++;
    let merged = null;
    this.chain = this.chain
      .then(async () => { merged = await this.backend.patchSettings(patch); })
      .catch((e) => {
        console.error(e);
        U.toast("Non sono riuscito a salvare le impostazioni: riprovo a sincronizzare");
        this._settingsDirty = true;
      })
      .finally(() => {
        this._settingsPending--;
        if (this._settingsPending > 0) return;
        if (this._settingsDirty) { this._settingsDirty = false; this.reloadSettings(); return; }
        if (merged && JSON.stringify(merged) !== JSON.stringify(this.settings)) { this.settings = merged; this.emit(); }
      });
  },

  // Impostazioni con valori di default
  cfg() {
    return { focusWeeklyMin: 600, sleepTarget: 8, weightTarget: null, raindropCollection: 0, notionDb: "", goalBooks: {}, dietGoal: null, dietHabit: null, recallPerDay: 5, focusStrict: true, name: Auth.profile().name || "", ...this.settings };
  }
};
