// Esami: elenco, ore studiate e piano del giorno.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeContext, load, get, run, STORE_STUB } from "./helpers.mjs";

const DAY = "2026-11-01";
let ctx, C, S;
const exam = (o) => S.d.milestones.push({ id: o.id, is_exam: true, title: o.id, goal_id: null, parent_id: null, position: 0, ...o });
const study = (id, min, date = "2026-10-20") => S.d.focus_sessions.push({ id: id + date + min, milestone_id: id, completed: true, duration_min: min, started_at: `${date}T12:00:00` });

beforeEach(() => {
  ctx = makeContext();
  load(ctx, "js/config.js", "js/util.js");
  run(ctx, STORE_STUB);
  load(ctx, "js/calc.js");
  C = get(ctx, "Calc"); S = get(ctx, "Store");
});

describe("esami", () => {
  test("prima quelli con la data, i superati a parte, gli argomenti non contano", () => {
    exam({ id: "a" }); exam({ id: "b", exam_date: "2027-01-10" }); exam({ id: "c", exam_date: "2026-12-01" }); exam({ id: "d", exam_grade: "28" });
    S.d.milestones.push({ id: "t", is_exam: false, parent_id: "a", title: "Argomento", position: 0 });
    assert.deepEqual([...C.exams().map((m) => m.id)], ["c", "b", "a"]);
    assert.deepEqual([...C.examsPassed().map((m) => m.id)], ["d"]);
  });
  test("contano solo le sessioni completate", () => {
    exam({ id: "a" }); study("a", 50);
    S.d.focus_sessions.push({ id: "x", milestone_id: "a", completed: false, duration_min: 30, started_at: "2026-10-20T12:00:00" });
    assert.equal(C.examMin({ id: "a" }), 50);
  });
});

describe("piano del giorno", () => {
  test("ore mancanti divise per i giorni, arrotondate a 5 minuti", () => {
    exam({ id: "a", exam_date: "2026-11-11", exam_hours: 10 });
    const [p] = C.examPlan(DAY);
    assert.equal(p.days, 10); assert.equal(p.perDay, 60); assert.equal(p.due, 60);
  });
  test("le ore già fatte riducono il piano, quelle di oggi solo ciò che resta da fare", () => {
    exam({ id: "a", exam_date: "2026-11-11", exam_hours: 10 });
    study("a", 300); study("a", 20, DAY);
    const [p] = C.examPlan(DAY);
    assert.equal(p.perDay, 30); assert.equal(p.due, 10);
  });
  test("fuori dal piano: senza data, senza ore, appello passato o completato", () => {
    exam({ id: "a" }); exam({ id: "b", exam_date: "2026-12-01" }); exam({ id: "c", exam_date: "2026-10-01", exam_hours: 5 });
    exam({ id: "d", exam_date: "2026-12-01", exam_hours: 1 }); study("d", 60);
    assert.equal(C.examPlan(DAY).length, 0);
  });
});
