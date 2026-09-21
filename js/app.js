// ============================================================
// App: navigazione, rendering della sezione attiva, eventi globali
// ============================================================
const App = {
  view: "today",
  loaded: false,

  NAV: [
    { id: "today", label: "Oggi", icon: "home", tab: true },
    { id: "habits", label: "Abitudini", icon: "habit", tab: true },
    { id: "goals", label: "Obiettivi", icon: "goal", tab: true },
    { id: "insights", label: "Statistiche", icon: "chart", tab: true },
    { id: "focus", label: "Focus", icon: "tree" },
    { id: "hero", label: "Dojo", icon: "shield" },
    { id: "body", label: "Benessere", icon: "heart" },
    { id: "recall", label: "Riscoperte", icon: "quote" },
    { id: "reading", label: "Lettura", icon: "book" },
    { id: "settings", label: "Impostazioni", icon: "gear" }
  ],

  views() {
    return { today: Today, habits: Habits, goals: Goals, insights: Insights, focus: Focus, hero: Dojo, body: Body, recall: Recall, reading: Reading, settings: Settings };
  },

  start() {
    Tip.init();
    this.buildNav();
    this.bind();
    Store.on(() => this.render());
    Auth.init(async () => {
      try {
        await Store.loadAll();
      } catch (e) {
        console.error(e);
        const raw = String((e && (e.message || e.details)) || e || "");
        const hint = /JWT|expired|401|invalid.*token|not authenticated/i.test(raw) ? "La sessione è scaduta: esci e rientra."
          : /Failed to fetch|NetworkError|Load failed|network|timeout/i.test(raw) ? "Connessione assente o bloccata (rete, VPN o blocco pubblicità)."
          : /column|relation|schema cache|does not exist|PGRST/i.test(raw) ? "Manca un aggiornamento del database: esegui supabase/schema.sql su Supabase."
          : /paused|not found|404/i.test(raw) ? "Il progetto Supabase potrebbe essere in pausa o l'URL in js/config.js non è corretto."
          : "Controlla la connessione e che URL e chiave in js/config.js siano corretti.";
        document.getElementById("view").innerHTML = UI.empty("gear", "Non riesco a caricare i dati",
          `${hint}<br><small class="muted">Dettaglio: ${U.esc(raw.slice(0, 160) || "sconosciuto")}${e && e.table ? " · tabella " + U.esc(e.table) : ""}</small>`,
          `<div class="btn-row center-row"><button class="btn primary" data-act="reload">Riprova</button><button class="btn ghost" data-act="logout">Esci e rientra</button></div>`);
        return;
      }
      this.loaded = true;
      Game.init();
      Focus.init();
      this.route();
    });
    window.addEventListener("hashchange", () => this.route());
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  },

  buildNav() {
    const tabs = this.NAV.filter((n) => n.tab);
    const item = (n, cls) => `<button class="${cls}" data-act="go" data-id="${n.id}" aria-label="${n.label}">${Icon.svg(n.icon, 22)}<span>${n.label}</span></button>`;
    document.getElementById("sidebar-nav").innerHTML = this.NAV.map((n) => item(n, "nav-item")).join("");
    document.getElementById("tabbar").innerHTML =
      tabs.slice(0, 2).map((n) => item(n, "tab")).join("") +
      `<button class="fab" data-act="quick-add" aria-label="Aggiungi">${Icon.svg("plus", 26)}</button>` +
      tabs.slice(2).map((n) => item(n, "tab")).join("");
  },

  updateNav() {
    document.querySelectorAll("[data-act=go]").forEach((b) => b.classList.toggle("on", b.dataset.id === this.view));
    const cur = this.NAV.find((n) => n.id === this.view);
    document.getElementById("top-title").textContent = cur ? cur.label : "";
    document.body.dataset.view = this.view;
  },

  go(view) {
    if (!this.views()[view]) view = "today";
    if (location.hash === "#/" + view) this.route(); else location.hash = "#/" + view;
  },

  route() {
    const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
    const changed = this.views()[v] && v !== this.view;
    this.view = this.views()[v] ? v : "today";
    if (Sheet.isOpen()) Sheet.close();
    this.render();
    if (changed || !v) window.scrollTo(0, 0);
  },

  render() {
    if (!this.loaded) return;
    const el = document.getElementById("view");
    const y = window.scrollY;
    el.className = "view view-" + this.view;
    this.views()[this.view].render(el);
    this.updateNav();
    window.scrollTo(0, y);
  },

  bind() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-sheet-close]")) return Sheet.close();
      const a = e.target.closest("[data-act]");
      if (!a || !Actions[a.dataset.act]) return;
      if (a.tagName !== "A") e.preventDefault();
      if (a.dataset.close) Sheet.close();
      Actions[a.dataset.act](a, e);
    });
    document.addEventListener("change", (e) => {
      const a = e.target.closest("[data-act-change]");
      if (a && Actions[a.dataset.actChange]) Actions[a.dataset.actChange](a, e);
    });
    document.addEventListener("input", (e) => {
      const a = e.target.closest("[data-act-input]");
      if (a && Actions[a.dataset.actInput]) Actions[a.dataset.actInput](a, e);
    });
    document.addEventListener("submit", (e) => {
      const f = e.target.closest("[data-act-submit]");
      if (f && Actions[f.dataset.actSubmit]) { e.preventDefault(); Actions[f.dataset.actSubmit](f, e); }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && Sheet.isOpen()) Sheet.close(); });
    document.getElementById("menu-btn").addEventListener("click", () => this.openMenu());
  },

  openMenu() {
    Sheet.open({
      title: "Menu",
      body: `<div class="menu-list">${this.NAV.map((n) => `<button class="menu-item ${n.id === this.view ? "on" : ""}" data-act="go" data-id="${n.id}" data-close="1">${Icon.svg(n.icon, 22)}<span>${n.label}</span>${Icon.svg("right", 16)}</button>`).join("")}</div>`
    });
  }
};

Actions["reload"] = () => location.reload();

Actions["quick-add"] = () => {
  const items = [
    ["habit", "Abitudine", "habit-new"], ["goal", "Obiettivo", "goal-new"], ["smile", "Umore", "mood-add"],
    ["moon", "Sonno", "sleep-add"], ["scale", "Peso", "weight-add"], ["dumbbell", "Allenamento", "workout-add"],
    ["book", "Da leggere", "read-add"], ["tree", "Focus", "go"]
  ];
  Sheet.open({
    title: "Aggiungi",
    body: `<div class="quick-grid">${items.map(([ic, l, act]) =>
      `<button class="quick" data-act="${act}" ${act === "go" ? `data-id="focus" data-close="1"` : ""}>${Icon.svg(ic, 24)}<span>${l}</span></button>`).join("")}</div>`
  });
};

document.addEventListener("DOMContentLoaded", () => App.start());
