// ============================================================
// Oggi: la schermata di casa. Tutto si aggiorna in tempo reale
// mentre spunti abitudini, registri umore o completi tappe.
// ============================================================
const Today = {
  tagline(pct, hasDue) {
    if (!hasDue) return ["Una giornata", "leggera"];
    if (pct >= 1) return ["Giornata", "compiuta"];
    if (pct >= 0.5) return ["A buon", "punto"];
    return ["Un passo", "alla volta"];
  },

  render(el) {
    const today = U.today();
    const cfg = Store.cfg();
    const due = Calc.habitsDueOn(today);
    const st = Calc.dayStats(today, due);
    const pct = st.pct ?? 0;
    const [t1, t2] = this.tagline(pct, st.due > 0);
    const now = new Date();

    // ultimo check-in di oggi
    const moods = Store.d.mood_logs.filter((m) => U.dateOf(m.logged_at) === today).sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    const last = moods[0];
    const lastSleep = [...Store.d.sleep_logs].sort((a, b) => b.sleep_date.localeCompare(a.sleep_date))[0];
    const lastWeight = [...Store.d.weight_logs].sort((a, b) => b.log_date.localeCompare(a.log_date))[0];

    const sessions = Store.d.focus_sessions.filter((s) => U.dateOf(s.started_at) === today);
    const sealed = sessions.filter((s) => s.completed);
    const focusMin = U.sum(sealed.map((s) => s.duration_min));
    const game = Game.totals();

    const goals = Calc.activeGoals().sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 3);
    const reads = Store.d.reading_items.filter((r) => r.status !== "done").sort((a, b) => (a.status === "reading" ? -1 : 1) - (b.status === "reading" ? -1 : 1) || b.created_at.localeCompare(a.created_at)).slice(0, 3);
    const score = Calc.score();
    const lab = Calc.scoreLabel(score.score);
    const streak = Calc.bestOverallStreak();

    const tiles = due.map((h, i) => {
      const done = Calc.isDone(h, today);
      const v = Calc.value(h, today);
      const p = h.kind === "qty" ? U.clamp(v / h.target, 0, 1) * 100 : done ? 100 : 0;
      const tone = ["", "peach", "sky"][i % 3];
      return `<article class="tile ${tone} ${done ? "done" : ""}" data-act="habit-open" data-id="${h.id}">
        <div class="tile-top"><i class="glyph" style="color:${AREAS[h.area].color}">${AREAS[h.area].glyph}</i>${Habits.quick(h)}</div>
        <h3>${U.esc(h.name)}</h3>
        <p>${Habits.valueText(h, today)}</p>
        ${h.kind === "qty" ? `<div class="tile-bar"><i style="width:${p}%"></i></div>` : ""}
      </article>`;
    }).join("");

    el.innerHTML = `
      <div class="today">
        <header class="today-head">
          <p class="eyebrow"><span class="kanji">${U.DOW_KANJI[now.getDay()]}</span> · ${now.getDate()} ${U.MONTHS_LONG[now.getMonth()]}</p>
          <p class="hello">${U.greeting()}, ${U.esc(cfg.name)}</p>
          <h1 class="title big">${t1} <em>${t2}</em></h1>
          ${Hero.strip(game)}
        </header>

        <section class="hero-card">
          <div class="hero-copy">
            <p class="hero-k">${st.due ? "Abitudini di oggi" : "Oggi non hai abitudini in programma"}</p>
            <p class="hero-n">${st.due ? `${st.done}<span>/${st.due}</span>` : "—"}</p>
            <p class="hero-s">${streak >= 2 ? `${Icon.svg("flame", 15)} serie più lunga: ${streak} giorni` : "Ogni giorno conta, anche uno piccolo."}</p>
            <button class="btn orange" data-act="go" data-id="habits">Vedi abitudini</button>
          </div>
          ${Charts.ring({ value: pct, size: 118, stroke: 10, color: "var(--orange-500)", track: "rgba(255,255,255,.7)", inner: `<b>${Math.round(pct * 100)}<small>%</small></b>` })}
        </section>

        <section class="block area-habits">
          <div class="block-head"><h2>Oggi</h2><button class="link" data-act="go" data-id="habits">Tutte ${Icon.svg("right", 14)}</button></div>
          ${due.length ? `<div class="tiles">${tiles}</div>` : UI.empty("habit", "Niente in programma", "Aggiungi un'abitudine o goditi il riposo.", `<button class="btn primary" data-act="habit-new">Nuova abitudine</button>`)}
        </section>

        <section class="block area-checkin">
          <div class="block-head"><h2>Come stai adesso?</h2><span class="muted small">${last ? "ultimo: " + U.fmtTime(last.logged_at) : "in tempo reale"}</span></div>
          <div class="card checkin">
            <div class="ci-row"><span class="ci-l">${Icon.svg("smile", 18)} Umore</span>${this.scaleHTML("mood", last && last.mood, MOOD_LABELS)}</div>
            <div class="ci-row"><span class="ci-l">${Icon.svg("bolt", 18)} Energia</span>${this.scaleHTML("energy", last && last.energy, ENERGY_LABELS)}</div>
            <div class="ci-row"><span class="ci-l">${Icon.svg("moon", 18)} Sonno</span>
              <button class="ci-quick" data-act="sleep-add">${lastSleep ? `${U.num(lastSleep.hours, 2)} h${lastSleep.sleep_date === today ? " stanotte" : " · " + U.fmtShort(lastSleep.sleep_date)}` : "Registra il sonno"}${Icon.svg("edit", 13)}</button></div>
            <div class="ci-row"><span class="ci-l">${Icon.svg("scale", 18)} Peso</span>
              <button class="ci-quick" data-act="weight-add">${lastWeight ? `${U.num(lastWeight.kg)} kg · ${U.fmtShort(lastWeight.log_date)}` : "Registra il peso"}${Icon.svg("edit", 13)}</button></div>
          </div>
        </section>

        <section class="block area-recall">
          <div class="block-head"><h2>Dalle tue letture</h2><button class="link" data-act="go" data-id="recall">Riscoperte ${Icon.svg("right", 14)}</button></div>
          ${Recall.miniHTML()}
        </section>

        <section class="block area-focus">
          <div class="block-head"><h2>Focus</h2><button class="link" data-act="go" data-id="focus">Yokai ${Icon.svg("right", 14)}</button></div>
          <div class="card focus-mini">
            <div class="fm-trees">${sealed.length ? sealed.slice(-4).map((s) => Yokai.svg(s.creature || "hitodama", 1, "sealed", 46)).join("") : `<span class="muted small">Nessuno yokai sigillato oggi</span>`}</div>
            <div class="fm-copy"><b>${U.fmtMin(focusMin)}</b><span>${sealed.length} ${sealed.length === 1 ? "yokai" : "yokai"} sigillati</span></div>
            <button class="btn primary" data-act="go" data-id="focus">${Icon.svg("play", 16)} Avvia</button>
          </div>
        </section>

        <section class="block area-goals">
          <div class="block-head"><h2>Obiettivi in corso</h2><button class="link" data-act="go" data-id="goals">Tutti ${Icon.svg("right", 14)}</button></div>
          ${goals.length ? `<div class="card stack">${goals.map((g) => {
            const pace = Calc.goalPace(g), a = AREAS[g.area];
            return `<div class="mini-goal" data-act="goal-open" data-id="${g.id}">
              <div class="mg-top"><span>${U.esc(g.title)}</span><b>${Math.round(pace.progress)}%</b></div>
              ${Charts.bar({ value: pace.progress, color: a.color, mark: pace.expected, h: 6 })}
              <div class="mg-sub"><span>${HORIZONS[g.horizon].label} · ${a.label}</span><span class="pace ${pace.key}">${Goals.paceIcon(pace.key)} ${pace.label}</span></div>
            </div>`;
          }).join("")}</div>` : UI.empty("goal", "Nessun obiettivo", "Definisci dove vuoi arrivare in 1, 4 o 12 mesi.", `<button class="btn primary" data-act="goal-new">Nuovo obiettivo</button>`)}
        </section>

        <section class="block area-score">
          <div class="block-head"><h2>Andamento</h2><button class="link" data-act="go" data-id="insights">Statistiche ${Icon.svg("right", 14)}</button></div>
          <div class="card score-mini">
            ${Charts.ring({ value: (score.score || 0) / 100, size: 84, stroke: 8, color: "var(--blue-500)", inner: `<b>${score.score == null ? "–" : Math.round(score.score)}</b>` })}
            <div><p class="sm-k">Punteggio degli ultimi 7 giorni</p><p class="sm-v">${lab.label}</p>
              <p class="muted small">${score.parts.map((p) => `${p.label} ${Math.round(p.value)}`).join(" · ")}</p></div>
          </div>
        </section>

        <section class="block area-read">
          <div class="block-head"><h2>Da leggere</h2><button class="link" data-act="go" data-id="reading">Tutti ${Icon.svg("right", 14)}</button></div>
          ${reads.length ? `<div class="card stack">${reads.map((r) => Reading.rowHTML(r, true)).join("")}</div>` : `<p class="muted small">Niente in coda. Collega Raindrop dalle impostazioni.</p>`}
        </section>
      </div>`;
  },

  scaleHTML(field, current, labels) {
    return `<div class="scale live" role="group" aria-label="${field}">${[1, 2, 3, 4, 5].map((n) =>
      `<button class="${n === current ? "on" : ""}" data-act="checkin" data-field="${field}" data-value="${n}" aria-label="${labels[n - 1]}" data-tip="${labels[n - 1]}"><span>${n}</span></button>`).join("")}</div>`;
  },

  // Registra subito: aggiorna il check-in degli ultimi 30 minuti, altrimenti ne crea uno nuovo
  checkin(field, value) {
    const recent = Store.d.mood_logs
      .filter((m) => Date.now() - new Date(m.logged_at).getTime() < 30 * 60000)
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0];
    if (recent) Store.update("mood_logs", recent.id, { [field]: value });
    else Store.insert("mood_logs", { logged_at: new Date().toISOString(), mood: null, energy: null, note: null, [field]: value });
  }
};

Actions["checkin"] = (el) => Today.checkin(el.dataset.field, Number(el.dataset.value));
Actions["go"] = (el) => App.go(el.dataset.id);
