// ============================================================
// Componenti UI condivisi: Sheet (finestra dal basso / dialogo su desktop),
// Dialog (conferme e richieste, sopra a uno Sheet già aperto), Tip
// (tooltip dei grafici), helper per i form e accessibilità da tastiera.
// ============================================================

// Elementi che possono ricevere il focus dentro una finestra
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const A11y = {
  // Elementi visibili e attivabili con Tab dentro root
  focusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest("[hidden], .hidden") && el.getClientRects().length);
  },

  // Tab e Maiusc+Tab restano dentro root
  trap(root, e) {
    if (e.key !== "Tab") return;
    const list = this.focusables(root);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  },

  // Tastiera fisica / puntatore preciso: lì il focus su un campo non apre una tastiera a schermo
  finePointer() { return window.matchMedia && window.matchMedia("(pointer: fine)").matches; },

  // Mette inert su ciò che sta sotto una finestra modale
  setInert(els, on) { els.forEach((el) => { if (el) { if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); } }); },

  // inert sul guscio dell'app mentre uno Sheet è aperto (lettori di schermo e Tab non ci arrivano)
  inertShell(on) { this.setInert([document.getElementById("app-shell")], on); }
};

const Sheet = {
  el: null,
  onClose: null,
  opener: null,

  open({ title = "", body = "", wide = false, onMount = null, onClose = null }) {
    // Se una finestra ne sostituisce un'altra, il focus tornerà comunque a chi ha aperto la prima
    const opener = this.el ? this.opener : document.activeElement;
    this.close(true);
    this.opener = opener;
    const root = document.getElementById("sheet-root");
    root.innerHTML = `
      <div class="sheet-back" data-sheet-close></div>
      <section class="sheet ${wide ? "sheet-wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-grab"></div>
        <header class="sheet-head"><h2 id="sheet-title" tabindex="-1">${U.esc(title)}</h2><button class="icon-btn" data-sheet-close aria-label="Chiudi">${Icon.svg("x", 20)}</button></header>
        <div class="sheet-body">${body}</div>
      </section>`;
    this.el = root.querySelector(".sheet");
    this.onClose = onClose;
    document.body.classList.add("sheet-open");
    A11y.inertShell(true);
    this.el.addEventListener("keydown", (e) => A11y.trap(this.el, e));
    requestAnimationFrame(() => root.classList.add("on"));
    if (onMount) onMount(this.el);
    this.focusStart();
    return this.el;
  },

  // Focus iniziale: il campo con autofocus (solo con tastiera/mouse, per non aprire la tastiera
  // a schermo sul telefono), altrimenti il titolo della finestra
  focusStart() {
    if (!this.el) return;
    const first = this.el.querySelector("[autofocus]");
    const target = first && A11y.finePointer() ? first : this.el.querySelector("#sheet-title");
    try { target.focus({ preventScroll: true }); } catch { target.focus(); }
  },

  // Sostituisce solo il contenuto (per le schede di dettaglio). Il focus resta sullo stesso
  // pulsante (stessa azione e stesso id) se esiste ancora, altrimenti va al titolo.
  setBody(html, title) {
    if (!this.el) return;
    const a = document.activeElement;
    const inside = !!a && this.el.contains(a);
    const key = inside && a.dataset && a.dataset.act ? { ...a.dataset } : null;
    this.el.querySelector(".sheet-body").innerHTML = html;
    if (title != null) this.el.querySelector("#sheet-title").textContent = title;
    if (!inside || a.isConnected) return;
    let next = null;
    if (key) next = [...this.el.querySelectorAll(`[data-act="${CSS.escape(key.act)}"]`)].find((x) => x.dataset.id === key.id && x.dataset.dir === key.dir && x.dataset.date === key.date);
    if (next && next.matches(".heatmap [data-date]")) { next.ownerSVGElement.querySelectorAll('[tabindex="0"]').forEach((r) => r.setAttribute("tabindex", "-1")); next.setAttribute("tabindex", "0"); }
    (next || this.el.querySelector("#sheet-title")).focus({ preventScroll: true });
  },

  close(replacing = false) {
    const root = document.getElementById("sheet-root");
    if (!this.el) return;
    root.classList.remove("on");
    document.body.classList.remove("sheet-open");
    const cb = this.onClose, opener = this.opener;
    this.el = null;
    this.onClose = null;
    this.opener = null;
    root.innerHTML = "";
    if (!replacing) {
      A11y.inertShell(false);
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    }
    if (cb) cb();
  },

  isOpen() { return !!this.el; }
};

