// Aree personali: syncAreas unisce le aree base con quelle salvate nelle impostazioni.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeContext, load } from "./helpers.mjs";

let w;
const fresh = () => { w = load(makeContext(), "js/config.js").window; };

describe("aree personali", () => {
  beforeEach(fresh);

  test("le aree personali si aggiungono dopo le sei di base", () => {
    w.syncAreas([{ id: "c_fam", label: "Famiglia", color: "#2A9AA5", icon: "users" }]);
    assert.deepEqual(Object.keys(w.AREAS), ["sport", "salute", "lavoro", "studio", "progetti", "hobby", "c_fam"]);
    assert.equal(w.AREAS.c_fam.label, "Famiglia");
    assert.equal(w.AREAS.c_fam.custom, true);
  });

  test("un'area tolta dalle impostazioni sparisce, le base restano", () => {
    w.syncAreas([{ id: "c_fam", label: "Famiglia", color: "#2A9AA5", icon: "users" }]);
    w.syncAreas([]);
    assert.equal(w.AREAS.c_fam, undefined);
    assert.equal(Object.keys(w.AREAS).length, 6);
    w.syncAreas(undefined);
    assert.equal(Object.keys(w.AREAS).length, 6);
  });

  test("dati non validi: niente sovrascritture delle base, valori ripuliti", () => {
    w.syncAreas([
      { id: "sport", label: "Finto", color: "#000000", icon: "x" },     // non può sostituire un'area base
      { id: "c_vuota", label: "   ", color: "#2A9AA5", icon: "users" },  // senza nome: scartata
      { id: "c_strana", label: "Arte", color: "red;background:url(x)", icon: "<script>" }
    ]);
    assert.equal(w.AREAS.sport.label, "Sport");
    assert.equal(w.AREAS.c_vuota, undefined);
    assert.equal(w.AREAS.c_strana.color, w.AREA_COLORS[0]);
    assert.equal(w.AREAS.c_strana.icon, "spark");
  });
});
