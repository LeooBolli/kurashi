// ============================================================
// Widget della Home: benessere e alimentazione.
// Ogni widget: title, icon, sizes (formati ammessi), go (sezione che apre),
// mini() per cerchio e capsula, render(formato, opzioni) → { html }. Vedi js/home/kit.js.
// ============================================================
(() => {
  const { ic, esc, plural, head, big, empty, cta, weightSeries } = HomeKit;
  Object.assign(HomeWidgets, {
    weight: {
      title: "Peso", icon: "scale", sizes: ["c", "s", "p", "mh"], go: "body",
      mini() {
        const w = weightSeries();
        if (!w) return { icon: "scale", title: "Peso", value: "—", cap: "Nessuna pesata", p: null, action: `<button type="button" class="d-cbtn" data-act="weight-add" aria-label="Registra il peso">${ic("plus", 15, 2.4)}</button>` };
        const t = Store.cfg().weightTarget, diff = t == null ? null : Math.round((w.last - Number(t)) * 10) / 10;
        return { icon: "scale", title: "Peso", value: U.num(w.last), unit: "kg", cap: t == null ? U.fmtShort(w.lastDate) : Math.abs(diff) < 0.05 ? "Peso ideale" : `${diff > 0 ? "−" : "+"}${U.num(Math.abs(diff))} kg ai ${U.num(Number(t))}`, p: null };
      },
      render(sz) {
        const w = weightSeries();
        if (!w) return { html: head("scale", "Peso", sz === "s" ? "" : "Nessuna pesata") + `<div class="d-wb">${empty(sz === "s" ? "" : "Registra il peso per vedere l'andamento.", cta("Peso", "weight-add"))}</div>` };
        const target = Store.cfg().weightTarget;
        const t = target == null ? null : Number(target), diff = t == null ? null : Math.round((w.last - t) * 10) / 10;
        const miss = t == null ? "Peso ideale da impostare" : Math.abs(diff) < 0.05 ? `Peso ideale raggiunto` : `${diff > 0 ? "Mancano" : "Sotto di"} ${U.num(Math.abs(diff))} kg ${diff > 0 ? "ai" : "rispetto ai"} ${U.num(t)}`;
        if (sz === "s") return { html: head("scale", "Peso", U.fmtShort(w.lastDate)) + `<div class="d-wb end">${big(U.num(w.last), "kg")}<span class="d-cap">${miss}</span></div>` };
        const v = w.win.map((x) => Number(x.kg));
        let spark = "";
        if (v.length > 1) {
          const lo = Math.min(...v, t != null && Math.abs(t - Math.min(...v)) < 2 ? t : Infinity), hi = Math.max(...v);
          const mn = lo - 0.3, mx = hi + 0.3;
          const X = (i) => 4 + (i / (v.length - 1)) * 292, Y = (k) => 50 - ((k - mn) / (mx - mn)) * 44;
          const line = v.map((k, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(k).toFixed(1)}`).join(" ");
          spark = `<svg class="d-spark" viewBox="0 0 300 54" preserveAspectRatio="none" aria-hidden="true"><path d="${line} L296,54 L4,54 Z" class="a"/><path d="${line}" class="l" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        const dl = w.delta == null ? "" : ` · ${w.delta > 0 ? "+" : w.delta < 0 ? "−" : ""}${U.num(Math.abs(w.delta))} kg`;
        return { html: head("scale", "Peso", `${w.label}${dl}`) + `<div class="d-wb end" style="flex-direction:row;align-items:flex-end;gap:16px"><div style="display:grid;gap:4px;flex:none">${big(U.num(w.last), "kg")}<span class="d-cap">${miss}</span></div>${spark}</div>` };
      }
    },
    meals: {
      title: "Pasti", icon: "bowl", sizes: ["mh", "mv", "lv"], go: "food",
      render(sz, o) {
        if (typeof Food === "undefined") return { html: head("bowl", "Pasti di oggi") + `<div class="d-wb">${empty("Sezione non disponibile.")}</div>` };
        const want = o && Array.isArray(o.slots) && o.slots.length ? o.slots : null;
        const today = U.today(), list = Food.entriesOn(today).filter((e) => !want || want.includes(e.slot));
        if (!list.length) return { html: head("bowl", "Pasti di oggi", "Niente in programma") + `<div class="d-wb">${empty("Pianifica i pasti o segna cosa hai mangiato.", `<div class="d-acts"><button type="button" class="d-btn deep sm" data-act="go" data-id="food">Pianifica</button><button type="button" class="d-btn glassy sm" data-act="food-extra">${ic("plus", 14, 2.4)}Fuori programma</button></div>`)}</div>` };
        const planned = list.filter((e) => !e.extra), eaten = planned.filter((e) => e.eaten).length;
        const slots = Food.SLOTS.filter(([k]) => list.some((e) => e.slot === k));
        // fino a 4 pasti (prima quelli ancora da mangiare), tutti nel formato grande
        const open = ([k]) => list.some((e) => e.slot === k && !e.eaten);
        const shown = sz === "lv" ? slots : slots.filter(open).concat(slots.filter((x) => !open(x))).slice(0, 4).sort((a, b) => Food.slotIdx(a[0]) - Food.slotIdx(b[0]));
        // ogni pasto è un interruttore: segna mangiati (o no) tutti i piatti in programma di quel pasto
        const cells = shown.map(([k, l]) => {
          const es = list.filter((e) => e.slot === k), all = es.every((e) => e.eaten), names = esc(es.map((e) => e.name).join(", "));
          return `<button type="button" class="d-meal ${all ? "done" : ""}" data-act="dash-meal" data-slot="${k}" aria-pressed="${all}" aria-label="${l}: ${names}. ${all ? "Mangiato, tocca per annullare" : "Segna come mangiato"}"><span class="d-mck">${ic("check", 13, 3)}</span><span class="d-mtx"><small>${l}</small><span>${names}</span></span></button>`;
        }).join("");
        const diet = Food.dayState(today);
        let sub = planned.length ? (diet ? "Dieta rispettata" : `${eaten} di ${planned.length} mangiati`) : "Solo fuori programma";
        const g = Food.goal && Food.goal();
        if (g) sub += ` · ${esc(g.title)}`;
        const foot = sz === "lv" ? (() => {
          const ad = Food.adherence(U.addDays(today, -6));
          return `<div class="d-row col"><b class="d-subhead">Ultimi 7 giorni</b><div class="d-macros"><span>${ad.ok} di ${ad.planned} giorni rispettati</span></div><button type="button" class="d-btn glassy sm" data-act="food-extra">${ic("plus", 14, 2.4)}Fuori programma</button></div>`;
        })() : "";
        return { html: head("bowl", "Pasti di oggi", sub) + `<div class="d-wb"><div class="d-meals ${sz === "mh" ? "two" : ""}">${cells}</div>${foot}</div>` };
      }
    },
    workouts: {
      title: "Allenamenti", icon: "run", sizes: ["c", "s", "p", "mh"], go: "body",
      data() {
        const today = U.today(), mon = U.mondayOf(today);
        const wk = Calc.workoutsIn(mon, today), days = new Set(wk.map((w) => w.workout_date));
        const last = [...Store.d.workouts].sort((a, b) => b.workout_date.localeCompare(a.workout_date))[0];
        return { wk, days, mon, today, last, min: U.sum(wk.map((w) => Number(w.minutes) || 0)) };
      },
      mini() {
        const x = this.data();
        return { icon: "run", title: "Allenamenti", value: x.wk.length, unit: "questa sett.", cap: x.last ? `Ultimo: ${esc(x.last.kind)} · ${U.fmtShort(x.last.workout_date)}` : "Nessun allenamento", p: Math.min(1, x.days.size / 4), action: `<button type="button" class="d-cbtn" data-act="workout-add" aria-label="Registra un allenamento">${ic("plus", 15, 2.4)}</button>` };
      },
      render(sz) {
        const x = this.data();
        const dots = `<div class="d-wdots" aria-label="${x.days.size} giorni di allenamento questa settimana">${U.DOW_SHORT.map((l, i) => { const d = U.addDays(x.mon, i); return `<span class="${x.days.has(d) ? "on" : ""} ${d === x.today ? "today" : ""}"><i></i>${l}</span>`; }).join("")}</div>`;
        const add = `<button type="button" class="d-cbtn" data-act="workout-add" aria-label="Registra un allenamento">${ic("plus", 15, 2.4)}</button>`;
        if (sz === "s") return { html: head("run", "Allenamenti", "Questa settimana") + `<div class="d-wb end">${big(x.wk.length, x.wk.length === 1 ? "sessione" : "sessioni")}<span class="d-cap">${x.min} minuti</span></div>` };
        return { html: head("run", "Allenamenti", `${plural(x.wk.length, "sessione", "sessioni")} · ${x.min} minuti questa settimana`, add) + `<div class="d-wb end">${dots}<span class="d-cap">${x.last ? `Ultimo: ${esc(x.last.kind)}, ${U.fmtShort(x.last.workout_date)}` : "Ancora nessun allenamento"}</span></div>` };
      }
    },
  });
})();
