// ============================================================
// Esportazione dei dati: Excel (tutti i fogli) e CSV (un foglio alla volta)
// Usa SheetJS, caricato via CDN in index.html
// ============================================================
const Export = {
  area: (k) => (AREAS[k] ? AREAS[k].label : k),
  goalName: (id) => { const g = Store.d.goals.find((x) => x.id === id); return g ? g.title : ""; },
  habitName: (id) => { const h = Store.d.habits.find((x) => x.id === id); return h ? h.name : ""; },
  yn: (b) => (b ? "sì" : "no"),

  datasets() {
    const d = Store.d;
    return {
      Abitudini: d.habits.map((h) => ({
        Nome: h.name, Area: this.area(h.area), Tipo: h.kind === "check" ? "Sì/No" : "Quantità", Obiettivo_giornaliero: h.kind === "qty" ? h.target : "",
        Unità: h.unit || "", Giorni: Habits.daysText(h), Obiettivo_collegato: this.goalName(h.goal_id), Inizio: h.start_date, Archiviata: this.yn(h.archived),
        Serie_attuale: Calc.streak(h), Record_serie: Calc.bestStreak(h)
      })),
      Log_abitudini: [...d.habit_logs].sort((a, b) => a.log_date.localeCompare(b.log_date)).map((l) => {
        const h = d.habits.find((x) => x.id === l.habit_id);
        return { Data: l.log_date, Abitudine: h ? h.name : "", Area: h ? this.area(h.area) : "", Valore: Number(l.value), Obiettivo: h ? (h.kind === "check" ? 1 : h.target) : "", Completata: h ? this.yn(Calc.isDone(h, l.log_date)) : "" };
      }),
      Obiettivi: d.goals.map((g) => {
        const p = Calc.goalPace(g);
        return { Titolo: g.title, Area: this.area(g.area), Orizzonte: HORIZONS[g.horizon].label, Inizio: g.start_date, Scadenza: g.due_date, Stato: g.status === "done" ? "completato" : g.status === "archived" ? "archiviato" : "attivo",
          Avanzamento_percent: Math.round(p.progress), Atteso_percent: Math.round(p.expected), Ritmo: p.label, Note: g.description || "" };
      }),
      Tappe: d.milestones.map((m) => ({ Obiettivo: this.goalName(m.goal_id), Tappa: m.title, Sottotappa_di: (d.milestones.find((p) => p.id === m.parent_id) || {}).title || "", Completata: this.yn(m.done), Data_completamento: m.done_at ? U.dateOf(m.done_at) : "" })),
      Focus: [...d.focus_sessions].sort((a, b) => a.started_at.localeCompare(b.started_at)).map((s) => ({
        Inizio: `${U.dateOf(s.started_at)} ${U.fmtTime(s.started_at)}`, Minuti: s.duration_min, Completata: this.yn(s.completed), XP: s.xp || 0, Ryo: s.ryo || 0, Yokai: (Game.YOKAI[s.creature] || {}).label || "",
        Obiettivo: this.goalName(s.goal_id), Abitudine: this.habitName(s.habit_id)
      })),
      Umore_energia: [...d.mood_logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at)).map((m) => ({ Data: U.dateOf(m.logged_at), Ora: U.fmtTime(m.logged_at), Umore: m.mood ?? "", Energia: m.energy ?? "", Nota: m.note || "" })),
      Sonno: [...d.sleep_logs].sort((a, b) => a.sleep_date.localeCompare(b.sleep_date)).map((s) => ({ Data: s.sleep_date, Ore: Number(s.hours), Qualità: s.quality ?? "" })),
      Peso: [...d.weight_logs].sort((a, b) => a.log_date.localeCompare(b.log_date)).map((w) => ({ Data: w.log_date, Kg: Number(w.kg) })),
      Allenamenti: [...d.workouts].sort((a, b) => a.workout_date.localeCompare(b.workout_date)).map((w) => ({ Data: w.workout_date, Tipo: w.kind, Minuti: w.minutes, Intensità: w.intensity ?? "", Nota: w.note || "" })),
      Evidenziazioni: (d.highlights || []).map((h) => ({
        Testo: h.text, Nota: h.note || "", Fonte: h.source_title, Autore: h.source_author || "", Posizione: h.location || "", Tipo: h.source_kind || "",
        Link: h.source_url || "", Preferita: this.yn(h.favorite), Silenziata: this.yn(h.muted), Ripassi: h.times_reviewed || 0, Ultimo_ripasso: h.last_reviewed_on || ""
      })),
      Lettura: d.reading_items.map((r) => ({ Titolo: r.title, Tipo: r.kind === "book" ? "libro" : "link", Autore: r.author || "", Pagine: r.pages || "", Pagina_attuale: r.kind === "book" ? r.current_page || 0 : "", Goodreads: r.goodreads_url || "", Link: r.url || "", Fonte: r.source === "raindrop" ? "Raindrop" : "Manuale", Stato: { todo: "da leggere", reading: "in corso", done: "letto" }[r.status], Aggiunto: U.dateOf(r.created_at), Letto_il: r.done_at ? U.dateOf(r.done_at) : "" }))
    };
  },

  stamp() { return U.today(); },

  excel() {
    if (!window.XLSX) return U.toast("Libreria Excel non caricata: controlla la connessione");
    const wb = XLSX.utils.book_new();
    const sets = this.datasets();
    for (const [name, rows] of Object.entries(sets)) {
      const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["Nessun dato"]]);
      if (rows.length) ws["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
      XLSX.utils.book_append_sheet(wb, ws, name.replace(/_/g, " ").slice(0, 31));
    }
    XLSX.writeFile(wb, `kurashi_${this.stamp()}.xlsx`);
  },

  csv(name) {
    if (!window.XLSX) return U.toast("Libreria non caricata: controlla la connessione");
    const rows = this.datasets()[name];
    if (!rows) return;
    if (!rows.length) return U.toast("Questo elenco è ancora vuoto");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
    // BOM: Excel apre correttamente accenti e caratteri speciali
    U.download(`kurashi_${name.toLowerCase()}_${this.stamp()}.csv`, new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  }
};
