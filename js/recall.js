// ============================================================
// Riscoperte: le evidenziazioni del tuo second brain (Kindle, Raindrop,
// note) ripescate ogni giorno, stile Readwise. I contenuti arrivano da
// scripts/sync_second_brain.py; qui si ripassano, si segnano come
// preferite o si silenziano. Rivedere un'evidenziazione dà XP.
// ============================================================
const Recall = {
  tab: "today",       // today | library
  filter: "all",      // all | fav | libro | articolo | video
  q: "",
  limit: 30,
  _persisting: false,
  MIN_LEN: 30,        // sotto questa lunghezza (es. il nome di un canale) non viene proposta

  all() { return Store.d.highlights || []; },
  eligible(h) { return !h.muted && h.text.length >= this.MIN_LEN; },

  hashSeed(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; },

  // Estrazione pesata: più peso a preferite e a quelle riviste meno; poco peso
  // a quelle rivedute da poco; al massimo 2 dalla stessa fonte (variando le fonti).
  pick(n, date, exclude = []) {
    const rnd = U.rng(this.hashSeed(date + "|" + exclude.length));
    const items = this.all().filter((h) => this.eligible(h) && !exclude.includes(h.id)).map((h) => {
      let w = (h.favorite ? 2 : 1) / (1 + (h.times_reviewed || 0));
      if (h.last_reviewed_on && U.diffDays(h.last_reviewed_on, date) < 10) w *= 0.05;
      return { h, w };
    });
    const chosen = [], perSource = {};
    while (chosen.length < n && items.length) {
      const total = U.sum(items.map((x) => x.w));
      let r = rnd() * total, idx = 0;
      for (; idx < items.length - 1; idx++) { r -= items[idx].w; if (r <= 0) break; }
      const it = items.splice(idx, 1)[0];
      const k = it.h.source_title;
      if ((perSource[k] || 0) >= 2 && items.some((x) => (perSource[x.h.source_title] || 0) < 2)) continue;
      perSource[k] = (perSource[k] || 0) + 1;
      chosen.push(it.h.id);
    }
    return chosen;
  },

  // Il set del giorno: scelto una volta e poi fissato, così non cambia ad ogni apertura
  daily() {
    const today = U.today(), stored = Store.settings.review;
    const exists = (id) => this.all().some((h) => h.id === id);
    if (stored && stored.date === today && (stored.ids.length || !this.all().some((h) => this.eligible(h)))) {
      return { ...stored, ids: stored.ids.filter(exists) };
    }
    const fresh = { date: today, ids: this.pick(Store.cfg().recallPerDay, today), done: [] };
    if (fresh.ids.length && !this._persisting) {
      this._persisting = true;
      setTimeout(() => { Store.setSettings({ review: fresh }); this._persisting = false; }, 0);
    }
    return fresh;
  },

  find(id) { return this.all().find((h) => h.id === id); },

  // ---------- azioni ----------
  review(id) {
    const h = this.find(id), r = this.daily();
    if (!h || r.done.includes(id)) return;
    Store.update("highlights", id, { times_reviewed: (h.times_reviewed || 0) + 1, last_reviewed_on: U.today() });
    Store.setSettings({ review: { ...r, done: [...r.done, id] } });
  },
  favorite(id) { const h = this.find(id); if (h) Store.update("highlights", id, { favorite: !h.favorite }); },
  mute(id) {
    if (!confirm("Non riproporre più questa evidenziazione? Resta comunque in libreria.")) return;
    Store.update("highlights", id, { muted: true });
    U.toast("Non verrà più riproposta");
  },
  unmute(id) { Store.update("highlights", id, { muted: false }); },
  more() {
    const r = this.daily(), extra = this.pick(3, U.today(), r.ids);
    if (!extra.length) return U.toast("Non ci sono altre evidenziazioni da proporre");
    Store.setSettings({ review: { ...r, ids: [...r.ids, ...extra] } });
  },

  // ---------- HTML ----------
  cite(h) {
    const parts = [h.source_author, h.location && !/^\w+ \d{1,2} \w+ \d{4}/.test(h.location) ? h.location : null].filter(Boolean);
    return parts.join(" · ");
  },

  card(h, { review = false, done = false } = {}) {
    const url = U.safeUrl(h.source_url);
    const long = h.text.length > 360;
    return `<article class="quote ${done ? "done" : ""} ${h.muted ? "muted-q" : ""}" data-qid="${h.id}">
      <blockquote class="${long ? "clamp" : ""}">${U.esc(h.text)}</blockquote>
      ${long ? `<button class="link sm-link" data-act="quote-expand">Leggi tutto</button>` : ""}
      ${h.note ? `<p class="q-note">${Icon.svg("edit", 13)} ${U.esc(h.note)}</p>` : ""}
      <footer>
        <div class="q-src"><b>${U.esc(h.source_title)}</b><span>${U.esc(this.cite(h))}</span></div>
        <div class="q-act">
          <button class="icon-btn sm ${h.favorite ? "fav" : ""}" data-act="quote-fav" data-id="${h.id}" aria-label="${h.favorite ? "Togli dalle preferite" : "Aggiungi alle preferite"}" data-tip="Preferita">${Icon.svg("star", 18)}</button>
          ${url ? `<a class="icon-btn sm" href="${U.esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Apri la fonte" data-tip="Apri la fonte">${Icon.svg("external", 17)}</a>` : ""}
          <button class="icon-btn sm" data-act="quote-copy" data-id="${h.id}" aria-label="Copia" data-tip="Copia">${Icon.svg("copy", 17)}</button>
          ${h.muted ? `<button class="btn ghost sm" data-act="quote-unmute" data-id="${h.id}">Riproponi</button>`
            : `<button class="icon-btn sm" data-act="quote-mute" data-id="${h.id}" aria-label="Non riproporre" data-tip="Non riproporre">${Icon.svg("eyeoff", 17)}</button>`}
          ${review ? (done ? `<span class="q-done">${Icon.svg("check", 15)} Ricordo</span>` : `<button class="btn primary sm" data-act="quote-review" data-id="${h.id}">${Icon.svg("check", 15)} Ricordo</button>`) : ""}
        </div>
      </footer>
    </article>`;
  },

  empty() {
    return UI.empty("quote", "Ancora nessuna evidenziazione",
      "Sincronizza il tuo second brain: lo script legge i file .md e le porta qui. Vedi il README (sezione «Second brain»).");
  },

  // Riquadro compatto per la home
  miniHTML() {
    const all = this.all();
    if (!all.length) return `<div class="card">${this.empty()}</div>`;
    const r = this.daily();
    const items = r.ids.map((id) => this.find(id)).filter(Boolean);
    const next = items.find((h) => !r.done.includes(h.id));
    const doneN = items.filter((h) => r.done.includes(h.id)).length;
    if (!items.length) return `<div class="card"><p class="muted small">Nessuna evidenziazione adatta per oggi.</p></div>`;
    if (!next) return `<div class="card recall-done">${Icon.svg("check", 22)}<div><b>Riscoperte di oggi completate</b><p class="muted small">${items.length} su ${items.length} · a domani con nuove sottolineature.</p></div></div>`;
    return `${this.card(next, { review: true })}
      <p class="muted small q-progress">${doneN}/${items.length} di oggi</p>`;
  },

  libraryList() {
    const q = this.q.trim().toLowerCase();
    let list = this.all().filter((h) => {
      if (this.filter === "fav" && !h.favorite) return false;
      if (["libro", "articolo", "video"].includes(this.filter) && h.source_kind !== this.filter) return false;
      if (q && !`${h.text} ${h.source_title} ${h.source_author || ""} ${h.note || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => (b.highlighted_at || b.created_at).localeCompare(a.highlighted_at || a.created_at));
    const shown = list.slice(0, this.limit);
    return `<p class="muted small">${list.length} ${list.length === 1 ? "risultato" : "risultati"}</p>
      <div class="quote-list">${shown.map((h) => this.card(h)).join("") || `<p class="muted">Niente da mostrare.</p>`}</div>
      ${list.length > shown.length ? `<button class="btn ghost wide" data-act="quote-more-lib">Mostra altre ${Math.min(30, list.length - shown.length)}</button>` : ""}`;
  },

  render(el) {
    const all = this.all();
    const sources = new Set(all.map((h) => h.source_title)).size;
    const r = this.daily();
    const items = r.ids.map((id) => this.find(id)).filter(Boolean);
    const doneN = items.filter((h) => r.done.includes(h.id)).length;
    const reviewed = U.sum(all.map((h) => h.times_reviewed || 0));
    const favs = all.filter((h) => h.favorite).length;

    let body;
    if (!all.length) body = `<div class="card">${this.empty()}</div>`;
    else if (this.tab === "today") {
      const allDone = items.length && doneN === items.length;
      body = `${allDone ? `<div class="card recall-done big">${Icon.svg("check", 26)}<div><b>Fatto per oggi</b><p class="muted small">Hai ripassato ${doneN} evidenziazioni. Ogni ripasso vale +${Game.CFG.xpReview} XP.</p></div></div>` : ""}
        <div class="quote-list">${items.map((h) => this.card(h, { review: true, done: r.done.includes(h.id) })).join("")}</div>
        <div class="btn-row"><button class="btn ghost" data-act="quote-more">${Icon.svg("plus", 16)} Altre 3 per oggi</button></div>`;
    } else {
      body = `<div class="lib-tools">
          <input type="search" placeholder="Cerca in testo, libro, autore…" value="${U.esc(this.q)}" data-act-input="recall-search" aria-label="Cerca">
          <div class="chips-row filters">${[["all", "Tutte"], ["fav", "★ Preferite"], ["libro", "Libri"], ["articolo", "Articoli"], ["video", "Video"]].map(([k, l]) =>
            `<button class="pill ${this.filter === k ? "on" : ""}" data-act="recall-filter" data-id="${k}">${l}</button>`).join("")}</div>
        </div><div id="lib-list">${this.libraryList()}</div>`;
    }

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">再読 · Riscoperte</p><h1 class="title">Le tue <em>sottolineature</em></h1>
          <p class="sub">${all.length} evidenziazioni da ${sources} fonti · ${favs} preferite · ${reviewed} ripassi</p></div>
      </div>
      ${all.length ? `<div class="seg tabs2">
        <button class="${this.tab === "today" ? "on" : ""}" data-act="recall-tab" data-id="today">Oggi<small>${doneN}/${items.length}</small></button>
        <button class="${this.tab === "library" ? "on" : ""}" data-act="recall-tab" data-id="library">Libreria<small>${all.length}</small></button>
      </div>` : ""}
      ${body}`;
  }
};

Actions["recall-tab"] = (el) => { Recall.tab = el.dataset.id; App.render(); };
Actions["recall-filter"] = (el) => { Recall.filter = el.dataset.id; Recall.limit = 30; App.render(); };
Actions["recall-search"] = (el) => {
  Recall.q = el.value; Recall.limit = 30;
  const list = document.getElementById("lib-list");
  if (list) list.innerHTML = Recall.libraryList();
};
Actions["quote-more-lib"] = () => { Recall.limit += 30; const l = document.getElementById("lib-list"); if (l) l.innerHTML = Recall.libraryList(); };
Actions["quote-review"] = (el) => Recall.review(el.dataset.id);
Actions["quote-fav"] = (el) => Recall.favorite(el.dataset.id);
Actions["quote-mute"] = (el) => Recall.mute(el.dataset.id);
Actions["quote-unmute"] = (el) => Recall.unmute(el.dataset.id);
Actions["quote-more"] = () => Recall.more();
Actions["quote-expand"] = (el) => {
  const bq = el.closest(".quote").querySelector("blockquote");
  bq.classList.toggle("clamp");
  el.textContent = bq.classList.contains("clamp") ? "Leggi tutto" : "Riduci";
};
Actions["quote-copy"] = async (el) => {
  const h = Recall.find(el.dataset.id);
  if (!h) return;
  const txt = `“${h.text}” — ${h.source_title}${h.source_author ? ", " + h.source_author : ""}`;
  try { await navigator.clipboard.writeText(txt); U.toast("Copiata negli appunti"); } catch { U.toast("Copia non riuscita"); }
};
