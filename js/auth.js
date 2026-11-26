// ============================================================
// Autenticazione - email + password, solo gli account in APP_CONFIG.USERS.
// Gli account si creano a mano su Supabase (Authentication > Users) e le
// registrazioni pubbliche si disattivano: vedi README.
// In modalità demo l'accesso è saltato.
// ============================================================
const Auth = {
  currentUser: null,
  EMAIL_KEY: "kurashi-last-email",

  uid() { return this.currentUser ? this.currentUser.id : "demo"; },

  // Nome e ruolo dell'account collegato (in demo: il proprietario)
  profile() {
    const users = window.APP_CONFIG.USERS;
    if (DEMO) return Object.values(users).find((u) => u.owner) || {};
    return users[(this.currentUser?.email || "").toLowerCase()] || {};
  },
  isOwner() { return !!this.profile().owner; },

  init(onReady) {
    if (DEMO) {
      this.currentUser = { id: "demo", email: "demo" };
      this.updateUI();
      onReady();
      return;
    }

    const emailInput = document.getElementById("login-email");
    const saved = localStorage.getItem(this.EMAIL_KEY);
    if (saved) emailInput.value = saved;

    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const password = document.getElementById("login-password").value;
      const status = document.getElementById("login-status");
      if (!window.APP_CONFIG.USERS[email]) {
        status.textContent = "Questa email non è autorizzata.";
        return;
      }
      status.textContent = "Accesso in corso…";
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (!error) localStorage.setItem(this.EMAIL_KEY, email);
      status.textContent = error ? "Email o password non corrette." : "";
    });

    // onReady parte una sola volta per caricamento di pagina. Se dopo un'uscita (SIGNED_OUT)
    // rientri senza ricaricare, o cambia utente, ricarico la pagina: niente stato vecchio in giro.
    let started = false, signedOut = false;
    const handle = (session) => {
      const user = session ? session.user : null;
      const prev = this.currentUser;
      this.currentUser = user;
      if (!user) {
        if (started) signedOut = true;
        this.updateUI();
        return;
      }
      if (started && (signedOut || (prev && prev.id !== user.id))) { location.reload(); return; }
      this.updateUI();
      if (!started) { started = true; onReady(); }
    };
    sb.auth.onAuthStateChange((_e, session) => handle(session));
    sb.auth.getSession().then(({ data }) => handle(data.session));
  },

  // Dati di questo dispositivo da non lasciare in giro dopo l'uscita (il tema chiaro/scuro resta)
  DEVICE_KEYS: ["kurashi-weather", "kurashi-bg-local", "kurashi-look", "kurashi-focus-run"],
  clearDeviceData() {
    for (const k of this.DEVICE_KEYS) { try { localStorage.removeItem(k); } catch { /* storage bloccato */ } }
  },

  async logout() {
    if (DEMO) {
      if (await UI.confirm({ title: "Azzerare i dati demo?", text: "Cancelli tutti i dati di prova di questo browser e ricominci da capo.", confirmLabel: "Azzera", danger: true })) {
        try { localStorage.removeItem(LocalBackend.KEY); } catch { /* storage bloccato */ }
        this.clearDeviceData();
        location.reload();
      }
      return;
    }
    // Modifiche fatte senza rete e non ancora salvate: uscendo andrebbero perse
    const n = Store.outbox.length;
    if (n) {
      const ok = await UI.confirm({
        title: n === 1 ? "C'è 1 modifica non salvata" : `Ci sono ${n} modifiche non salvate`,
        text: "Sono su questo dispositivo in attesa della rete. Se esci adesso vanno perse: meglio aspettare di essere online.",
        confirmLabel: "Esci lo stesso", danger: true
      });
      if (!ok) return;
      try { localStorage.removeItem(Store.outboxKey()); } catch { /* storage bloccato */ }
    }
    try { await sb.auth.signOut(); } catch (e) { console.error(e); }
    this.clearDeviceData();
    location.reload();
  },

  updateUI() {
    const on = !!this.currentUser;
    document.getElementById("view-login").classList.toggle("hidden", on);
    document.getElementById("app-shell").classList.toggle("hidden", !on);
  }
};
