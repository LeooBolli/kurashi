// ============================================================
// Cornice dell'app: aspetto (palette, vetro, luminosità, sfondo),
// tema chiaro/scuro, tacca della barra laterale sulla voce attiva,
// testata con saluto, promemoria, ora, meteo e sessione di focus.
// L'aspetto si salva nelle impostazioni (uguale su ogni dispositivo)
// e in una copia locale, così all'avvio non c'è il lampo dei colori vecchi.
// ============================================================
const Shell = {
  LOOK_KEY: "kurashi-look",
  THEME_KEY: "kurashi-theme",
  LOCAL_PHOTOS_KEY: "kurashi-bg-local",
  WEATHER_KEY: "kurashi-weather",
  BUCKET: "kurashi-backgrounds",

  PALETTES: {
    kurashi: { name: "Kurashi classico", side: "#6B98C8", sideIc: "#FFE0C7", navy: "#34689F", deep: "#34689F", hot: "#E8792F", accent: "#F08A48", sky: "#6F9BCF" },
    notte: { name: "Notte e albicocca", side: "#6683A8", sideIc: "#FFE2CC", navy: "#2C4A6E", deep: "#2C4A6E", hot: "#F08A48", accent: "#F4A06A", sky: "#7896BA" },
    ceruleo: { name: "Ceruleo e mandarino", side: "#76A6D8", sideIc: "#FFE4CC", navy: "#3471AE", deep: "#3471AE", hot: "#F28C3B", accent: "#F5A25E", sky: "#78A7DA" },
    indaco: { name: "Indaco e corallo", side: "#7489C0", sideIc: "#FFDCD2", navy: "#3D5A99", deep: "#3D5A99", hot: "#E9765B", accent: "#EF907A", sky: "#8396C8" },
    petrolio: { name: "Petrolio e arancio bruciato", side: "#6596A1", sideIc: "#FFE0C6", navy: "#2F6470", deep: "#2F6470", hot: "#D9732F", accent: "#E58E52", sky: "#6E9DA7" },
    ardesia: { name: "Ardesia e pesca", side: "#7F97B2", sideIc: "#FFE6D3", navy: "#4A6380", deep: "#4A6380", hot: "#EE9A63", accent: "#F2AE80", sky: "#8399B3" },
    // Arancio come colore principale: barra, widget pieni e pulsanti arancio; il blu passa ad accento
    arancio: { name: "Arancio Kurashi", side: "#E8853F", sideIc: "#FFF1E2", navy: "#C9632B", deep: "#BF5A22", hot: "#F2A65A", accent: "#6F9BCF", sky: "#F6C09B" },
    mandarino: { name: "Mandarino e notte", side: "#F08A48", sideIc: "#FFF1E4", navy: "#2C3E5C", deep: "#2C3E5C", hot: "#F08A48", accent: "#F4A06A", sky: "#8FA6C4" },
    terracotta: { name: "Terracotta e salvia", side: "#C97B5A", sideIc: "#FFEBDD", navy: "#A65A3C", deep: "#A65A3C", hot: "#7FA58C", accent: "#8DB39A", sky: "#E0A788" },
    lavanda: { name: "Lavanda e pesca", side: "#8A86C8", sideIc: "#FFE5D4", navy: "#5B57A0", deep: "#5B57A0", hot: "#F08A48", accent: "#F4A986", sky: "#A9A6DB" },
    bosco: { name: "Bosco e albicocca", side: "#6E9C86", sideIc: "#FFE6CF", navy: "#3E6E5A", deep: "#3E6E5A", hot: "#E8853F", accent: "#F2A65A", sky: "#8FB8A4" }
  },

  look: { pal: "kurashi", ga: 72, dim: 0, bg: "morbido" },
  cache: {},          // sfondi generati (data URL)
  signed: {},         // foto su Supabase: path -> { url, exp }
  notch: null,

  // ---------- Avvio: prima del login (tema e aspetto dalla copia locale) ----------
  boot() {
    const t = this.read(this.THEME_KEY);
    if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
    const saved = this.readJSON(this.LOOK_KEY);
    if (saved) this.look = { ...this.look, ...saved };
    this.applyLook();
    this.applyBg();
    document.getElementById("theme-btn")?.addEventListener("click", () => this.toggleTheme());
    new ResizeObserver(() => this.placeNotch(false)).observe(document.querySelector(".sidebar"));
    document.fonts?.ready.then(() => this.placeNotch(false));
    setInterval(() => this.tick(), 1000);
  },

  // ---------- Dopo il caricamento dei dati ----------
  ready() {
    const cfg = Store.cfg();
    if (cfg.look) { this.look = { ...this.look, ...cfg.look }; this.write(this.LOOK_KEY, JSON.stringify(this.look)); this.applyLook(); this.applyBg(); }
    this.loadWeather();
    setInterval(() => this.loadWeather(), 30 * 60 * 1000);
  },

  // ---------- Utilità di archiviazione (possono fallire: navigazione privata) ----------
  read(k) { try { return localStorage.getItem(k); } catch { return null; } },
  readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  write(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },

  // ---------- Tema ----------
  isDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  },
  toggleTheme() {
    const next = this.isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    this.write(this.THEME_KEY, next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0F131A" : "#F6F2EA");
  },

  // ---------- Palette, vetro, luminosità ----------
  applyLook() {
    const p = this.PALETTES[this.look.pal] || this.PALETTES.kurashi, st = document.documentElement.style;
    st.setProperty("--side", p.side); st.setProperty("--side-ic", p.sideIc); st.setProperty("--navy", p.navy);
    st.setProperty("--deep", p.deep); st.setProperty("--hot", p.hot); st.setProperty("--accent", p.accent); st.setProperty("--sky", p.sky);
    st.setProperty("--ga", (this.look.ga ?? 72) + "%");
    st.setProperty("--dim", (this.look.dim || 0) / 100);
    document.documentElement.classList.toggle("dimmed", (this.look.dim || 0) >= 30);
  },
  saveLook() {
    this.write(this.LOOK_KEY, JSON.stringify(this.look));
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => Store.setSettings({ look: { ...this.look } }), 600);
  },

  // ---------- Sfondi: due "morbidi" a colori (chiaro e scuro) e due paesaggi in bianco e nero ----------
  grain(x, w, h, amt) {
    const im = x.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(im, 0, 0);
  },
  mesh(base, blobs) {
    const c = document.createElement("canvas"); c.width = 1600; c.height = 1000;
    const x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 1600, 1000);
    for (const [cx, cy, r, rgb, a] of blobs) {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(.6, `rgba(${rgb},${a * .45})`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, 1600, 1000);
    }
    this.grain(x, 1600, 1000, 7);
    return c.toDataURL("image/jpeg", .9);
  },
  landscape(kind) {
    const c = document.createElement("canvas"); c.width = 1600; c.height = 1000;
    const x = c.getContext("2d");
    let seed = kind === "dune" ? 7 : 19; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (kind === "dune") {
      const sky = x.createLinearGradient(0, 0, 0, 560); sky.addColorStop(0, "#7d7d7d"); sky.addColorStop(1, "#d9d9d9");
      x.fillStyle = sky; x.fillRect(0, 0, 1600, 560);
      for (let i = 0; i < 40; i++) { const cx = rnd() * 1600, cy = rnd() * 380, r = 80 + rnd() * 220, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(245,245,245,${.18 + rnd() * .25})`); g.addColorStop(1, "rgba(245,245,245,0)"); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
      const hill = (pts, top, bot) => { x.beginPath(); x.moveTo(pts[0][0], 620); pts.forEach(([a, b]) => x.lineTo(a, b)); x.lineTo(pts[pts.length - 1][0], 620); x.closePath(); const g = x.createLinearGradient(0, 260, 0, 620); g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fill(); };
      hill([[0, 330], [180, 300], [420, 380], [640, 470], [820, 540], [900, 560]], "#3c3c3c", "#7a7a7a");
      hill([[700, 560], [1000, 470], [1250, 400], [1450, 360], [1600, 340]], "#4a4a4a", "#8c8c8c");
      hill([[0, 470], [300, 430], [560, 500], [760, 560]], "#262626", "#5e5e5e");
      const gr = x.createLinearGradient(0, 560, 0, 1000); gr.addColorStop(0, "#d6d6d6"); gr.addColorStop(.25, "#f1f1f1"); gr.addColorStop(1, "#fafafa");
      x.fillStyle = gr; x.fillRect(0, 560, 1600, 440);
      x.strokeStyle = "rgba(90,90,90,.22)"; x.lineWidth = 1.2;
      for (let i = 0; i < 900; i++) { let px = rnd() * 1600, py = 600 + rnd() * 400; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (rnd() - .5) * 60; py += (rnd() - .5) * 14; x.lineTo(px, py); } x.stroke(); }
    } else {
      const sky = x.createLinearGradient(0, 0, 0, 1000); sky.addColorStop(0, "#6f6f6f"); sky.addColorStop(.5, "#dcdcdc"); sky.addColorStop(1, "#bdbdbd");
      x.fillStyle = sky; x.fillRect(0, 0, 1600, 1000);
      [[430, 220, "#4b4b4b", "#a9a9a9"], [540, 160, "#2d2d2d", "#8f8f8f"], [690, 90, "#8b8b8b", "#d0d0d0"], [860, 30, "#c4c4c4", "#f4f4f4"]].forEach(([base, amp, c1, c2], li) => {
        const ph = [rnd() * 6, rnd() * 6];
        x.beginPath(); x.moveTo(0, 1000);
        for (let px = 0; px <= 1600; px += 8) { const t = px / 1600; const y = li < 2 ? 1 - Math.abs(Math.sin(t * 4 + ph[0])) * 1.2 - Math.abs(Math.sin(t * 11 + ph[1])) * .35 : Math.sin(t * 3 + ph[0]) * .6 + Math.sin(t * 7 + ph[1]) * .3; x.lineTo(px, base - y * amp); }
        x.lineTo(1600, 1000); x.closePath();
        const g = x.createLinearGradient(0, base - amp, 0, 1000); g.addColorStop(0, c2); g.addColorStop(.4, c1); g.addColorStop(1, c2);
        x.fillStyle = g; x.fill();
      });
    }
    this.grain(x, 1600, 1000, 14);
    return c.toDataURL("image/jpeg", .85);
  },
  SCENES: {
    morbido: { name: "Morbido",
      l: (s) => s.mesh("#F4EFE7", [[220, 160, 620, "169,199,230", .95], [1380, 140, 560, "246,192,155", .9], [860, 640, 640, "214,229,243", .9], [1480, 880, 520, "240,138,72", .55], [120, 920, 560, "63,124,191", .45], [720, 220, 360, "249,214,188", .8], [1100, 480, 300, "255,253,249", .9]]),
      d: (s) => s.mesh("#0F131B", [[220, 160, 640, "52,104,159", .55], [1380, 160, 560, "232,121,47", .28], [860, 640, 640, "40,64,100", .6], [1480, 880, 520, "232,121,47", .22], [120, 920, 560, "63,124,191", .35]]) },
    alba: { name: "Alba",
      l: (s) => s.mesh("#F7EFE6", [[300, 120, 620, "255,214,186", .95], [1300, 200, 620, "240,138,72", .5], [800, 700, 700, "255,236,220", .95], [100, 800, 520, "169,199,230", .7], [1500, 900, 500, "246,192,155", .8]]),
      d: (s) => s.mesh("#14121A", [[300, 120, 620, "232,121,47", .35], [1300, 200, 620, "150,70,40", .4], [800, 700, 700, "52,104,159", .35], [1500, 900, 500, "232,121,47", .2]]) },
    dune: { name: "Dune", photo: true, l: (s) => s.landscape("dune") },
    monti: { name: "Montagne", photo: true, l: (s) => s.landscape("monti") }
  },
  sceneSrc(k, v) { return this.cache[k + v] || (this.cache[k + v] = this.SCENES[k][v](this)); },
  localPhotos() { const a = this.readJSON(this.LOCAL_PHOTOS_KEY); return Array.isArray(a) ? a : []; },
  cloudPhotos() { const a = Store.cfg?.().bgPhotos; return Array.isArray(a) ? a : []; },

  async photoUrl(id) {
    if (id.startsWith("l:")) return this.localPhotos()[+id.slice(2)] || null;
    if (!id.startsWith("s:") || DEMO) return null;
    const path = id.slice(2), c = this.signed[path];
    if (c && c.exp > Date.now()) return c.url;
    const { data, error } = await sb.storage.from(this.BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error || !data) return null;
    this.signed[path] = { url: data.signedUrl, exp: Date.now() + 1000 * 60 * 60 * 24 * 6 };
    return data.signedUrl;
  },

  async applyBg() {
    const st = document.documentElement.style, bd = document.getElementById("backdrop"), k = this.look.bg;
    if (this.SCENES[k] && !this.SCENES[k].photo) {
      st.setProperty("--scene-l", `url(${this.sceneSrc(k, "l")})`);
      st.setProperty("--scene-d", `url(${this.sceneSrc(k, "d")})`);
      bd.classList.remove("photo");
      return;
    }
    const src = this.SCENES[k] ? this.sceneSrc(k, "l") : await this.photoUrl(k);
    if (!src) { if (k !== "morbido") { this.look.bg = "morbido"; return this.applyBg(); } return; }
    st.setProperty("--scene-l", `url(${src})`); st.setProperty("--scene-d", `url(${src})`);
    bd.classList.add("photo");
  },

  // Le foto si riducono e si mettono in bianco e nero prima di salvarle
  toGray(file) {
    return new Promise((ok, ko) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1920 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
        const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
        for (let i = 0; i < d.length; i += 4) { const l = d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722; d[i] = d[i + 1] = d[i + 2] = l; }
        x.putImageData(im, 0, 0); URL.revokeObjectURL(url);
        c.toBlob((blob) => ok({ blob, dataUrl: c.toDataURL("image/jpeg", .8) }), "image/jpeg", .82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("bad")); };
      img.src = url;
    });
  },

  async addPhoto(file) {
    const { blob, dataUrl } = await this.toGray(file);
    if (!DEMO) {
      const path = `${Auth.uid()}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from(this.BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (!error) {
        Store.setSettings({ bgPhotos: [...this.cloudPhotos(), path].slice(-8) });
        this.look.bg = "s:" + path;
        return "cloud";
      }
      console.warn("Upload sfondo non riuscito", error);
    }
    const loc = [...this.localPhotos(), dataUrl].slice(-4);
    if (!this.write(this.LOCAL_PHOTOS_KEY, JSON.stringify(loc))) throw new Error("full");
    this.look.bg = "l:" + (loc.length - 1);
    return "local";
  },

  async removePhoto(id) {
    if (id.startsWith("s:")) {
      const path = id.slice(2);
      if (!DEMO) await sb.storage.from(this.BUCKET).remove([path]);
      Store.setSettings({ bgPhotos: this.cloudPhotos().filter((p) => p !== path) });
    } else {
      const loc = this.localPhotos(); loc.splice(+id.slice(2), 1);
      this.write(this.LOCAL_PHOTOS_KEY, JSON.stringify(loc));
    }
    if (this.look.bg === id) this.look.bg = "morbido";
  },

  // ---------- Foglio "Aspetto" ----------
  async openLook() {
    const dark = this.isDark();
    const ids = [...Object.keys(this.SCENES), ...this.cloudPhotos().map((p) => "s:" + p), ...this.localPhotos().map((_, i) => "l:" + i)];
    const thumbs = await Promise.all(ids.map(async (id) => {
      const sc = this.SCENES[id];
      const src = sc ? (sc.photo ? this.sceneSrc(id, "l") : this.sceneSrc(id, dark ? "d" : "l")) : await this.photoUrl(id);
      return { id, src, name: sc ? sc.name : id.startsWith("s:") ? "Tua foto" : "Su questo dispositivo", bw: !sc || sc.photo, mine: !sc };
    }));
    const L = this.look;
    Sheet.open({
      title: "Aspetto", wide: true,
      body: `<div class="look">
        <p class="look-sec">Colori</p>
        <div class="look-pal">${Object.entries(this.PALETTES).map(([k, p]) => `<button type="button" data-pal="${k}" aria-pressed="${L.pal === k}"><span class="sw">${[p.side, p.navy, p.hot, p.accent].map((c) => `<i style="background:${c}"></i>`).join("")}</span>${p.name}</button>`).join("")}</div>
        <p class="look-sec">Vetro dei widget</p>
        <label class="look-range" for="look-ga"><span class="sr">Opacità del vetro</span><input id="look-ga" type="range" min="45" max="92" value="${L.ga}"><span class="look-ends"><span>Più trasparente</span><span>Più coprente</span></span></label>
        <p class="look-sec">Luminosità dello sfondo</p>
        <label class="look-range" for="look-dim"><span class="sr">Quanto scurire lo sfondo</span><input id="look-dim" type="range" min="0" max="65" value="${L.dim || 0}"><span class="look-ends"><span>Originale</span><span>Più scuro</span></span></label>
        <p class="look-sec">Sfondo</p>
        <div class="look-thumbs">${thumbs.filter((t) => t.src).map((t) => `<button type="button" class="look-thumb ${t.bw ? "bw" : ""}" data-bg="${U.esc(t.id)}" aria-pressed="${L.bg === t.id}" style="background-image:url('${t.src}')"><span>${t.name}</span>${t.mine ? `<span class="del" data-del="${U.esc(t.id)}" role="button" aria-label="Elimina questa foto">${Icon.svg("x", 13)}</span>` : ""}</button>`).join("")}
          <label class="look-thumb up" for="look-file">${Icon.svg("plus", 22)}Carica foto<input id="look-file" type="file" accept="image/*" hidden></label></div>
        <p class="muted small">Le tue foto vengono ridotte e messe in bianco e nero prima di essere salvate, in uno spazio privato su Supabase visibile solo a te.</p>
      </div>`,
      onMount: (el) => this.wireLook(el)
    });
  },

  wireLook(el) {
    el.addEventListener("click", async (e) => {
      const del = e.target.closest("[data-del]");
      if (del) { e.stopPropagation(); await this.removePhoto(del.dataset.del); this.saveLook(); this.applyBg(); return this.openLook(); }
      const pb = e.target.closest("[data-pal]");
      if (pb) { this.look.pal = pb.dataset.pal; this.applyLook(); this.saveLook(); el.querySelectorAll("[data-pal]").forEach((n) => n.setAttribute("aria-pressed", n === pb)); return; }
      const b = e.target.closest("[data-bg]");
      if (b) { this.look.bg = b.dataset.bg; this.applyBg(); this.saveLook(); el.querySelectorAll("[data-bg]").forEach((n) => n.setAttribute("aria-pressed", n === b)); }
    });
    el.querySelector("#look-ga").addEventListener("input", (e) => { this.look.ga = +e.target.value; this.applyLook(); this.saveLook(); });
    el.querySelector("#look-dim").addEventListener("input", (e) => { this.look.dim = +e.target.value; this.applyLook(); this.saveLook(); });
    el.querySelector("#look-file").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      U.toast("Preparo la foto…");
      try {
        const where = await this.addPhoto(f);
        this.saveLook(); await this.applyBg(); this.openLook();
        U.toast(where === "cloud" ? "Sfondo salvato" : DEMO ? "Sfondo salvato in questo browser" : "Sfondo salvato solo su questo dispositivo: esegui supabase/schema.sql per sincronizzarlo");
      } catch (err) {
        U.toast(err.message === "full" ? "Il browser non ha spazio per questa foto" : "Questo file non è un'immagine leggibile. Prova con un JPG o un PNG.");
      }
    });
  },

  // ---------- Tacca della barra laterale ----------
  drawSide(n) {
    const side = document.querySelector(".sidebar"), path = document.getElementById("side-path");
    const W = side.offsetWidth, H = side.offsetHeight; if (!W || !path) return;
    const R = 32, rr = 22, h = n.b - n.a, a = Math.max(n.a, R + rr), b = a + h, L = n.L;
    path.setAttribute("d", `M${R},0 H${W - R} A${R},${R} 0 0 1 ${W},${R} V${a - rr} A${rr},${rr} 0 0 1 ${W - rr},${a} H${L + h / 2} A${h / 2},${h / 2} 0 0 0 ${L + h / 2},${b} H${W - rr} A${rr},${rr} 0 0 1 ${W},${b + rr} V${H - R} A${R},${R} 0 0 1 ${W - R},${H} H${R} A${R},${R} 0 0 1 0,${H - R} V${R} A${R},${R} 0 0 1 ${R},0 Z`);
  },
  placeNotch(animate) {
    const side = document.querySelector(".sidebar"), btn = side && side.querySelector(".nav-item.on");
    if (!btn || !side.offsetWidth) return;
    const s0 = side.getBoundingClientRect(), r = btn.getBoundingClientRect();
    const to = { a: r.top - s0.top - 3, b: r.bottom - s0.top + 3, L: r.left - s0.left };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || !this.notch || reduce || (Math.abs(this.notch.a - to.a) < 1)) { this.notch = to; return this.drawSide(to); }
    const from = { ...this.notch }, t0 = performance.now(), id = (this._nid = (this._nid || 0) + 1);
    let done = false;
    const step = (t) => {
      if (id !== this._nid) return;
      const k = Math.min(1, (t - t0) / 380), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.notch = { a: from.a + (to.a - from.a) * e, b: from.b + (to.b - from.b) * e, L: to.L };
      this.drawSide(this.notch); if (k < 1) requestAnimationFrame(step); else done = true;
    };
    requestAnimationFrame(step);
    setTimeout(() => { if (!done && id === this._nid) { this.notch = to; this.drawSide(to); } }, 600);
  },

  svg(paths, size = 20, w = 1.8) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`; },

  // ---------- Testata ----------
  greeting() {
    const h = new Date().getHours();
    return `${h < 5 ? "Buonanotte" : h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera"}, ${U.esc(Store.cfg().name)}`;
  },
  pending() {
    const today = U.today();
    return Calc.habitsDueOn(today).filter((h) => !Calc.isDone(h, today));
  },
  renderHeader(view) {
    const el = document.getElementById("app-head");
    if (!el || !App.loaded) return;
    const pend = this.pending(), next = pend[0];
    const hello = view === "today"
      ? `<div class="greet"><h1 id="greet-h">${this.greeting()}</h1><p>${next ? `Prossima: <b>${U.esc(next.name)}</b>` : "Giornata completata: tutte le abitudini sono fatte"}</p></div>`
      : `<div class="greet"></div>`;
    const bell = `<button class="hpill glass bell" data-act="reminders" aria-label="${pend.length ? `Promemoria: ${pend.length} da fare` : "Promemoria"}">${this.svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>', 20)}${pend.length ? `<span class="badge">${pend.length}</span>` : ""}</button>`;
    const w = this.weather;
    const when = `<div class="hpill glass when"><span class="stack"><b id="hd-clock">${this.clock()}</b><small id="hd-date">${this.date()}</small></span>${w ? `<span class="sep"></span>${this.wxIcon(w.code)}<span class="stack"><b>${Math.round(w.temp)}°</b><small>${U.esc(w.label)}${w.geo && w.geo.name ? ` · ${U.esc(w.geo.name)}` : ""}</small></span>`
      : `<span class="sep"></span><button class="link-sm" data-act="go" data-id="settings">${Store.cfg().weatherCity ? "Meteo non disponibile" : "Attiva la posizione"}</button>`}</div>`;
    const focus = `<button class="hpill glass blue focus-pill" data-act="go" data-id="focus" id="hd-focus" hidden><span class="dot">${this.svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>', 15, 2.4)}</span><span class="stack"><b id="hd-focus-t">--:--</b><small>Sessione di focus</small></span></button>`;
    const theme = `<button class="toggle" id="theme-btn2" type="button" aria-label="Tema chiaro o scuro"><i>${Icon.svg("moon", 16)}</i></button>`;
    el.innerHTML = `${hello}<div class="hpills">${bell}${when}${focus}${theme}</div>`;
    el.querySelector("#theme-btn2").addEventListener("click", () => this.toggleTheme());
    this.tick();
  },
  clock() { return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); },
  date() { return new Date().toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }); },
  tick() {
    const c = document.getElementById("hd-clock"); if (c) c.textContent = this.clock();
    const f = document.getElementById("hd-focus");
    if (!f) return;
    const run = typeof Focus !== "undefined" ? Focus.run : null;
    const onHomeWidget = App.view === "today" && (Store.cfg().homeLayout || []).some((x) => (Array.isArray(x) ? x[0] : x && x.type) === "timer");
    const show = !!run && App.view !== "focus" && !onHomeWidget;
    f.hidden = !show;
    if (show) {
      const left = Math.max(0, run.durationMin * 60 - Focus.elapsedSec());
      document.getElementById("hd-focus-t").textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
    }
  },

  // ---------- Meteo: Open-Meteo, città dalle Impostazioni (nessuna chiave) ----------
  weather: null,
  WX: [[[0], "Sereno", "sun"], [[1, 2], "Poco nuvoloso", "cloudsun"], [[3], "Nuvoloso", "cloud"], [[45, 48], "Nebbia", "cloud"], [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], "Pioggia", "rain"], [[71, 73, 75, 77, 85, 86], "Neve", "snow"], [[95, 96, 99], "Temporale", "rain"]],
  wxInfo(code) { return this.WX.find(([c]) => c.includes(code)) || this.WX[2]; },
  wxIcon(code) {
    const k = this.wxInfo(code)[2];
    const p = { sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      cloudsun: '<path d="M8 3v1.5M3.6 5.6l1 1M2 10h1.5M12.4 5.6l-1 1"/><path d="M5.5 11a3 3 0 0 1 5.6-1.5"/><path d="M8 19h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13a3 3 0 0 0 0 6z"/>',
      cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/>',
      rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z"/><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2"/>',
      snow: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z"/><path d="M9 19h.01M13 20h.01M17 19h.01"/>' }[k];
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  },
  // Posizione del dispositivo (se non c'è una città in Impostazioni). Il nome della città arriva
  // da BigDataCloud (gratuito, senza chiave); il meteo da Open-Meteo.
  locate() {
    return new Promise((ok, ko) => {
      if (!navigator.geolocation) return ko(new Error("posizione non disponibile"));
      navigator.geolocation.getCurrentPosition((p) => ok(p.coords), ko, { timeout: 10000, maximumAge: 60 * 60 * 1000 });
    });
  },
  async loadWeather(force) {
    const city = (Store.cfg().weatherCity || "").trim(), key = city || "auto";
    const cached = this.readJSON(this.WEATHER_KEY);
    if (!force && cached && cached.key === key && Date.now() - cached.at < 30 * 60 * 1000) { this.weather = cached; return this.renderHeader(App.view); }
    try {
      let geo = cached && cached.key === key && city ? cached.geo : null;
      if (!geo && city) {
        const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it&format=json`)).json();
        const r = g.results && g.results[0];
        if (!r) throw new Error("città non trovata");
        geo = { lat: r.latitude, lon: r.longitude, name: r.name };
      }
      if (!geo) {
        const c = await this.locate();
        geo = { lat: +c.latitude.toFixed(3), lon: +c.longitude.toFixed(3), name: "" };
        try {
          const r = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${geo.lat}&longitude=${geo.lon}&localityLanguage=it`)).json();
          geo.name = r.city || r.locality || "";
        } catch { /* il nome è facoltativo */ }
      }
      const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code&timezone=auto`)).json();
      const code = f.current.weather_code;
      this.weather = { key, geo, temp: f.current.temperature_2m, code, label: this.wxInfo(code)[1], at: Date.now() };
      this.write(this.WEATHER_KEY, JSON.stringify(this.weather));
    } catch (e) {
      console.warn("Meteo non disponibile", e);
      this.weather = cached && cached.key === key ? cached : null;
    }
    this.renderHeader(App.view);
  },

  // ---------- Promemoria (campanella) ----------
  openReminders() {
    const pend = this.pending();
    const goals = Calc.activeGoals().filter((g) => g.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 2);
    Sheet.open({
      title: "Promemoria",
      body: `${pend.length ? `<p class="look-sec">Da fare oggi</p><div class="list">${pend.map((h) => `<button class="row-card slim" data-act="${h.kind === "check" ? "habit-toggle" : "habit-open"}" data-id="${h.id}" data-close="1"><span class="round"></span><span class="row-main"><h3>${U.esc(h.name)}</h3><p>${h.kind === "check" ? "Tocca per segnarla come fatta" : "Tocca per registrare il valore"}</p></span></button>`).join("")}</div>`
        : `<p class="muted">Niente da fare: tutte le abitudini di oggi sono completate.</p>`}
        ${goals.length ? `<p class="look-sec">In scadenza</p><div class="list">${goals.map((g) => `<button class="row-card slim" data-act="goal-open" data-id="${g.id}" data-close="1"><span class="row-main"><h3>${U.esc(g.title)}</h3><p>Scade il ${U.fmtShort(g.due_date)}</p></span></button>`).join("")}</div>` : ""}`
    });
  }
};

Actions["look-open"] = () => Shell.openLook();
Actions["reminders"] = () => Shell.openReminders();
Actions["weather-save"] = (form) => {
  Store.setSettings({ weatherCity: (new FormData(form).get("city") || "").trim() });
  U.toast("Città salvata");
  setTimeout(() => Shell.loadWeather(true), 50);
};
