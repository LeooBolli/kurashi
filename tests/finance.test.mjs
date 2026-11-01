// Finanze: importi, mese da compilare, conti e sezione spenta di default.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeContext, load, get, run, STORE_STUB } from "./helpers.mjs";

let ctx, F, S;
const w = () => ctx.window;
const M = (n) => get(ctx, "U").addMonths(get(ctx, "U").today().slice(0, 8) + "01", n);
const put = (month, category, amount) => S.d.finance_entries.push({ id: `${month}${category}`, month, category, amount });

beforeEach(() => {
  ctx = makeContext();
  load(ctx, "js/config.js", "js/util.js");
  run(ctx, STORE_STUB + `var Auth = { isOwner: () => true, uid: () => "u" }; var Actions = {}; var FIN_CATS = window.FIN_CATS, FIN_GROUPS = window.FIN_GROUPS, FIN_ICONS = window.FIN_ICONS;`);
  ctx.document.querySelectorAll = () => [];
  load(ctx, "js/finance.js");
  F = get(ctx, "Finance"); S = get(ctx, "Store");
});

describe("importi", () => {
  test("legge i formati italiani e quelli col punto", () => {
    assert.equal(F.parse("1.234,56"), 1234.56);
    assert.equal(F.parse("12,5"), 12.5);
    assert.equal(F.parse("12.50"), 12.5);
    assert.equal(F.parse("1.234"), 1234);
    assert.equal(F.parse("30 €"), 30);
    assert.equal(F.parse("0"), 0);
    assert.equal(F.parse("  "), null);
  });
  test("rifiuta ciò che non è un importo", () => {
    for (const s of ["abc", "-5", "1,2,3", "12,345"]) assert.ok(Number.isNaN(F.parse(s)), s);
  });
});

describe("struttura", () => {
  test("le voci personali sono solo dell'owner", () => {
    assert.equal(F.cats().length, 16);
    run(ctx, `Auth.isOwner = () => false`);
    assert.ok(!F.cats().some((c) => c.mine));
    assert.ok(!F.groups().some((g) => g.mine));
  });
  test("una voce archiviata resta solo nei mesi in cui ha un importo", () => {
    S.settings.financeCats = [{ id: "a", label: "A", group: "casa" }, { id: "b", label: "B", group: "casa", off: true }];
    put(M(-2), "b", 10);
    assert.deepEqual(F.catsFor(M(-2)).map((c) => c.id), ["a", "b"]);
    assert.deepEqual(F.catsFor(M(-1)).map((c) => c.id), ["a"]);
  });
});

describe("mesi e conti", () => {
  beforeEach(() => { S.settings.financeCats = [{ id: "a", label: "A", group: "casa" }, { id: "b", label: "B", group: "pasti" }]; });

  test("si compila il mese finito finché ha voci vuote, poi quello in corso", () => {
    assert.equal(F.defaultMonth(), M(-1));
    put(M(-1), "a", 0);
    assert.equal(F.defaultMonth(), M(-1));
    put(M(-1), "b", 5);
    assert.equal(F.defaultMonth(), M(0));
  });
  test("totale, macro aree e voce più alta", () => {
    put(M(-1), "a", "100.50"); put(M(-1), "b", 200);
    assert.equal(F.total(M(-1)), 300.5);
    assert.deepEqual([...F.byGroup(M(-1)).map((g) => g.label)], ["Pasti", "Casa"]);
    assert.equal(F.top(M(-1)).cat.id, "b");
  });
  test("confronto col mese prima, solo se quel mese ha dati", () => {
    put(M(-1), "a", 110);
    assert.equal(F.delta(M(-1)), null);
    put(M(-2), "a", 100);
    assert.equal(F.delta(M(-1)), 10);
    assert.equal(F.deltaText(M(-1)), "+10% sul mese prima");
  });
});

describe("entrate", () => {
  test("voci separate: non entrano nel totale delle uscite né nel conteggio da compilare", () => {
    assert.equal(F.cats("in").length, 5);
    put(M(-1), "luce", 100); put(M(-1), "in_stipendio", 2000);
    assert.equal(F.total(M(-1)), 100);
    assert.equal(F.total(M(-1), "in"), 2000);
    assert.equal(F.filled(M(-1)).done, 1);
    assert.equal(F.top(M(-1)).cat.id, "luce");
  });
  test("il saldo c'è solo se il mese ha entrate", () => {
    put(M(-1), "luce", 100);
    assert.equal(F.balance(M(-1)), null);
    put(M(-1), "in_extra", 30);
    assert.equal(F.balance(M(-1)), -70);
  });
  test("le voci importate restano valide dopo il riordino", () => {
    for (const id of ["luce", "gas", "spesa", "fisse", "macchina", "varie", "viaggi", "salute", "universita", "pasti", "nevada", "online", "personale", "attivita", "lavoro", "negozi"]) {
      const c = F.cats().find((x) => x.id === id);
      assert.ok(c && F.group(c.group).label !== "Altro" && w().FIN_ICONS.includes(c.icon), id);
    }
    assert.equal(F.group(F.cats().find((c) => c.id === "macchina").group).label, "Automobile");
    assert.equal(F.cats().find((c) => c.id === "fisse").label, "Abbonamenti");
  });
});

describe("sezione spenta di default", () => {
  test("finanze resta spenta finché non è in shownSections, le altre restano accese", () => {
    load(ctx, "js/app.js");
    const App = get(ctx, "App");
    assert.equal(App.isOn("finance"), false);
    assert.equal(App.isOn("habits"), true);
    S.settings.shownSections = ["finance"];
    assert.equal(App.isOn("finance"), true);
  });
});
