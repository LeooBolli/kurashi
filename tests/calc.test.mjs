// Logica di calc.js e delle date di util.js. Gira con:  node --test tests/
process.env.TZ = "Europe/Rome"; // date locali: le prove su mezzanotte dipendono dal fuso
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeContext, load, get, run, STORE_STUB } from "./helpers.mjs";

let ctx, U, Calc, Store;
const fresh = () => {
  ctx = makeContext();
  run(ctx, STORE_STUB);
  load(ctx, "js/util.js", "js/calc.js");
  U = get(ctx, "U"); Calc = get(ctx, "Calc"); Store = get(ctx, "Store");
};
const goal = (o) => ({ id: o.id, title: o.id, area: "studio", horizon: "medium", status: "active", manual_progress: 0,
  start_date: "2026-01-01", due_date: "2026-12-31", parent_goal_id: null, weight_linked: false, ...o });

describe("gerarchia degli obiettivi", () => {
  beforeEach(fresh);

  test("un ciclo nei dati (A figlio di B, B figlio di A) non fa più ricorsione infinita", () => {
    // Prima della correzione: RangeError "Maximum call stack size exceeded"
    Store.d.goals = [
      goal({ id: "A", parent_goal_id: "B", manual_progress: 40 }),
      goal({ id: "B", parent_goal_id: "A", manual_progress: 80 })
    ];
    const a = Store.d.goals[0];
    let p;
    assert.doesNotThrow(() => { p = Calc.goalProgress(a, "2026-06-01"); });
    assert.ok(Number.isFinite(p) && p >= 0 && p <= 100);
    assert.doesNotThrow(() => Calc.goalPace(a, "2026-06-01"));
    assert.doesNotThrow(() => Calc.score("2026-06-01"));
  });

  test("anche un obiettivo genitore di sé stesso non va in loop", () => {
    Store.d.goals = [goal({ id: "S", parent_goal_id: "S", manual_progress: 30 })];
    assert.deepEqual(Calc.childGoals(Store.d.goals[0]), []);
    assert.equal(Calc.goalProgress(Store.d.goals[0], "2026-06-01"), 30);
  });

  test("ciclo più lungo (A → B → C → A)", () => {
    Store.d.goals = [
      goal({ id: "A", parent_goal_id: "C", manual_progress: 10 }),
      goal({ id: "B", parent_goal_id: "A", manual_progress: 20 }),
      goal({ id: "C", parent_goal_id: "B", manual_progress: 30 })
    ];
    for (const g of Store.d.goals) assert.ok(Number.isFinite(Calc.goalProgress(g, "2026-06-01")));
  });

  test("possibleParents esclude sé stesso e tutti i discendenti", () => {
    Store.d.goals = [
      goal({ id: "short1", horizon: "short" }),
      goal({ id: "med1", horizon: "medium" }),
      goal({ id: "long1", horizon: "long" }),
      goal({ id: "long2", horizon: "long", parent_goal_id: "med1" }), // dato anomalo: lungo figlio di medio
      goal({ id: "long3", horizon: "long", parent_goal_id: "long2" }), // nipote
      goal({ id: "longArch", horizon: "long", status: "archived" })
    ];
    const ids = (g) => Calc.possibleParents(g).map((x) => x.id).sort();
    assert.deepEqual(ids(Store.d.goals[1]), ["long1"]);
    assert.deepEqual(ids(Store.d.goals[0]), ["long1", "long2", "long3", "med1"]);
    assert.deepEqual(ids({ horizon: "short" }), ["long1", "long2", "long3", "med1"]); // obiettivo nuovo
    assert.deepEqual(ids(Store.d.goals[2]), []);
    assert.deepEqual([...Calc.descendantIds(Store.d.goals[1])].sort(), ["long2", "long3"]);
  });

  test("il genitore fa la media con i figli", () => {
    Store.d.goals = [
      goal({ id: "P", horizon: "long", manual_progress: 0 }),
      goal({ id: "K1", parent_goal_id: "P", manual_progress: 50 }),
      goal({ id: "K2", parent_goal_id: "P", status: "done", done_at: "2026-02-01T10:00:00Z" })
    ];
    assert.equal(Calc.goalProgress(Store.d.goals[0], "2026-06-01"), 75);
  });
});

