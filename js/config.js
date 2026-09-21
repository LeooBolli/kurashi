// ============================================================
// CONFIGURAZIONE - da compilare dopo aver creato il progetto Supabase
// (vedi README.md). Lasciando SUPABASE_URL vuoto l'app parte in
// MODALITÀ DEMO: dati di esempio salvati solo in questo browser.
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: "https://zwqoxbkcfebiipkssiws.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_RGYs1fsWIyP1K-6R6Yxx3g_EXnB4-k8",

  // L'unica email autorizzata. Anche se qualcuno trovasse l'URL, senza
  // questo account (creato a mano su Supabase) non entra.
  ALLOWED_EMAIL: "23leo07@gmail.com",

  // Nome mostrato nei saluti
  USER_NAME: "Leonardo"
};

// Le sei aree della vita. I colori sono stati validati (contrasto e
// distinguibilità per daltonici); il glifo giapponese accompagna sempre
// il nome, così il colore non è mai l'unico modo per riconoscere un'area.
window.AREAS = {
  sport:    { label: "Sport",    glyph: "動", color: "#3F7CBF", tint: "#E3EDF7" },
  salute:   { label: "Salute",   glyph: "健", color: "#E8792F", tint: "#FCE9DA" },
  lavoro:   { label: "Lavoro",   glyph: "仕", color: "#3E9B72", tint: "#E1F1E9" },
  studio:   { label: "Studio",   glyph: "学", color: "#8A6FD0", tint: "#ECE7F8" },
  progetti: { label: "Progetti", glyph: "創", color: "#D8608A", tint: "#F8E3EB" },
  hobby:    { label: "Hobby",    glyph: "趣", color: "#B48A12", tint: "#F5ECD0" }
};

window.HORIZONS = {
  short:  { label: "Breve",  sub: "1 mese",       months: 1 },
  medium: { label: "Medio",  sub: "4 mesi",       months: 4 },
  long:   { label: "Lungo",  sub: "1 anno o più", months: 12 }
};