// ---- Dialog: conferma o breve testo, sopra a tutto (anche sopra uno Sheet aperto) ----
const Dialog = {
  open({ title, text = "", body = "", actions, onKey = null, init = null }) {
    return new Promise((resolve) => {
      const opener = document.activeElement;
      const root = document.createElement("div");
      root.className = "dialog-root";
      root.innerHTML = `<div class="sheet-back" data-dialog-cancel></div>
        <section class="sheet dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" ${text ? 'aria-describedby="dialog-text"' : ""}>
          <h2 id="dialog-title" tabindex="-1">${U.esc(title)}</h2>
          ${text ? `<p id="dialog-text" class="dialog-text">${U.esc(text)}</p>` : ""}
          ${body}
          <div class="btn-row dialog-actions">${actions}</div>
        </section>`;
      document.body.appendChild(root);
      const under = [document.getElementById("app-shell"), document.getElementById("sheet-root")];
      const wasInert = under.map((el) => el && el.hasAttribute("inert"));
      A11y.setInert(under, true);
      document.body.classList.add("sheet-open");
      const box = root.querySelector(".dialog");
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        window.removeEventListener("keydown", onKeydown, true);
        under.forEach((el, i) => { if (el && !wasInert[i]) el.removeAttribute("inert"); });
        if (!Sheet.isOpen()) document.body.classList.remove("sheet-open");
        root.remove();
        if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
        resolve(value);
      };
      // In cattura: l'Esc chiude solo questa finestra, non lo Sheet che sta sotto
      const onKeydown = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(onKey ? onKey("cancel") : false); return; }
        A11y.trap(box, e);
      };
      window.addEventListener("keydown", onKeydown, true);
      root.addEventListener("click", (e) => {
        e.stopPropagation();
        if (e.target.closest("[data-dialog-cancel]")) finish(onKey ? onKey("cancel") : false);
        else if (e.target.closest("[data-dialog-ok]")) finish(onKey ? onKey("ok") : true);
      });
      root.addEventListener("submit", (e) => { e.preventDefault(); finish(onKey ? onKey("ok") : true); });
      void root.offsetWidth;   // forza il primo stile, così la transizione parte
      root.classList.add("on");
      if (init) init(box);
      // Azioni distruttive: il focus parte da «Annulla», così un Invio di troppo non cancella nulla
      const first = box.querySelector("[autofocus]")
        || (box.querySelector(".danger-solid") ? box.querySelector("button[data-dialog-cancel]") : box.querySelector("[data-dialog-ok]"))
        || box.querySelector("#dialog-title");
      first.focus({ preventScroll: true });
    });
  }
};

const Tip = {
  el: null,
  init() {
    this.el = document.getElementById("tip");
    const show = (t, x, y) => {
      this.el.textContent = t.dataset.tip;
      this.el.classList.add("on");
      const r = this.el.getBoundingClientRect();
      const left = U.clamp(x - r.width / 2, 8, window.innerWidth - r.width - 8);
      const top = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
      this.el.style.left = left + "px";
      this.el.style.top = top + "px";
    };
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (t && e.pointerType === "mouse") show(t, e.clientX, e.clientY);
    });
    document.addEventListener("pointermove", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (t && e.pointerType === "mouse") show(t, e.clientX, e.clientY);
      else if (e.pointerType === "mouse") this.hide();
    });
    document.addEventListener("pointerdown", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (t && e.pointerType !== "mouse") {
        show(t, e.clientX, e.clientY);
        clearTimeout(this._t);
        this._t = setTimeout(() => this.hide(), 2500);
      } else this.hide();
    });
    // Da tastiera: il tooltip compare anche quando l'elemento riceve il focus, e lo descrive
    document.addEventListener("focusin", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (!t || !e.target.matches(":focus-visible")) return;
      const r = t.getBoundingClientRect();
      show(t, r.left + r.width / 2, r.top);
      if (!t.hasAttribute("aria-describedby")) { t.setAttribute("aria-describedby", "tip"); t.dataset.tipDesc = "1"; }
    });
    document.addEventListener("focusout", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (!t) return;
      this.hide();
      if (t.dataset.tipDesc) { t.removeAttribute("aria-describedby"); delete t.dataset.tipDesc; }
    });
  },
  hide() { this.el && this.el.classList.remove("on"); }
};

