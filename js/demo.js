// ============================================================
// Dati di esempio per la modalità demo (date sempre relative a oggi)
// ============================================================
const Demo = {
  seed() {
    const rnd = U.rng(42);
    const today = U.today();
    const iso = (date, h = 9, m = 0) => new Date(`${date}T${U.pad(h)}:${U.pad(m)}:00`).toISOString();
    const db = { settings: { focusWeeklyMin: 600, sleepTarget: 8, weightTarget: 74, game: { owned: ["hachimaki", "bokken"], equipped: { hat: "hachimaki", weapon: "bokken" }, potions: [] } } };
    TABLES.forEach((t) => (db[t] = []));

    const mk = (o) => ({ id: U.uid(), created_at: iso(U.addDays(today, -60)), ...o });

    // Obiettivi
    const g = {
      half: mk({ title: "Correre una mezza maratona", area: "sport", horizon: "medium", description: "Autunno, sotto 1h55.", start_date: U.addDays(today, -50), due_date: U.addDays(today, 70), manual_progress: 0, status: "active" }),
      exam: mk({ title: "Finire il corso di design system", area: "studio", horizon: "short", start_date: U.addDays(today, -12), due_date: U.addDays(today, 18), manual_progress: 0, status: "active" }),
      app: mk({ title: "Lanciare il side project", area: "progetti", horizon: "long", start_date: U.addDays(today, -90), due_date: U.addDays(today, 270), manual_progress: 0, status: "active" }),
      sleep: mk({ title: "Routine del sonno stabile", area: "salute", horizon: "short", start_date: U.addDays(today, -20), due_date: U.addDays(today, 10), manual_progress: 40, status: "active" }),
      guitar: mk({ title: "Suonare 5 brani a memoria", area: "hobby", horizon: "medium", start_date: U.addDays(today, -30), due_date: U.addDays(today, 90), manual_progress: 20, status: "active" })
    };
    db.goals = Object.values(g);

    const ms = (goal, list) => list.forEach(([title, done], i) => db.milestones.push(mk({
      goal_id: goal.id, title, done, position: i, done_at: done ? iso(U.addDays(today, -(list.length - i) * 4)) : null
    })));
    ms(g.half, [["10 km senza fermarsi", true], ["Mezza di allenamento (16 km)", true], ["Iscrizione alla gara", true], ["18 km di lungo", false], ["Scarico ultima settimana", false]]);
    ms(g.exam, [["Moduli 1-3", true], ["Moduli 4-6", false], ["Progetto finale", false]]);
    ms(g.app, [["Prototipo cliccabile", true], ["Landing page", true], ["MVP funzionante", false], ["10 utenti di prova", false], ["Lancio pubblico", false]]);

    // Abitudini
    const h = {
      water: mk({ name: "Bere acqua", area: "salute", kind: "qty", target: 8, step: 1, unit: "bicchieri", start_date: U.addDays(today, -60) }),
      run: mk({ name: "Corsa o camminata", area: "sport", kind: "check", target: 1, step: 1, days: [1, 3, 5, 6], goal_id: g.half.id, start_date: U.addDays(today, -50) }),
      read: mk({ name: "Leggere", area: "studio", kind: "qty", target: 20, step: 5, unit: "pagine", start_date: U.addDays(today, -60) }),
      deep: mk({ name: "Lavoro profondo", area: "lavoro", kind: "qty", target: 90, step: 15, unit: "min", days: [1, 2, 3, 4, 5], start_date: U.addDays(today, -60) }),
      course: mk({ name: "Lezione del corso", area: "studio", kind: "check", target: 1, step: 1, days: [1, 2, 3, 4, 5], goal_id: g.exam.id, start_date: U.addDays(today, -12) }),
      side: mk({ name: "Side project", area: "progetti", kind: "qty", target: 45, step: 15, unit: "min", goal_id: g.app.id, start_date: U.addDays(today, -60) }),
      guitar: mk({ name: "Chitarra", area: "hobby", kind: "qty", target: 20, step: 5, unit: "min", days: [2, 4, 6, 7], goal_id: g.guitar.id, start_date: U.addDays(today, -30) }),
      bed: mk({ name: "A letto entro le 23", area: "salute", kind: "check", target: 1, step: 1, goal_id: g.sleep.id, start_date: U.addDays(today, -20) })
    };
    db.habits = Object.values(h);
    db.habits.forEach((x) => { x.days = x.days || [1, 2, 3, 4, 5, 6, 7]; x.archived = false; x.goal_id = x.goal_id || null; x.unit = x.unit || null; });
    db.goals.forEach((x) => { x.notion_page_id = null; x.done_at = null; });

    // Log abitudini: buona costanza con qualche buco, più bassa per alcune
    const reliability = { water: 0.82, run: 0.85, read: 0.6, deep: 0.75, course: 0.7, side: 0.55, guitar: 0.6, bed: 0.65 };
    for (const habit of db.habits) {
      for (let i = 60; i >= 0; i--) {
        const date = U.addDays(today, -i);
        if (date < habit.start_date || !habit.days.includes(U.dow(date))) continue;
        if (i === 0 && rnd() < 0.5) continue; // oggi: solo qualcosa fatto
        const r = rnd();
        const key = Object.keys(h).find((k) => h[k] === habit);
        let value = 0;
        if (r < reliability[key]) value = habit.kind === "check" ? 1 : habit.target * (0.9 + rnd() * 0.3);
        else if (r < reliability[key] + 0.12 && habit.kind === "qty") value = habit.target * (0.3 + rnd() * 0.5);
        if (value > 0) db.habit_logs.push(mk({ habit_id: habit.id, log_date: date, value: Math.round(value * 10) / 10, created_at: iso(date, 20) }));
      }
    }

    // Focus
    for (let i = 40; i >= 0; i--) {
      const date = U.addDays(today, -i);
      const n = Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const dur = [25, 25, 45, 50][Math.floor(rnd() * 4)];
        const ok = rnd() > 0.15;
        const creature = ["hitodama", "hitodama", "chochin", "kasa"][Math.floor(rnd() * 4)];
        db.focus_sessions.push(mk({
          started_at: iso(date, 9 + k * 3, 10), duration_min: dur, completed: ok, xp: ok ? dur : 0, ryo: ok ? Math.round(dur / 5) : 0,
          creature, goal_id: rnd() > 0.5 ? g.app.id : null, label: null, created_at: iso(date, 9 + k * 3, 10)
        }));
      }
    }

    // Umore / energia (più check-in al giorno), sonno, peso, allenamenti
    for (let i = 30; i >= 0; i--) {
      const date = U.addDays(today, -i);
      const base = 3 + Math.sin(i / 4) * 0.8;
      [10, 16].forEach((hh) => {
        if (rnd() < 0.8) db.mood_logs.push(mk({
          logged_at: iso(date, hh, 5), mood: U.clamp(Math.round(base + rnd() * 1.4 - 0.7), 1, 5),
          energy: U.clamp(Math.round(base - 0.2 + rnd() * 1.6 - 0.8 - (hh === 16 ? 0.4 : 0)), 1, 5), created_at: iso(date, hh, 5)
        }));
      });
      if (i > 0 || rnd() < 0.6) db.sleep_logs.push(mk({ sleep_date: date, hours: Math.round((6.4 + rnd() * 2 + (i < 10 ? 0.3 : 0)) * 4) / 4, quality: U.clamp(Math.round(2.6 + rnd() * 2.2), 1, 5) }));
      if (i % 3 === 0) db.weight_logs.push(mk({ log_date: date, kg: Math.round((77.4 - (30 - i) * 0.07 + rnd() * 0.5) * 10) / 10 }));
      if ([1, 3, 5, 6].includes(U.dow(date)) && rnd() < 0.8) {
        db.workouts.push(mk({ workout_date: date, kind: ["Corsa", "Corsa", "Palestra", "Camminata"][Math.floor(rnd() * 4)], minutes: [35, 45, 60, 50][Math.floor(rnd() * 4)], intensity: 2 + Math.floor(rnd() * 3) }));
      }
    }

    // Lettura
    const reads = [
      ["The Design of Everyday Things", "https://example.com/design", "todo"],
      ["Atomic Habits: riassunto e note", "https://example.com/atomic", "todo"],
      ["Ma: lo spazio vuoto nel design giapponese", "https://example.com/ma", "reading"],
      ["Come funziona la memoria a lungo termine", "https://example.com/memoria", "done"],
      ["Correre la prima mezza maratona", "https://example.com/mezza", "done"]
    ];
    reads.forEach(([title, url, status], i) => db.reading_items.push(mk({
      source: "raindrop", external_id: "demo" + i, title, url, status,
      done_at: status === "done" ? iso(U.addDays(today, -i * 3)) : null, created_at: iso(U.addDays(today, -i * 4))
    })));

    // Evidenziazioni (citazioni classiche, solo per la demo)
    const quotes = [
      ["Non è che abbiamo poco tempo, ma ne perdiamo molto.", "Sulla brevità della vita", "Seneca", "libro", "p. 12"],
      ["Non sono le cose a turbare gli uomini, ma i giudizi che essi ne danno.", "Manuale", "Epitteto", "libro", "p. 5"],
      ["Un viaggio di mille miglia comincia con un singolo passo.", "Tao Te Ching", "Lao Tzu", "libro", "cap. 64"],
      ["Quando cammini, cammina. Quando mangi, mangia.", "Proverbio zen", null, "articolo", null],
      ["La vita è solo una successione di momenti presenti: passato e futuro non esistono realmente e quindi non contano.", "In Crescita", "Sadurny, Luca", "libro", "p. 13"],
      ["Ichigo-ichie: questo momento esiste solo adesso e non tornerà più.", "In Crescita", "Sadurny, Luca", "libro", "p. 14"],
      ["Siamo ciò che facciamo ripetutamente. L'eccellenza, quindi, non è un atto ma un'abitudine.", "Vite parallele", "Will Durant", "libro", "p. 98"],
      ["Less is more: togliere non significa rinunciare alle funzioni, ma lasciare solo ciò che serve.", "Design minimale", "Dieter Rams", "video", "12:40"],
      ["Il segreto per andare avanti è iniziare.", "Come iniziare", null, "articolo", null],
      ["Chi ha un perché abbastanza forte può sopportare quasi ogni come.", "Uno psicologo nei lager", "Viktor Frankl", "libro", "p. 104"],
      ["Ciò che ostacola il cammino diventa il cammino.", "Meditazioni", "Marco Aurelio", "libro", "V, 20"],
      ["Sì", "Nota breve", null, "nota", null]
    ];
    quotes.forEach(([text, title, author, kind, loc], i) => db.highlights.push(mk({
      uid: "demo:" + i, text, note: i === 3 ? "Da ricordare a tavola." : null, location: loc,
      source_title: title, source_author: author, source_url: kind === "articolo" ? "https://example.com/" + i : null,
      source_kind: kind, source_file: "demo/" + title + ".md", highlighted_at: null, content_hash: "d" + i,
      favorite: i === 2, muted: false, times_reviewed: i % 3, last_reviewed_on: i % 3 ? U.addDays(today, -(4 + i)) : null
    })));

    return db;
  }
};
