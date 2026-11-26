// ============================================================
// Widget della Home: finanze.
// Ogni widget: title, icon, sizes (formati ammessi), go (sezione che apre),
// mini() per cerchio e capsula, render(formato, opzioni) → { html }. Vedi js/home/kit.js.
// ============================================================
(() => {
  const { ic, esc, cap1, head, big, empty, cta, track } = HomeKit;
  Object.assign(HomeWidgets, {
    finMonth: {
      title: "Spese del mese", icon: "coin", sizes: ["c", "s", "p", "mh"], go: "finance",
      data() { const m = Finance.lastMonth(), f = Finance.filled(m); return { m, t: Finance.total(m), f, name: cap1(Finance.monthName(m)), note: Finance.deltaText(m) }; },
      mini() {
        const x = this.data();
        return { icon: "coin", title: "Spese del mese", value: Finance.whole(x.t), unit: "€", cap: x.note ? `${x.name} · ${x.note}` : x.name, p: x.f.total ? x.f.done / x.f.total : null };
      },
      render(sz) {
        const x = this.data();
        if (!x.t) return { html: head("coin", "Spese del mese") + `<div class="d-wb">${empty("Ancora nessun importo.", cta("Compila", "finance-open"))}</div>` };
        return { html: head("coin", "Spese del mese", x.name) + `<div class="d-wb end">${big(Finance.whole(x.t), "€")}<span class="d-cap">${x.note || `${x.f.done} di ${x.f.total} voci compilate`}</span></div>` };
      }
    },
    finAreas: {
      title: "Macro aree", icon: "coin", sizes: ["mh", "mv", "lh"], go: "finance",
      render(sz) {
        const m = Finance.lastMonth(), list = Finance.byGroup(m), t = Finance.total(m), n = sz === "mh" ? 2 : 7;
        if (!list.length) return { html: head("coin", "Macro aree") + `<div class="d-wb">${empty("Compila le spese per vedere dove vanno.", cta("Compila", "finance-open"))}</div>` };
        return { html: head("coin", "Macro aree", cap1(Finance.monthName(m))) + `<div class="d-wb"><ul class="d-fbars">${list.slice(0, n).map((g) => `<li style="--a:${g.color}"><span>${esc(g.label)}</span><b>${Finance.whole(g.total)} €</b><i><u style="width:${(g.total / t) * 100}%"></u></i></li>`).join("")}</ul></div>` };
      }
    },
    finTrend: {
      title: "Andamento spese", icon: "chart", sizes: ["mh", "lh"], go: "finance",
      render(sz) {
        const end = Finance.lastMonth(), list = Finance.series(sz === "lh" ? 12 : 6, end), max = Math.max(1, ...list.map((x) => x.total));
        const v = list.filter((x) => x.total > 0).map((x) => x.total), avg = U.avg(v);
        return { html: head("chart", "Andamento spese", avg == null ? "Nessun dato" : `Media ${Finance.whole(avg)} € al mese`) + `<div class="d-wb end"><div class="d-fcols" role="img" aria-label="Spese totali degli ultimi ${list.length} mesi">${list.map((x) => `<span class="${x.m === end ? "cur" : ""}" title="${Finance.monthName(x.m, true)}: ${Finance.euro(x.total)}"><i style="height:${(x.total / max) * 100}%"></i><small>${U.MONTHS[U.parse(x.m).getMonth()][0].toUpperCase()}</small></span>`).join("")}</div></div>` };
      }
    },
    finTodo: {
      title: "Da compilare", icon: "edit", sizes: ["c", "s", "p"], go: "finance",
      data() { const m = Finance.defaultMonth(), f = Finance.filled(m); return { f, left: f.total - f.done, name: cap1(Finance.monthName(m)) }; },
      mini() {
        const x = this.data();
        return { icon: "edit", title: "Da compilare", value: x.left, unit: x.left === 1 ? "voce" : "voci", cap: x.name, p: x.f.total ? x.f.done / x.f.total : null };
      },
      render() {
        const x = this.data();
        return { html: head("edit", "Da compilare", x.name) + `<div class="d-wb end">${big(x.left, x.left === 1 ? "voce" : "voci")}<span class="d-cap">${x.f.done} di ${x.f.total} fatte</span></div>` };
      }
    },
    finBalance: {
      title: "Saldo del mese", icon: "wallet", sizes: ["c", "s", "p", "mh"], go: "finance",
      data() {
        const m = Finance.lastBalanced();
        if (!m) return null;
        const b = Finance.balance(m);
        return { name: cap1(Finance.monthName(m)), sign: b < 0 ? "−" : "+", value: Finance.whole(Math.abs(b)), detail: `${Finance.whole(Finance.total(m, "in"))} € entrate · ${Finance.whole(Finance.total(m))} € uscite` };
      },
      mini() {
        const x = this.data();
        return x ? { icon: "wallet", title: "Saldo del mese", value: x.sign + x.value, unit: "€", cap: x.name, p: null } : { icon: "wallet", title: "Saldo del mese", value: "—", cap: "Compila le entrate", p: null };
      },
      render() {
        const x = this.data();
        if (!x) return { html: head("wallet", "Saldo del mese") + `<div class="d-wb">${empty("Compila le entrate per vedere il saldo.", cta("Compila", "finance-open"))}</div>` };
        return { html: head("wallet", "Saldo del mese", x.name) + `<div class="d-wb end">${big(x.sign + x.value, "€")}<span class="d-cap">${x.detail}</span></div>` };
      }
    },
    finYear: {
      title: "Riepilogo dell'anno", icon: "cal", sizes: ["c", "s", "p", "mh"], go: "finance",
      data() { return Finance.yearStats(Finance.lastMonth().slice(0, 4)); },
      mini() {
        const x = this.data();
        return { icon: "cal", title: `Uscite ${x.year}`, value: Finance.whole(x.total), unit: "€", cap: x.count ? `Media ${Finance.whole(x.avg)} € al mese` : "Nessun dato", p: null };
      },
      render(sz) {
        const x = this.data();
        if (!x.count) return { html: head("cal", `Uscite ${x.year}`) + `<div class="d-wb">${empty("Compila le spese per vedere l'anno.", cta("Compila", "finance-open"))}</div>` };
        const top = `Il più caro: ${Finance.monthName(x.top.m)}, ${Finance.whole(x.top.total)} €`;
        return { html: head("cal", `Uscite ${x.year}`, `${x.count} ${x.count === 1 ? "mese" : "mesi"} · media ${Finance.whole(x.avg)} €`) + `<div class="d-wb end">${big(Finance.whole(x.total), "€")}${sz === "mh" ? `<span class="d-cap">${top}</span>` : ""}</div>` };
      }
    },
    finVsAvg: {
      title: "Rispetto alla media", icon: "chart", sizes: ["c", "s", "p"], go: "finance",
      data() { const m = Finance.lastMonth(), d = Finance.vsAverage(m); return { d, value: d == null ? "—" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d)}`, name: cap1(Finance.monthName(m)) }; },
      mini() { const x = this.data(); return { icon: "chart", title: "Rispetto alla media", value: x.value, unit: x.d == null ? "" : "%", cap: x.d == null ? "Serve più di un mese" : x.name, p: null }; },
      render() { const x = this.data(); return { html: head("chart", "Rispetto alla media", x.name) + `<div class="d-wb end">${big(x.value, x.d == null ? "" : "%")}<span class="d-cap">${x.d == null ? "Serve più di un mese" : "sui mesi precedenti"}</span></div>` }; }
    },
    finGroup: {
      title: "Macro area", icon: "coin", sizes: ["c", "s", "p", "mh"], go: "finance",
      data(o) {
        const m = Finance.lastMonth(), id = (o && o.finGroup && Finance.groups().some((g) => g.id === o.finGroup) && o.finGroup) || (Finance.byGroup(m)[0] || {}).id;
        return id == null ? null : { m, id, label: esc(Finance.group(id).label), color: Finance.group(id).color, total: Finance.groupTotal(m, id), name: cap1(Finance.monthName(m)) };
      },
      mini(o) {
        const x = this.data(o);
        return x ? { icon: "coin", title: x.label, value: Finance.whole(x.total), unit: "€", cap: x.name, p: Finance.total(x.m) ? x.total / Finance.total(x.m) : null } : { icon: "coin", title: "Macro area", value: "—", cap: "Nessun importo", p: null };
      },
      render(sz, o) {
        const x = this.data(o);
        if (!x) return { html: head("coin", "Macro area") + `<div class="d-wb">${empty("Nessun importo.")}</div>` };
        const list = Finance.series(6, x.m).map((s) => ({ m: s.m, v: Finance.groupTotal(s.m, x.id) })), max = Math.max(1, ...list.map((s) => s.v));
        const cols = sz === "mh" ? `<div class="d-fcols" style="--a:${x.color}">${list.map((s) => `<span title="${Finance.monthName(s.m, true)}: ${Finance.euro(s.v)}"><i style="height:${(s.v / max) * 100}%;background:var(--a)"></i><small>${U.MONTHS[U.parse(s.m).getMonth()][0].toUpperCase()}</small></span>`).join("")}</div>` : "";
        return { html: head("coin", x.label, `${x.name} · ${Finance.whole(x.total)} €`) + `<div class="d-wb end">${cols || big(Finance.whole(x.total), "€")}</div>` };
      }
    },
    finTrips: {
      title: "Viaggi nell'anno", icon: "plane", sizes: ["c", "s", "p"], go: "finance",
      data() { const y = Finance.lastMonth().slice(0, 4), s = Finance.yearStats(y), t = Finance.groupYear(y, "viaggi"); return { y, t, p: s.total ? t / s.total : null }; },
      mini() { const x = this.data(); return { icon: "plane", title: `Viaggi ${x.y}`, value: Finance.whole(x.t), unit: "€", cap: x.p == null ? "Nessun dato" : `${Math.round(x.p * 100)}% delle uscite`, p: x.p }; },
      render() { const x = this.data(); return { html: head("plane", `Viaggi ${x.y}`) + `<div class="d-wb end">${big(Finance.whole(x.t), "€")}<span class="d-cap">${x.p == null ? "Nessun dato" : `${Math.round(x.p * 100)}% delle uscite`}</span></div>` }; }
    },
    finSave: {
      title: "Tasso di risparmio", icon: "target", sizes: ["c", "s", "p"], go: "finance",
      data() { const m = Finance.lastBalanced(); return m ? { v: Finance.saving(m), name: cap1(Finance.monthName(m)) } : null; },
      mini() {
        const x = this.data();
        return x && x.v != null ? { icon: "target", title: "Tasso di risparmio", value: `${x.v < 0 ? "−" : ""}${Math.abs(x.v)}`, unit: "%", cap: x.name, p: Math.max(0, x.v) / 100 } : { icon: "target", title: "Tasso di risparmio", value: "—", cap: "Compila le entrate", p: null };
      },
      render() {
        const x = this.data();
        if (!x || x.v == null) return { html: head("target", "Risparmio") + `<div class="d-wb">${empty("Compila le entrate per vederlo.", cta("Compila", "finance-open"))}</div>` };
        return { html: head("target", "Risparmio", x.name) + `<div class="d-wb end">${big(`${x.v < 0 ? "−" : ""}${Math.abs(x.v)}`, "%")}<span class="d-cap">delle entrate è rimasto</span></div>` };
      }
    },
    finCompare: {
      title: "Entrate e uscite", icon: "bars", sizes: ["mh", "lh"], go: "finance",
      render(sz) {
        const list = Finance.series(sz === "lh" ? 12 : 6, Finance.lastMonth());
        if (!list.some((x) => x.income > 0)) return { html: head("bars", "Entrate e uscite") + `<div class="d-wb">${empty("Compila le entrate per il confronto.", cta("Compila", "finance-open"))}</div>` };
        const max = Math.max(1, ...list.map((x) => Math.max(x.income, x.total)));
        return { html: head("bars", "Entrate e uscite", `Ultimi ${list.length} mesi`) + `<div class="d-wb end"><div class="d-fcols two" role="img" aria-label="Entrate e uscite degli ultimi ${list.length} mesi">${list.map((x) => `<span title="${Finance.monthName(x.m, true)}: ${Finance.euro(x.income)} entrate, ${Finance.euro(x.total)} uscite"><em><i style="height:${(x.income / max) * 100}%"></i><i class="b" style="height:${(x.total / max) * 100}%"></i></em><small>${U.MONTHS[U.parse(x.m).getMonth()][0].toUpperCase()}</small></span>`).join("")}</div><div class="d-legend"><span>Uscite</span><span class="b">Entrate</span></div></div>` };
      }
    },
    finBudget: {
      title: "Budget del mese", icon: "target", sizes: ["c", "s", "p", "mh"], go: "finance",
      data() {
        const b = Finance.budget(), m = Finance.lastMonth();
        if (!b) return null;
        const t = Finance.total(m), left = b - t;
        return { b, t, over: left < 0, left: Finance.whole(Math.abs(left)), p: t / b, name: cap1(Finance.monthName(m)) };
      },
      btn: () => `<button type="button" class="d-btn deep sm" data-act="fin-budget">${ic("edit", 14)}Imposta</button>`,
      mini() {
        const x = this.data();
        return x ? { icon: "target", title: "Budget del mese", value: x.left, unit: "€", cap: `${x.over ? "oltre il budget" : "rimasti"} · ${x.name}`, p: Math.min(1, x.p) } : { icon: "target", title: "Budget del mese", value: "—", cap: "Da impostare in Finanze", p: null };
      },
      render() {
        const x = this.data();
        if (!x) return { html: head("target", "Budget del mese") + `<div class="d-wb">${empty("Decidi quanto spendere al mese.", this.btn())}</div>` };
        return { html: head("target", "Budget del mese", x.name) + `<div class="d-wb end">${big(x.left, "€")}<span class="d-cap">${x.over ? "oltre il budget" : "rimasti"} di ${Finance.whole(x.b)} €</span>${track(Math.min(100, x.p * 100), `${Math.round(x.p * 100)}% del budget`)}</div>` };
      }
    },
    finRenew: {
      title: "Prossimi rinnovi", icon: "repeat", sizes: ["p", "mh", "mv"], go: "finance",
      mini() {
        const r = Finance.upcoming()[0];
        return r ? { icon: "repeat", title: esc(r.label), value: Finance.whole(r.amount), unit: "€", cap: `Il ${U.fmtShort(r.date)}`, p: null } : { icon: "repeat", title: "Prossimi rinnovi", value: "—", cap: "Nessun rinnovo", p: null };
      },
      render(sz) {
        const l = Finance.upcoming().slice(0, sz === "mv" ? 6 : 3);
        if (!l.length) return { html: head("repeat", "Prossimi rinnovi") + `<div class="d-wb">${empty("Aggiungili dalla sezione Finanze.")}</div>` };
        return { html: head("repeat", "Prossimi rinnovi") + `<div class="d-wb"><ul class="d-frenew">${l.map((r) => `<li><em>${U.fmtShort(r.date)}</em><span>${esc(r.label)}</span><b>${Finance.euro(r.amount)}</b></li>`).join("")}</ul></div>` };
      }
    },
    finSubs: {
      title: "Costo annuo rinnovi", icon: "repeat", sizes: ["c", "s", "p"], go: "finance",
      mini() { const t = Finance.yearCosts(); return { icon: "repeat", title: "Costo annuo rinnovi", value: Finance.whole(t), unit: "€", cap: t ? `${Finance.whole(t / 12)} € al mese` : "Nessun rinnovo", p: null }; },
      render() { const t = Finance.yearCosts(); return { html: head("repeat", "Costo dei rinnovi", "All'anno") + `<div class="d-wb end">${big(Finance.whole(t), "€")}<span class="d-cap">${t ? `${Finance.whole(t / 12)} € al mese` : "Nessun rinnovo"}</span></div>` }; }
    },
    finTop: {
      title: "Voce più alta", icon: "coin", sizes: ["c", "s", "p"], go: "finance",
      mini() {
        const m = Finance.lastMonth(), x = Finance.top(m);
        return x ? { icon: "coin", title: "Voce più alta", value: Finance.whole(x.amount), unit: "€", cap: esc(x.cat.label), p: x.amount / Finance.total(m) } : { icon: "coin", title: "Voce più alta", value: "—", cap: "Nessun importo", p: null };
      },
      render() {
        const m = Finance.lastMonth(), x = Finance.top(m);
        if (!x) return { html: head("coin", "Voce più alta") + `<div class="d-wb">${empty("Nessun importo.")}</div>` };
        return { html: head("coin", "Voce più alta", cap1(Finance.monthName(m))) + `<div class="d-wb end">${big(Finance.whole(x.amount), "€")}<span class="d-cap">${esc(x.cat.label)}</span></div>` };
      }
    },
  });
})();
