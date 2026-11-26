// Store (js/store.js) in modalità demo, con un backend finto dove serve.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeContext, load, get, run } from "./helpers.mjs";

const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let ctx, Store, toasts;
const fresh = (extra) => {
  toasts = [];
  ctx = makeContext(extra);
  load(ctx, "js/util.js", "js/demo.js", "js/store.js");
  run(ctx, `var Auth = { uid: () => "user-1" };`);
  get(ctx, "U").toast = (m) => toasts.push(m);
  Store = get(ctx, "Store");
  for (const t of get(ctx, "TABLES")) Store.d[t] = [];
};

// Backend finto: registra le chiamate; fetchAll restituisce "server[t]" dopo "delay" ms
function fakeBackend(server = {}, delay = 0) {
  const calls = [];
  return {
    calls, server,
    async fetchAll(t) { calls.push(["fetchAll", t]); const snap = structuredClone(server[t] || []); await wait(delay); return snap; },
    async insert(t, row) { calls.push(["insert", t, row]); },
    async insertMany(t, rows) { calls.push(["insertMany", t, rows]); },
    async update(t, id, patch) { calls.push(["update", t, id, patch]); },
    async remove(t, id) { calls.push(["remove", t, id]); },
    async removeMany(t, ids) { calls.push(["removeMany", t, ids]); },
    async upsert(t, row, k) { calls.push(["upsert", t, row, k]); },
    async getSettings() { return structuredClone(server.settings || {}); },
    async patchSettings(p) { calls.push(["patchSettings", p]); server.settings = { ...(server.settings || {}), ...p }; return structuredClone(server.settings); },
    subscribe() {}
  };
}

describe("id delle righe", () => {
  test("newId è un uuid v4, anche senza crypto.randomUUID", () => {
    fresh();
    assert.match(get(ctx, "newId")(), UUID4);
    const noRandomUUID = { getRandomValues: (b) => globalThis.crypto.getRandomValues(b) };
    fresh({ crypto: noRandomUUID });
    const ids = new Set(Array.from({ length: 200 }, () => get(ctx, "newId")()));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.match(id, UUID4);
  });

  test("insert e upsert mandano al server lo stesso id della riga locale", async () => {
    fresh();
    const be = fakeBackend(); Store.backend = be;
    const row = Store.insert("mood_logs", { mood: 3 });
    Store.upsert("weight_logs", { log_date: "2026-10-16", kg: 70 }, "user_id,log_date");
    Store.setLog("h1", "2026-10-16", 1);
    await Store.chain;
    const [ins, up, log] = be.calls;
    assert.equal(ins[2].id, row.id);
    assert.equal(up[2].id, Store.d.weight_logs[0].id);
    assert.equal(up[2].user_id, "user-1");
    assert.equal(log[2].id, Store.d.habit_logs[0].id);
    for (const c of [ins, up, log]) assert.match(c[2].id, UUID4);
    // secondo upsert sulla stessa chiave: stessa riga, stesso id
    Store.upsert("weight_logs", { log_date: "2026-10-16", kg: 69.5 }, "user_id,log_date");
    await Store.chain;
    assert.equal(Store.d.weight_logs.length, 1);
    assert.equal(be.calls.at(-1)[2].id, up[2].id);
  });
});

describe("eliminazioni a catena (come il database)", () => {
  beforeEach(() => fresh());
  test("cascadeDelete rispetta cascade e set null", () => {
    const db = {
      goals: [{ id: "G" }, { id: "K", parent_goal_id: "G" }],
      milestones: [{ id: "M", goal_id: "G" }, { id: "S", goal_id: "G", parent_id: "M" }, { id: "X", goal_id: "K" }],
      habits: [{ id: "H", goal_id: "G" }],
      habit_logs: [{ id: "L", habit_id: "H" }],
      focus_sessions: [{ id: "F", goal_id: "G", milestone_id: "S", habit_id: "H" }],
      foods: [{ id: "FO" }], meal_entries: [{ id: "E", food_id: "FO" }]
    };
    get(ctx, "cascadeDelete")(db, "goals", ["G"]);
    assert.deepEqual(db.goals.map((g) => [g.id, g.parent_goal_id]), [["K", null]]);
    assert.deepEqual(db.milestones.map((m) => m.id), ["X"]);
    assert.equal(db.habits[0].goal_id, null);
    assert.equal(db.habit_logs.length, 1);
    assert.deepEqual([db.focus_sessions[0].goal_id, db.focus_sessions[0].milestone_id, db.focus_sessions[0].habit_id], [null, null, "H"]);
    get(ctx, "cascadeDelete")(db, "habits", ["H"]);
    assert.equal(db.habit_logs.length, 0);
    assert.equal(db.focus_sessions[0].habit_id, null);
    get(ctx, "cascadeDelete")(db, "foods", ["FO"]);
    assert.equal(db.meal_entries[0].food_id, null);
  });

  test("Store.remove e la demo (LocalBackend) applicano la stessa catena", async () => {
    const LB = get(ctx, "LocalBackend");
    LB.db = null;
    await Store.loadAll();
    const g = Store.d.goals.find((x) => Store.d.milestones.some((m) => m.goal_id === x.id));
    const fs = Store.insert("focus_sessions", { started_at: new Date().toISOString(), duration_min: 25, completed: true, goal_id: g.id });
    await Store.chain;
    Store.remove("goals", g.id);
    await Store.chain;
    for (const db of [Store.d, LB.db]) {
      assert.ok(!db.goals.some((x) => x.id === g.id));
      assert.ok(!db.milestones.some((m) => m.goal_id === g.id));
      assert.ok(!db.habits.some((h) => h.goal_id === g.id));
      assert.equal(db.focus_sessions.find((s) => s.id === fs.id).goal_id, null);
    }
  });

  test("demo: spazio esaurito → un solo avviso", () => {
    const LB = get(ctx, "LocalBackend");
    LB.db = { settings: {} };
    ctx.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    const err = console.error; console.error = () => {};
    LB.save(); LB.save(); LB.save();
    console.error = err;
    assert.equal(toasts.length, 1);
  });
});

