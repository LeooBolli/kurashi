// ============================================================
// CONFIGURAZIONE - da compilare dopo aver creato il progetto Supabase
// (vedi README.md). Lasciando SUPABASE_URL vuoto l'app parte in
// MODALITÀ DEMO: dati di esempio salvati solo in questo browser.
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: "https://zwqoxbkcfebiipkssiws.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_RGYs1fsWIyP1K-6R6Yxx3g_EXnB4-k8",

  // Le email autorizzate, ognuna con il nome mostrato nei saluti. Anche se
  // qualcuno trovasse l'URL, senza uno di questi account (creati a mano su
  // Supabase) non entra. Ogni account vede e scrive solo i propri dati.
  // "owner" = le integrazioni Raindrop/Notion usano i suoi token: solo lui le vede.
  // Stesse email di public.kurashi_allowed() in supabase/schema.sql.
  USERS: {
    "23leo07@gmail.com":             { name: "Leonardo", owner: true },
    "biagettimariachiara@gmail.com": { name: "Chiara" }
  }
};

// Le sei aree della vita. I colori sono stati validati (contrasto e
// distinguibilità per daltonici); l'icona (vedi ICONS in util.js) accompagna
// sempre il nome, così il colore non è mai l'unico modo per riconoscere un'area.
window.AREAS = {
  sport:    { label: "Sport",    icon: "dumbbell",  color: "#3F7CBF" },
  salute:   { label: "Salute",   icon: "heart",     color: "#E8792F" },
  lavoro:   { label: "Lavoro",   icon: "briefcase", color: "#3E9B72" },
  studio:   { label: "Studio",   icon: "cap",       color: "#8A6FD0" },
  progetti: { label: "Progetti", icon: "spark",     color: "#D8608A" },
  hobby:    { label: "Hobby",    icon: "palette",   color: "#B48A12" }
};

window.HORIZONS = {
  short:     { label: "Breve",     sub: "1 mese",       months: 1 },
  medium:    { label: "Medio",     sub: "4 mesi",       months: 4 },
  long:      { label: "Lungo",     sub: "1 anno o più", months: 12 },
  recurring: { label: "Ricorrente", sub: "si ripete",    months: 12 }
};

// Solo per gli obiettivi ricorrenti: ogni quanto si rinnova il traguardo
window.PERIODS = {
  week:  { label: "Settimanale", sub: "ogni settimana" },
  month: { label: "Mensile",     sub: "ogni mese" },
  year:  { label: "Annuale",     sub: "ogni anno" }
};
