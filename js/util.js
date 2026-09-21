// ============================================================
// Utility: date (sempre stringhe locali YYYY-MM-DD), formattazione, toast
// ============================================================
const U = {
  pad: (n) => String(n).padStart(2, "0"),

  dateStr(d = new Date()) {
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  },
  today() { return U.dateStr(); },
  parse(s) {
    const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  },
  addDays(s, n) {
    const d = U.parse(s);
    d.setDate(d.getDate() + n);
    return U.dateStr(d);
  },
  addMonths(s, n) {
    const d = U.parse(s);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return U.dateStr(d);
  },
  diffDays(a, b) { return Math.round((U.parse(b) - U.parse(a)) / 86400000); },
  // 1 = lunedì ... 7 = domenica
  dow(s) { const d = U.parse(s).getDay(); return d === 0 ? 7 : d; },
  range(from, to) {
    const out = [];
    for (let d = from; d <= to; d = U.addDays(d, 1)) out.push(d);
    return out;
  },
  mondayOf(s) { return U.addDays(s, -(U.dow(s) - 1)); },
  dateOf(iso) { return U.dateStr(new Date(iso)); },

  MONTHS: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
  MONTHS_LONG: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  DOW_SHORT: ["L", "M", "M", "G", "V", "S", "D"],
  DOW_KANJI: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
  DOW_NAMES: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],

  fmtShort(s) { const d = U.parse(s); return `${d.getDate()} ${U.MONTHS[d.getMonth()]}`; },
  fmtLong(s) { const d = U.parse(s); return `${d.getDate()} ${U.MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; },
  fmtTime(iso) { const d = new Date(iso); return `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; },

  fmtMin(m) {
    m = Math.round(m);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  },
  // numero all'italiana: max 1 decimale, senza .0
  num(n, dec = 1) {
    if (n == null || isNaN(n)) return "–";
    return Number(n).toLocaleString("it-IT", { maximumFractionDigits: dec });
  },

  clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  sum: (arr) => arr.reduce((s, x) => s + x, 0),
  avg(arr) { const a = arr.filter((x) => x != null && !isNaN(x)); return a.length ? U.sum(a) / a.length : null; },

  uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  },

  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  domain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  },

  safeUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
    } catch { return ""; }
  },

  greeting() {
    const h = new Date().getHours();
    return h < 5 ? "Buonanotte" : h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
  },

  toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(U._toastT);
    U._toastT = setTimeout(() => el.classList.remove("show"), 2600);
  },

  download(filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  // Deterministico: serve alla modalità demo
  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
};

// ---- Icone (tratto sottile, stile minimal) --------------------------------
const ICONS = {
  home: "M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  habit: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.7 2.7L16 9.5",
  goal: "M6 21V4M6 5h11l-2.5 4 2.5 4H6",
  chart: "M5 20v-7M12 20V5M19 20v-10",
  plus: "M12 5v14M5 12h14",
  tree: "M12 21v-8M12 13c-4 0-6-3-6-7 4 0 6 3 6 7zM12 16c3 0 5-2 5-5-3 0-5 2-5 5z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  menu: "M4 7h16M4 12h16M4 17h10",
  x: "M6 6l12 12M18 6L6 18",
  right: "M9 6l6 6-6 6",
  left: "M15 6l-6 6 6 6",
  flame: "M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  scale: "M4 6h16v13H4zM9 11a3 3 0 0 1 6 0",
  dumbbell: "M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12",
  sync: "M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  edit: "M4 20l4-1 11-11-3-3L5 16z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  smile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2M9 9.5v.5M15 9.5v.5",
  logout: "M9 4H5v16h4M15 8l4 4-4 4M19 12H9",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  minus: "M5 12h14",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  star: "M12 3l2.600 5.600 6.100.700-4.500 4.200 1.200 6L12 16.500 6.600 19.500l1.200-6L3.300 9.300l6.100-.700z",
  quote: "M7 7h4v4H8c0 2 .5 3 3 3v2c-3.500 0-5-1.500-5-5zM15 7h4v4h-3c0 2 .5 3 3 3v2c-3.500 0-5-1.500-5-5z",
  eyeoff: "M3 3l18 18M10.600 10.600a2 2 0 0 0 2.800 2.800M9.900 5.200A9.500 9.500 0 0 1 12 5c5 0 8.500 4 9.500 7-.4 1.200-1.200 2.500-2.300 3.600M6.600 6.700C4.700 8 3.400 10 2.500 12c1 3 4.500 7 9.500 7 1.500 0 2.800-.4 4-.9",
  copy: "M9 9h10v11H9zM5 15V4h10",
  shield: "M12 3l7 3v6c0 4.500-3 7.500-7 9-4-1.500-7-4.500-7-9V6z",
  play: "M8 5l11 7-11 7z",
  seed: "M12 20v-7M12 13c0-4 2-6 6-6 0 4-2 6-6 6zM12 15c0-3-1.5-5-5-5 0 3 1.5 5 5 5z"
};

const Icon = {
  svg(name, size = 22, extra = "") {
    return `<svg class="ico ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
  }
};
