// ============================================================
// Lettura: libri (incollando il link di Goodreads, con copertina e
// avanzamento a pagine), bookmark di Raindrop.io e link manuali.
// Goodreads non ha più un'API pubblica: dal link si ricava il titolo
// e si cercano autore, pagine e copertina su Open Library e Apple Books (interrogati insieme).
// ============================================================
const Reading = {
  tab: "todo",
  syncing: false,
  draft: null,      // stato dell'aggiunta di un libro: {goodreads, query, results, pick}

  cover(r, cls = "") {
    const book = r.kind === "book" ? "book" : "";
    return r.cover
      ? `<img class="cover ${book} ${cls}" src="${U.esc(U.safeUrl(r.cover))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'cover ph ${book}'}))">`
      : `<i class="cover ph ${book} ${cls}"></i>`;
  },

  pct(r) { return r.pages ? U.clamp(Math.round((r.current_page / r.pages) * 100), 0, 100) : null; },

  // ---------- righe ----------
  rowHTML(r, compact = false) {
    const url = U.safeUrl(r.url || r.goodreads_url);
    const isBook = r.kind === "book";
    const p = isBook ? this.pct(r) : null;
    const meta = isBook
      ? `${U.esc(r.author || "Autore sconosciuto")}${r.status === "reading" && r.pages ? ` · pag. ${r.current_page}/${r.pages} (${p}%)` : r.pages ? ` · ${r.pages} pag.` : ""}`
      : `${U.esc(U.domain(r.url) || "manuale")}${r.source === "raindrop" ? " · Raindrop" : ""}${r.status === "reading" ? " · in corso" : ""}`;
    return `<div class="read-row">
      ${this.cover(r)}
      <div class="read-main">
        <h3>${url ? `<a href="${U.esc(url)}" target="_blank" rel="noopener noreferrer" data-act="read-open" data-id="${r.id}">${U.esc(r.title)}</a>` : U.esc(r.title)}</h3>
        <p class="muted small">${meta}</p>
        ${isBook && r.status === "reading" && p != null && compact ? Charts.bar({ value: p, color: "var(--blue-500)", h: 4 }) : ""}
      </div>
      ${compact ? "" : `<div class="read-act">
        ${r.status === "todo" ? `<button class="btn ghost sm" data-act="read-status" data-id="${r.id}" data-value="reading">Inizia</button>` : ""}
        ${r.status !== "done" ? `<button class="btn ghost sm" data-act="read-status" data-id="${r.id}" data-value="done">${Icon.svg("check", 14)} ${isBook ? "Finito" : "Letto"}</button>` : `<button class="btn ghost sm" data-act="read-status" data-id="${r.id}" data-value="todo">Rimetti in coda</button>`}
        <button class="icon-btn sm" data-act="read-delete" data-id="${r.id}" aria-label="Elimina">${Icon.svg("x", 16)}</button>
      </div>`}
    </div>`;
  },

  // Scheda del libro che stai leggendo, con avanzamento
  currentHTML(r) {
    const p = this.pct(r), url = U.safeUrl(r.goodreads_url || r.url);
    return `<article class="book-now">
      ${url ? `<a href="${U.esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Apri su Goodreads">${this.cover(r, "lg")}</a>` : this.cover(r, "lg")}
      <div class="bn-main">
        <h3>${U.esc(r.title)}</h3>
        <p class="muted small">${U.esc(r.author || "Autore sconosciuto")}</p>
        ${r.pages ? `<div class="bn-prog">${Charts.bar({ value: p, color: "var(--orange-500)", h: 8 })}<span><b>${p}%</b> · pag. ${r.current_page} di ${r.pages}</span></div>`
          : `<p class="muted small">Aggiungi il numero di pagine per vedere l'avanzamento.</p>`}
        <div class="btn-row">
          <button class="btn ghost sm" data-act="book-plus" data-id="${r.id}" data-n="10">+10 pag.</button>
          <button class="btn ghost sm" data-act="book-page" data-id="${r.id}">${Icon.svg("edit", 14)} Pagina</button>
          <button class="btn primary sm" data-act="read-status" data-id="${r.id}" data-value="done">${Icon.svg("check", 14)} Finito</button>
        </div>
      </div>
    </article>`;
  },

  render(el) {
    const items = Store.d.reading_items;
    const counts = { todo: 0, reading: 0, done: 0 };
    items.forEach((r) => counts[r.status]++);
    const nowBooks = items.filter((r) => r.kind === "book" && r.status === "reading");
    const list = items.filter((r) => (this.tab === "todo" ? r.status !== "done" && !nowBooks.includes(r) : r.status === "done"))
      .sort((a, b) => this.tab === "todo"
        ? (a.status === "reading" ? -1 : 1) - (b.status === "reading" ? -1 : 1) || b.created_at.localeCompare(a.created_at)
        : (b.done_at || "").localeCompare(a.done_at || ""));
    const monthStart = U.today().slice(0, 8) + "01";
    const doneMonth = items.filter((r) => r.status === "done" && r.done_at && U.dateOf(r.done_at) >= monthStart).length;
    const booksDone = items.filter((r) => r.kind === "book" && r.status === "done").length;

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">読書 · Lettura</p><h1 class="title">Da <em>leggere</em></h1>
          <p class="sub">${booksDone} ${booksDone === 1 ? "libro finito" : "libri finiti"} · ${doneMonth} letti questo mese · ${counts.todo + counts.reading} in coda</p></div>
        <div class="btn-row nowrap">
          <button class="btn ghost" data-act="read-sync" aria-label="Sincronizza Raindrop" ${this.syncing ? "disabled" : ""}>${Icon.svg("sync", 16, this.syncing ? "spin" : "")}<span class="hide-sm">${this.syncing ? "Sincronizzo…" : "Raindrop"}</span></button>
          <button class="btn ghost" data-act="read-add">${Icon.svg("link", 16)}<span>Link</span></button>
          <button class="btn primary" data-act="book-add">${Icon.svg("book", 16)}<span>Libro</span></button>
        </div>
      </div>
      ${Calc.activeGoals().filter((g) => Calc.goalBooks(g)).map((g) => { const b = Calc.goalBooks(g); return `<div class="goal-banner" data-act="goal-open" data-id="${g.id}" role="button">
        <div><b>${U.esc(g.title)}</b><span>${b.count} di ${b.target} libri · ${Math.round(b.pct)}%</span></div>${Charts.bar({ value: b.pct, color: "var(--orange-500)", h: 6 })}</div>`; }).join("")}
      ${this.tab === "todo" && nowBooks.length ? `<section class="now-reading"><h2 class="mini-h">Sto leggendo</h2>${nowBooks.map((r) => this.currentHTML(r)).join("")}</section>` : ""}
      <div class="seg tabs2">
        <button class="${this.tab === "todo" ? "on" : ""}" data-act="read-tab" data-id="todo">Da leggere<small>${counts.todo + counts.reading - nowBooks.length}</small></button>
        <button class="${this.tab === "done" ? "on" : ""}" data-act="read-tab" data-id="done">Letti<small>${counts.done}</small></button>
      </div>
      ${list.length ? `<div class="card stack">${list.map((r) => this.rowHTML(r)).join("")}</div>`
        : UI.empty("book", this.tab === "todo" ? "Nessuna lettura in coda" : "Ancora niente di letto",
          this.tab === "todo" ? "Incolla il link di un libro di Goodreads, salva link su Raindrop e sincronizza, o aggiungine uno a mano." : "Quando finisci qualcosa, segnalo come letto.",
          this.tab === "todo" ? `<button class="btn primary" data-act="book-add">Aggiungi un libro</button>` : "")}`;
  },

  // ---------- link semplice ----------
  openAdd() {
    Sheet.open({
      title: "Aggiungi un link",
      body: `<form class="form" id="read-form">
        <label>Link<input name="url" type="url" inputmode="url" required autofocus placeholder="https://…"></label>
        <label>Titolo (facoltativo)<input name="title" maxlength="140" placeholder="Se vuoto uso il dominio"></label>
        <button class="btn primary wide" type="submit">Aggiungi</button></form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form);
          const url = U.safeUrl(f.get("url"));
          if (!url) return U.toast("Link non valido");
          Store.insert("reading_items", { source: "manual", kind: "link", external_id: null, title: (f.get("title") || "").trim() || U.domain(url), url, cover: null, status: "todo", done_at: null });
          Sheet.close(); U.toast("Aggiunto alla lista");
        });
      }
    });
  },

  // ---------- libro: incolla Goodreads → cerca → conferma ----------
  // Dal link di Goodreads (.../book/show/40121378-atomic-habits) ricava il titolo.
  parseInput(raw) {
    // toglie spazi, a capo e caratteri invisibili che a volte arrivano con il copia-incolla
    const s = String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
    const m = s.match(/goodreads\.com\/(?:[a-z]{2}\/)?book\/show\/(\d+)(?:[-.]([^/?#\s]+))?/i);
    if (m) {
      let slug = m[2] || "";
      try { slug = decodeURIComponent(slug); } catch { /* lascia com'è */ }
      return { goodreads: "https://www.goodreads.com/book/show/" + m[1] + (m[2] ? "-" + m[2] : ""), query: slug.replace(/[-_.]+/g, " ").trim() };
    }
    const u = s.match(/https?:\/\/\S+/i);
    if (u) {
      const text = s.replace(u[0], "").replace(/[“”"«»]/g, "").trim();   // es. «Titolo di Autore https://…»
      return { goodreads: /goodreads|goodr\.es/i.test(u[0]) ? u[0].split(/[?#]/)[0] : null, query: text };
    }
    return { goodreads: null, query: s };
  },

  titleCase(t) { return String(t || "").replace(/\S+/g, (w, i) => (i > 0 && /^(di|da|del|della|il|la|lo|le|e|a|in|of|the|and|to)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))); },

  // Richiesta con limite di tempo: mai più «Cerco…» all'infinito se la rete è lenta o bloccata
  async fetchJson(url, ms = 8000) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  },

  // Open Library: gratuita, senza chiave: ha le pagine. Lancia un errore se non risponde.
  async searchOpenLibrary(q) {
    const j = await this.fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=title,author_name,cover_i,number_of_pages_median`);
    return (j.docs || []).filter((d) => d.title).map((d) => ({
      title: d.title, author: (d.author_name || []).slice(0, 2).join(", "), pages: d.number_of_pages_median || null,
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : ""
    }));
  },

  // Apple Books: fonte indipendente, molto affidabile (senza numero di pagine)
  async searchApple(q) {
    const j = await this.fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=ebook&country=it&limit=8`);
    return (j.results || []).filter((r) => r.trackName).map((r) => ({
      title: r.trackName, author: r.artistName || "", pages: null,
      cover: (r.artworkUrl100 || "").replace("100x100bb", "300x300bb")
    }));
  },

  // Interroga i due cataloghi insieme. error = true solo se NESSUNO dei due ha risposto (rete assente o bloccata).
  async searchBooks(q) {
    const run = async (text) => {
      const res = await Promise.allSettled([this.searchOpenLibrary(text), this.searchApple(text)]);
      return { answered: res.filter((r) => r.status === "fulfilled").length, list: res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])) };
    };
    let { answered, list } = await run(q);
    const short = q.split(/\s+/).slice(0, 4).join(" ");
    if (!list.length && answered && short !== q) ({ list } = await run(short));   // titoli lunghi: riprovo con le prime parole
    // unisce i doppioni tenendo, per ognuno, pagine e copertina disponibili
    const seen = new Map();
    for (const b of list) {
      const key = b.title.toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + (b.author || "").toLowerCase().split(/[ ,]/)[0];
      const ex = seen.get(key);
      if (!ex) seen.set(key, { ...b });
      else { ex.pages = ex.pages || b.pages; ex.cover = ex.cover || b.cover; ex.author = ex.author || b.author; }
    }
    return { list: [...seen.values()].slice(0, 8), error: answered === 0 };
  },

  openBook() {
    this.draft = { goodreads: null, query: "", results: [] };
    Sheet.open({ title: "Aggiungi un libro", wide: true, body: this.stepSearchHTML(), onMount: (root) => this.bindSearch(root), onClose: () => { this.draft = null; } });
  },

  stepSearchHTML(msg = "") {
    return `<form class="form" id="book-search">
      <label>Incolla il link di Goodreads, oppure scrivi titolo e autore
        <input name="q" type="text" autofocus autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" placeholder="https://www.goodreads.com/book/show/… oppure «Project Hail Mary»" value="${U.esc(this.draft.raw || "")}"></label>
      ${msg ? `<p class="muted small">${msg}</p>` : `<p class="muted small">Su Goodreads: apri il libro → Condividi → Copia link. Poi incolla qui.</p>`}
      <button class="btn primary wide" type="submit">${Icon.svg("book", 16)} Cerca il libro</button>
      <button class="btn ghost wide" type="button" data-act="book-manual">Inserisci a mano</button>
    </form>`;
  },

  bindSearch(root) {
    const form = root.querySelector("#book-search");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = new FormData(form).get("q");
      const { goodreads, query } = this.parseInput(raw);
      this.draft = { ...this.draft, raw, goodreads, query };
      if (!query) return this.showForm({ title: "", author: "", pages: null, cover: "" }, "Da questo link non riesco a leggere il titolo: scrivilo tu.");
      Sheet.setBody(`<p class="muted center" style="padding:22px 0 12px">Cerco «${U.esc(query)}»…</p>
        <div class="btn-row center-row"><button class="btn ghost" data-act="book-manual">Non aspettare: inserisci a mano</button></div>`, "Cerco il libro");
      const token = (this.searchToken = (this.searchToken || 0) + 1);
      const { list, error } = await this.searchBooks(query);
      if (token !== this.searchToken || !Sheet.isOpen() || !this.draft) return;   // nel frattempo hai cambiato strada
      this.draft.results = list;
      this.draft.netError = error;
      this.showResults();
    });
  },

  showResults() {
    const { results: res, query, netError } = this.draft;
    const asIs = this.titleCase(query);
    const header = res.length
      ? `<p class="muted small" style="margin-bottom:10px">Scegli il tuo libro:</p>`
      : netError
        ? `<p style="margin-bottom:6px"><b>Non riesco a contattare i cataloghi dei libri.</b></p><p class="muted small" style="margin-bottom:12px">Controlla la connessione, oppure un blocco pubblicità/DNS che impedisce di raggiungere openlibrary.org e itunes.apple.com. Intanto puoi aggiungerlo lo stesso.</p>`
        : `<p style="margin-bottom:6px"><b>Nessun risultato per «${U.esc(query)}».</b></p><p class="muted small" style="margin-bottom:12px">Prova con titolo e autore insieme, oppure aggiungilo così com'è.</p>`;
    const list = res.length ? `<div class="book-results">${res.map((b, i) => `<button class="book-result" data-act="book-pick" data-i="${i}">
           ${b.cover ? `<img class="cover book" src="${U.esc(U.safeUrl(b.cover))}" alt="" referrerpolicy="no-referrer">` : `<i class="cover ph book"></i>`}
           <span><b>${U.esc(b.title)}</b><small>${U.esc(b.author || "Autore sconosciuto")}${b.pages ? ` · ${b.pages} pag.` : ""}</small></span></button>`).join("")}</div>` : "";
    Sheet.setBody(`${header}${list}
      <div class="btn-row">
        <button class="btn primary" data-act="book-manual" data-title="${U.esc(asIs)}">Aggiungi «${U.esc(asIs)}» così com'è</button>
        <button class="btn ghost" data-act="book-back">Cerca di nuovo</button>
      </div>`, res.length ? "Scegli il libro" : "Libro non trovato");
  },

  showForm(b, msg = "") {
    this.draft.pick = b;
    Sheet.setBody(`<form class="form" id="book-form">
      ${msg ? `<p class="muted small">${msg}</p>` : ""}
      <div class="book-pick">${b.cover ? `<img class="cover book lg" src="${U.esc(U.safeUrl(b.cover))}" alt="" referrerpolicy="no-referrer">` : ""}
        <div class="form" style="flex:1">
          <label>Titolo<input name="title" required maxlength="160" value="${U.esc(b.title)}"></label>
          <label>Autore<input name="author" maxlength="120" value="${U.esc(b.author || "")}"></label>
        </div></div>
      <div class="row2">
        <label>Pagine totali<input name="pages" type="number" min="1" max="5000" inputmode="numeric" value="${b.pages || ""}"></label>
        <label>A che pagina sei<input name="current" type="number" min="0" max="5000" inputmode="numeric" value="0"></label>
      </div>
      <div class="field"><span class="lbl">Stato</span>${UI.seg("status", [["reading", "Lo sto leggendo"], ["todo", "Da leggere"], ["done", "Già letto"]], "reading")}</div>
      <button class="btn primary wide" type="submit">Aggiungi il libro</button>
    </form>`, "Il tuo libro");
    const form = Sheet.el.querySelector("#book-form");
    UI.wire(form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const pages = Number(f.get("pages")) || null;
      const status = f.get("status");
      let current = U.clamp(Number(f.get("current")) || 0, 0, pages || 100000);
      if (status === "done" && pages) current = pages;
      const gr = this.draft && this.draft.goodreads;
      Store.insert("reading_items", {
        source: gr ? "goodreads" : "manual", external_id: null, kind: "book",
        title: f.get("title").trim(), author: (f.get("author") || "").trim() || null, pages, current_page: status === "todo" ? 0 : current,
        cover: b.cover || null, url: gr || null, goodreads_url: gr || null, status, done_at: status === "done" ? new Date().toISOString() : null
      });
      Sheet.close();
      U.toast(status === "reading" ? "Buona lettura!" : "Libro aggiunto");
    });
  },

  // ---------- avanzamento ----------
  // Messaggio quando finisci un libro: dice anche come avanzano gli obiettivi collegati
  finishedMsg(r) {
    let msg = "Libro finito! Bravo.";
    for (const g of Calc.activeGoals()) {
      const b = Calc.goalBooks(g);
      if (!b || !b.done.some((x) => x.id === r.id)) continue;
      msg += b.count >= b.target ? ` · «${g.title}»: obiettivo raggiunto!` : ` · «${g.title}»: ${b.count}/${b.target}`;
    }
    return msg;
  },

  setPage(id, page) {
    const r = Store.d.reading_items.find((x) => x.id === id);
    if (!r) return;
    const max = r.pages || 100000;
    page = U.clamp(Math.round(page), 0, max);
    if (r.pages && page >= r.pages) {
      Store.update("reading_items", id, { current_page: r.pages, status: "done", done_at: new Date().toISOString() });
      U.toast(this.finishedMsg(r));
    } else Store.update("reading_items", id, { current_page: page, status: page > 0 && r.status === "todo" ? "reading" : r.status });
  },

  openPage(id) {
    const r = Store.d.reading_items.find((x) => x.id === id);
    if (!r) return;
    Sheet.open({
      title: r.title,
      body: `<form class="form" id="page-form">
        <div class="row2">
          <label>Pagina attuale<input name="current" type="number" min="0" inputmode="numeric" autofocus value="${r.current_page || 0}"></label>
          <label>Pagine totali<input name="pages" type="number" min="1" inputmode="numeric" value="${r.pages || ""}"></label>
        </div>
        <button class="btn primary wide" type="submit">Salva</button></form>`,
      onMount: (root) => {
        const form = root.querySelector("form");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(form), pages = Number(f.get("pages")) || null;
          if (pages !== r.pages) Store.update("reading_items", id, { pages });
          Sheet.close();
          this.setPage(id, Number(f.get("current")) || 0);
        });
      }
    });
  },

  // Importa i nuovi bookmark da Raindrop tramite la Edge Function
  async sync() {
    if (this.syncing) return;
    if (DEMO) return U.toast("In modalità demo la sincronizzazione è disattivata");
    this.syncing = true; App.render();
    try {
      const cfg = Store.cfg();
      const { data, error } = await sb.functions.invoke("integrations", { body: { action: "raindrop_list", collectionId: cfg.raindropCollection || 0 } });
      if (error || !data || data.error) throw new Error((data && data.error) || (error && error.message) || "Errore sconosciuto");
      const known = new Set(Store.d.reading_items.filter((r) => r.source === "raindrop").map((r) => String(r.external_id)));
      let added = 0;
      for (const it of data.items) {
        if (known.has(String(it.id))) continue;
        Store.insert("reading_items", { source: "raindrop", kind: "link", external_id: String(it.id), title: it.title || U.domain(it.link), url: it.link, cover: it.cover || null, status: "todo", done_at: null });
        added++;
      }
      U.toast(added ? `${added} nuovi link da Raindrop` : "Raindrop è già allineato");
    } catch (e) {
      console.error(e);
      U.toast("Sincronizzazione non riuscita: controlla le impostazioni");
    }
    this.syncing = false; App.render();
  }
};

