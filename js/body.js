// ============================================================
// Benessere: umore ed energia, sonno, peso, allenamenti
// ============================================================
const Body = {
  tab: "mood",
  TABS: [["mood", "Umore"], ["sleep", "Sonno"], ["weight", "Peso"], ["workout", "Allenamenti"]],
  WORKOUTS: ["Corsa", "Camminata", "Palestra", "Ciclismo", "Nuoto", "Yoga", "Calcio", "Altro"],

  days(n) { const t = U.today(); return U.range(U.addDays(t, -(n - 1)), t); },

  render(el) {
    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">心身 · Benessere</p><h1 class="title">Corpo e <em>mente</em></h1></div>
        <button class="btn primary" data-act="body-add">${Icon.svg("plus", 18)}<span>Registra</span></button>
      </div>
      <div class="seg tabs4">${this.TABS.map(([k, l]) => `<button class="${this.tab === k ? "on" : ""}" data-act="body-tab" data-id="${k}">${l}</button>`).join("")}</div>
      <div class="body-pane">${this[this.tab + "HTML"]()}</div>`;
  },

  // ---------- umore & energia ----------
  moodHTML() {
    const days = this.days(14), from = days[0], to = days[days.length - 1];
    const mm = Calc.moodByDay(from, to, "mood"), ee = Calc.moodByDay(from, to, "energy");
    const mv = days.map((d) => (mm[d] ? U.avg(mm[d]) : null)), ev = days.map((d) => (ee[d] ? U.avg(ee[d]) : null));
    const labels = days.map((d) => String(U.parse(d).getDate()));
    const mAvg = Calc.moodAvg(from, to, "mood"), eAvg = Calc.moodAvg(from, to, "energy");
    const recent = [...Store.d.mood_logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at)).slice(0, 8);
    return `
      <div class="grid2">
        <section class="card">
          <div class="block-head"><h3>Ultimi 14 giorni</h3></div>
          ${Charts.legend([{ color: "var(--blue)", label: "Umore" }, { color: "var(--orange)", label: "Energia" }])}
          ${Charts.lines({ series: [{ name: "Umore", color: "var(--blue)", vals: mv }, { name: "Energia", color: "var(--orange)", vals: ev }], labels, min: 1, max: 5, dec: 1, labelEvery: 2, aria: "Umore ed energia negli ultimi 14 giorni" })}
        </section>
        <section class="card stats-col">
          <div><b>${mAvg == null ? "–" : U.num(mAvg)}</b><span>umore medio /5</span></div>
          <div><b>${eAvg == null ? "–" : U.num(eAvg)}</b><span>energia media /5</span></div>
          <button class="btn primary" data-act="mood-add">${Icon.svg("smile", 16)} Nuovo check-in</button>
        </section>
      </div>
      <section class="card"><div class="block-head"><h3>Check-in recenti</h3></div>
        ${recent.length ? `<ul class="log">${recent.map((m) => `<li><span class="when">${U.fmtShort(U.dateOf(m.logged_at))} · ${U.fmtTime(m.logged_at)}</span>
          <span class="vals">${m.mood ? `<i class="dot mood">${m.mood}</i>` : ""}${m.energy ? `<i class="dot energy">${m.energy}</i>` : ""}</span>
          <span class="note">${U.esc(m.note || "")}</span>
          <button class="icon-btn sm" data-act="log-delete" data-table="mood_logs" data-id="${m.id}" aria-label="Elimina">${Icon.svg("x", 16)}</button></li>`).join("")}</ul>` : `<p class="muted small">Nessun check-in. Puoi farlo anche dalla schermata Oggi.</p>`}
      </section>`;
  },

  // ---------- sonno ----------
  sleepHTML() {
    const cfg = Store.cfg();
    const days = this.days(14);
    const byDate = Object.fromEntries(Store.d.sleep_logs.map((s) => [s.sleep_date, s]));
    const data = days.map((d) => ({ label: String(U.parse(d).getDate()), v: byDate[d] ? Number(byDate[d].hours) : 0, tip: byDate[d] ? `${U.fmtShort(d)}: ${U.num(byDate[d].hours, 2)} h${byDate[d].quality ? " · qualità " + byDate[d].quality + "/5" : ""}` : `${U.fmtShort(d)}: nessun dato` }));
    const avg = Calc.sleepAvg(days[0], days[days.length - 1]);
    const last = byDate[U.today()] || byDate[U.addDays(U.today(), -1)];
    return `
      <div class="grid2">
        <section class="card">
          <div class="block-head"><h3>Ore dormite</h3><span class="muted small">ultimi 14 giorni</span></div>
          ${Charts.cols({ data, h: 160, max: 10, target: cfg.sleepTarget, unit: "h", labelEvery: 2, aria: "Ore di sonno negli ultimi 14 giorni" })}
        </section>
        <section class="card stats-col">
          <div><b>${avg == null ? "–" : U.num(avg) + " h"}</b><span>media 14 giorni</span></div>
          <div><b>${last ? U.num(last.hours, 2) + " h" : "–"}</b><span>ultima notte</span></div>
          <button class="btn primary" data-act="sleep-add">${Icon.svg("moon", 16)} Registra il sonno</button>
        </section>
      </div>`;
  },

  // ---------- peso ----------
  weightHTML() {
    const cfg = Store.cfg();
    const all = [...Store.d.weight_logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    const recent = all.slice(-30);
    const latest = all[all.length - 1], first = recent[0];
    const delta = latest && first && latest !== first ? Number(latest.kg) - Number(first.kg) : null;
    const weightGoals = Calc.activeGoals().filter((g) => g.weight_target != null);
    return `
      ${weightGoals.map((g) => { const pct = Calc.weightProgress(g), start = Goals.weightStart(g);
        return `<div class="goal-banner" data-act="goal-open" data-id="${g.id}" role="button">
          <div><b>${U.esc(g.title)}</b><span>${start != null && latest ? `${U.num(start)} → ${U.num(Number(latest.kg))} kg · ` : ""}obiettivo ${U.num(g.weight_target)} kg${pct == null ? "" : ` · ${Math.round(pct)}%`}</span></div>
          ${Charts.bar({ value: pct || 0, color: "var(--orange-500)", h: 6 })}</div>`; }).join("")}
      <div class="grid2">
        <section class="card">
          <div class="block-head"><h3>Andamento</h3><span class="muted small">ultime ${recent.length} pesate</span></div>
          ${recent.length ? Charts.lines({ series: [{ name: "Peso", color: "var(--blue)", vals: recent.map((w) => Number(w.kg)) }], labels: recent.map((w) => String(U.parse(w.log_date).getDate())), area: true, target: cfg.weightTarget || null, dec: 1, labelEvery: Math.ceil(recent.length / 8), aria: "Andamento del peso" })
            : `<div class="empty-chart">Registra la prima pesata</div>`}
        </section>
        <section class="card stats-col">
          <div><b>${latest ? U.num(latest.kg) + " kg" : "–"}</b><span>ultima pesata</span></div>
          <div><b>${delta == null ? "–" : (delta > 0 ? "+" : "") + U.num(delta) + " kg"}</b><span>nel periodo</span></div>
          <button class="btn primary" data-act="weight-add">${Icon.svg("scale", 16)} Registra il peso</button>
        </section>
      </div>
      ${recent.length ? `<section class="card"><div class="block-head"><h3>Pesate</h3></div><ul class="log">${[...recent].reverse().slice(0, 8).map((w) => `<li><span class="when">${U.fmtLong(w.log_date)}</span><span class="vals"><b>${U.num(w.kg)} kg</b></span><span class="note"></span>
        <button class="icon-btn sm" data-act="log-delete" data-table="weight_logs" data-id="${w.id}" aria-label="Elimina">${Icon.svg("x", 16)}</button></li>`).join("")}</ul></section>` : ""}`;
  },

  // ---------- allenamenti ----------
  workoutHTML() {
    const today = U.today();
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const mon = U.addDays(U.mondayOf(today), -i * 7);
      const list = Calc.workoutsIn(mon, U.addDays(mon, 6));
      weeks.push({ label: U.fmtShort(mon).split(" ")[0], v: list.length, tip: `Settimana del ${U.fmtShort(mon)}: ${list.length} allenamenti · ${U.fmtMin(U.sum(list.map((w) => w.minutes)))}` });
    }
    const thisWeek = Calc.workoutsIn(U.mondayOf(today), today);
    const recent = [...Store.d.workouts].sort((a, b) => b.workout_date.localeCompare(a.workout_date) || b.created_at.localeCompare(a.created_at)).slice(0, 8);
    return `
      <div class="grid2">
        <section class="card">
          <div class="block-head"><h3>Allenamenti a settimana</h3></div>
          ${Charts.cols({ data: weeks, h: 150, aria: "Allenamenti per settimana" })}
        </section>
        <section class="card stats-col">
          <div><b>${thisWeek.length}</b><span>questa settimana</span></div>
          <div><b>${U.fmtMin(U.sum(thisWeek.map((w) => w.minutes)))}</b><span>tempo totale</span></div>
          <button class="btn primary" data-act="workout-add">${Icon.svg("dumbbell", 16)} Registra allenamento</button>
        </section>
      </div>
      <section class="card"><div class="block-head"><h3>Recenti</h3></div>
        ${recent.length ? `<ul class="log">${recent.map((w) => `<li><span class="when">${U.fmtShort(w.workout_date)}</span><span class="vals"><b>${U.esc(w.kind)}</b> · ${w.minutes} min${w.intensity ? ` · intensità ${w.intensity}/5` : ""}</span><span class="note">${U.esc(w.note || "")}</span>
          <button class="icon-btn sm" data-act="log-delete" data-table="workouts" data-id="${w.id}" aria-label="Elimina">${Icon.svg("x", 16)}</button></li>`).join("")}</ul>` : `<p class="muted small">Ancora nessun allenamento registrato.</p>`}
      </section>`;
  },

  // ---------- form ----------
  openMood() {
    const last = [...Store.d.mood_logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0];
    Sheet.open({
      title: "Come stai?",
      body: `<form class="form" id="mood-form">
        <div class="field"><span class="lbl">Umore</span>${UI.scale("mood", 3, MOOD_LABELS)}<div class="scale-labels"><span>Giù</span><span>Ottimo</span></div></div>
        <div class="field"><span class="lbl">Energia</span>${UI.scale("energy", 3, ENERGY_LABELS)}<div class="scale-labels"><span>Esausto</span><span>Al massimo</span></div></div>
        <label>Nota (facoltativa)<input name="note" maxlength="140" placeholder="Cosa sta influenzando come ti senti?"></label>
        <button class="btn primary wide" type="submit">Salva check-in</button></form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        UI.wire(form);
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          Store.insert("mood_logs", { logged_at: new Date().toISOString(), mood: Number(f.get("mood")), energy: Number(f.get("energy")), note: (f.get("note") || "").trim() || null });
          Sheet.close(); U.toast("Check-in salvato");
        });
      }
    });
  },

  openSleep() {
    const t = U.today(), ex = Store.d.sleep_logs.find((s) => s.sleep_date === t);
    Sheet.open({
      title: "Sonno di stanotte",
      body: `<form class="form" id="sleep-form">
        <label>Ore dormite<input name="hours" type="number" step="0.25" min="0" max="16" inputmode="decimal" required autofocus value="${ex ? ex.hours : 7.5}"></label>
        <div class="field"><span class="lbl">Qualità del riposo</span>${UI.scale("quality", ex && ex.quality || 3, ["Pessima", "Scarsa", "Ok", "Buona", "Ottima"])}<div class="scale-labels"><span>Pessima</span><span>Ottima</span></div></div>
        <label>Giorno del risveglio<input name="date" type="date" value="${t}" max="${t}"></label>
        <button class="btn primary wide" type="submit">Salva</button></form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        UI.wire(form);
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          Store.upsert("sleep_logs", { sleep_date: f.get("date") || t, hours: Math.max(0, Number(String(f.get("hours")).replace(",", "."))) || 0, quality: Number(f.get("quality")) || null }, "user_id,sleep_date");
          Sheet.close(); U.toast("Sonno registrato");
        });
      }
    });
  },

  openWeight() {
    const t = U.today(), latest = Calc.latestWeight();
    Sheet.open({
      title: "Peso",
      body: `<form class="form" id="weight-form">
        <label>Peso in kg<input name="kg" type="number" step="0.1" min="20" max="400" inputmode="decimal" required autofocus value="${latest ? latest.kg : ""}"></label>
        <label>Data<input name="date" type="date" value="${t}" max="${t}"></label>
        <button class="btn primary wide" type="submit">Salva</button></form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          const kg = Number(String(f.get("kg")).replace(",", "."));
          if (!(kg > 0)) return;
          Store.upsert("weight_logs", { log_date: f.get("date") || t, kg }, "user_id,log_date");
          Sheet.close(); U.toast("Peso registrato");
        });
      }
    });
  },

  openWorkout() {
    const t = U.today();
    Sheet.open({
      title: "Allenamento",
      body: `<form class="form" id="workout-form">
        <label>Tipo<select name="kind">${this.WORKOUTS.map((k) => `<option>${k}</option>`).join("")}</select></label>
        <div class="row2"><label>Durata (min)<input name="minutes" type="number" min="1" max="600" inputmode="numeric" required value="45"></label>
        <label>Data<input name="date" type="date" value="${t}" max="${t}"></label></div>
        <div class="field"><span class="lbl">Intensità</span>${UI.scale("intensity", 3, ["Leggera", "Facile", "Media", "Dura", "Massima"])}<div class="scale-labels"><span>Leggera</span><span>Massima</span></div></div>
        <label>Nota<input name="note" maxlength="140" placeholder="Es. 8 km, ritmo 5:40"></label>
        <button class="btn primary wide" type="submit">Salva</button></form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        UI.wire(form);
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          Store.insert("workouts", { workout_date: f.get("date") || t, kind: f.get("kind"), minutes: Math.max(1, Number(f.get("minutes")) || 30), intensity: Number(f.get("intensity")) || null, note: (f.get("note") || "").trim() || null });
          Sheet.close(); U.toast("Allenamento registrato");
        });
      }
    });
  }
};

Actions["body-tab"] = (el) => { Body.tab = el.dataset.id; App.render(); };
Actions["body-add"] = () => ({ mood: Body.openMood, sleep: Body.openSleep, weight: Body.openWeight, workout: Body.openWorkout }[Body.tab].call(Body));
Actions["mood-add"] = () => Body.openMood();
Actions["sleep-add"] = () => Body.openSleep();
Actions["weight-add"] = () => Body.openWeight();
Actions["workout-add"] = () => Body.openWorkout();
Actions["log-delete"] = (el) => { if (confirm("Eliminare questa registrazione?")) Store.remove(el.dataset.table, el.dataset.id); };
