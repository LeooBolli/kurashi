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
    "leonardobolli@gmail.com":       { name: "Leonardo", owner: true },
    "biagettimariachiara@gmail.com": { name: "Chiara" },
    // Account di prova, vuoto: per far vedere l'app senza mostrare dati personali
    "23leo07@gmail.com":             { name: "Ospite" }
  }
};

// Le sei aree della vita, fisse per tutti. I colori sono stati validati (contrasto e
// distinguibilità per daltonici); l'icona (vedi ICONS in util.js) accompagna
// sempre il nome, così il colore non è mai l'unico modo per riconoscere un'area.
window.BASE_AREAS = Object.freeze({
  sport:    { label: "Sport",    icon: "dumbbell",  color: "#3F7CBF" },
  salute:   { label: "Salute",   icon: "heart",     color: "#E8792F" },
  lavoro:   { label: "Lavoro",   icon: "briefcase", color: "#3E9B72" },
  studio:   { label: "Studio",   icon: "cap",       color: "#8A6FD0" },
  progetti: { label: "Progetti", icon: "spark",     color: "#D8608A" },
  hobby:    { label: "Hobby",    icon: "palette",   color: "#B48A12" }
});

// Colori e icone tra cui scegliere per le aree personali. I colori nuovi hanno
// lo stesso contrasto di quelli base (testo bianco sul colore pieno, tema scuro).
window.AREA_COLORS = [
  "#3F7CBF", "#5462C8", "#2A9AA5", "#3E9B72", "#7E9130", "#B48A12", "#E8792F",
  "#D2483F", "#D8608A", "#B04FB4", "#8A6FD0", "#A0694A", "#5F7684"
];
window.AREA_ICONS = [
  "spark", "heart", "dumbbell", "run", "briefcase", "cap", "book", "palette", "music", "home",
  "users", "coin", "plane", "bowl", "tree", "moon", "sun", "star", "code", "target"
];

// AREAS = aree base + aree personali dell'utente (settings.data.customAreas).
// Si aggiorna sul posto a ogni cambio delle impostazioni (vedi Store.emit), così
// chi legge AREAS vede sempre l'elenco attuale.
window.AREAS = { ...window.BASE_AREAS };
window.syncAreas = (custom) => {
  const A = window.AREAS;
  for (const k of Object.keys(A)) if (!window.BASE_AREAS[k]) delete A[k];
  for (const c of Array.isArray(custom) ? custom : []) {
    if (!c || typeof c.id !== "string" || !c.id.startsWith("c_") || A[c.id]) continue;
    const label = String(c.label || "").trim().slice(0, 24);
    if (!label) continue;
    A[c.id] = {
      label,
      icon: window.AREA_ICONS.includes(c.icon) ? c.icon : "spark",
      color: /^#[0-9A-F]{6}$/i.test(c.color) ? c.color : window.AREA_COLORS[0],
      custom: true
    };
  }
};

window.HORIZONS = {
  short:     { label: "Breve",     sub: "1 mese",       months: 1 },
  medium:    { label: "Medio",     sub: "4 mesi",       months: 4 },
  long:      { label: "Lungo",     sub: "1 anno o più", months: 12 },
  recurring: { label: "Ricorrente", sub: "si ripete",    months: 12 }
};