// ---- Tastiera e immagini: un solo gestore delegato per tutta l'app ----
(() => {
  // Elementi non nativi con role="button" e data-act: Invio e Spazio li attivano come un pulsante
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t || !t.matches || !t.matches('[role=button][data-act], [role=button][data-sheet-close]')) return;
    if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    e.preventDefault();
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  // Mappa di calore: una sola casella nel giro del Tab, le frecce si muovono tra i giorni
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches(".heatmap [data-date]")) return;
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = t.ownerSVGElement.querySelector(`[data-date="${U.addDays(t.dataset.date, step)}"]`);
    if (!next) return;
    t.setAttribute("tabindex", "-1");
    next.setAttribute("tabindex", "0");
    next.focus();
  });

  // Immagini che non si caricano (copertine): nessun onerror inline, compatibile con una CSP rigida.
  // data-fallback="remove" toglie l'immagine; altrimenti è la classe del segnaposto <i> che la sostituisce
  // (con il testo di data-initials, es. le iniziali del titolo).
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || img.dataset.fallback == null) return;
    if (img.dataset.fallback === "remove") return img.remove();
    const ph = document.createElement("i");
    ph.className = img.dataset.fallback;
    ph.setAttribute("aria-hidden", "true");
    ph.textContent = img.dataset.initials || "";
    img.replaceWith(ph);
  }, true);
})();

