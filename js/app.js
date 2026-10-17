// ============================================================
// App: navigazione, rendering della sezione attiva, eventi globali
// ============================================================
const App = {
  view: "today",
  loaded: false,

  NAV: [
    { id: "today", label: "Home", icon: "home", tab: true },
    { id: "habits", label: "Abitudini", icon: "habit", tab: true },
    { id: "goals", label: "Obiettivi", icon: "goal", tab: true },
    { id: "insights", label: "Statistiche", icon: "chart" },
    { id: "focus", label: "Focus", icon: "clock" },
    { id: "body", label: "Benessere", icon: "heart" },
    { id: "food", label: "Alimentazione", icon: "bowl" },
    { id: "recall", label: "Riscoperte", icon: "quote" },
    { id: "reading", label: "Lettura", icon: "book" },
    { id: "settings", label: "Impostazioni", icon: "gear" }
  ],

  views() {
    return { today: Today, habits: Habits, goals: Goals, insights: Insights, focus: Focus, body: Body, food: Food, recall: Recall, reading: Reading, settings: Settings };
  },

  start() {
    // Kurashi non si apre dentro un riquadro di un altro sito (protezione dai clic ingannevoli)
    if (window.top !== window.self) { document.body.innerHTML = ""; try { window.top.location = window.self.location.href; } catch { /* bloccato */ } return; }
    Tip.init();
    Shell.boot();
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
      Focus.init();
      Shell.ready();
      KetoPlan.apply();
      this.route();
    });
    window.addEventListener("hashchange", () => this.route());
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      // Quando una versione nuova prende il controllo, lo diciamo invece di cambiare tutto in silenzio
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController) U.toast("C'è una nuova versione di Kurashi", { action: "Ricarica", fn: () => location.reload() });
      });
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  },

  buildNav() {
    const tabs = this.NAV.filter((n) => n.tab);
    const item = (n, cls) => `<button class="${cls}" data-act="go" data-id="${n.id}">${Icon.svg(n.icon, 22)}<span>${n.label}</span></button>`;
    document.getElementById("sidebar-nav").innerHTML = this.NAV.map((n) => item(n, "nav-item")).join("");
    // Telefono: Home · Abitudini · + · Obiettivi · Altro (le altre sezioni in una griglia)
    document.getElementById("tabbar").innerHTML =
      tabs.slice(0, 2).map((n) => item(n, "tab")).join("") +
      `<button class="fab" data-act="quick-add" aria-label="Registra">${Icon.svg("plus", 26)}</button>` +
      tabs.slice(2).map((n) => item(n, "tab")).join("") +
      `<button class="tab" data-act="more" id="tab-more" aria-haspopup="dialog">${Icon.svg("apps", 22)}<span>Altro</span></button>`;
  },

  updateNav() {
    document.querySelectorAll("[data-act=go]").forEach((b) => {
      const on = b.dataset.id === this.view;
      b.classList.toggle("on", on);
      if (b.closest("#sidebar-nav, #tabbar")) { if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
    });
    const inTabs = this.NAV.some((n) => n.tab && n.id === this.view);
    const more = document.getElementById("tab-more");
    if (more) more.classList.toggle("on", !inTabs);
    const cur = this.NAV.find((n) => n.id === this.view);
    document.getElementById("top-title").textContent = cur ? cur.label : "";
    document.body.dataset.view = this.view;
    Shell.renderHeader(this.view);
    Shell.placeNotch(true);
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
    // Un errore in una sezione non deve bloccare tutta l'app
    try { this.views()[this.view].render(el); }
    catch (e) {
      console.error(e);
      el.innerHTML = UI.empty("gear", "Questa sezione non si è caricata", `Le altre funzionano. Riprova, e se succede ancora annota cosa stavi facendo.<br><small class="muted">${U.esc(String(e && e.message || e).slice(0, 160))}</small>`,
        `<div class="btn-row center-row"><button class="btn primary" data-act="reload">Ricarica</button><button class="btn ghost" data-act="go" data-id="today">Torna alla Home</button></div>`);
    }
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
  }
};

// "Altro" (telefono): le sezioni che non stanno nella barra in basso
Actions["more"] = () => {
  const items = App.NAV.filter((n) => !n.tab);
  Sheet.open({
    title: "Altre sezioni",
    body: `<div class="more-grid">${items.map((n, i) => `<button class="quick c${i % 2 + 1} ${n.id === App.view ? "on" : ""}" data-act="go" data-id="${n.id}" data-close="1" ${n.id === App.view ? 'aria-current="page"' : ""}>${Icon.svg(n.icon, 24)}<span>${n.label}</span></button>`).join("")}</div>`
  });
};

Actions["reload"] = () => location.reload();

// "Registra": un solo punto per aggiungere qualcosa (stessa parola ovunque)
Actions["quick-add"] = () => {
  const items = [
    ["habit", "Abitudine", "habit-new", 1], ["goal", "Obiettivo", "goal-new", 1], ["scale", "Peso", "weight-add", 2], ["dumbbell", "Allenamento", "workout-add", 2],
    ["bowl", "Pasto", "food-quick", 2], ["smile", "Umore", "mood-add", 1], ["moon", "Sonno", "sleep-add", 1], ["book", "Da leggere", "read-add", 2]
  ];
  Sheet.open({
    title: "Registra",
    body: `<div class="quick-grid">${items.map(([ic, l, act, c]) => `<button class="quick c${c}" data-act="${act}">${Icon.svg(ic, 24)}<span>${l}</span></button>`).join("")}</div>`
  });
};

document.addEventListener("DOMContentLoaded", () => App.start());
