// Abitudini ricorrenti (calc.js: occursOn, window, isDue, slot, streak). Gira con:  node --test tests/
process.env.TZ = "Europe/Rome";
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeContext, load, get, run, STORE_STUB } from "./helpers.mjs";

let U, Calc, Store;
const TODAY = "2026-10-18"; // domenica
beforeEach(() => {
  const ctx = makeContext();
  run(ctx, STORE_STUB);
  load(ctx, "js/util.js", "js/calc.js");
  U = get(ctx, "U"); Calc = get(ctx, "Calc"); Store = get(ctx, "Store");
  U.today = () => TODAY;
});
const habit = (o) => ({ id: "h", name: "h", kind: "check", target: 1, step: 1, days: [1, 2, 3, 4, 5, 6, 7], start_date: "2026-01-01", archived: false, ...o });
const logs = (...dates) => { Store.d.habit_logs = dates.map((d) => ({ habit_id: "h", log_date: d, value: 1 })); Store.reindex(); };
const occ = (h, from, to) => [...U.range(from, to).filter((d) => Calc.occursOn(h, d))];

describe("occorrenze", () => {
  test("senza repeat: come prima, solo nei giorni scelti e senza riporto", () => {
    const h = habit({ days: [1, 4] });
    assert.deepEqual(occ(h, "2026-10-12", "2026-10-18"), ["2026-10-12", "2026-10-15"]);
    assert.equal(Calc.carries(h), false);
    assert.equal(Calc.isDue(h, "2026-10-13"), false);
  });

  test("ogni 2 settimane di martedì, a partire da una data", () => {
    const h = habit({ days: [2], repeat: { type: "week", every: 2, from: "2026-10-06" } });
    assert.deepEqual(occ(h, "2026-09-28", "2026-11-08"), ["2026-10-06", "2026-10-20", "2026-11-03"].filter((d) => d >= "2026-09-28"));
  });

  test("giorni del mese: 1, 15 e 31 (che nei mesi corti diventa l'ultimo)", () => {
    const h = habit({ repeat: { type: "monthdays", days: [1, 15, 31] } });
    assert.deepEqual(occ(h, "2026-02-01", "2026-03-01"), ["2026-02-01", "2026-02-15", "2026-02-28", "2026-03-01"]);
    const last = habit({ repeat: { type: "monthdays", days: [-1] } });
    assert.deepEqual(occ(last, "2026-04-01", "2026-05-31"), ["2026-04-30", "2026-05-31"]);
  });

  test("primo e ultimo lunedì del mese", () => {
    const h = habit({ repeat: { type: "nth", nths: [1, -1], dow: 1 } });
    assert.deepEqual(occ(h, "2026-10-01", "2026-10-31"), ["2026-10-05", "2026-10-26"]);
  });

  test("ogni 3 giorni", () => {
    const h = habit({ repeat: { type: "interval", every: 3, from: "2026-10-10" } });
    assert.deepEqual(occ(h, "2026-10-10", "2026-10-18"), ["2026-10-10", "2026-10-13", "2026-10-16"]);
  });
});

describe("resta in lista finché non la fai", () => {
  const bill = () => habit({ repeat: { type: "monthdays", days: [15] } });

  test("non fatta il 15: resta dal 15 in poi, con la data da cui è in sospeso", () => {
    const h = bill();
    assert.equal(Calc.isDue(h, "2026-10-14"), true); // finestra del 15 settembre, mai fatta
    assert.equal(Calc.isDue(h, TODAY), true);
    assert.equal(Calc.pendingSince(h, TODAY), "2026-10-15");
  });

  test("fatta il 16: sparisce dai giorni dopo fino al 15 successivo", () => {
    const h = bill();
    logs("2026-10-16");
    assert.equal(Calc.isDue(h, "2026-10-16"), true);
    assert.equal(Calc.isDue(h, "2026-10-17"), false);
    assert.equal(Calc.isDue(h, "2026-11-15"), true);
  });

  test("nelle statistiche un'occorrenza conta una volta sola", () => {
    const h = bill();
    logs("2026-10-16");
    // 15..17: in sospeso il 15 (passato, non conta), fatta il 16, niente il 17
    assert.equal(Calc.rate("2026-10-15", "2026-10-17", [h]), 100);
    // settembre: non fatta, conta come persa l'ultimo giorno della finestra (14 ottobre)
    assert.deepEqual({ ...Calc.slot(h, "2026-10-14") }, { due: 1, credit: 0 });
    assert.deepEqual({ ...Calc.slot(h, "2026-09-20") }, { due: 0, credit: 0 });
  });

  test("oggi in sospeso conta come da fare oggi", () => {
    const h = bill();
    assert.deepEqual({ ...Calc.dayStats(TODAY, [h]) }, { due: 1, credit: 0, done: 0, pct: 0 });
  });

  test("serie: occorrenze fatte di fila, quella in corso non la interrompe", () => {
    const h = bill();
    logs("2026-08-15", "2026-09-20");
    assert.equal(Calc.streak(h), 2);
    logs("2026-07-15", "2026-09-20");
    assert.equal(Calc.streak(h), 1);
    assert.equal(Calc.bestStreak(h), 1);
  });
});

describe("N volte nel periodo", () => {
  test("2 volte al mese: in lista finché non arrivi a 2, poi riposo", () => {
    const h = habit({ repeat: { type: "times", count: 2, per: "month" } });
    logs("2026-10-03", "2026-10-10");
    assert.equal(Calc.isDue(h, "2026-10-10"), true);
    assert.equal(Calc.isDue(h, "2026-10-11"), false);
    assert.deepEqual({ ...Calc.periodCount(h, TODAY) }, { done: 2, need: 2 });
    assert.equal(Calc.rate("2026-10-01", TODAY, [h]), 100);
  });

  test("3 volte a settimana non raggiunte: le mancanti contano l'ultimo giorno", () => {
    const h = habit({ repeat: { type: "times", count: 3, per: "week" } });
    logs("2026-10-06");
    assert.deepEqual({ ...Calc.slot(h, "2026-10-11") }, { due: 2, credit: 0 });
    assert.equal(Math.round(Calc.rate("2026-10-05", "2026-10-11", [h])), 33);
  });
});