describe("avanzamento degli obiettivi", () => {
  beforeEach(fresh);

  test("senza fonti usa manual_progress", () => {
    const g = goal({ id: "g", manual_progress: 42 });
    Store.d.goals = [g];
    assert.equal(Calc.goalProgress(g, "2026-06-01"), 42);
  });

  test("tappe: fatte / totali, con le sottotappe e la data di completamento", () => {
    const g = goal({ id: "g" });
    Store.d.goals = [g];
    Store.d.milestones = [
      { id: "m1", goal_id: "g", title: "1", done: true, done_at: "2026-03-01T10:00:00Z", position: 0 },
      { id: "m2", goal_id: "g", title: "2", done: false, position: 1 },
      { id: "m3", goal_id: "g", title: "3", done: false, position: 2 },
      { id: "s1", goal_id: "g", parent_id: "m3", title: "3a", done: true, done_at: "2026-03-01T10:00:00Z", position: 0 },
      { id: "s2", goal_id: "g", parent_id: "m3", title: "3b", done: false, position: 1 }
    ];
    // m1 100, m2 0, m3 50 → 50
    assert.equal(Calc.goalProgress(g, "2026-06-01"), 50);
    // prima del completamento di m1 e s1 → 0
    assert.equal(Calc.goalProgress(g, "2026-02-01"), 0);
  });

  test("obiettivo completato = 100 dalla data di completamento", () => {
    const g = goal({ id: "g", status: "done", done_at: "2026-05-10T08:00:00Z", manual_progress: 10 });
    Store.d.goals = [g];
    assert.equal(Calc.goalProgress(g, "2026-06-01"), 100);
    assert.equal(Calc.goalProgress(g, "2026-05-01"), 10);
  });

  test("abitudini collegate: credito sui giorni previsti", () => {
    const g = goal({ id: "g", start_date: "2026-06-01", due_date: "2026-06-04" });
    Store.d.goals = [g];
    Store.d.habits = [{ id: "h", kind: "check", target: 1, days: [1, 2, 3, 4, 5, 6, 7], goal_id: "g", start_date: "2026-01-01", archived: false }];
    Store.d.habit_logs = [{ habit_id: "h", log_date: "2026-06-01", value: 1 }, { habit_id: "h", log_date: "2026-06-02", value: 1 }];
    Store.reindex();
    assert.equal(Calc.goalProgress(g, "2026-06-04"), 50); // 2 su 4
  });
});

describe("serie (streak)", () => {
  beforeEach(fresh);
  const habit = (o = {}) => ({ id: "h", kind: "check", target: 1, days: [1, 2, 3, 4, 5, 6, 7], start_date: "2020-01-01", archived: false, ...o });
  const logs = (dates, value = 1) => { Store.d.habit_logs = dates.map((d) => ({ habit_id: "h", log_date: d, value })); Store.reindex(); };

  test("oggi non ancora fatto non spezza la serie", () => {
    const t = U.today();
    Store.d.habits = [habit()];
    logs([U.addDays(t, -1), U.addDays(t, -2), U.addDays(t, -3)]);
    assert.equal(Calc.streak(Store.d.habits[0]), 3);
    logs([t, U.addDays(t, -1)]);
    assert.equal(Calc.streak(Store.d.habits[0]), 2);
  });

  test("un giorno mancato la interrompe; i giorni non previsti non contano", () => {
    const t = U.today();
    Store.d.habits = [habit()];
    logs([U.addDays(t, -1), U.addDays(t, -3)]);
    assert.equal(Calc.streak(Store.d.habits[0]), 1);
    // prevista solo nel giorno della settimana di ieri e di 8 giorni fa
    Store.d.habits = [habit({ days: [U.dow(U.addDays(t, -1))] })];
    logs([U.addDays(t, -1), U.addDays(t, -8)]);
    assert.equal(Calc.streak(Store.d.habits[0]), 2);
  });

  test("quantitativa: conta solo se raggiunge il target", () => {
    const t = U.today();
    Store.d.habits = [habit({ kind: "qty", target: 10 })];
    logs([U.addDays(t, -1)], 9);
    assert.equal(Calc.streak(Store.d.habits[0]), 0);
    logs([U.addDays(t, -1)], 10);
    assert.equal(Calc.streak(Store.d.habits[0]), 1);
  });

  test("bestStreak", () => {
    const t = U.today();
    Store.d.habits = [habit({ start_date: U.addDays(t, -10) })];
    logs([-10, -9, -8, -6, -5].map((n) => U.addDays(t, n)));
    assert.equal(Calc.bestStreak(Store.d.habits[0]), 3);
  });
});