// ---- Helper HTML per i form -------------------------------------------------
const UI = {
  areaOptions(sel) {
    return Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${a.label}</option>`).join("");
  },

  // Il colore dell'area passa solo come variabile CSS (--a): sfondo e testo li decide il CSS, anche in tema scuro
  areaChip(area, small = false) {
    const a = AREAS[area] || AREAS.progetti;
    return `<span class="chip area-chip ${small ? "chip-sm" : ""}" style="--a:${a.color}"><i class="glyph">${Icon.svg(a.icon, 14)}</i>${a.label}</span>`;
  },

  glyph(area, big = true) {
    const a = AREAS[area] || AREAS.progetti;
    return `<i class="glyph area-glyph ${big ? "big" : ""}" style="--a:${a.color}" aria-hidden="true">${Icon.svg(a.icon, big ? 20 : 14)}</i>`;
  },

  // Scelta dell'area a pillole (al posto di un <select>): <div class="area-pick" data-area-pick="name">
  areaPicker(name, current, label = "Area") {
    const cur = AREAS[current] ? current : Object.keys(AREAS)[0];
    return `<div class="area-pick" role="radiogroup" aria-label="${U.esc(label)}" data-area-pick="${name}">${Object.entries(AREAS).map(([k, a]) =>
      `<button type="button" role="radio" aria-checked="${k === cur}" tabindex="${k === cur ? 0 : -1}" class="chip area-chip ${k === cur ? "on" : ""}" style="--a:${a.color}" data-value="${k}"><i class="glyph">${Icon.svg(a.icon, 14)}</i>${a.label}</button>`).join("")}</div>
      <input type="hidden" name="${name}" value="${cur}">`;
  },

  // Solo l'icona SVG di un'area (senza contenitore)
  areaIcon(area, size = 16) { return Icon.svg((AREAS[area] || AREAS.progetti).icon, size); },

  // Selettore a pillole: <div class="seg" data-seg="name">
  seg(name, options, current) {
    return `<div class="seg" data-seg="${name}">${options.map(([v, l]) =>
      `<button type="button" class="${String(v) === String(current) ? "on" : ""}" aria-pressed="${String(v) === String(current)}" data-value="${v}">${l}</button>`).join("")}</div>
      <input type="hidden" name="${name}" value="${current}">`;
  },

  // Scala 1..5 a pallini
  scale(name, current, labels) {
    return `<div class="scale" data-scale="${name}">${[1, 2, 3, 4, 5].map((n) =>
      `<button type="button" class="${n === current ? "on" : ""}" aria-pressed="${n === current}" data-value="${n}" aria-label="${labels ? `${n}: ${labels[n - 1]}` : n}"><span>${n}</span></button>`).join("")}</div>
      <input type="hidden" name="${name}" value="${current || ""}">`;
  },

  empty(icon, title, text, action = "") {
    return `<div class="empty">${Icon.svg(icon, 30)}<h3>${title}</h3><p>${text}</p>${action}</div>`;
  },

  // Collega i selettori .seg, .scale e .area-pick dentro un contenitore agli input nascosti
  wire(root, onChange) {
    const pick = (b) => {
      const box = b.parentElement;
      const radio = box.matches(".area-pick");
      box.querySelectorAll("button").forEach((x) => {
        const on = x === b;
        x.classList.toggle("on", on);
        if (radio) { x.setAttribute("aria-checked", on); x.tabIndex = on ? 0 : -1; }
        else x.setAttribute("aria-pressed", on);
      });
      const name = box.dataset.seg || box.dataset.scale || box.dataset.areaPick;
      const input = root.querySelector(`input[type=hidden][name="${name}"]`);
      if (input) input.value = b.dataset.value;
      if (onChange) onChange(name, b.dataset.value);
    };
    root.addEventListener("click", (e) => {
      const b = e.target.closest(".seg button, .scale button, .area-pick button");
      if (b && root.contains(b)) pick(b);
    });
    // Gruppo radio: le frecce cambiano scelta, come nei controlli nativi
    root.addEventListener("keydown", (e) => {
      const b = e.target.closest && e.target.closest(".area-pick button");
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!b || !dir) return;
      e.preventDefault();
      const all = [...b.parentElement.querySelectorAll("button")];
      const next = all[(all.indexOf(b) + dir + all.length) % all.length];
      pick(next);
      next.focus();
    });
  },

  // Finestra di conferma al posto di confirm(): restituisce una Promise<boolean>
  confirm({ title = "Sei sicuro?", text = "", confirmLabel = "Conferma", cancelLabel = "Annulla", danger = false } = {}) {
    return Dialog.open({
      title, text,
      actions: `<button type="button" class="btn ghost" data-dialog-cancel>${U.esc(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? "danger-solid" : "primary"}" data-dialog-ok>${U.esc(confirmLabel)}</button>`
    });
  },

  // Breve testo al posto di prompt(): Promise<string|null> (null = annullato)
  prompt({ title, label = "", value = "", confirmLabel = "Salva", placeholder = "", inputmode = "" } = {}) {
    let input = null;
    return Dialog.open({
      title,
      body: `<form class="form dialog-form"><label>${U.esc(label)}<input name="v" autofocus autocomplete="off" maxlength="120" value="${U.esc(value)}" placeholder="${U.esc(placeholder)}" ${inputmode ? `inputmode="${inputmode}"` : ""}></label></form>`,
      actions: `<button type="button" class="btn ghost" data-dialog-cancel>Annulla</button><button type="button" class="btn primary" data-dialog-ok>${U.esc(confirmLabel)}</button>`,
      init: (box) => { input = box.querySelector("input"); input.select(); },
      onKey: (k) => (k === "ok" ? input.value : null)
    });
  }
};

const MOOD_LABELS = ["Giù", "Così così", "Ok", "Bene", "Ottimo"];
const ENERGY_LABELS = ["Esausto", "Scarico", "Nella media", "Carico", "Al massimo"];

// Registro delle azioni dei pulsanti: <button data-act="nome" data-id="...">
// Ogni sezione aggiunge le sue con Actions.nome = (el, event) => {...}
const Actions = {};
