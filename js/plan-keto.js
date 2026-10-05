// ============================================================
// Piano chetogenico 12 ottobre – 8 novembre 2026 (dal file della nutrizionista).
// Si carica una sola volta, alla prima apertura dopo l'aggiornamento:
//   - le pietanze giorno per giorno nel piano (senza quantità: si aggiungono dal ricettario)
//   - l'obiettivo a breve termine "Chetogenica", figlio di "Arrivare a 72 kg"
//   - l'abitudine "Dieta rispettata" collegata a "Chetogenica": ogni giorno con tutto spuntato la fa avanzare
// Non è un modello ricorrente: finito il periodo questo file si può togliere.
// ============================================================
const KetoPlan = {
  FLAG: "ketoPlan2026",
  FROM: "2026-10-12",
  TO: "2026-11-08",
  // colazione | pranzo | spuntino (pomeriggio) | cena — un giorno per riga, dal 12 ottobre
  DAYS: [
    ["Pancake", "Pipette", "Cioccowafer", "Carne"],
    ["Croissant", "Schiacciatine rosmarino", "Biscotto cacao e vaniglia", "Pesce"],
    ["Biscotti vaniglia e cacao", "Mezze maniche", "Barretta al cocco", "Carne"],
    ["Fagottino", "Cioccolata calda", "Crostini rosmarino", "Pesce"],
    ["Pancake", "Penne + sugo arrabbiata (1)", "Biscotto cacao e vaniglia", "Carne"],
    ["Biscotti vaniglia e cacao", "Schiacciatine pomodoro", "Dessert cioccolato", "Pesce"],
    ["Croissant", "Pipette", "Crackers pizza", "Carne"],
    ["Fagottino", "Cioccolata calda", "Cioccowafer", "Pesce"],
    ["Pancake", "Mezze maniche", "Biscotto cacao e vaniglia", "Carne"],
    ["Biscotti vaniglia e cacao", "Schiacciatine rosmarino", "Barretta al cocco", "Pesce"],
    ["Croissant", "Penne", "Dessert cioccolato", "Carne"],
    ["Fagottino", "Schiacciatine pomodoro", "Crostini rosmarino", "Pesce"],
    ["Pancake", "Pipette", "Biscotto cacao e vaniglia", "Carne"],
    ["Biscotti vaniglia e cacao", "Cioccolata calda", "Cioccowafer", "Pesce"],
    ["Croissant", "Mezze maniche", "Barretta al cocco", "Carne"],
    ["Fagottino", "Schiacciatine rosmarino", "Crackers pizza", "Pesce"],
    ["Pancake", "Penne + sugo arrabbiata (2)", "Biscotto cacao e vaniglia", "Carne"],
    ["Biscotti vaniglia e cacao", "Crackers pizza", "Dessert cioccolato", "Pesce"], // 29/10: a pranzo lo spuntino in più
    ["Croissant", "Pipette", "Cioccowafer", "Carne"],
    ["Biscotti vaniglia e cacao", "Schiacciatine pomodoro", "Barretta al cocco", "Pesce"],
    ["Pancake", "Cioccolata calda", "Biscotto cacao e vaniglia", "Carne"],
    ["Biscotti vaniglia e cacao", "Mezze maniche", "Crostini rosmarino", "Pesce"],
    ["Croissant", "Schiacciatine rosmarino", "Dessert cioccolato", "Carne"],
    ["Fagottino", "Penne", "Biscotto cacao e vaniglia", "Pesce"],
    ["Pancake", "Pipette", "Crackers pizza", "Carne"],
    ["Biscotti vaniglia e cacao", "Schiacciatine pomodoro", "Barretta al cocco", "Pesce"],
    ["Fagottino", "Cioccolata calda", "Cioccowafer", "Carne"],
    ["Pancake", "Pipette", "Biscotto cacao e vaniglia", "Pesce"]
  ],
  SLOTS: ["colazione", "pranzo", "spuntino_pomeriggio", "cena"],

  apply() {
    if (DEMO || Store.cfg()[this.FLAG]) return;
    Store.setSettings({ [this.FLAG]: true });

    // Pietanze: le metto nel ricettario (senza quantità) così le quantità aggiunte lì arrivano anche al piano.
    // Se quei giorni hanno già qualcosa (es. caricato da un altro dispositivo), non tocco il piano.
    const busy = Store.d.meal_entries.some((e) => e.entry_date >= this.FROM && e.entry_date <= this.TO);
    if (!busy) {
      const byName = new Map(Store.d.foods.map((f) => [Food.norm(f.name), f]));
      const missing = [...new Set(this.DAYS.flat())].filter((n) => !byName.has(Food.norm(n)));
      Store.insertMany("foods", missing.map((name) => ({ kind: "food", name, qty: null, unit: null, items: [], favorite: false })))
        .forEach((f) => byName.set(Food.norm(f.name), f));
      const rows = this.DAYS.flatMap((day, i) => day.map((name, j) => {
        const f = byName.get(Food.norm(name));
        return { entry_date: U.addDays(this.FROM, i), slot: this.SLOTS[j], food_id: f.id, name: f.name, qty: f.qty ?? null, unit: f.unit || null,
          items: [], eaten: false, extra: false, position: 0 };
      }));
      Store.insertMany("meal_entries", rows);
    }

    // Obiettivo "Chetogenica", figlio dell'obiettivo di peso (non entra nella sua percentuale, che resta sul peso)
    const parent = Store.d.goals.find((g) => g.status === "active" && g.weight_linked)
      || Store.d.goals.find((g) => g.status === "active" && /72\s*kg/i.test(g.title));
    let goal = Store.d.goals.find((g) => g.title.trim().toLowerCase() === "chetogenica" && g.status !== "archived");
    if (!goal) goal = Store.insert("goals", {
      title: "Chetogenica", area: "salute", horizon: "short", start_date: this.FROM, due_date: this.TO, period: null,
      parent_goal_id: parent ? parent.id : null, weight_linked: false,
      description: "Dieta chetogenica dal 12 ottobre all'8 novembre. Ogni giorno in cui spunti tutti i pasti fa avanzare l'obiettivo.",
      manual_progress: 0, status: "active", notion_page_id: null, done_at: null
    });

    // L'abitudine che si spunta da sola a giornata completata è la fonte di avanzamento dell'obiettivo
    const h = Food.habit() || (Store.cfg().dietHabit ? null : Food.ensureHabit(U.today()));
    if (h && h.goal_id !== goal.id) Store.update("habits", h.id, { goal_id: goal.id });

    U.toast("Piano chetogenico caricato: 28 giorni dal 12 ottobre");
  }
};