describe("periodi (obiettivi ricorrenti)", () => {
  beforeEach(fresh);
  test("periodRange", () => {
    assert.deepEqual([...Calc.periodRange("week", "2026-10-16")], ["2026-10-12", "2026-10-18"]); // ven → lun..dom
    assert.deepEqual([...Calc.periodRange("week", "2026-10-12")], ["2026-10-12", "2026-10-18"]);
    assert.deepEqual([...Calc.periodRange("week", "2026-10-18")], ["2026-10-12", "2026-10-18"]);
    assert.deepEqual([...Calc.periodRange("month", "2026-02-14")], ["2026-02-01", "2026-02-28"]);
    assert.deepEqual([...Calc.periodRange("month", "2028-02-14")], ["2028-02-01", "2028-02-29"]);
    assert.deepEqual([...Calc.periodRange("year", "2026-07-01")], ["2026-01-01", "2026-12-31"]);
  });
  test("shiftPeriod", () => {
    const m = Calc.periodRange("month", "2026-01-31");
    assert.deepEqual([...Calc.shiftPeriod("month", m, 1)], ["2026-02-01", "2026-02-28"]);
    assert.deepEqual([...Calc.shiftPeriod("month", m, -1)], ["2025-12-01", "2025-12-31"]);
    const w = Calc.periodRange("week", "2026-10-16");
    assert.deepEqual([...Calc.shiftPeriod("week", w, -1)], ["2026-10-05", "2026-10-11"]);
    assert.deepEqual([...Calc.shiftPeriod("week", w, 2)], ["2026-10-26", "2026-11-01"]); // cambio ora legale
    const y = Calc.periodRange("year", "2026-05-05");
    assert.deepEqual([...Calc.shiftPeriod("year", y, -1)], ["2025-01-01", "2025-12-31"]);
  });
});

describe("date locali (util.js)", () => {
  beforeEach(fresh);
  test("U.today è la data locale", () => {
    const d = new Date();
    const exp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    assert.equal(U.today(), exp);
  });
  test("U.dateOf converte un timestamp UTC nel giorno locale", () => {
    assert.equal(U.dateOf("2026-10-16T23:30:00Z"), "2026-10-17"); // a Roma è già l'1:30 del 17
    assert.equal(U.dateOf("2026-10-16T21:59:00Z"), "2026-10-16");
    assert.equal(U.dateOf("2026-01-15T23:30:00Z"), "2026-01-16"); // ora solare
  });
  test("addDays attraversa il cambio dell'ora legale", () => {
    assert.equal(U.addDays("2026-10-24", 1), "2026-10-25");
    assert.equal(U.addDays("2026-10-25", 1), "2026-10-26");
    assert.equal(U.addDays("2026-03-28", 2), "2026-03-30");
    assert.equal(U.diffDays("2026-03-28", "2026-03-30"), 2);
  });
});
