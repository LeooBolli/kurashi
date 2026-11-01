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
  test("una tappa di un obiettivo segnata come esame compare da sola, i suoi argomenti no", () => {
    exam({ id: "uni", goal_id: "obiettivo-uni" });
    S.d.milestones.push({ id: "t", is_exam: false, goal_id: "obiettivo-uni", parent_id: "uni", title: "Norma", position: 0 });
    S.d.milestones.push({ id: "p", is_exam: false, goal_id: "obiettivo-uni", parent_id: null, title: "Iscrizione", position: 1 });
    assert.deepEqual([...C.exams().map((m) => m.id)], ["uni"]);
  });
  test("contano solo le sessioni completate", () => {
    exam({ id: "a" }); study("a", 50);
    S.d.focus_sessions.push({ id: "x", milestone_id: "a", completed: false, duration_min: 30, started_at: "2026-10-20T12:00:00" });
    assert.equal(C.examMin({ id: "a" }), 50);
  });
});

describe("piano del giorno", () => {
  test("ore mancanti divise per i giorni, arrotondate a 5 minuti", () => {
    exam({ id: "a", exam_date: "2026-11-11", exam_hours: 10, exam_fav: true });
    const [p] = C.examPlan(DAY);
    assert.equal(p.days, 10); assert.equal(p.perDay, 60); assert.equal(p.due, 60);
  });
  test("le ore già fatte riducono il piano, quelle di oggi solo ciò che resta da fare", () => {
    exam({ id: "a", exam_date: "2026-11-11", exam_hours: 10, exam_fav: true });
    study("a", 300); study("a", 20, DAY);
    const [p] = C.examPlan(DAY);
    assert.equal(p.perDay, 30); assert.equal(p.due, 10);
  });
  test("fuori dal piano: non preferito, senza data, senza ore, appello passato o completato", () => {
    exam({ id: "n", exam_date: "2026-12-01", exam_hours: 5 });
    exam({ id: "a", exam_fav: true }); exam({ id: "b", exam_date: "2026-12-01", exam_fav: true }); exam({ id: "c", exam_date: "2026-10-01", exam_hours: 5, exam_fav: true });
    exam({ id: "d", exam_date: "2026-12-01", exam_hours: 1, exam_fav: true }); study("d", 60);
    assert.equal(C.examPlan(DAY).length, 0);
  });
});

describe("sessioni pianificate", () => {
  const MON = "2026-11-02"; // lunedì
  test("solo i preferiti di quel giorno, in ordine di ora", () => {
    exam({ id: "a", exam_fav: true, exam_slots: [{ id: "1", dow: 1, time: "18:00", min: 60 }, { id: "2", dow: 2, time: "09:00", min: 30 }] });
    exam({ id: "b", exam_fav: true, exam_slots: [{ id: "3", dow: 1, time: "09:00", min: 30 }] });
    exam({ id: "c", exam_slots: [{ id: "4", dow: 1, time: "08:00", min: 30 }] });
    assert.deepEqual([...C.slotsOn(MON).map((s) => s.id)], ["3", "1"]);
  });
  test("una sessione è fatta quando i minuti del giorno la coprono, nell'ordine", () => {
    exam({ id: "a", exam_fav: true, exam_slots: [{ id: "1", dow: 1, time: "09:00", min: 30 }, { id: "2", dow: 1, time: "18:00", min: 60 }] });
    study("a", 40, MON);
    assert.deepEqual([...C.slotsOn(MON).map((s) => s.done)], [true, false]);
    study("a", 50, MON);
    assert.deepEqual([...C.slotsOn(MON).map((s) => s.done)], [true, true]);
  });
});