describe("impostazioni", () => {
  test("setSettings manda solo le chiavi cambiate e adotta la versione unita del server", async () => {
    fresh();
    const be = fakeBackend({ settings: { a: 1, fromOther: "x" } }); Store.backend = be;
    Store.settings = { a: 1 };
    Store.setSettings({ b: 2 });
    Store.setSettings({ c: undefined });
    assert.deepEqual({ ...Store.settings }, { a: 1, b: 2, c: null });
    await Store.chain; await wait(5);
    assert.equal(JSON.stringify(be.calls.map((c) => c[1])), JSON.stringify([{ b: 2 }, { c: null }]));
    assert.deepEqual({ ...Store.settings }, { a: 1, fromOther: "x", b: 2, c: null });
  });

  test("gli eventi realtime delle impostazioni: ignorati mentre salvo, applicati altrimenti", async () => {
    fresh();
    const be = fakeBackend({ settings: {} }); Store.backend = be;
    Store.setSettings({ k: 1 });
    Store.applyRemoteSettings({ new: { data: { k: 0 } } }); // eco vecchio mentre salvo
    assert.equal(Store.settings.k, 1);
    await Store.chain; await wait(5);
    Store.applyRemoteSettings({ new: { data: { k: 1, other: true } } });
    assert.equal(Store.settings.other, true);
  });
});

describe("ricarica e realtime", () => {
  test("una ricarica partita prima di una mia scrittura viene scartata e rifatta", async () => {
    fresh();
    const be = fakeBackend({ mood_logs: [] }, 40); Store.backend = be;
    Store.reloadTable("mood_logs", 0);
    await wait(10); // fetch in corso (vede il server senza la riga nuova)
    const row = Store.insert("mood_logs", { mood: 4 });
    be.server.mood_logs = [{ ...row }]; // il server la salva
    await wait(60);
    assert.ok(Store.d.mood_logs.some((x) => x.id === row.id), "la riga nuova non deve sparire");
    await wait(450); // la ricarica riprogrammata finisce
    assert.ok(Store.d.mood_logs.some((x) => x.id === row.id));
    assert.ok(be.calls.filter((c) => c[0] === "fetchAll").length >= 2);
  });

  test("applyRemote: insert / update / delete senza ricaricare, eco ignorato", async () => {
    fresh();
    const be = fakeBackend(); Store.backend = be;
    Store.d.goals = [{ id: "G", title: "x" }];
    Store.d.milestones = [{ id: "M", goal_id: "G", title: "m" }];
    Store.applyRemote("mood_logs", { eventType: "INSERT", new: { id: "r1", mood: 2 }, old: {} });
    assert.equal(Store.d.mood_logs[0].mood, 2);
    Store.applyRemote("mood_logs", { eventType: "UPDATE", new: { id: "r1", mood: 5 }, old: { id: "r1" } });
    assert.equal(Store.d.mood_logs.length, 1);
    assert.equal(Store.d.mood_logs[0].mood, 5);
    Store.applyRemote("goals", { eventType: "DELETE", new: {}, old: { id: "G" } });
    assert.equal(Store.d.goals.length, 0);
    assert.equal(Store.d.milestones.length, 0, "cascade anche sugli eventi remoti");
    // eco di una mia scrittura: ignorato
    const mine = Store.insert("mood_logs", { mood: 1 });
    Store.applyRemote("mood_logs", { eventType: "UPDATE", new: { id: mine.id, mood: 9 }, old: { id: mine.id } });
    assert.equal(Store.d.mood_logs.find((x) => x.id === mine.id).mood, 1);
    await Store.chain;
    assert.equal(be.calls.filter((c) => c[0] === "fetchAll").length, 0);
  });

  test("le modifiche ravvicinate producono un solo aggiornamento dello schermo", async () => {
    fresh();
    Store.backend = fakeBackend();
    let renders = 0;
    Store.on(() => renders++);
    for (let i = 0; i < 5; i++) Store.insert("mood_logs", { mood: i });
    await wait(20);
    assert.equal(renders, 1);
  });
});

