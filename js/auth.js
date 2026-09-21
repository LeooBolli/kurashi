// ============================================================
// Autenticazione - email + password, un solo account.
// L'account si crea a mano su Supabase (Authentication > Users) e le
// registrazioni pubbliche si disattivano: vedi README.
// In modalità demo l'accesso è saltato.
// ============================================================
const Auth = {
  currentUser: null,
  EMAIL_KEY: "kurashi-last-email",

  uid() { return this.currentUser ? this.currentUser.id : "demo"; },

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
      if (email !== window.APP_CONFIG.ALLOWED_EMAIL.toLowerCase()) {
        status.textContent = "Questa email non è autorizzata.";
        return;
      }
      status.textContent = "Accesso in corso…";
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (!error) localStorage.setItem(this.EMAIL_KEY, email);
      status.textContent = error ? "Email o password non corrette." : "";
    });

    let started = false;
    const handle = (session) => {
      const user = session ? session.user : null;
      const changed = (user && user.id) !== (this.currentUser && this.currentUser.id);
      this.currentUser = user;
      this.updateUI();
      if (user && changed && !started) { started = true; onReady(); }
      if (!user) started = false;
    };
    sb.auth.onAuthStateChange((_e, session) => handle(session));
    sb.auth.getSession().then(({ data }) => handle(data.session));
  },

  async logout() {
    if (DEMO) {
      if (confirm("Cancellare i dati demo e ricominciare?")) { localStorage.removeItem(LocalBackend.KEY); location.reload(); }
      return;
    }
    await sb.auth.signOut();
    location.reload();
  },

  updateUI() {
    const on = !!this.currentUser;
    document.getElementById("view-login").classList.toggle("hidden", on);
    document.getElementById("app-shell").classList.toggle("hidden", !on);
  }
};
