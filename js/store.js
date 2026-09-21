// ============================================================
// Store: cache locale + salvataggio ottimistico + realtime.
// Due backend con la stessa interfaccia:
//   - SbBackend    -> Supabase (uso reale)
//   - LocalBackend -> localStorage con dati demo (SUPABASE_URL vuoto)
// ============================================================
const DEMO = !window.APP_CONFIG.SUPABASE_URL;
const TABLES = ["habits", "goals", "milestones", "habit_logs", "focus_sessions",
  "mood_logs", "sleep_logs", "weight_logs", "workouts", "reading_items", "highlights"];

const sb = DEMO ? null : window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

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
    const { data } = await sb.from("settings").select("data").maybeSingle();
    return (data && data.data) || {};
  },
  async saveSettings(obj) {
    const { error } = await sb.from("settings")
      .upsert({ user_id: Auth.uid(), data: obj, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
  },
  subscribe(onTable) {
    const ch = sb.channel("kurashi-changes");
    TABLES.forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => onTable(t)));
    ch.subscribe();
  }
};

const LocalBackend = {
  KEY: "kurashi-demo-v4",
  db: null,
  load() {
    if (!this.db) {
      try { this.db = JSON.parse(localStorage.getItem(this.KEY)); } catch { this.db = null; }
      if (!this.db) { this.db = Demo.seed(); this.save(); }
    }
    return this.db;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.db)); } catch { /* quota */ } },
  async fetchAll(t) { return structuredClone(this.load()[t] || []); },
  async insert(t, row) { this.load()[t].push(structuredClone(row)); this.save(); },
  async update(t, id, patch) {
    const r = this.load()[t].find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    this.save();
  },
  async remove(t, id) {
    this.db[t] = this.load()[t].filter((x) => x.id !== id);
    if (t === "milestones") this.db.milestones = this.db.milestones.filter((m) => m.parent_id !== id);
    if (t === "goals") {
      this.db.milestones = this.db.milestones.filter((m) => m.goal_id !== id);
      this.db.habits.forEach((h) => { if (h.goal_id === id) h.goal_id = null; });
    }
    if (t === "habits") this.db.habit_logs = this.db.habit_logs.filter((l) => l.habit_id !== id);
    this.save();
  },
  async upsert(t, row, onConflict) {
    const keys = onConflict.split(",").filter((k) => k !== "user_id");
    const ex = this.load()[t].find((x) => keys.every((k) => x[k] === row[k]));
    if (ex) Object.assign(ex, row); else this.db[t].push({ id: U.uid(), created_at: new Date().toISOString(), ...row });
    this.save();
  },
  async getSettings() { return this.load().settings || {}; },
  async saveSettings(obj) { this.load().settings = obj; this.save(); },
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

  on(fn) { this.listeners.push(fn); },
  emit() {
    this.reindex();
    this.listeners.forEach((fn) => fn());
  },

  reindex() {
    this.logIdx.clear();
    for (const l of this.d.habit_logs || []) this.logIdx.set(`${l.habit_id}|${l.log_date}`, Number(l.value));
  },

  async loadAll() {
    await Promise.all(TABLES.map(async (t) => { this.d[t] = await this.backend.fetchAll(t); }));
    this.settings = await this.backend.getSettings();
    this.emit();
    this.backend.subscribe((t) => this.reloadTable(t));
  },

  // Ricarica una tabella dal server (dopo una modifica arrivata da un altro dispositivo)
  reloadTable(t) {
    clearTimeout(this._reloadT[t]);
    this._reloadT[t] = setTimeout(async () => {
      if (this.pending > 0) return this.reloadTable(t); // prima finisco di scrivere le mie modifiche
      try { this.d[t] = await this.backend.fetchAll(t); this.emit(); } catch (e) { console.error(e); }
    }, 350);
  },

  // Le scritture partono una alla volta, nell'ordine in cui le fai
  enqueue(fn, table) {
    this.pending++;
    this.chain = this.chain.then(fn).catch((e) => {
      console.error(e);
      U.toast("Non sono riuscito a salvare: riprovo a sincronizzare");
      if (table) this.reloadTable(table);
    }).finally(() => { this.pending--; });
  },

  insert(table, row) {
    const full = { id: U.uid(), created_at: new Date().toISOString(), ...row };
    this.d[table].push(full);
    this.emit();
    this.enqueue(() => this.backend.insert(table, full), table);
    return full;
  },

  update(table, id, patch) {
    const r = this.d[table].find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    this.emit();
    this.enqueue(() => this.backend.update(table, id, patch), table);
  },

  remove(table, id) {
    this.d[table] = this.d[table].filter((x) => x.id !== id);
    if (table === "milestones") this.d.milestones = this.d.milestones.filter((m) => m.parent_id !== id);
    if (table === "goals") {
      this.d.milestones = this.d.milestones.filter((m) => m.goal_id !== id);
      this.d.habits.forEach((h) => { if (h.goal_id === id) h.goal_id = null; });
    }
    if (table === "habits") this.d.habit_logs = this.d.habit_logs.filter((l) => l.habit_id !== id);
    this.emit();
    this.enqueue(() => this.backend.remove(table, id), table);
  },

  // Riga unica per chiave (es. un solo peso al giorno)
  upsert(table, row, keys) {
    const ks = keys.split(",").filter((k) => k !== "user_id");
    const ex = this.d[table].find((x) => ks.every((k) => x[k] === row[k]));
    if (ex) Object.assign(ex, row);
    else this.d[table].push({ id: U.uid(), created_at: new Date().toISOString(), ...row });
    this.emit();
    const payload = { ...row };
    if (keys.includes("user_id")) payload.user_id = Auth.uid();
    this.enqueue(() => this.backend.upsert(table, payload, keys), table);
  },

  setLog(habitId, date, value) {
    value = Math.max(0, Math.round(value * 100) / 100);
    this.upsert("habit_logs", { habit_id: habitId, log_date: date, value }, "habit_id,log_date");
  },

  setSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.emit();
    this.enqueue(() => this.backend.saveSettings(this.settings));
  },

  // Impostazioni con valori di default
  cfg() {
    return { focusWeeklyMin: 600, sleepTarget: 8, weightTarget: null, raindropCollection: 0, notionDb: "", recallPerDay: 5, focusStrict: true, name: window.APP_CONFIG.USER_NAME, ...this.settings };
  }
};