describe("modifiche senza rete (outbox)", () => {
  const netErr = () => Object.assign(new Error("TypeError: Failed to fetch"), { status: 0, code: "" });
  const KEY = "kurashi-outbox-user-1";

  test("senza rete la modifica resta in coda, salvata sul dispositivo, e riparte quando torna la rete", async () => {
    fresh();
    const be = fakeBackend(); Store.backend = be;
    let offline = true;
    const insert = be.insert;
    be.insert = async (t, row) => { if (offline) throw netErr(); return insert(t, row); };
    const row = Store.insert("mood_logs", { mood: 4 });
    await Store.chain;
    clearTimeout(Store._retryT);
    assert.equal(Store.outbox.length, 1);
    assert.equal(Store.d.mood_logs[0].id, row.id, "la riga resta visibile");
    assert.equal(JSON.parse(ctx.localStorage.getItem(KEY))[0].row.id, row.id);
    assert.match(toasts[0], /offline/);
    offline = false;
    await Store.flush();
    assert.equal(Store.outbox.length, 0);
    assert.equal(ctx.localStorage.getItem(KEY), null);
    assert.equal(be.calls.filter((c) => c[0] === "insert").length, 1);
    assert.match(toasts.at(-1), /salvate/);
    assert.equal(Store._pendingT.mood_logs, 0);
  });

  test("una modifica rifiutata dal server esce dalla coda e non blocca le successive", async () => {
    fresh();
    const be = fakeBackend(); Store.backend = be;
    be.update = async () => { throw Object.assign(new Error("violates check constraint"), { status: 400, code: "23514" }); };
    Store.d.goals.push({ id: "g1", title: "A" });
    Store.update("goals", "g1", { manual_progress: 500 });
    Store.insert("mood_logs", { mood: 2 });
    await Store.chain;
    assert.equal(Store.outbox.length, 0);
    assert.equal(be.calls.filter((c) => c[0] === "insert").length, 1);
    assert.match(toasts[0], /Non sono riuscito a salvare/);
  });

  test("alla riapertura le modifiche in coda tornano nei dati e partono", async () => {
    fresh();
    const pending = [
      { kind: "insert", table: "mood_logs", row: { id: "m1", mood: 5 }, tables: ["mood_logs"], ids: ["m1"], tries: 1, at: 0 },
      { kind: "update", table: "goals", id: "g1", patch: { title: "Nuovo" }, tables: ["goals"], ids: ["g1"], tries: 0, at: 0 },
      { kind: "remove", table: "habits", id: "h1", tables: ["habits", "habit_logs", "focus_sessions"], ids: ["h1"], tries: 0, at: 0 },
      { kind: "settings", patch: { sleepTarget: 7 }, tables: [], ids: [], tries: 0, at: 0 }
    ];
    ctx.localStorage.setItem(KEY, JSON.stringify(pending));
    const server = { goals: [{ id: "g1", title: "Vecchio" }], habits: [{ id: "h1" }], habit_logs: [{ id: "l1", habit_id: "h1" }], settings: { sleepTarget: 8 } };
    const be = fakeBackend(server); Store.backend = be;
    Store.watchResume = () => {};
    await Store.loadAll();
    assert.equal(Store.d.mood_logs[0].id, "m1");
    assert.equal(Store.d.goals[0].title, "Nuovo");
    assert.equal(Store.d.habits.length, 0);
    assert.equal(Store.d.habit_logs.length, 0, "cascata applicata anche qui");
    assert.equal(Store.settings.sleepTarget, 7);
    await Store.chain;
    assert.deepEqual(be.calls.filter((c) => c[0] !== "fetchAll").map((c) => c[0]), ["insert", "update", "remove", "patchSettings"]);
    assert.equal(Store.outbox.length, 0);
  });

  test("inserimento già arrivato al tentativo prima (risposta persa): il duplicato conta come fatto", async () => {
    fresh();
    const be = fakeBackend(); Store.backend = be;
    let n = 0;
    be.insert = async () => { if (n++ === 0) throw netErr(); throw Object.assign(new Error("duplicate key"), { status: 409, code: "23505" }); };
    Store.insert("mood_logs", { mood: 1 });
    await Store.chain; clearTimeout(Store._retryT);
    await Store.flush();
    assert.equal(Store.outbox.length, 0);
    assert.ok(!toasts.some((t) => /Non sono riuscito/.test(t)));
  });
});
