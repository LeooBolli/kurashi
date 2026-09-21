// ============================================================
// Statistiche: punteggio generale, KPI e grafici. Tutto è calcolato
// al volo dai dati, quindi si aggiorna appena registri qualcosa.
// ============================================================
const Insights = {
  range: 30,

  delta(cur, prev, unit = "", dec = 0, higherIsBetter = true, fmt = null) {
    if (cur == null || prev == null) return "";
    const d = cur - prev;
    if (Math.abs(d) < Math.pow(10, -dec) / 2) return `<span class="delta flat">= come prima</span>`;
    const good = higherIsBetter ? d > 0 : d < 0;
    return `<span class="delta ${good ? "good" : "bad"}">${d > 0 ? "▲" : "▼"} ${fmt ? fmt(Math.abs(d)) : U.num(Math.abs(d), dec) + unit}</span>`;
  },

  tile(label, value, sub = "", extra = "") {
    return `<div class="kpi"><span class="kpi-l">${label}</span><b class="kpi-v">${value}</b><span class="kpi-s">${sub}</span>${extra}</div>`;
  },

  render(el) {
    const today = U.today(), n = this.range;
    const from = U.addDays(today, -(n - 1));
    const pFrom = U.addDays(from, -n), pTo = U.addDays(from, -1);
    const days = U.range(from, today);
    const cfg = Store.cfg();

    // ---- punteggio ----
    const sc = Calc.score(), scPrev = Calc.score(U.addDays(today, -7));
    const lab = Calc.scoreLabel(sc.score);
    const scoreDelta = sc.score != null && scPrev.score != null ? sc.score - scPrev.score : null;

    // ---- KPI di periodo ----
    const hRate = Calc.rate(from, today), hRatePrev = Calc.rate(pFrom, pTo);
    const focus = Calc.focusMinutes(from, today), focusPrev = Calc.focusMinutes(pFrom, pTo);
    const sleep = Calc.sleepAvg(from, today), sleepPrev = Calc.sleepAvg(pFrom, pTo);
    const mood = Calc.moodAvg(from, today, "mood"), moodPrev = Calc.moodAvg(pFrom, pTo, "mood");
    const energy = Calc.moodAvg(from, today, "energy");
    const works = Calc.workoutsIn(from, today);
    const worksPrev = Calc.workoutsIn(pFrom, pTo);
    const readDone = Store.d.reading_items.filter((r) => r.status === "done" && r.done_at && U.dateOf(r.done_at) >= from).length;
    const goals = Calc.activeGoals();
    const onTrack = goals.filter((g) => ["ahead", "on", "done"].includes(Calc.goalPace(g).key)).length;
    const topStreak = Calc.activeHabits().map((h) => ({ h, s: Calc.streak(h) })).sort((a, b) => b.s - a.s)[0];
    const dailyPct = days.map((d) => { const s = Calc.dayStats(d); return s.pct == null ? null : s.pct * 100; });

    // ---- serie per i grafici (giorni, oppure settimane se il periodo è lungo) ----
    const weekly = n > 30;
    const buckets = [];
    if (weekly) {
      for (let i = 12; i >= 0; i--) { const mon = U.addDays(U.mondayOf(today), -i * 7); buckets.push([mon, U.addDays(mon, 6) > today ? today : U.addDays(mon, 6)]); }
    } else days.forEach((d) => buckets.push([d, d]));
    const bLabel = (b) => (weekly ? U.fmtShort(b[0]).split(" ")[0] : String(U.parse(b[0]).getDate()));
    const bTip = (b) => (weekly ? `Sett. dal ${U.fmtShort(b[0])}` : U.fmtShort(b[0]));
    const labelEvery = Math.ceil(buckets.length / 9);

    const habitCols = buckets.map((b) => { const r = Calc.rate(b[0], b[1]); return { label: bLabel(b), v: r || 0, tip: `${bTip(b)}: ${r == null ? "nulla in programma" : Math.round(r) + "%"}` }; });
    const focusCols = buckets.map((b) => { const m = Calc.focusMinutes(b[0], b[1]); return { label: bLabel(b), v: m, tip: `${bTip(b)}: ${U.fmtMin(m)}` }; });

    const mm = Calc.moodByDay(from, today, "mood"), ee = Calc.moodByDay(from, today, "energy");
    const moodVals = days.map((d) => (mm[d] ? U.avg(mm[d]) : null)), energyVals = days.map((d) => (ee[d] ? U.avg(ee[d]) : null));

    const sleepByDate = Object.fromEntries(Store.d.sleep_logs.map((s) => [s.sleep_date, s]));
    const sleepDays = U.range(U.addDays(today, -(Math.min(n, 30) - 1)), today);
    const sleepCols = sleepDays.map((d) => ({ label: String(U.parse(d).getDate()), v: sleepByDate[d] ? Number(sleepByDate[d].hours) : 0, tip: sleepByDate[d] ? `${U.fmtShort(d)}: ${U.num(sleepByDate[d].hours, 2)} h` : `${U.fmtShort(d)}: nessun dato` }));

    const weights = Store.d.weight_logs.filter((w) => w.log_date >= from).sort((a, b) => a.log_date.localeCompare(b.log_date));

    // ---- aree ----
    const areaRows = Object.entries(AREAS).map(([k, a]) => {
      const hs = Calc.activeHabits().filter((h) => h.area === k);
      const r = hs.length ? Calc.rate(from, today, hs) : null;
      return r == null ? null : { label: a.label, glyph: a.glyph, color: a.color, tint: a.tint, v: r, tip: `${a.label}: ${Math.round(r)}% in ${n} giorni · ${hs.length} abitudini` };
    }).filter(Boolean).sort((a, b) => b.v - a.v);

    // ---- mappa di calore complessiva ----
    const heatCells = {};
    for (const d of U.range(U.addDays(U.mondayOf(today), -15 * 7), today)) { const s = Calc.dayStats(d); heatCells[d] = s.pct; }

    // ---- punti di forza / da rivedere ----
    const ranked = Calc.activeHabits().map((h) => ({ h, r: Calc.rate(from, today, [h]) })).filter((x) => x.r != null).sort((a, b) => b.r - a.r);
    const strong = ranked.slice(0, 2), weak = ranked.length > 3 ? ranked.slice(-2).reverse() : [];
    const behind = goals.filter((g) => ["behind", "slight"].includes(Calc.goalPace(g).key));

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">統計 · Statistiche</p><h1 class="title">Come sta <em>andando</em></h1></div>
        <div class="seg range">${[7, 30, 90].map((d) => `<button class="${n === d ? "on" : ""}" data-act="ins-range" data-id="${d}">${d} giorni</button>`).join("")}</div>
      </div>

      <section class="score-card">
        <div class="score-ring">${Charts.ring({ value: (sc.score || 0) / 100, size: 150, stroke: 12, color: "var(--orange-500)", track: "rgba(255,255,255,.7)", inner: `<b class="hero-num">${sc.score == null ? "–" : Math.round(sc.score)}</b><small>su 100</small>` })}</div>
        <div class="score-copy">
          <p class="hero-k">Punteggio degli ultimi 7 giorni</p>
          <p class="score-label ${lab.tone}">${lab.label}</p>
          <p class="hero-s">${scoreDelta == null ? "Servono più dati per il confronto." : `${scoreDelta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(scoreDelta))} punti rispetto alla settimana scorsa`}</p>
          <div class="parts">${sc.parts.map((p) => `<div class="part" data-tip="Peso nel punteggio: ${Math.round(p.w * 100)}%"><span>${p.label}</span>${Charts.bar({ value: p.value, color: "var(--blue-500)", h: 6 })}<b>${Math.round(p.value)}</b></div>`).join("")}</div>
        </div>
      </section>

      <div class="kpis">
        ${this.tile("Abitudini", hRate == null ? "–" : Math.round(hRate) + "%", this.delta(hRate, hRatePrev, "%") || "completamento", `<div class="kpi-spark">${Charts.spark(dailyPct.slice(-14), "var(--blue)")}</div>`)}
        ${this.tile("Serie più lunga", topStreak ? topStreak.s + " gg" : "–", topStreak && topStreak.s ? U.esc(topStreak.h.name) : "nessuna serie")}
        ${this.tile("Obiettivi in linea", goals.length ? `${onTrack}/${goals.length}` : "–", behind.length ? `${behind.length} da recuperare` : "tutto a posto")}
        ${this.tile("Focus", U.fmtMin(focus), this.delta(focus, focusPrev, "", 0, true, U.fmtMin) || "tempo concentrato")}
        ${this.tile("Sonno medio", sleep == null ? "–" : U.num(sleep) + " h", this.delta(sleep, sleepPrev, " h", 1) || `obiettivo ${cfg.sleepTarget} h`)}
        ${this.tile("Umore medio", mood == null ? "–" : U.num(mood) + "/5", this.delta(mood, moodPrev, "", 1) || "in periodo")}
        ${this.tile("Energia media", energy == null ? "–" : U.num(energy) + "/5", "in periodo")}
        ${this.tile("Allenamenti", works.length, this.delta(works.length, worksPrev.length, "", 0) || U.fmtMin(U.sum(works.map((w) => w.minutes))))}
      </div>

      <div class="charts">
        <section class="card chart-card">
          <div class="block-head"><h3>Completamento abitudini</h3><span class="muted small">${weekly ? "per settimana" : "per giorno"}</span></div>
          ${Charts.cols({ data: habitCols, h: 160, max: 100, unit: "%", labelEvery, aria: `Completamento delle abitudini, ultimi ${n} giorni` })}
        </section>

        <section class="card chart-card">
          <div class="block-head"><h3>Equilibrio tra le aree</h3><span class="muted small">${n} giorni</span></div>
          ${areaRows.length ? Charts.hbars(areaRows) : `<div class="empty-chart">Nessuna abitudine in programma</div>`}
        </section>

        <section class="card chart-card wide-card">
          <div class="block-head"><h3>Costanza nelle ultime 16 settimane</h3><span class="muted small">ogni quadrato è un giorno</span></div>
          <div class="heat-wrap big">${Charts.heat({ cells: heatCells, weeks: 16, name: "Mappa di calore del completamento giornaliero" })}</div>
          <div class="heat-legend"><span>meno</span>${[1, 2, 3, 4, 5].map((l) => `<i class="heat l${l}"></i>`).join("")}<span>più</span></div>
        </section>

        <section class="card chart-card">
          <div class="block-head"><h3>Umore ed energia</h3></div>
          ${Charts.legend([{ color: "var(--blue)", label: "Umore" }, { color: "var(--orange)", label: "Energia" }])}
          ${Charts.lines({ series: [{ name: "Umore", color: "var(--blue)", vals: moodVals }, { name: "Energia", color: "var(--orange)", vals: energyVals }], labels: days.map((d) => String(U.parse(d).getDate())), min: 1, max: 5, labelEvery: Math.ceil(days.length / 9), aria: "Umore ed energia" })}
        </section>

        <section class="card chart-card">
          <div class="block-head"><h3>Focus</h3><span class="muted small">minuti ${weekly ? "a settimana" : "al giorno"}</span></div>
          ${Charts.cols({ data: focusCols, h: 160, labelEvery, aria: "Minuti di focus" })}
        </section>

        <section class="card chart-card">
          <div class="block-head"><h3>Sonno</h3><span class="muted small">ore per notte</span></div>
          ${Charts.cols({ data: sleepCols, h: 160, max: 10, target: cfg.sleepTarget, unit: "h", labelEvery: Math.ceil(sleepCols.length / 9), aria: "Ore di sonno" })}
        </section>

        ${weights.length > 1 ? `<section class="card chart-card">
          <div class="block-head"><h3>Peso</h3><span class="muted small">kg</span></div>
          ${Charts.lines({ series: [{ name: "Peso", color: "var(--blue)", vals: weights.map((w) => Number(w.kg)) }], labels: weights.map((w) => String(U.parse(w.log_date).getDate())), area: true, target: cfg.weightTarget || null, labelEvery: Math.ceil(weights.length / 8), aria: "Peso" })}
        </section>` : ""}

        <section class="card chart-card read-card">
          <div class="block-head"><h3>Cosa notare</h3></div>
          <ul class="notes">
            ${strong.map((x) => `<li><i class="tag good">Punto di forza</i><span>${U.esc(x.h.name)}: ${Math.round(x.r)}%</span></li>`).join("")}
            ${weak.map((x) => `<li><i class="tag low">Da rivedere</i><span>${U.esc(x.h.name)}: ${Math.round(x.r)}%</span></li>`).join("")}
            ${behind.map((g) => { const p = Calc.goalPace(g); return `<li><i class="tag low">Obiettivo indietro</i><span>${U.esc(g.title)}: ${Math.round(p.progress)}% (atteso ${Math.round(p.expected)}%)</span></li>`; }).join("")}
            ${readDone ? `<li><i class="tag good">Lettura</i><span>${readDone} ${readDone === 1 ? "contenuto letto" : "contenuti letti"} nel periodo</span></li>` : ""}
            ${!strong.length && !behind.length ? `<li><span class="muted">Servono un po' di giorni di dati per dare indicazioni utili.</span></li>` : ""}
          </ul>
        </section>
      </div>`;
  }
};

Actions["ins-range"] = (el) => { Insights.range = Number(el.dataset.id); App.render(); };