// Finanze: struttura di partenza (macro aree e voci). Chi la modifica la ritrova nelle
// impostazioni (financeGroups, financeCats). kind "in" = entrate, senza kind = uscite;
// mine = solo per l'account owner. L'id delle voci non cambia mai: lo usano gli importi salvati.
window.FIN_GROUPS = [
  { id: "trasporti",   label: "Automobile",  color: "#5462C8" },
  { id: "pasti",       label: "Pasti",       color: "#D2483F" },
  { id: "spesa",       label: "Spesa",       color: "#3E9B72" },
  { id: "casa",        label: "Casa",        color: "#B48A12" },
  { id: "salute",      label: "Salute",      color: "#8A6FD0" },
  { id: "everyday",    label: "Tasse e commissioni", color: "#3F7CBF" },
  { id: "lavoro",      label: "Lavoro",      color: "#5F7684" },
  { id: "attivita",    label: "Attività",    color: "#7E9130" },
  { id: "uni",         label: "Formazione",  color: "#D8608A" },
  { id: "online",      label: "Servizi Online", color: "#B04FB4" },
  { id: "negozi",      label: "Negozi",      color: "#A0694A" },
  { id: "personale",   label: "Personale",   color: "#5462C8" },
  { id: "viaggi",      label: "Viaggi",      color: "#E8792F" },
  { id: "abbonamenti", label: "Abbonamenti", color: "#2A9AA5" },
  { id: "cane",        label: "Nevada",      color: "#A0694A", mine: true },
  { id: "in_lavoro",   label: "Lavoro",      color: "#3E9B72", kind: "in" },
  { id: "in_famiglia", label: "Famiglia",    color: "#2A9AA5", kind: "in" },
  { id: "in_altro",    label: "Altre entrate", color: "#7E9130", kind: "in" }
];
window.FIN_CATS = [
  { id: "macchina",   label: "Automobile",  icon: "car",       group: "trasporti" },
  { id: "pasti",      label: "Pasti",       icon: "bowl",      group: "pasti" },
  { id: "spesa",      label: "Spesa",       icon: "cart",      group: "spesa" },
  { id: "luce",       label: "Luce",        icon: "bolt",      group: "casa" },
  { id: "gas",        label: "Gas",         icon: "flame",     group: "casa" },
  { id: "salute",     label: "Salute",      icon: "heart",     group: "salute" },
  { id: "varie",      label: "Tasse e commissioni", icon: "apps",      group: "everyday" },
  { id: "lavoro",     label: "Lavoro",      icon: "briefcase", group: "lavoro" },
  { id: "attivita",   label: "Attività",    icon: "boat",      group: "attivita" },
  { id: "universita", label: "Formazione",  icon: "cap",       group: "uni" },
  { id: "online",     label: "Servizi Online", icon: "box",    group: "online" },
  { id: "negozi",     label: "Negozi",      icon: "barcode",   group: "negozi" },
  { id: "personale",  label: "Personale",   icon: "user",      group: "personale" },
  { id: "viaggi",     label: "Viaggi",      icon: "plane",     group: "viaggi" },
  { id: "fisse",      label: "Abbonamenti", icon: "repeat",    group: "abbonamenti" },
  { id: "nevada",     label: "Nevada",      icon: "paw",       group: "cane", mine: true },
  { id: "in_stipendio", label: "Stipendio",         icon: "wallet",    group: "in_lavoro",   kind: "in" },
  { id: "in_fatture",   label: "Fatture e autonomo", icon: "briefcase", group: "in_lavoro",   kind: "in" },
  { id: "in_famiglia",  label: "Famiglia",          icon: "users",     group: "in_famiglia", kind: "in" },
  { id: "in_rimborsi",  label: "Rimborsi",          icon: "refund",    group: "in_altro",    kind: "in" },
  { id: "in_extra",     label: "Extra e regali",    icon: "gift",      group: "in_altro",    kind: "in" }
];
window.FIN_ICONS = ["coin", "wallet", "briefcase", "gift", "refund", "users", "user", "smile", "box", "barcode", "laptop", "boat", "home", "bolt", "flame", "cart", "bowl", "car", "repeat", "apps", "plane", "heart", "cap", "paw", "book", "music", "dumbbell", "shield", "tree", "star"];
// Proposte nella finestra «Nuova macro area»
window.FIN_SUGGESTED = { out: ["Tempo libero", "Regali", "Tasse e burocrazia", "Risparmio", "Imprevisti"], in: ["Investimenti", "Affitti"] };

// Solo per gli obiettivi ricorrenti: ogni quanto si rinnova il traguardo
window.PERIODS = {
  week:  { label: "Settimanale", sub: "ogni settimana" },
  month: { label: "Mensile",     sub: "ogni mese" },
  year:  { label: "Annuale",     sub: "ogni anno" }
};
