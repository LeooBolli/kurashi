// ============================================================
// Lettura: bookmark di Raindrop.io (sincronizzati) + link manuali
// ============================================================
const Reading = {
  tab: "todo",
  syncing: false,

  cover(r) {
    return r.cover ? `<img class="cover" src="${U.esc(U.safeUrl(r.cover))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'cover ph'}))">` : `<i class="cover ph"></i>`;
  },

  rowHTML(r, compact = false) {
    const url = U.safeUrl(r.url);
    return `<div class="read-row">
      ${this.cover(r)}
      <div class="read-main">
        <h3>${url ? `<a href="${U.esc(url)}" target="_blank" rel="noopener noreferrer" data-act="read-open" data-id="${r.id}">${U.esc(r.title)}</a>` : U.esc(r.title)}</h3>
        <p class="muted small">${U.esc(U.domain(r.url) || "manuale")}${r.source === "raindrop" ? " · Raindrop" : ""}${r.status === "reading" ? " · in corso" : ""}</p>
      </div>
      ${compact ? "" : `<div class="read-act">
        ${r.status === "todo" ? `<button class="btn ghost sm" data-act="read-status" data-id="${r.id}" data-value="reading">Inizia</button>` : ""}
        ${r.status !== "done" ? `<button class="btn ghost sm" data-act="read-status" data-id="${r.id}" data-value="done">${Icon.svg("check", 14)} Letto</button>` : `<button class="btn ghost sm" data-act="read-status" data-id="${r.id}" data-value="todo">Rimetti in coda</button>`}
        <button class="icon-btn sm" data-act="read-delete" data-id="${r.id}" aria-label="Elimina">${Icon.svg("x", 16)}</button>
      </div>`}
    </div>`;
  },

  render(el) {
    const items = Store.d.reading_items;
    const counts = { todo: 0, reading: 0, done: 0 };
    items.forEach((r) => counts[r.status]++);
    const list = items.filter((r) => this.tab === "todo" ? r.status !== "done" : r.status === "done")
      .sort((a, b) => this.tab === "todo"
        ? (a.status === "reading" ? -1 : 1) - (b.status === "reading" ? -1 : 1) || b.created_at.localeCompare(a.created_at)
        : (b.done_at || "").localeCompare(a.done_at || ""));
    const monthStart = U.today().slice(0, 8) + "01";
    const doneMonth = items.filter((r) => r.status === "done" && r.done_at && U.dateOf(r.done_at) >= monthStart).length;
    const cfg = Store.cfg();

    el.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">読書 · Lettura</p><h1 class="title">Da <em>leggere</em></h1>
          <p class="sub">${doneMonth} letti questo mese · ${counts.todo + counts.reading} in coda</p></div>
        <div class="btn-row nowrap">
          <button class="btn ghost" data-act="read-sync" ${this.syncing ? "disabled" : ""}>${Icon.svg("sync", 16, this.syncing ? "spin" : "")}<span>${this.syncing ? "Sincronizzo…" : "Raindrop"}</span></button>
          <button class="btn primary" data-act="read-add">${Icon.svg("plus", 18)}<span>Link</span></button>
        </div>
      </div>
      <div class="seg tabs2">
        <button class="${this.tab === "todo" ? "on" : ""}" data-act="read-tab" data-id="todo">Da leggere<small>${counts.todo + counts.reading}</small></button>
        <button class="${this.tab === "done" ? "on" : ""}" data-act="read-tab" data-id="done">Letti<small>${counts.done}</small></button>
      </div>
      ${list.length ? `<div class="card stack">${list.map((r) => this.rowHTML(r)).join("")}</div>`
        : UI.empty("book", this.tab === "todo" ? "Nessuna lettura in coda" : "Ancora niente di letto",
          this.tab === "todo" ? `Salva link su Raindrop e sincronizza, oppure aggiungine uno a mano.${cfg ? "" : ""}` : "Quando finisci qualcosa, segnalo come letto.",
          this.tab === "todo" ? `<button class="btn primary" data-act="read-add">Aggiungi un link</button>` : "")}`;
  },

  openAdd() {
    Sheet.open({
      title: "Aggiungi da leggere",
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
          Store.insert("reading_items", { source: "manual", external_id: null, title: (f.get("title") || "").trim() || U.domain(url), url, cover: null, status: "todo", done_at: null });
          Sheet.close(); U.toast("Aggiunto alla lista");
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
        Store.insert("reading_items", { source: "raindrop", external_id: String(it.id), title: it.title || U.domain(it.link), url: it.link, cover: it.cover || null, status: "todo", done_at: null });
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
Actions["read-sync"] = () => Reading.sync();
Actions["read-status"] = (el) => {
  const v = el.dataset.value;
  Store.update("reading_items", el.dataset.id, { status: v, done_at: v === "done" ? new Date().toISOString() : null });
};
Actions["read-delete"] = (el) => { if (confirm("Rimuovere dalla lista?")) Store.remove("reading_items", el.dataset.id); };
Actions["read-open"] = (el) => {
  const r = Store.d.reading_items.find((x) => x.id === el.dataset.id);
  if (r && r.status === "todo") Store.update("reading_items", r.id, { status: "reading" });
};
