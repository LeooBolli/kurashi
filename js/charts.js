// ============================================================
// Grafici in SVG puro, senza librerie. Regole applicate (dataviz):
// barre sottili con estremo arrotondato, linee 2px, marker >= 8px con
// anello del colore della superficie, griglia solo hairline, tooltip al
// passaggio/tocco (data-tip), nessun testo nel colore della serie.
// ============================================================
const Charts = {
  // Larghezza del disegno = larghezza (stimata) della scheda, così il testo degli assi resta leggibile
  get W() {
    const w = window.innerWidth;
    const card = w >= 1024 ? (w - 250 - 96 - 20) / 2 - 38 : w - 32 - 38;
    return Math.round(U.clamp(card, 260, 520));
  },

  _tip(t) { return t ? ` data-tip="${U.esc(t)}"` : ""; },

  // Anello di progresso (tratto tondo, ispirato all'enso)
  ring({ value = 0, size = 120, stroke = 9, color = "var(--orange)", track = "var(--line)", inner = "" }) {
    const r = 46, C = 2 * Math.PI * r, p = U.clamp(value, 0, 1);
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${Math.round(p * 100)}%">
        <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${track}" stroke-width="${stroke * 100 / size * 1.0}"/>
        <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${color}" stroke-width="${stroke * 100 / size * 1.0}" stroke-linecap="round"
          stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>
      </svg>
      <div class="ring-c">${inner}</div>
    </div>`;
  },

  // Barra orizzontale di avanzamento, con tacca facoltativa (ritmo atteso)
  bar({ value = 0, color = "var(--blue)", mark = null, h = 8 }) {
    const v = U.clamp(value, 0, 100);
    return `<div class="bar" style="height:${h}px"><i style="width:${v}%;background:${color}"></i>${mark != null ? `<b class="bar-mark" style="left:${U.clamp(mark, 0, 100)}%"></b>` : ""}</div>`;
  },

  // Piccola linea (sparkline) con punto finale
  spark(vals, color = "var(--blue)", w = 90, h = 28) {
    const pts = vals.map((v, i) => ({ v, i })).filter((p) => p.v != null);
    if (pts.length < 2) return "";
    const max = Math.max(...pts.map((p) => p.v), 1), min = Math.min(...pts.map((p) => p.v), 0);
    const x = (i) => 4 + (i / (vals.length - 1)) * (w - 8);
    const y = (v) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
    const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
    const last = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <path d="${d}" fill="none" style="stroke:${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(last.i).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="4" style="fill:${color};stroke:var(--card)" stroke-width="2"/></svg>`;
  },

  // Colonne verticali. data: [{label, v, tip, color?, showLabel?}]
  cols({ data, h = 150, max = null, target = null, unit = "", color = "var(--blue)", labelEvery = 1, aria = "" }) {
    const W = this.W, padL = 30, padB = 20, padT = 10;
    const top = max ?? Math.max(1, ...data.map((d) => d.v || 0), target || 0);
    const niceMax = this._nice(top);
    const slot = (W - padL - 6) / data.length;
    const bw = Math.min(20, slot * 0.62);
    const ph = h - padB - padT;
    const y = (v) => padT + ph - (v / niceMax) * ph;
    let g = "";
    [0, niceMax / 2, niceMax].forEach((t) => {
      g += `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${padL - 6}" y="${y(t) + 3.5}" class="axis" text-anchor="end">${U.num(t, 0)}${unit}</text>`;
    });
    let bars = "", hits = "", lbls = "";
    data.forEach((d, i) => {
      const cx = padL + slot * i + slot / 2;
      const v = d.v || 0, bh = Math.max(v > 0 ? 3 : 0, (v / niceMax) * ph);
      const c = d.color || color;
      if (v > 0) {
        const r = Math.min(4, bw / 2, bh);
        const x0 = cx - bw / 2, x1 = cx + bw / 2, yt = y(0) - bh;
        bars += `<path d="M${x0} ${y(0)}V${yt + r}Q${x0} ${yt} ${x0 + r} ${yt}H${x1 - r}Q${x1} ${yt} ${x1} ${yt + r}V${y(0)}Z" style="fill:${c}"/>`;
      }
      hits += `<rect x="${cx - slot / 2}" y="${padT}" width="${slot}" height="${ph + padB}" fill="transparent"${this._tip(d.tip)}/>`;
      if (i % labelEvery === 0 || d.showLabel) lbls += `<text x="${cx}" y="${h - 5}" class="axis" text-anchor="middle">${U.esc(d.label)}</text>`;
    });
    const tgt = target != null ? `<line x1="${padL}" x2="${W}" y1="${y(target)}" y2="${y(target)}" class="target"/><text x="${W}" y="${y(target) - 4}" class="axis" text-anchor="end">obiettivo</text>` : "";
    return `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img" aria-label="${U.esc(aria)}">${g}${tgt}${bars}${lbls}${hits}</svg>`;
  },

  // Linee. series: [{name, color, vals:[num|null]}], labels: [str]
  lines({ series, labels, h = 160, min = null, max = null, labelEvery = 1, area = false, target = null, dec = 1, aria = "" }) {
    const W = this.W, padL = 30, padB = 20, padT = 12, padR = 10;
    const all = series.flatMap((s) => s.vals).filter((v) => v != null);
    if (!all.length) return `<div class="empty-chart">Ancora nessun dato</div>`;
    let lo = min ?? Math.min(...all, target ?? Infinity), hi = max ?? Math.max(...all, target ?? -Infinity);
    if (min == null && max == null) { const pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad; }
    const n = labels.length, ph = h - padB - padT;
    const x = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
    const y = (v) => padT + ph - ((v - lo) / (hi - lo || 1)) * ph;
    let g = "";
    [lo, (lo + hi) / 2, hi].forEach((t) => {
      g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${padL - 6}" y="${y(t) + 3.5}" class="axis" text-anchor="end">${U.num(t, dec)}</text>`;
    });
    let paths = "", dots = "";
    series.forEach((s) => {
      let d = "", pen = false;
      s.vals.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
        pen = true;
      });
      if (area && series.length === 1) {
        const pts = s.vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
        if (pts.length > 1) paths += `<path d="M${pts[0][0]} ${y(lo)}L${pts.map((p) => p.join(" ")).join("L")}L${pts[pts.length - 1][0]} ${y(lo)}Z" style="fill:${s.color}" opacity=".10"/>`;
      }
      paths += `<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      let li = -1; s.vals.forEach((v, i) => { if (v != null) li = i; });
      if (li >= 0) dots += `<circle cx="${x(li).toFixed(1)}" cy="${y(s.vals[li]).toFixed(1)}" r="4.5" style="fill:${s.color};stroke:var(--card)" stroke-width="2"/>`;
    });
    const tgt = target != null ? `<line x1="${padL}" x2="${W - padR}" y1="${y(target)}" y2="${y(target)}" class="target"/><text x="${W - padR}" y="${y(target) - 4}" class="axis" text-anchor="end">obiettivo</text>` : "";
    let lbls = "", hits = "";
    const slot = (W - padL - padR) / Math.max(1, n - 1);
    labels.forEach((l, i) => {
      if (i % labelEvery === 0) lbls += `<text x="${x(i)}" y="${h - 5}" class="axis" text-anchor="middle">${U.esc(l)}</text>`;
      const tip = `${l}: ` + series.filter((s) => s.vals[i] != null).map((s) => `${s.name} ${U.num(s.vals[i], dec)}`).join(" · ");
      if (series.some((s) => s.vals[i] != null)) hits += `<rect x="${x(i) - slot / 2}" y="${padT}" width="${slot}" height="${ph + padB}" fill="transparent" data-tip="${U.esc(tip)}"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img" aria-label="${U.esc(aria)}">${g}${tgt}${paths}${dots}${lbls}${hits}</svg>`;
  },

  legend(items) {
    return `<div class="legend">${items.map((i) => `<span><i style="background:${i.color}"></i>${U.esc(i.label)}</span>`).join("")}</div>`;
  },

  // Mappa di calore (settimane in colonna, lunedì in alto). cells: {date: 0..1|null}
  heat({ cells, end = U.today(), weeks = 15, onCell = "", name = "" }) {
    const cs = 13, gap = 3;
    const lastMonday = U.mondayOf(end);
    const start = U.addDays(lastMonday, -(weeks - 1) * 7);
    const W = weeks * (cs + gap), H = 7 * (cs + gap);
    let out = "";
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = U.addDays(start, w * 7 + d);
        if (date > end) continue;
        const v = cells[date];
        const lvl = v == null ? 0 : v <= 0 ? 1 : v < 0.34 ? 2 : v < 0.67 ? 3 : v < 1 ? 4 : 5;
        const tip = `${U.fmtShort(date)}: ${v == null ? "nulla in programma" : Math.round(v * 100) + "%"}`;
        out += `<rect x="${w * (cs + gap)}" y="${d * (cs + gap)}" width="${cs}" height="${cs}" rx="4" class="heat l${lvl}" data-tip="${U.esc(tip)}"${onCell ? ` data-date="${date}" data-act="heat-cell"` : ""}/>`;
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="heatmap" role="img" aria-label="${U.esc(name)}">${out}</svg>`;
  },

  // Barre orizzontali con etichetta. rows: [{label, glyph, color, v(0-100), tip}]
  hbars(rows) {
    return `<div class="hbars">${rows.map((r) => `
      <div class="hbar"${this._tip(r.tip)}>
        <span class="hbar-l"><i class="glyph" style="background:${r.tint || "var(--blue-100)"};color:var(--ink-2)">${r.glyph || ""}</i>${U.esc(r.label)}</span>
        <span class="hbar-t"><i style="width:${U.clamp(r.v, 0, 100)}%;background:${r.color}"></i></span>
        <span class="hbar-v">${Math.round(r.v)}%</span>
      </div>`).join("")}</div>`;
  },

  _nice(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
};
