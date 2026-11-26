// ============================================================
// Widget della Home: lettura e riscoperte.
// Ogni widget: title, icon, sizes (formati ammessi), go (sezione che apre),
// mini() per cerchio e capsula, render(formato, opzioni) → { html }. Vedi js/home/kit.js.
// ============================================================
(() => {
  const { ic, esc, head, big, empty, cta, track } = HomeKit;
  Object.assign(HomeWidgets, {
    reading: {
      title: "Lettura", icon: "book", sizes: ["c", "p", "mh", "mv"], go: "reading",
      mini() {
        const r = Store.d.reading_items.filter((x) => x.kind === "book" && x.status === "reading").sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0];
        if (!r) return { icon: "book", title: "Sto leggendo", value: "—", cap: "Nessun libro in corso", p: null };
        const p = r.pages ? U.clamp((r.current_page || 0) / r.pages, 0, 1) : null;
        return { icon: "book", title: esc(r.title), value: p == null ? r.current_page || 0 : Math.round(p * 100), unit: p == null ? "pag." : "%", cap: esc(r.title), p };
      },
      render(sz) {
        const books = Store.d.reading_items.filter((r) => r.kind === "book" && r.status === "reading")
          .sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
        const r = books[0];
        if (!r) return { html: head("book", "Sto leggendo", "Nessun libro in corso") + `<div class="d-wb">${empty("Aggiungi il libro che stai leggendo e segna le pagine.", cta("Libro", "book-add"))}</div>` };
        const p = r.pages ? U.clamp(Math.round(((r.current_page || 0) / r.pages) * 100), 0, 100) : null;
        const url = r.cover ? U.safeUrl(r.cover) : "";
        const cover = url ? `<div class="d-cover img"><img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${esc(r.title)}</span></div>` : `<div class="d-cover"><span>${esc(r.title)}</span></div>`;
        const sub = p == null ? esc(r.author || "") : `${p}%${books.length > 1 ? ` · altri ${books.length - 1} in corso` : ""}`;
        return { html: head("book", "Sto leggendo", sub) + `<div class="d-wb"><div class="d-book ${sz === "mv" ? "col" : ""}">${cover}<div class="d-info"><b>${esc(r.title)}</b><span class="d-muted">${esc(r.author || "Autore sconosciuto")}</span>${p != null ? `${track(p)}<span class="d-cap tnum">Pagina ${r.current_page || 0} di ${r.pages}</span>` : `<span class="d-cap">Pagine totali da aggiungere</span>`}</div></div></div>` };
      }
    },
    recall: {
      title: "Da ricordare", icon: "quote", sizes: ["mh", "lh"], go: "recall",
      render(sz) {
        if (typeof Recall === "undefined" || !Recall.all().length) return { html: head("quote", "Da ricordare", "Nessuna evidenziazione") + `<div class="d-wb">${empty("Sincronizza il second brain per ritrovare qui le tue sottolineature.", `<button type="button" class="d-btn deep sm" data-act="go" data-id="recall">Riscoperte</button>`)}</div>` };
        const r = Recall.daily();
        const items = r.ids.map((id) => Recall.find(id)).filter(Boolean);
        const next = items.find((h) => !r.done.includes(h.id));
        if (!next) return { html: head("quote", "Da ricordare", items.length ? `${items.length} su ${items.length} di oggi` : "Niente per oggi") + `<div class="d-wb center-v">${empty(items.length ? "Riscoperte di oggi completate: a domani." : "Nessuna evidenziazione adatta per oggi.")}</div>` };
        const done = items.length - items.filter((h) => !r.done.includes(h.id)).length;
        const src = [next.source_title, Recall.cite(next)].filter(Boolean).join(" · ");
        const long = next.text.length > (sz === "lh" ? 260 : 150);
        return { html: head("quote", "Da ricordare", esc(src)) + `<div class="d-wb center-v" style="gap:14px"><p class="d-quote ${long ? "clamp" : ""}">«${esc(next.text)}»</p>${sz === "lh" ? `<div class="d-acts"><button class="d-btn deep" type="button" data-act="quote-review" data-id="${next.id}">${ic("check", 15, 2.4)}Ricordo</button><span class="d-cap">${done}/${items.length} di oggi</span></div>` : ""}</div>` };
      }
    },
    toRead: {
      title: "Da leggere", icon: "link", sizes: ["c", "s", "p"], go: "reading",
      list() { return Store.d.reading_items.filter((r) => r.kind !== "book" && r.status !== "done").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")); },
      mini() {
        const l = this.list();
        return { icon: "link", title: "Da leggere", value: l.length, unit: "link", cap: l[0] ? esc(l[0].title || l[0].url || "") : "Lista vuota", p: null, action: `<button type="button" class="d-cbtn" data-act="read-add" aria-label="Aggiungi da leggere">${ic("plus", 15, 2.4)}</button>` };
      },
      render() {
        const l = this.list();
        return { html: head("link", "Da leggere", l.length ? "Il più recente" : "") + `<div class="d-wb end">${big(l.length, "link")}<span class="d-cap d-clamp">${l[0] ? esc(l[0].title || l[0].url || "") : "Niente in coda"}</span></div>` };
      }
    },
  });
})();
