// ============================================================
// Widget della Home: studio e focus.
// Ogni widget: title, icon, sizes (formati ammessi), go (sezione che apre),
// mini() per cerchio e capsula, render(formato, opzioni) → { html }. Vedi js/home/kit.js.
// ============================================================
(() => {
  const { ic, esc, head, big, empty, hours, mmss, linkLabel, focusOk, minOf, remainingSec, startBtn } = HomeKit;
  Object.assign(HomeWidgets, {
    focusStats: {
      title: "Ore di focus", icon: "timer", sizes: ["c", "s", "p", "mh"], go: "focus",
      mini() {
        const today = U.today(), mon = U.mondayOf(today);
        const tMin = Calc.focusMinutes(today, today), wMin = Calc.focusMinutes(mon, today), goal = Number(Store.cfg().focusWeeklyMin) || 600;
        return { icon: "timer", title: "Ore di focus", value: hours(tMin), unit: "h", cap: `oggi · ${hours(wMin)} su ${hours(goal)} h a settimana`, p: wMin / goal };
      },
      render(sz) {
        const today = U.today(), mon = U.mondayOf(today);
        const tMin = Calc.focusMinutes(today, today), wMin = Calc.focusMinutes(mon, today);
        const goal = Number(Store.cfg().focusWeeklyMin) || 600;
        const a = U.clamp((tMin / goal) * 100, 0, 100), b = U.clamp(((wMin - tMin) / goal) * 100, 0, 100 - a);
        const bar = `<div class="d-prog" role="img" aria-label="${hours(wMin)} ore su ${hours(goal)} questa settimana">${a > 0 ? `<i style="width:${a}%"></i>` : ""}${b > 0 ? `<i class="b" style="width:${b}%"></i>` : ""}<i class="e"></i></div>`;
        if (sz === "s") return { html: head("timer", "Focus", "Oggi") + `<div class="d-wb end">${big(hours(tMin), "h")}${bar}<span class="d-cap">${hours(wMin)} su ${hours(goal)} h a settimana</span></div>` };
        return { html: head("timer", "Ore di focus", `Questa settimana ${hours(wMin)} h`) + `<div class="d-wb end"><div class="d-row">${big(hours(tMin), "h oggi")}<span class="d-cap">obiettivo ${hours(goal)} h a settimana</span></div>${bar}<div class="d-legend"><span>Oggi</span><span class="b">Resto della settimana</span></div></div>` };
      }
    },
    timer: {
      title: "Sessione di focus", icon: "timer", sizes: ["c", "s", "p", "mh"], go: "focus",
      mini(o) {
        const running = focusOk() && !!Focus.run;
        const btn = running
          ? `<button type="button" class="d-cbtn" data-act="focus-giveup" aria-label="Interrompi la sessione">${ic("stop", 14)}</button>`
          : startBtn(o, "d-cbtn", 15);
        const p = running ? Focus.elapsedSec() / (Focus.run.durationMin * 60) : null;
        return { cls: "blue", icon: "timer", title: "Sessione di focus", value: `<span data-dash-timer data-running="${running}" role="timer">${mmss(remainingSec(o))}</span>`, cap: running ? esc(linkLabel(Focus.run)) : `Pronta · ${minOf(o)} min`, p, action: btn };
      },
      render(sz, o) {
        const running = focusOk() && !!Focus.run;
        // con una durata fissata in Personalizza il pulsante dei minuti non serve
        const min = minOf(o), pick = o && o.min ? "" : `<button type="button" class="d-durbtn" data-act="dash-focus-pick" aria-label="Durata: ${min} minuti. Cambia">${min} min</button>`;
        const btns = `<div class="d-tbtns">${running
          ? `<button type="button" data-act="focus-giveup" aria-label="Interrompi la sessione">${ic("stop", 16)}</button>`
          : startBtn({ ...o, min }, "", 18) + pick}</div>`;
        const state = running ? linkLabel(Focus.run) : `Pronta · ${minOf(o)} min`;
        const time = `<span class="d-timer" data-dash-timer data-running="${running}" role="timer" aria-label="${running ? "Tempo rimanente" : "Durata"}">${mmss(remainingSec(o))}</span>`;
        if (sz === "s") return { cls: "blue", html: head("timer", "Focus", esc(state)) + `<div class="d-wb end" style="gap:10px">${time}${btns}</div>` };
        return { cls: "blue", html: head("timer", "Sessione di focus", esc(state)) + `<div class="d-wb"><div class="d-row">${time}${btns}</div></div>` };
      }
    },
    exam: {
      title: "Prossimo esame", icon: "cap", sizes: ["c", "s", "p"], go: "goals",
      // l'esame scelto in Personalizza, altrimenti il prossimo appello non ancora pronto
      pick(o) {
        const today = U.today();
        const chosen = o && o.exam ? Store.d.milestones.find((x) => x.id === o.exam && x.is_exam) : null;
        const m = chosen || Store.d.milestones.filter((x) => x.is_exam && x.exam_date && x.exam_date >= today && Calc.msPct(x) < 100).sort((a, b) => a.exam_date.localeCompare(b.exam_date))[0];
        return m ? { m, left: m.exam_date ? U.diffDays(today, m.exam_date) : null, pct: Calc.msPct(m), fixed: !!chosen } : null;
      },
      // giorni all'appello: "Oggi", "passato", o senza data
      when(x) {
        if (x.left == null) return { v: "—", u: "", cap: "Appello da fissare" };
        if (x.left < 0) return { v: -x.left, u: -x.left === 1 ? "giorno fa" : "giorni fa", cap: "Appello passato" };
        if (x.left === 0) return { v: "Oggi", u: "", cap: "È il giorno dell'appello" };
        return { v: x.left, u: x.left === 1 ? "giorno" : "giorni", cap: "" };
      },
      mini(o) {
        const x = this.pick(o);
        if (!x) return { icon: "cap", title: "Prossimo esame", value: "—", cap: "Nessun esame in programma", p: null };
        const w = this.when(x);
        return { icon: "cap", title: esc(x.m.title), value: w.v, unit: w.u, cap: esc(x.m.title), p: x.pct / 100 };
      },
      render(sz, o) {
        const x = this.pick(o);
        if (!x) return { html: head("cap", "Prossimo esame") + `<div class="d-wb">${empty("Nessun esame con una data d'appello.")}</div>` };
        const w = this.when(x);
        return { html: head("cap", "Esame", `${x.m.exam_date ? U.fmtShort(x.m.exam_date) : w.cap} · ${Math.round(x.pct)}% pronto`) + `<div class="d-wb end">${big(w.v, w.u)}<span class="d-cap">${esc(x.m.title)}</span></div>` };
      }
    },
    studyToday: {
      title: "Studio di oggi", icon: "cap", sizes: ["c", "s", "p", "mh"], go: "focus",
      data() {
        const plan = Calc.examPlan(), due = U.sum(plan.map((x) => x.due)), now = plan.find((x) => x.due > 0);
        return { plan, due, now, exams: Calc.exams().length };
      },
      val: (m) => (m < 60 ? [m, "min"] : [U.num(m / 60, 1), "h"]),
      mini() {
        const x = this.data(), [v, u] = this.val(x.due);
        if (!x.plan.length) return { icon: "cap", title: "Studio di oggi", value: x.exams, unit: x.exams === 1 ? "esame" : "esami", cap: "Scegli gli esami in Studio", p: null };
        return { icon: "cap", title: "Studio di oggi", value: x.due ? v : "Fatto", unit: x.due ? u : "", cap: x.now ? esc(x.now.m.title) : "Piano completato", p: null };
      },
      render(sz) {
        const x = this.data(), [v, u] = this.val(x.due);
        if (!x.plan.length) return { html: head("cap", "Studio di oggi") + `<div class="d-wb">${empty("Scegli gli esami in Studio e aggiungi date e ore.")}</div>` };
        return { html: head("cap", "Studio di oggi", x.now ? "" : "Piano completato") + `<div class="d-wb end">${big(x.due ? v : "Fatto", x.due ? u : "")}<span class="d-cap">${x.now ? esc(x.now.m.title) : `${x.exams} ${x.exams === 1 ? "esame" : "esami"} in programma`}</span></div>` };
      }
    },
  });
})();
