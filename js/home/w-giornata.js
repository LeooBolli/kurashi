// ============================================================
// Widget della Home: la giornata e le abitudini.
// Ogni widget: title, icon, sizes (formati ammessi), go (sezione che apre),
// mini() per cerchio e capsula, render(formato, opzioni) → { html }. Vedi js/home/kit.js.
// ============================================================
(() => {
  const { ic, esc, cap1, plural, st, head, big, empty, cta, ring, inArea, areaTitle, pickHabit, todayData,
    habitLeft, habBtn, nextBtn, weekRates, calState, calTabs, monthCount, calendar, calWeek, calNav } = HomeKit;
  Object.assign(HomeWidgets, {
    score: {
      title: "Oggi", icon: "sun", sizes: ["c", "s", "p", "mh"], go: "habits",
      mini() {
        const d = todayData(), p = d.stats.pct;
        return { icon: "sun", title: "Oggi", value: d.stats.due ? Math.round((p || 0) * 100) : "—", unit: d.stats.due ? "%" : "", cap: d.stats.due ? `${d.stats.done} di ${d.stats.due} abitudini` : "Giorno di riposo", p: d.stats.due ? p || 0 : null };
      },
      render(sz) {
        const d = todayData();
        const p = d.stats.pct;
        const lbl = d.stats.due ? `${Math.round((p || 0) * 100)}%` : "—";
        const small = d.stats.due ? `${d.stats.done} di ${d.stats.due}` : "riposo";
        if (sz === "s") return { html: head("sun", "Oggi") + `<div class="d-wb center">${ring(90, p, lbl, small)}</div>` };
        const wk = weekRates(d.today), ti = U.dow(d.today) - 1;
        const vals = wk.filter((v) => v != null);
        const avg = vals.length ? Math.round(U.avg(vals)) : null;
        return { html: head("sun", "Oggi", avg == null ? "Nessuna abitudine in programma" : `Media della settimana ${avg}%`) + `<div class="d-wb row-c">${ring(96, p, lbl, small)}<div class="d-week" aria-hidden="true">${wk.map((v, i) => `<div class="${i === ti ? "today" : ""}"><i class="${v != null && v >= 70 ? "f" : ""}" style="height:${Math.max(6, (v || 0) * 0.5)}px"></i>${U.DOW_SHORT[i]}</div>`).join("")}</div></div>` };
      }
    },
    habits: {
      title: "Abitudini", icon: "habit", sizes: ["p", "mh", "mv", "lh", "lv"], go: "habits",
      mini(o) {
        const d = todayData(o), next = d.due.find((h) => !Calc.isDone(h, d.today));
        return { icon: "habit", title: areaTitle(o), value: `${d.stats.done}/${d.stats.due}`, cap: next ? `Prossima: ${esc(next.name)}` : d.stats.due ? "Tutte fatte" : "Oggi riposo", p: d.stats.due ? d.stats.pct || 0 : null, action: next ? nextBtn(next, d.today) : "" };
      },
      render(sz, o) {
        const d = todayData(o), title = areaTitle(o);
        if (!d.due.length) {
          const none = !Calc.activeHabits().filter(inArea(o)).length;
          return { html: head("habit", title, none ? "Nessuna abitudine" : "Oggi riposo") + `<div class="d-wb">${empty(none ? "Inizia con una sola: piccola e chiara." : "Niente in programma oggi: goditi il riposo.", cta("Nuova abitudine", "habit-new"))}</div>` };
        }
        const n = { mh: 2, mv: 4, lh: 8, lv: 7 }[sz];
        const order = [...d.due].sort((a, b) => Calc.isDone(a, d.today) - Calc.isDone(b, d.today));
        const list = order.slice(0, n).map((h) => habBtn(h, d.today)).join("");
        const rest = d.due.length - n, left = habitLeft(d);
        const pct = Math.round((d.stats.pct || 0) * 100);
        const foot = sz === "lv" ? `<div class="d-row"><div class="d-legend"><span>Fatte ${d.stats.done}</span><span class="b">Da fare ${left}</span></div>${big(pct, "%")}</div>` : rest > 0 ? `<span class="d-more">Altre ${rest} nella sezione Abitudini</span>` : "";
        return { html: head("habit", title, left ? `${left} da fare oggi` : "Tutte fatte") + `<div class="d-wb"><div class="d-habits ${sz === "lh" ? "two" : ""}">${list}</div>${foot}</div>` };
      }
    },
    streak: {
      title: "Serie", icon: "flame", sizes: ["c", "s", "p"], go: "habits",
      best(o) {
        const h = pickHabit(o);
        if (h) return { h, s: Calc.streak(h), fixed: true };
        return Calc.activeHabits().map((x) => ({ h: x, s: Calc.streak(x) })).sort((a, b) => b.s - a.s)[0];
      },
      mini(o) {
        const best = this.best(o);
        return { cls: "orange", icon: "flame", title: best && best.fixed ? esc(best.h.name) : "Serie migliore", value: best ? best.s : 0, unit: best && best.s === 1 ? "giorno" : "giorni", cap: best && (best.s || best.fixed) ? esc(best.h.name) : "Completa un'abitudine", p: null };
      },
      render(sz, o) {
        const best = this.best(o);
        const title = best && best.fixed ? "Serie" : "Serie migliore";
        if (!best || (!best.s && !best.fixed)) return { cls: "orange", html: head("flame", title) + `<div class="d-wb end">${big(0, "giorni")}<span class="d-cap">${best ? "Completa un'abitudine per iniziare" : "Nessuna abitudine"}</span></div>` };
        const rec = Calc.bestStreak(best.h);
        return { cls: "orange", html: head("flame", title) + `<div class="d-wb end">${big(best.s, best.s === 1 ? "giorno" : "giorni")}<span class="d-cap">${esc(best.h.name)}${rec > best.s ? ` · record ${rec}` : best.s ? " · è il record" : ""}</span></div>` };
      }
    },

    // ---------- Widget nuovi ----------
    nextHabit: {
      title: "Prossima abitudine", icon: "habit", sizes: ["c", "s", "p", "mh"], go: "habits",
      // con un'abitudine scelta mostra sempre quella; altrimenti la prima ancora da fare oggi
      pick(o) {
        const d = todayData(), h = pickHabit(o);
        if (h) return { d, h, due: d.due.includes(h), done: Calc.isDone(h, d.today), fixed: true };
        const n = d.due.find((x) => !Calc.isDone(x, d.today));
        return { d, h: n || null, due: !!n, done: false };
      },
      mini(o) {
        const { d, h, due, done, fixed } = this.pick(o);
        if (!h) return { icon: "check", title: "Prossima abitudine", value: d.stats.due ? "Fatto" : "—", cap: d.stats.due ? "Tutte le abitudini di oggi" : "Oggi riposo", p: d.stats.due ? 1 : null };
        const s = Calc.streak(h);
        return { icon: done ? "check" : "habit", title: esc(h.name), value: s, unit: s === 1 ? "giorno" : "giorni", cap: fixed && !due ? "Non in programma oggi" : esc(h.name), p: done ? 1 : null, action: due && !done ? nextBtn(h, d.today) : "" };
      },
      render(sz, o) {
        const { d, h, due, done, fixed } = this.pick(o);
        if (!h) return { html: head("habit", "Prossima abitudine") + `<div class="d-wb">${empty(d.stats.due ? "Hai fatto tutto per oggi." : "Niente in programma oggi.")}</div>` };
        const s = Calc.streak(h), qty = h.kind !== "check";
        const info = !due ? "Non in programma oggi" : done ? "Fatta oggi" : qty ? `${U.num(Calc.value(h, d.today))} di ${U.num(h.target)} ${esc(h.unit || "")}` : s ? `${plural(s, "giorno", "giorni")} di fila` : "Da iniziare";
        return { html: head("habit", fixed ? "Abitudine" : "Prossima", fixed ? (s ? `${plural(s, "giorno", "giorni")} di fila` : "") : `${d.stats.due - d.stats.done} da fare oggi`) + `<div class="d-wb end"><b class="d-hname">${esc(h.name)}</b><div class="d-row"><span class="d-cap">${info}</span>${due && !done ? nextBtn(h, d.today, true) : ""}</div></div>` };
      }
    },
    points: {
      title: "Punteggio", icon: "star", sizes: ["c", "s", "p"], go: "insights",
      mini() {
        const sc = Calc.score(), v = sc.score == null ? null : Math.round(sc.score);
        return { cls: "blue", icon: "star", title: "Punteggio della settimana", value: v == null ? "—" : v, unit: v == null ? "" : "/100", cap: Calc.scoreLabel(v).label, p: v == null ? null : v / 100 };
      },
      render() {
        const sc = Calc.score(), v = sc.score == null ? null : Math.round(sc.score);
        return { cls: "blue", html: head("star", "Punteggio", "Ultimi 7 giorni") + `<div class="d-wb end">${big(v == null ? "—" : v, v == null ? "" : "/100")}<span class="d-cap">${Calc.scoreLabel(v).label}</span></div>` };
      }
    },
    calendar: {
      title: "Storico", icon: "cal", sizes: ["c", "s", "mh", "mv", "lh", "lv"],
      go(o) { const t = calState(o).tab; return t === "focus" ? "focus" : t === "diet" ? "food" : "habits"; },
      // cerchio: giorni pieni di questo mese, l'anello è la quota sui giorni passati
      mini(o) {
        calState(o);
        const c = monthCount(), tab = calTabs().tabs.find(([k]) => k === st.cs.tab)[1];
        return { icon: "cal", title: `Storico · ${tab}`, value: c.count, unit: c.count === 1 ? "giorno" : "giorni", cap: `pieni a ${U.MONTHS_LONG[c.m]}`, p: c.count / c.elapsed };
      },
      render(sz, o) {
        calState(o);
        if (sz === "s") {
          const c = monthCount();
          return { html: head("cal", "Storico", cap1(U.MONTHS_LONG[c.m])) + `<div class="d-wb end">${big(c.count, c.count === 1 ? "giorno" : "giorni")}<span class="d-cap">${c.run ? `Serie in corso: ${plural(c.run, "giorno", "giorni")}` : "pieni questo mese"}</span></div>` };
        }
        if (sz === "mh") {
          const c = calWeek();
          return { html: head("cal", "Storico", `${c.tab} · ${plural(c.count, "giorno pieno", "giorni pieni")} questa settimana`) + `<div class="d-wb end">${c.grid}<span class="d-cap">${c.run ? `Serie in corso: ${plural(c.run, "giorno", "giorni")}` : "Nessuna serie in corso"}</span></div>` };
        }
        const c = calendar(sz === "lh" ? "tight" : sz === "mv" ? "dots" : "");
        const sum = `<div class="d-sum"><b>${plural(c.count, "giorno completato", "giorni completati")}</b><span>${st.cs.off !== 0 ? "Mese passato" : c.run ? `Serie in corso: ${plural(c.run, "giorno", "giorni")}` : "Nessuna serie in corso"}</span></div>`;
        if (sz === "mv") return { html: head("cal", "Storico", c.name) + `<div class="d-wb">${c.grid}<div class="d-calfoot col">${sum}<div class="d-navs">${calNav()}</div></div></div>` };
        if (sz === "lh") return { html: head("cal", "Storico", c.name, c.tabsHTML + calNav()) + `<div class="d-wb d-calrow"><div class="d-calgrid">${c.grid}</div><div class="d-calfoot col">${sum}</div></div>` };
        return { html: head("cal", "Storico", c.name) + `<div class="d-wb" style="gap:18px">${c.tabsHTML}${c.grid}<div class="d-calfoot">${sum}<div class="d-navs">${calNav()}</div></div></div>` };
      }
    },
    heat: {
      title: "Ultime settimane", icon: "grid", sizes: ["mh", "lh"], go: "insights",
      render(sz) {
        const weeks = sz === "lh" ? 10 : 5, today = U.today(), mon = U.mondayOf(today);
        const start = U.addDays(mon, -7 * (weeks - 1));
        let cells = "";
        for (let w = 0; w < weeks; w++) for (let i = 0; i < 7; i++) {
          const d = U.addDays(start, w * 7 + i);
          if (d > today) { cells += `<i class="fut"></i>`; continue; }
          const s = Calc.dayStats(d), p = s.pct;
          const lv = p == null ? 0 : p >= 1 ? 4 : p >= .66 ? 3 : p >= .33 ? 2 : p > 0 ? 1 : 0;
          cells += `<i class="l${lv} ${d === today ? "today" : ""}" title="${U.fmtShort(d)}: ${p == null ? "riposo" : Math.round(p * 100) + "%"}"></i>`;
        }
        const r = Calc.rate(start, today);
        return { html: head("grid", "Ultime settimane", `${weeks} settimane · ${r == null ? "nessun dato" : Math.round(r) + "% di abitudini fatte"}`) + `<div class="d-wb center"><div class="d-heat" role="img" aria-label="Costanza giorno per giorno nelle ultime ${weeks} settimane">${cells}</div></div>` };
      }
    },
    // Finanze: si vedono solo con la sezione accesa (go), quindi non sono tra quelli di serie
    quick: {
      title: "Azioni rapide", icon: "bolt", sizes: ["s", "p", "mh"],
      acts: [["scale", "Peso", "weight-add"], ["run", "Allenamento", "workout-add"], ["bowl", "Pasto", "food-quick"], ["timer", "Focus", "dash-focus"], ["book", "Da leggere", "read-add"], ["habit", "Abitudine", "habit-new"]],
      render(sz) {
        const n = sz === "s" ? 4 : sz === "p" ? 5 : 6;
        const btns = this.acts.filter(([, , a]) => App.actOn(a)).slice(0, n).map(([i, l, a]) => `<button type="button" class="d-qa" data-act="${a}" aria-label="${l}"><span>${ic(i, 20)}</span>${sz === "s" ? "" : `<small>${l}</small>`}</button>`).join("");
        if (sz === "p") return { html: `<div class="d-pillrow d-qrow">${btns}</div>` };
        if (sz === "s") return { html: `<div class="d-wb center"><div class="d-qas s">${btns}</div></div>` };
        return { html: head("bolt", "Azioni rapide") + `<div class="d-wb end"><div class="d-qas ${sz}">${btns}</div></div>` };
      }
    },
    clock: {
      title: "Orologio", icon: "clock", sizes: ["c", "s"],
      face(size) {
        const ticks = Array.from({ length: 12 }, (_, i) => { const a = (i * 30) * Math.PI / 180, r1 = i % 3 ? 41 : 37; return `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * 44}" y2="${50 - Math.cos(a) * 44}" class="${i % 3 ? "tk" : "tk b"}"/>`; }).join("");
        const n = new Date(), hr = n.getHours() % 12, mi = n.getMinutes(), se = n.getSeconds();
        return `<svg class="d-clock" viewBox="0 0 100 100" style="width:${size}" role="img" aria-label="Ora attuale">${ticks}<line x1="50" y1="50" x2="50" y2="27" class="hh" data-hand="h" transform="rotate(${hr * 30 + mi / 2} 50 50)"/><line x1="50" y1="50" x2="50" y2="17" class="mh" data-hand="m" transform="rotate(${mi * 6 + se / 10} 50 50)"/><line x1="50" y1="56" x2="50" y2="14" class="sh" data-hand="s" transform="rotate(${se * 6} 50 50)"/><circle cx="50" cy="50" r="2.6" class="pin"/></svg>`;
      },
      mini() { return { icon: "clock", title: "Orologio", value: "", cap: "", p: null }; },
      render(sz) {
        const d = new Date();
        if (sz === "c") return { html: `<div class="d-circ clock">${this.face("100%")}</div>` };
        return { html: `<div class="d-wb center" style="gap:6px">${this.face("96px")}<span class="d-cap">${cap1(d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }))}</span></div>` };
      }
    },
  });
})();
