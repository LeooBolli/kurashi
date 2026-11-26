// ============================================================
// Widget della Home: obiettivi e scadenze.
// Ogni widget: title, icon, sizes (formati ammessi), go (sezione che apre),
// mini() per cerchio e capsula, render(formato, opzioni) → { html }. Vedi js/home/kit.js.
// ============================================================
(() => {
  const { ic, esc, head, big, empty, cta, track, pickGoal, monthly, barChart, goalInfo, leftChip, dueTxt } = HomeKit;
  Object.assign(HomeWidgets, {
    goals: {
      title: "Obiettivi", icon: "goal", sizes: ["c", "p", "mh", "mv", "lh", "lv"], go: "goals",
      mini(o) {
        const g = pickGoal(o) || Calc.activeGoals().slice().sort((a, b) => (goalInfo(a).due || "9999").localeCompare(goalInfo(b).due || "9999"))[0];
        if (!g) return { icon: "goal", title: "Obiettivi", value: "0", cap: "Nessun obiettivo attivo", p: null };
        const gi = goalInfo(g);
        return { icon: "goal", title: esc(g.title), value: gi.pct, unit: "%", cap: gi.due ? `Scade il ${U.fmtShort(gi.due)} · ${gi.pace.label}` : gi.pace.label, p: gi.pct / 100 };
      },
      render(sz, o) {
        const one = pickGoal(o);
        const goals = one ? [one] : Calc.activeGoals().slice().sort((a, b) => (goalInfo(a).due || "9999").localeCompare(goalInfo(b).due || "9999"));
        if (!goals.length) return { html: head("goal", "Obiettivi", "Nessuno attivo") + `<div class="d-wb">${empty("Definisci dove vuoi arrivare in 1, 4 o 12 mesi.", cta("Nuovo obiettivo", "goal-new"))}</div>` };
        const n = { mh: 2, mv: 3, lh: 3, lv: 4 }[sz];
        const items = goals.slice(0, n).map((g) => {
          const gi = goalInfo(g);
          if (sz === "lh") {
            // scheda piena: % grande e giorni rimasti, poi le prossime 2 tappe, in fondo ritmo e tappe fatte
            const nx = gi.nexts.length ? `<div class="d-nx"><small>${gi.nexts.length > 1 ? "Prossime tappe" : "Prossima tappa"}</small><ul>${gi.nexts.map((m) => `<li><span>${esc(m.title)}</span>${m.date ? `<em>${U.fmtShort(m.date)}</em>` : ""}</li>`).join("")}</ul></div>` : `<div class="d-nx"><small>Tappe</small><b>${gi.steps.length ? "Tutte completate" : "Nessuna tappa"}</b></div>`;
            const meta = [gi.pace.label, gi.steps.length ? `${gi.doneSteps} di ${gi.steps.length} tappe` : "", gi.due ? `scade il ${U.fmtShort(gi.due)}` : ""].filter(Boolean).join(" · ");
            return `<div class="d-goal"><div class="d-t"><span>${esc(g.title)}</span></div><div class="d-gtop"><div class="d-pbig">${gi.pct}<span class="d-u">%</span></div>${leftChip(gi)}</div>${track(gi.pct, `${gi.pct}%, ${gi.pace.label}`)}${nx}<span class="d-meta">${meta}</span></div>`;
          }
          const stepsHTML = sz === "lv" && gi.steps.length ? `<div class="d-steps">${gi.steps.slice(0, 5).map(([t, d]) => `<span class="d-step ${d ? "done" : ""}">${d ? ic("check", 12, 2.8) : ""}${esc(t)}</span>`).join("")}${gi.steps.length > 5 ? `<span class="d-step">+${gi.steps.length - 5}</span>` : ""}</div>` : "";
          return `<div class="d-goal"><div class="d-t"><span>${esc(g.title)}</span><span class="d-p">${gi.pct}%</span></div>${track(gi.pct, `${gi.pct}%, ${gi.pace.label}`)}${stepsHTML}<span class="d-meta">${dueTxt(gi)} · ${gi.pace.label}</span></div>`;
        }).join("");
        const g0 = goalInfo(goals[0]);
        const sub = one ? (dueTxt(g0) || g0.pace.label) : `${goals.length} ${goals.length === 1 ? "attivo" : "attivi"}${g0.due ? ` · il prossimo scade il ${U.fmtShort(g0.due)}` : ""}`;
        return { html: head("goal", "Obiettivi", sub) + `<div class="d-wb"><div class="d-goals ${sz === "lh" ? (goals.length > 1 ? "three" : "three one") : ""}">${items}</div></div>` };
      }
    },
    deadline: {
      title: "Prossima scadenza", icon: "hourglass", sizes: ["c", "s", "p"], go: "goals",
      pick(o) {
        const g = pickGoal(o);
        if (g) { const gi = goalInfo(g); return gi.due ? { g, gi } : null; }
        return Calc.activeGoals().map((x) => ({ g: x, gi: goalInfo(x) })).filter((x) => x.gi.due && x.gi.left >= 0).sort((a, b) => a.gi.left - b.gi.left)[0];
      },
      mini(o) {
        const x = this.pick(o);
        if (!x) return { icon: "hourglass", title: "Prossima scadenza", value: "—", cap: "Nessuna scadenza", p: null };
        return { cls: "orange", icon: "hourglass", title: esc(x.g.title), value: Math.abs(x.gi.left), unit: x.gi.left < 0 ? "di ritardo" : x.gi.left === 1 ? "giorno" : "giorni", cap: esc(x.g.title), p: x.gi.pct / 100 };
      },
      render(sz, o) {
        const x = this.pick(o);
        if (!x) return { html: head("hourglass", "Scadenza") + `<div class="d-wb">${empty("Nessun obiettivo con una data.")}</div>` };
        return { cls: "orange", html: head("hourglass", "Scadenza", `${x.gi.pct}% fatto`) + `<div class="d-wb end">${big(Math.abs(x.gi.left), x.gi.left < 0 ? "di ritardo" : x.gi.left === 1 ? "giorno" : "giorni")}<span class="d-cap">${esc(x.g.title)}</span></div>` };
      }
    },
    // Conto alla rovescia verso una data scelta in Personalizza (con titolo, anche ogni anno)
    countdown: {
      title: "Conto alla rovescia", icon: "hourglass", sizes: ["c", "s", "p", "mh"],
      data(o) {
        if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(o.date || "")) return null;
        const today = U.today();
        let date = o.date;
        if (o.yearly) while (date < today) date = U.addMonths(date, 12);
        const left = U.diffDays(today, date), label = esc(o.label || "Conto alla rovescia");
        // barra: dal giorno in cui l'hai impostato (o dall'anno prima, se si ripete) fino alla data
        const from = o.yearly ? U.addMonths(date, -12) : o.since && o.since < date ? o.since : null;
        const p = from ? U.clamp(U.diffDays(from, today) / Math.max(1, U.diffDays(from, date)), 0, 1) : null;
        const v = left > 0 ? left : left === 0 ? "Oggi" : -left;
        const u = left > 0 ? (left === 1 ? "giorno" : "giorni") : left === 0 ? "" : -left === 1 ? "giorno fa" : "giorni fa";
        const weeks = left > 60 ? ` · circa ${Math.round(left / 30)} mesi` : left > 13 ? ` · ${Math.floor(left / 7)} settimane` : "";
        const when = `${U.fmtShort(date)}${left > 0 ? weeks : ""}`;
        return { date, left, label, p, v, u, when };
      },
      choose: (wide) => wide ? `<button type="button" class="d-btn deep sm" data-dash-custom aria-label="Scegli la data del conto alla rovescia">${ic("cal", 14, 2.2)}Scegli la data</button>`
        : `<button type="button" class="d-cbtn" data-dash-custom aria-label="Scegli la data del conto alla rovescia">${ic("cal", 15, 2.2)}</button>`,
      mini(o, sz) {
        const x = this.data(o);
        if (!x) return { icon: "hourglass", title: "Conto alla rovescia", value: "—", cap: "Scegli la data", p: null, action: this.choose() };
        return { cls: x.left === 0 ? "orange" : "", icon: "hourglass", title: x.label, value: x.v, unit: x.u, cap: sz === "p" ? (x.left < 0 ? `${x.when} · passato` : x.when) : x.left < 0 ? `${x.label} · passato` : x.label, p: x.p };
      },
      render(sz, o) {
        const x = this.data(o);
        if (!x) return { html: head("hourglass", "Conto alla rovescia") + `<div class="d-wb">${empty("Un esame, un viaggio, un compleanno: scegli la data.", this.choose(true))}</div>` };
        const cap = x.left > 0 ? "mancano" : x.left === 0 ? "È oggi!" : "È passato";
        return { cls: x.left === 0 ? "orange" : "", html: head("hourglass", x.label, x.when) + `<div class="d-wb end" style="gap:8px">${big(x.v, x.u)}<span class="d-cap">${cap}</span>${sz === "mh" && x.p != null ? track(x.p * 100, `${Math.round(x.p * 100)}% del tempo trascorso`) : ""}</div>` };
      }
    },
    stats: {
      title: "Costanza", icon: "chart", sizes: ["mh", "lh", "lv"], go: "insights",
      render(sz) {
        const today = U.today();
        if (!Calc.activeHabits().length) return { cls: "blue", html: head("chart", "Costanza", "% di abitudini fatte") + `<div class="d-wb">${empty("Le statistiche arrivano con la prima abitudine.", cta("Nuova abitudine", "habit-new"))}</div>` };
        const data = monthly(today);
        const hasPrev = data.some((d) => d.prev != null);
        const legend = `<div class="d-legend"><span>Quest'anno</span>${hasPrev ? `<span class="b">Anno scorso</span>` : ""}</div>`;
        // settimana e mese correnti, confrontati con lo stesso tratto del periodo precedente
        const mon = U.mondayOf(today), off = U.diffDays(mon, today);
        const wk = Calc.rate(mon, today), wkPrev = Calc.rate(U.addDays(mon, -7), U.addDays(mon, -7 + off));
        const m0 = today.slice(0, 8) + "01", mOff = U.diffDays(m0, today), pm0 = U.addMonths(m0, -1);
        const pmEnd = U.addDays(pm0, mOff) < m0 ? U.addDays(pm0, mOff) : U.addDays(m0, -1);
        const mo = Calc.rate(m0, today), moPrev = Calc.rate(pm0, pmEnd);
        const kpi = (label, v, prev) => {
          const dlt = v != null && prev != null ? Math.round(v - prev) : null;
          const icn = dlt == null || dlt === 0 ? "flat" : dlt > 0 ? "up" : "down";
          const why = dlt == null ? "" : dlt === 0 ? ", come il periodo prima" : `, ${dlt > 0 ? "più" : "meno"} ${Math.abs(dlt)} punti rispetto al periodo prima`;
          return `<div class="d-kpi" aria-label="${label}: ${v == null ? "nessun dato" : Math.round(v) + "%"}${why}">${ic(icn, 20, 2)}<p>${label}</p><b>${v == null ? "–" : Math.round(v) + "%"}</b></div>`;
        };
        const k = `<div class="d-kpis">${kpi("Questa settimana", wk, wkPrev)}${kpi("Questo mese", mo, moPrev)}${legend}</div>`;
        if (sz === "mh") return { cls: "blue", html: head("chart", "Costanza", "% di abitudini fatte", legend) + `<div class="d-chart">${barChart(true, data)}</div>` };
        return { cls: "blue", html: head("chart", "Costanza", "% di abitudini fatte per mese") + `<div class="d-chart ${sz === "lv" ? "col" : ""}">${barChart(false, data)}${k}</div>` };
      }
    },
  });
})();
