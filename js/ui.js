// ============================================================
// Componenti UI condivisi: Sheet (finestra dal basso / dialogo su desktop),
// Tip (tooltip dei grafici), helper per i form.
// ============================================================
const Sheet = {
  el: null,
  onClose: null,

  open({ title = "", body = "", wide = false, onMount = null, onClose = null }) {
    this.close();
    const root = document.getElementById("sheet-root");
    root.innerHTML = `
      <div class="sheet-back" data-sheet-close></div>
      <section class="sheet ${wide ? "sheet-wide" : ""}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
        <div class="sheet-grab"></div>
        <header class="sheet-head"><h2>${U.esc(title)}</h2><button class="icon-btn" data-sheet-close aria-label="Chiudi">${Icon.svg("x", 20)}</button></header>
        <div class="sheet-body">${body}</div>
      </section>`;
    this.el = root.querySelector(".sheet");
    this.onClose = onClose;
    document.body.classList.add("sheet-open");
    requestAnimationFrame(() => root.classList.add("on"));
    if (onMount) onMount(this.el);
    const first = this.el.querySelector("[autofocus]");
    if (first && window.innerWidth >= 1024) first.focus();
    return this.el;
  },

  // Sostituisce solo il contenuto (per le schede di dettaglio)
  setBody(html, title) {
    if (!this.el) return;
    this.el.querySelector(".sheet-body").innerHTML = html;
    if (title != null) this.el.querySelector("h2").textContent = title;
  },

  close() {
    const root = document.getElementById("sheet-root");
    if (!this.el) return;
    root.classList.remove("on");
    document.body.classList.remove("sheet-open");
    const cb = this.onClose;
    this.el = null;
    this.onClose = null;
    root.innerHTML = "";
    if (cb) cb();
  },

  isOpen() { return !!this.el; }
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
  },
  hide() { this.el && this.el.classList.remove("on"); }
};

// ---- Helper HTML per i form -------------------------------------------------
const UI = {
  areaOptions(sel) {
    return Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${a.glyph}  ${a.label}</option>`).join("");
  },

  areaChip(area, small = false) {
    const a = AREAS[area] || AREAS.progetti;
    return `<span class="chip ${small ? "chip-sm" : ""}" style="background:${a.tint}"><i class="glyph" style="color:${a.color}">${a.glyph}</i>${a.label}</span>`;
  },

  glyph(area) {
    const a = AREAS[area] || AREAS.progetti;
    return `<i class="glyph big" style="background:${a.tint};color:${a.color}">${a.glyph}</i>`;
  },

  // Selettore a pillole: <div class="seg" data-seg="name">
  seg(name, options, current) {
    return `<div class="seg" data-seg="${name}">${options.map(([v, l]) =>
      `<button type="button" class="${String(v) === String(current) ? "on" : ""}" data-value="${v}">${l}</button>`).join("")}</div>
      <input type="hidden" name="${name}" value="${current}">`;
  },

  // Scala 1..5 a pallini
  scale(name, current, labels) {
    return `<div class="scale" data-scale="${name}">${[1, 2, 3, 4, 5].map((n) =>
      `<button type="button" class="${n === current ? "on" : ""}" data-value="${n}" aria-label="${labels ? labels[n - 1] : n}"><span>${n}</span></button>`).join("")}</div>
      <input type="hidden" name="${name}" value="${current || ""}">`;
  },

  empty(icon, title, text, action = "") {
    return `<div class="empty">${Icon.svg(icon, 30)}<h3>${title}</h3><p>${text}</p>${action}</div>`;
  },

  // Collega i selettori .seg e .scale dentro un contenitore agli input nascosti
  wire(root, onChange) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest(".seg button, .scale button");
      if (!b) return;
      const box = b.parentElement;
      box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      const name = box.dataset.seg || box.dataset.scale;
      const input = root.querySelector(`input[type=hidden][name="${name}"]`);
      if (input) input.value = b.dataset.value;
      if (onChange) onChange(name, b.dataset.value);
    });
  }
};

const MOOD_LABELS = ["Giù", "Così così", "Ok", "Bene", "Ottimo"];
const ENERGY_LABELS = ["Esausto", "Scarico", "Nella media", "Carico", "Al massimo"];

// Registro delle azioni dei pulsanti: <button data-act="nome" data-id="...">
// Ogni sezione aggiunge le sue con Actions.nome = (el, event) => {...}
const Actions = {};