Actions["read-tab"] = (el) => { Reading.tab = el.dataset.id; App.render(); };
Actions["read-add"] = () => Reading.openAdd();
Actions["book-add"] = () => Reading.openBook();
Actions["book-manual"] = (el) => {
  Reading.draft = Reading.draft || {};
  Reading.searchToken = (Reading.searchToken || 0) + 1;   // annulla una ricerca ancora in corso
  Reading.showForm({ title: (el && el.dataset.title) || Reading.titleCase(Reading.draft.query || ""), author: "", pages: null, cover: "" });
};
Actions["book-back"] = () => { if (!Reading.draft) return; Sheet.setBody(Reading.stepSearchHTML(), "Aggiungi un libro"); Reading.bindSearch(Sheet.el); const i = Sheet.el.querySelector("input"); if (i) i.focus(); };
Actions["book-pick"] = (el) => { const b = Reading.draft && Reading.draft.results[Number(el.dataset.i)]; if (b) Reading.showForm(b); };
Actions["book-plus"] = (el) => { const r = Store.d.reading_items.find((x) => x.id === el.dataset.id); if (r) Reading.setPage(r.id, (r.current_page || 0) + Number(el.dataset.n || 10)); };
Actions["book-page"] = (el) => Reading.openPage(el.dataset.id);
Actions["read-sync"] = () => Reading.sync();
Actions["read-status"] = (el) => {
  const v = el.dataset.value, r = Store.d.reading_items.find((x) => x.id === el.dataset.id);
  if (!r) return;
  const patch = { status: v, done_at: v === "done" ? new Date().toISOString() : null };
  if (r.kind === "book" && r.pages) { if (v === "done") patch.current_page = r.pages; if (v === "todo") patch.current_page = 0; }
  Store.update("reading_items", r.id, patch);
  if (v === "done" && r.kind === "book") U.toast(Reading.finishedMsg(r));
};
Actions["read-delete"] = (el) => { if (confirm("Rimuovere dalla lista?")) Store.remove("reading_items", el.dataset.id); };
Actions["read-open"] = (el) => {
  const r = Store.d.reading_items.find((x) => x.id === el.dataset.id);
  if (r && r.status === "todo") Store.update("reading_items", r.id, { status: "reading" });
};
