// ============================================================
// Oggi: la Home a widget (stile iOS). Ogni widget legge i dati veri
// (Store/Calc) e si ridisegna a ogni modifica. La disposizione si salva
// nelle impostazioni (homeLayout), quindi è la stessa su tutti i dispositivi.
// Modifica Home: trascina per spostare, × per togliere (con Annulla),
// scegli il formato, + per aggiungere; da tastiera frecce e Canc.
// Su telefono: pressione lunga su un widget per entrare in modifica.
// ============================================================
const Today = (() => {
  // ---------- Icone (stesso tratto del prototipo) ----------
  const P = {
    habit: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    goal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>',
    bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
    quote: '<path d="M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    scale: '<rect x="3" y="4" width="18" height="16" rx="5"/><path d="M8 10a5 5 0 0 1 8 0l-3 2"/>',
    flame: '<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-2 4-2 4s-2-2-2-4c-3 3-6 6-6 10a7 7 0 0 0 7 7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    flat: '<path d="M5 12h14"/>',
    run: '<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 3v-6l-3-2-3 3M14 12l3 3h3"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="3"/><rect x="14" y="4" width="6" height="6" rx="3"/><rect x="4" y="14" width="6" height="6" rx="3"/><rect x="14" y="14" width="6" height="6" rx="3"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>',
    scaleAdd: '<rect x="3" y="4" width="18" height="16" rx="5"/><path d="M8 10a5 5 0 0 1 8 0l-3 2"/>'
  };
  const ic = (n, s = 18, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
  const esc = (s) => U.esc(s);
  const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---------- Stato del modulo (sopravvive ai ridisegni) ----------
  const st = {
    editing: false,
    layout: null,        // [[tipo, formato], ...]
    seen: null,          // JSON dell'ultima disposizione letta/salvata nelle impostazioni
    saveT: null,
    calTab: "habits",
    calOff: 0,
    timerI: null,
    bound: false,
    drag: null,
    press: null,
    focusIdx: null,
    suppressClick: false
  };

  const SIZE_NAMES = { c: "Cerchio", s: "Piccolo", p: "Capsula", mh: "Medio orizzontale", mv: "Medio verticale", lh: "Grande orizzontale", lv: "Grande verticale" };
  const SIZE_ORDER = ["c", "s", "p", "mh", "mv", "lh", "lv"];
  const NEW_WIDGETS = ["nextHabit", "points", "workouts", "deadline", "clock", "exam", "toRead", "quick", "heat"];
  const unseenNew = () => { const seen = Store.cfg().seenWidgets || []; const used = new Set((st.layout || []).map((l) => l[0])); return NEW_WIDGETS.filter((k) => !seen.includes(k) && !used.has(k)); };
  const sizeIcon = (s) => ({ c: '<circle cx="12" cy="9" r="7.5"/>', p: '<rect x="1" y="4.5" width="22" height="9" rx="4.5"/>', s: '<rect x="7" y="4" width="10" height="10" rx="3"/>', mh: '<rect x="2" y="5" width="20" height="9" rx="3"/>', mv: '<rect x="7" y="1" width="10" height="16" rx="3"/>', lh: '<rect x="1" y="2" width="22" height="14" rx="3"/>', lv: '<rect x="4" y="0.5" width="16" height="17" rx="3"/>' })[s];
  const DEFAULT = [["score", "c"], ["timer", "s"], ["calendar", "lv"], ["stats", "mh"], ["habits", "mv"], ["weight", "c"], ["streak", "c"], ["goals", "lh"], ["focusStats", "p"], ["quick", "p"], ["reading", "mh"], ["recall", "mh"], ["meals", "mh"], ["clock", "c"], ["points", "c"], ["deadline", "c"], ["nextHabit", "c"]];

  // ---------- Pezzi comuni ----------
  const head = (icon, title, sub, right = "") => `<header class="d-wh"><span class="d-ic">${ic(icon, 17)}</span><div class="d-tt"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ""}</div>${right ? `<div class="d-right">${right}</div>` : ""}</header>`;
  const big = (v, u) => `<div class="d-big">${v}${u ? `<span class="d-u">${u}</span>` : ""}</div>`;
  const empty = (text, btn = "") => `<div class="d-empty"><p>${text}</p>${btn}</div>`;
  const cta = (label, act, extra = "") => `<button type="button" class="d-btn deep sm" data-act="${act}" ${extra}>${ic("plus", 14, 2.4)}${label}</button>`;
  const ring = (size, p, label, small) => {
    const r = 40, c = 2 * Math.PI * r, v = p == null ? 0 : U.clamp(p, 0, 1);
    return `<div class="d-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--line, rgba(35,39,46,.14))" stroke-width="10"/>${v > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--hot, #E8792F)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}"/>` : ""}</svg><div class="d-lbl"><span><b>${label}</b>${small ? `<small>${small}</small>` : ""}</span></div></div>`;
  };
  const track = (pct, label) => `<div class="d-track" role="img" aria-label="${label || Math.round(pct) + "%"}"><i style="width:${U.clamp(pct, 0, 100)}%"></i></div>`;
  const hours = (min) => U.num(min / 60, 1);
  const mmss = (sec) => { const s = Math.max(0, Math.ceil(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}:${U.pad(m)}:${U.pad(r)}` : `${U.pad(m)}:${U.pad(r)}`; };

  // ---------- Forme: cerchio (1×1) e capsula (2×1) ----------
  // Ogni widget che le supporta ha mini(): { icon, title, value, unit, cap, p (0..1 o null), cls, action }
  const arc = (p, cls = "") => {
    const r = 46, c = 2 * Math.PI * r, v = p == null ? null : U.clamp(p, 0, 1);
    return v == null ? "" : `<svg class="d-cring ${cls}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="t"/>${v > 0 ? `<circle cx="50" cy="50" r="${r}" class="v" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}"/>` : ""}</svg>`;
  };
  function shapeHTML(sz, def, m) {
    const val = `${m.value}${m.unit ? `<span class="d-u">${m.unit}</span>` : ""}`;
    if (sz === "c") return { cls: m.cls, html: `${arc(m.p)}<div class="d-circ"><span class="d-ic">${ic(m.icon || def.icon, 16)}</span><div class="d-cv">${val}</div>${m.cap ? `<small>${m.cap}</small>` : ""}${m.action || ""}</div>` };
    const left = m.p != null
      ? `<div class="d-pring">${arc(m.p, "mini")}<span class="d-ic">${ic(m.icon || def.icon, 18)}</span></div>`
      : `<span class="d-pic">${ic(m.icon || def.icon, 22)}</span>`;
    return { cls: m.cls, html: `<div class="d-pillrow">${left}<div class="d-ptx"><b>${m.title || def.title}</b>${m.cap ? `<small>${m.cap}</small>` : ""}</div><div class="d-pv">${val}</div>${m.action || ""}</div>` };
  }

  // ---------- Dati ----------
  const todayData = () => {
    const today = U.today();
    const due = Calc.habitsDueOn(today);
    return { today, due, stats: Calc.dayStats(today, due) };
  };
  const habitLeft = (d) => d.stats.due - d.stats.done;

  function habBtn(h, today) {
    const done = Calc.isDone(h, today), s = Calc.streak(h);
    const qty = h.kind === "qty";
    const act = qty ? `data-act="habit-inc" data-id="${h.id}" data-dir="1"` : `data-act="habit-toggle" data-id="${h.id}"`;
    const label = qty ? `${esc(h.name)}: ${U.num(Calc.value(h, today))} su ${U.num(h.target)} ${esc(h.unit || "")}, aggiungi ${U.num(h.step)}` : `${esc(h.name)}: ${done ? "fatta, tocca per annullare" : "segna come fatta"}`;
    const stTxt = qty ? `${U.num(Calc.value(h, today))}/${U.num(h.target)} ${esc(h.unit || "")}${s ? ` · ${plural(s, "giorno", "giorni")}` : ""}`
      : s ? `${plural(s, "giorno", "giorni")} di fila` : "Da iniziare";
    return `<button type="button" class="d-hab ${done ? "done" : ""}" ${act} aria-pressed="${done}" aria-label="${label}"><span class="d-ck">${ic(done || !qty ? "check" : "plus", 16, 2.6)}</span><span class="d-tx"><span class="d-n">${esc(h.name)}</span><span class="d-st">${stTxt}</span></span></button>`;
  }

  // Pulsante "fatta" (o "+passo" per le quantitative) sulla prossima abitudine
  function nextBtn(h, today, wide) {
    const qty = h.kind !== "check";
    const act = qty ? `data-act="habit-inc" data-id="${h.id}" data-dir="1"` : `data-act="habit-toggle" data-id="${h.id}"`;
    const lbl = qty ? `Aggiungi ${U.num(h.step || 1)} ${esc(h.unit || "")} a ${esc(h.name)}` : `Segna ${esc(h.name)} come fatta`;
    return wide ? `<button type="button" class="d-btn deep sm" ${act} aria-label="${lbl}">${ic(qty ? "plus" : "check", 14, 2.6)}${qty ? `+${U.num(h.step || 1)}` : "Fatta"}</button>`
      : `<button type="button" class="d-cbtn" ${act} aria-label="${lbl}">${ic(qty ? "plus" : "check", 15, 2.6)}</button>`;
  }

  // Percentuale (0..100) di abitudini fatte per i 7 giorni della settimana corrente
  function weekRates(today) {
    const mon = U.mondayOf(today);
    return U.range(mon, U.addDays(mon, 6)).map((d) => {
      if (d > today) return null;
      const s = Calc.dayStats(d);
      return s.pct == null ? null : Math.round(s.pct * 100);
    });
  }

  // Ultimi 7 mesi: costanza di quest'anno e degli stessi mesi dell'anno scorso
  function monthly(today) {
    const out = [];
    const first = today.slice(0, 8) + "01";
    for (let i = 6; i >= 0; i--) {
      const from = U.addMonths(first, -i);
      const to0 = U.addDays(U.addMonths(from, 1), -1), to = to0 > today ? today : to0;
      const pFrom = U.addMonths(from, -12), pTo = U.addDays(U.addMonths(pFrom, 1), -1);
      const m = U.parse(from).getMonth();
      out.push({ label: cap1(U.MONTHS[m]), v: Calc.rate(from, to), prev: Calc.rate(pFrom, pTo) });
    }
    return out;
  }

  function barChart(wide, data) {
    const W = wide ? 470 : 330, H = wide ? 132 : 170, base = H - 26, bw = wide ? 40 : 30, gap = (W - 20 - bw * 7) / 6;
    const x = (i) => 10 + i * (bw + gap), y = (v) => base - (v / 100) * (base - 14);
    const bars = data.map((d, i) => {
      const v = d.v == null ? 0 : d.v;
      const hh = Math.max(bw, base - y(v));
      return i === data.length - 1
        ? `<rect x="${x(i)}" y="${y(100)}" width="${bw}" height="${base - y(100)}" rx="${bw / 2}" fill="#FFFFFF" fill-opacity=".16"/><rect x="${x(i) + 4}" y="${base - Math.max(bw - 8, base - y(v) - 8) - 4}" width="${bw - 8}" height="${Math.max(bw - 8, base - y(v) - 8)}" rx="${bw / 2 - 4}" fill="#FFFFFF" fill-opacity="${d.v == null ? .35 : 1}"/>`
        : `<rect x="${x(i)}" y="${base - hh}" width="${bw}" height="${hh}" rx="${bw / 2}" fill="#FFFFFF" fill-opacity="${d.v == null ? .25 : 1}"/>`;
    }).join("");
    const pts = data.map((d, i) => (d.prev == null ? null : [x(i) + bw / 2, y(d.prev)]));
    let path = "", prevPt = null;
    for (const p of pts) {
      if (!p) { prevPt = null; continue; }
      if (!prevPt) path += ` M${p[0]},${p[1]}`;
      else { const mx = (prevPt[0] + p[0]) / 2; path += ` C${mx},${prevPt[1]} ${mx},${p[1]} ${p[0]},${p[1]}`; }
      prevPt = p;
    }
    const gid = "dlg" + (wide ? "w" : "");
    const labels = data.map((d, i) => `<text x="${x(i) + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF" fill-opacity="${i === data.length - 1 ? 1 : .8}" font-family="Manrope, sans-serif">${d.label}</text>`).join("");
    const aria = data.map((d) => `${d.label} ${d.v == null ? "nessun dato" : Math.round(d.v) + "%"}`).join(", ");
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Abitudini completate per mese: ${aria}"><defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" stop-color="#C9DCF1"/><stop offset="1" style="stop-color:var(--hot, #E8792F)"/></linearGradient></defs>${bars}${path ? `<path d="${path.trim()}" fill="none" stroke="url(#${gid})" stroke-width="6" stroke-linecap="round"/>` : ""}${labels}</svg>`;
  }

  // Calendario: quali giorni sono "pieni" per ciascuna scheda
  function calTabs() {
    const tabs = [["habits", "Abitudini"]];
    if (Store.d.focus_sessions.some((s) => s.completed)) tabs.push(["focus", "Focus"]);
    const diet = typeof Food !== "undefined" && Food.habit ? Food.habit() : null;
    if (diet) tabs.push(["diet", "Dieta"]);
    if (!tabs.some(([k]) => k === st.calTab)) st.calTab = "habits";
    return { tabs, diet };
  }

  function calendar(tight) {
    const { tabs, diet } = calTabs();
    const today = U.today();
    const base = U.addMonths(today.slice(0, 8) + "01", st.calOff);
    const Y = U.parse(base).getFullYear(), M = U.parse(base).getMonth();
    const days = new Date(Y, M + 1, 0).getDate();
    const first = U.dow(base) - 1;
    let focusDays = null;
    if (st.calTab === "focus") focusDays = new Set(Calc.focusDone().map((s) => U.dateOf(s.started_at)));
    const isFull = (d) => {
      if (st.calTab === "focus") return focusDays.has(d);
      if (st.calTab === "diet") return diet ? Calc.isDone(diet, d) : false;
      const s = Calc.dayStats(d);
      return s.pct != null && s.pct >= 1;
    };
    let h = U.DOW_SHORT.map((d) => `<span class="d-dn" aria-hidden="true">${d}</span>`).join(""), count = 0;
    for (let i = 0; i < first; i++) h += `<span class="d-d pad"></span>`;
    for (let n = 1; n <= days; n++) {
      const d = `${Y}-${U.pad(M + 1)}-${U.pad(n)}`;
      const fut = d > today, isToday = d === today, f = !fut && isFull(d);
      if (f) count++;
      h += `<span class="d-d ${fut ? "fut" : f ? "full" : ""} ${isToday ? "today" : ""}">${n}</span>`;
    }
    // la serie conta all'indietro da ieri (oggi è ancora in corso), anche oltre l'inizio del mese
    let run = 0;
    if (st.calOff === 0) {
      let d = isFull(today) ? today : U.addDays(today, -1);
      for (let i = 0; i < 400 && isFull(d); i++, d = U.addDays(d, -1)) run++;
    }
    const name = `${cap1(U.MONTHS_LONG[M])} ${Y}`;
    const tabsHTML = tabs.length > 1 ? `<div class="d-tabs" role="group" aria-label="Cosa mostrare">${tabs.map(([k, l]) => `<button type="button" data-dash-tab="${k}" aria-pressed="${st.calTab === k}">${l}</button>`).join("")}</div>` : "";
    return { grid: `<div class="d-cal ${tight ? "tight" : ""}" role="img" aria-label="${plural(count, "giorno completato", "giorni completati")} in ${name}">${h}</div>`, name, count, run, tabsHTML };
  }
  const calNav = () => `<button type="button" class="d-navbtn" data-dash-cal="-1" aria-label="Mese precedente">${ic("left", 18, 2.2)}</button><button type="button" class="d-navbtn" data-dash-cal="1" aria-label="Mese successivo" ${st.calOff >= 0 ? "disabled" : ""}>${ic("right", 18, 2.2)}</button>`;

  function goalInfo(g) {
    const pace = Calc.goalPace(g);
    const due = g.horizon === "recurring" ? Calc.periodRange(g.period)[1] : g.due_date;
    const left = Calc.daysLeft(g);
    const ms = Calc.milestonesOf(g);
    const steps = ms.map((m) => [m.title, Calc.msPct(m) >= 100]);
    const next = ms.find((m) => Calc.msPct(m) < 100);
    let nextTxt = next ? next.title : "";
    if (next) { const kid = Calc.childrenOf(next).find((k) => !k.done); if (kid && !next.is_exam) nextTxt = `${next.title} · ${kid.title}`; }
    return { pct: Math.round(pace.progress), pace, due, left, steps, next: nextTxt };
  }
  const dueTxt = (gi) => gi.due ? `Scade il ${U.fmtShort(gi.due)} · ${gi.left > 0 ? `tra ${plural(gi.left, "giorno", "giorni")}` : gi.left === 0 ? "oggi" : `scaduto da ${plural(-gi.left, "giorno", "giorni")}`}` : "";

  function linkLabel(run) {
    if (!run || !run.link) return "In corso";
    const [type, id] = run.link.split(":");
    const s = { goal_id: type === "g" ? id : null, milestone_id: type === "m" ? id : null, habit_id: type === "h" ? id : null };
    return (typeof Focus.linkName === "function" && Focus.linkName(s)) || "In corso";
  }
  const focusOk = () => typeof Focus !== "undefined";
  const remainingSec = () => (focusOk() && Focus.run ? Focus.run.durationMin * 60 - Focus.elapsedSec() : (focusOk() ? Focus.minutes : 25) * 60);

  function weightSeries() {
    const logs = [...Store.d.weight_logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    if (!logs.length) return null;
    const from = U.addDays(U.today(), -13);
    let win = logs.filter((w) => w.log_date >= from);
    let label = "Ultime 2 settimane";
    if (win.length < 2) { win = logs.slice(-8); label = win.length > 1 ? `Dal ${U.fmtShort(win[0].log_date)}` : `Pesata del ${U.fmtShort(win[0].log_date)}`; }
    const last = Number(logs[logs.length - 1].kg);
    return { win, label, last, delta: win.length > 1 ? Number(win[win.length - 1].kg) - Number(win[0].kg) : null, lastDate: logs[logs.length - 1].log_date };
  }

  // ---------- Registro dei widget ----------
  const W = {
    score: {
      title: "Oggi", icon: "sun", sizes: ["c", "s", "p", "mh"], go: "habits",
      mini() {
        const d = todayData(), p = d.stats.pct;
        return { icon: "sun", title: "Oggi", value: d.stats.due ? Math.round((p || 0) * 100) : "—", unit: d.stats.due ? "%" : "", cap: d.stats.due ? `${d.stats.done} di ${d.stats.due} abitudini` : "Giorno di riposo", p: d.stats.due ? p || 0 : null };
      },
      render(sz) {
        const d = todayData();
        const p = d.stats.pct;
        const lbl = d.stats.due ? `${Math.round((p || 0) * 100)}%` : "—";
        const small = d.stats.due ? `${d.stats.done} di ${d.stats.due}` : "riposo";
        if (sz === "s") return { html: head("sun", "Oggi") + `<div class="d-wb center">${ring(90, p, lbl, small)}</div>` };
        const wk = weekRates(d.today), ti = U.dow(d.today) - 1;
        const vals = wk.filter((v) => v != null);
        const avg = vals.length ? Math.round(U.avg(vals)) : null;
        return { html: head("sun", "Oggi", avg == null ? "Nessuna abitudine in programma" : `Media della settimana ${avg}%`) + `<div class="d-wb row-c">${ring(96, p, lbl, small)}<div class="d-week" aria-hidden="true">${wk.map((v, i) => `<div class="${i === ti ? "today" : ""}"><i class="${v != null && v >= 70 ? "f" : ""}" style="height:${Math.max(6, (v || 0) * 0.5)}px"></i>${U.DOW_SHORT[i]}</div>`).join("")}</div></div>` };
      }
    },
    habits: {
      title: "Abitudini", icon: "habit", sizes: ["p", "mh", "mv", "lh", "lv"], go: "habits",
      mini() {
        const d = todayData(), next = d.due.find((h) => !Calc.isDone(h, d.today));
        return { icon: "habit", title: "Abitudini", value: `${d.stats.done}/${d.stats.due}`, cap: next ? `Prossima: ${esc(next.name)}` : d.stats.due ? "Tutte fatte" : "Oggi riposo", p: d.stats.due ? d.stats.pct || 0 : null, action: next ? nextBtn(next, d.today) : "" };
      },
      render(sz) {
        const d = todayData();
        if (!d.due.length) {
          const none = !Calc.activeHabits().length;
          return { html: head("habit", "Abitudini", none ? "Nessuna abitudine" : "Oggi riposo") + `<div class="d-wb">${empty(none ? "Inizia con una sola: piccola e chiara." : "Niente in programma oggi: goditi il riposo.", cta("Nuova abitudine", "habit-new"))}</div>` };
        }
        const n = { mh: 2, mv: 4, lh: 8, lv: 7 }[sz];
        const order = [...d.due].sort((a, b) => Calc.isDone(a, d.today) - Calc.isDone(b, d.today));
        const list = order.slice(0, n).map((h) => habBtn(h, d.today)).join("");
        const rest = d.due.length - n, left = habitLeft(d);
        const pct = Math.round((d.stats.pct || 0) * 100);
        const foot = sz === "lv" ? `<div class="d-row"><div class="d-legend"><span>Fatte ${d.stats.done}</span><span class="b">Da fare ${left}</span></div>${big(pct, "%")}</div>` : rest > 0 ? `<span class="d-more">Altre ${rest} nella sezione Abitudini</span>` : "";
        return { html: head("habit", "Abitudini", left ? `${left} da fare oggi` : "Tutte fatte") + `<div class="d-wb"><div class="d-habits ${sz === "lh" ? "two" : ""}">${list}</div>${foot}</div>` };
      }
    },
    focusStats: {
      title: "Ore di focus", icon: "timer", sizes: ["c", "s", "p", "mh"], go: "focus",
      mini() {
        const today = U.today(), mon = U.mondayOf(today);
        const tMin = Calc.focusMinutes(today, today), wMin = Calc.focusMinutes(mon, today), goal = Number(Store.cfg().focusWeeklyMin) || 600;
        return { icon: "timer", title: "Ore di focus", value: hours(tMin), unit: "h", cap: `oggi · ${hours(wMin)} su ${hours(goal)} h a settimana`, p: wMin / goal };
      },
      render(sz) {
        const today = U.today(), mon = U.mondayOf(today);
        const tMin = Calc.focusMinutes(today, today), wMin = Calc.focusMinutes(mon, today);
        const goal = Number(Store.cfg().focusWeeklyMin) || 600;
        const a = U.clamp((tMin / goal) * 100, 0, 100), b = U.clamp(((wMin - tMin) / goal) * 100, 0, 100 - a);
        const bar = `<div class="d-prog" role="img" aria-label="${hours(wMin)} ore su ${hours(goal)} questa settimana">${a > 0 ? `<i style="width:${a}%"></i>` : ""}${b > 0 ? `<i class="b" style="width:${b}%"></i>` : ""}<i class="e"></i></div>`;
        if (sz === "s") return { html: head("timer", "Focus", "Oggi") + `<div class="d-wb end">${big(hours(tMin), "h")}${bar}<span class="d-cap">${hours(wMin)} su ${hours(goal)} h a settimana</span></div>` };
        return { html: head("timer", "Ore di focus", `Questa settimana ${hours(wMin)} h`) + `<div class="d-wb end"><div class="d-row">${big(hours(tMin), "h oggi")}<span class="d-cap">obiettivo ${hours(goal)} h a settimana</span></div>${bar}<div class="d-legend"><span>Oggi</span><span class="b">Resto della settimana</span></div></div>` };
      }
    },
    timer: {
      title: "Sessione di focus", icon: "timer", sizes: ["c", "s", "p", "mh"], go: "focus",
      mini() {
        const running = focusOk() && !!Focus.run;
        const btn = running
          ? `<button type="button" class="d-cbtn" data-act="focus-giveup" aria-label="Interrompi la sessione">${ic("stop", 14)}</button>`
          : `<button type="button" class="d-cbtn" data-act="focus-start" aria-label="Avvia una sessione di ${focusOk() ? Focus.minutes : 25} minuti">${ic("play", 15, 2.6)}</button>`;
        const p = running ? Focus.elapsedSec() / (Focus.run.durationMin * 60) : null;
        return { cls: "blue", icon: "timer", title: "Sessione di focus", value: `<span data-dash-timer data-running="${running}" role="timer">${mmss(remainingSec())}</span>`, cap: running ? esc(linkLabel(Focus.run)) : `Pronta · ${focusOk() ? Focus.minutes : 25} min`, p, action: btn };
      },
      render(sz) {
        const running = focusOk() && !!Focus.run;
        const btns = `<div class="d-tbtns">${running
          ? `<button type="button" data-act="focus-giveup" aria-label="Interrompi la sessione">${ic("stop", 16)}</button>`
          : `<button type="button" data-act="focus-start" aria-label="Avvia una sessione di ${focusOk() ? Focus.minutes : 25} minuti">${ic("play", 18, 2.6)}</button>`}</div>`;
        const state = running ? linkLabel(Focus.run) : `Pronta · ${focusOk() ? Focus.minutes : 25} min`;
        const time = `<span class="d-timer" data-dash-timer data-running="${running}" role="timer" aria-label="${running ? "Tempo rimanente" : "Durata"}">${mmss(remainingSec())}</span>`;
        if (sz === "s") return { cls: "blue", html: head("timer", "Focus", esc(state)) + `<div class="d-wb end" style="gap:10px">${time}${btns}</div>` };
        return { cls: "blue", html: head("timer", "Sessione di focus", esc(state)) + `<div class="d-wb"><div class="d-row">${time}${btns}</div></div>` };
      }
    },
    goals: {
      title: "Obiettivi", icon: "goal", sizes: ["c", "p", "mh", "mv", "lh", "lv"], go: "goals",
      mini() {
        const g = Calc.activeGoals().slice().sort((a, b) => (goalInfo(a).due || "9999").localeCompare(goalInfo(b).due || "9999"))[0];
        if (!g) return { icon: "goal", title: "Obiettivi", value: "0", cap: "Nessun obiettivo attivo", p: null };
        const gi = goalInfo(g);
        return { icon: "goal", title: esc(g.title), value: gi.pct, unit: "%", cap: gi.due ? `Scade il ${U.fmtShort(gi.due)} · ${gi.pace.label}` : gi.pace.label, p: gi.pct / 100 };
      },
      render(sz) {
        const goals = Calc.activeGoals().slice().sort((a, b) => (goalInfo(a).due || "9999").localeCompare(goalInfo(b).due || "9999"));
        if (!goals.length) return { html: head("goal", "Obiettivi", "Nessuno attivo") + `<div class="d-wb">${empty("Definisci dove vuoi arrivare in 1, 4 o 12 mesi.", cta("Nuovo obiettivo", "goal-new"))}</div>` };
        const n = { mh: 2, mv: 3, lh: 3, lv: 4 }[sz], steps = sz === "lh" || sz === "lv";
        const items = goals.slice(0, n).map((g) => {
          const gi = goalInfo(g);
          const stepsHTML = steps && gi.steps.length ? `<div class="d-steps">${gi.steps.slice(0, sz === "lh" ? 4 : 5).map(([s, d]) => `<span class="d-step ${d ? "done" : ""}">${d ? ic("check", 12, 2.8) : ""}${esc(s)}</span>`).join("")}${gi.steps.length > (sz === "lh" ? 4 : 5) ? `<span class="d-step">+${gi.steps.length - (sz === "lh" ? 4 : 5)}</span>` : ""}</div>` : "";
          return `<div class="d-goal"><div class="d-t"><span>${esc(g.title)}</span>${sz === "lh" ? "" : `<span class="d-p">${gi.pct}%</span>`}</div>${sz === "lh" ? `<div class="d-pbig">${gi.pct}<span class="d-u">%</span></div>` : ""}${track(gi.pct, `${gi.pct}%, ${gi.pace.label}`)}${stepsHTML}${sz === "lh" && gi.next ? `<div class="d-nx"><small>Prossima tappa</small><b>${esc(gi.next)}</b></div>` : ""}<span class="d-meta">${dueTxt(gi)} · ${gi.pace.label}</span></div>`;
        }).join("");
        const g0 = goalInfo(goals[0]);
        const sub = `${goals.length} ${goals.length === 1 ? "attivo" : "attivi"}${g0.due ? ` · il prossimo scade il ${U.fmtShort(g0.due)}` : ""}`;
        return { html: head("goal", "Obiettivi", sub) + `<div class="d-wb"><div class="d-goals ${sz === "lh" ? "three" : ""}">${items}</div></div>` };
      }
    },
    stats: {
      title: "Costanza", icon: "chart", sizes: ["mh", "lh", "lv"], go: "insights",
      render(sz) {
        const today = U.today();
        if (!Calc.activeHabits().length) return { cls: "blue", html: head("chart", "Costanza", "% di abitudini fatte") + `<div class="d-wb">${empty("Le statistiche arrivano con la prima abitudine.", cta("Nuova abitudine", "habit-new"))}</div>` };
        const data = monthly(today);
        const hasPrev = data.some((d) => d.prev != null);
        const legend = `<div class="d-legend"><span>Quest'anno</span>${hasPrev ? `<span class="b">Anno scorso</span>` : ""}</div>`;
        // settimana e mese correnti, confrontati con lo stesso tratto del periodo precedente
        const mon = U.mondayOf(today), off = U.diffDays(mon, today);
        const wk = Calc.rate(mon, today), wkPrev = Calc.rate(U.addDays(mon, -7), U.addDays(mon, -7 + off));
        const m0 = today.slice(0, 8) + "01", mOff = U.diffDays(m0, today), pm0 = U.addMonths(m0, -1);
        const pmEnd = U.addDays(pm0, mOff) < m0 ? U.addDays(pm0, mOff) : U.addDays(m0, -1);
        const mo = Calc.rate(m0, today), moPrev = Calc.rate(pm0, pmEnd);
        const kpi = (label, v, prev) => {
          const dlt = v != null && prev != null ? Math.round(v - prev) : null;
          const icn = dlt == null || dlt === 0 ? "flat" : dlt > 0 ? "up" : "down";
          const why = dlt == null ? "" : dlt === 0 ? ", come il periodo prima" : `, ${dlt > 0 ? "più" : "meno"} ${Math.abs(dlt)} punti rispetto al periodo prima`;
          return `<div class="d-kpi" aria-label="${label}: ${v == null ? "nessun dato" : Math.round(v) + "%"}${why}">${ic(icn, 20, 2)}<p>${label}</p><b>${v == null ? "–" : Math.round(v) + "%"}</b></div>`;
        };
        const k = `<div class="d-kpis">${kpi("Questa settimana", wk, wkPrev)}${kpi("Questo mese", mo, moPrev)}${legend}</div>`;
        if (sz === "mh") return { cls: "blue", html: head("chart", "Costanza", "% di abitudini fatte", legend) + `<div class="d-chart">${barChart(true, data)}</div>` };
        return { cls: "blue", html: head("chart", "Costanza", "% di abitudini fatte per mese") + `<div class="d-chart ${sz === "lv" ? "col" : ""}">${barChart(false, data)}${k}</div>` };
      }
    },
    calendar: {
      title: "Storico", icon: "cal", sizes: ["lv", "lh"],
      get go() { return st.calTab === "focus" ? "focus" : st.calTab === "diet" ? "food" : "habits"; },
      render(sz) {
        const c = calendar(sz === "lh");
        const sum = `<div class="d-sum"><b>${plural(c.count, "giorno completato", "giorni completati")}</b><span>${st.calOff !== 0 ? "Mese passato" : c.run ? `Serie in corso: ${plural(c.run, "giorno", "giorni")}` : "Nessuna serie in corso"}</span></div>`;
        if (sz === "lh") return { html: head("cal", "Storico", c.name, c.tabsHTML + calNav()) + `<div class="d-wb" style="flex-direction:row;gap:24px;align-items:stretch"><div style="flex:1;min-width:0">${c.grid}</div><div class="d-calfoot" style="flex-direction:column;align-items:flex-start;justify-content:flex-end">${sum}</div></div>` };
        return { html: head("cal", "Storico", c.name) + `<div class="d-wb" style="gap:18px">${c.tabsHTML}${c.grid}<div class="d-calfoot">${sum}<div class="d-navs">${calNav()}</div></div></div>` };
      }
    },
    weight: {
      title: "Peso", icon: "scale", sizes: ["c", "s", "p", "mh"], go: "body",
      mini() {
        const w = weightSeries();
        if (!w) return { icon: "scale", title: "Peso", value: "—", cap: "Nessuna pesata", p: null, action: `<button type="button" class="d-cbtn" data-act="weight-add" aria-label="Registra il peso">${ic("plus", 15, 2.4)}</button>` };
        const t = Store.cfg().weightTarget, diff = t == null ? null : Math.round((w.last - Number(t)) * 10) / 10;
        return { icon: "scale", title: "Peso", value: U.num(w.last), unit: "kg", cap: t == null ? U.fmtShort(w.lastDate) : Math.abs(diff) < 0.05 ? "Peso ideale" : `${diff > 0 ? "−" : "+"}${U.num(Math.abs(diff))} kg ai ${U.num(Number(t))}`, p: null };
      },
      render(sz) {
        const w = weightSeries();
        if (!w) return { html: head("scale", "Peso", sz === "s" ? "" : "Nessuna pesata") + `<div class="d-wb">${empty(sz === "s" ? "" : "Registra il peso per vedere l'andamento.", cta("Peso", "weight-add"))}</div>` };
        const target = Store.cfg().weightTarget;
        const t = target == null ? null : Number(target), diff = t == null ? null : Math.round((w.last - t) * 10) / 10;
        const miss = t == null ? "Peso ideale da impostare" : Math.abs(diff) < 0.05 ? `Peso ideale raggiunto` : `${diff > 0 ? "Mancano" : "Sotto di"} ${U.num(Math.abs(diff))} kg ${diff > 0 ? "ai" : "rispetto ai"} ${U.num(t)}`;
        if (sz === "s") return { html: head("scale", "Peso", U.fmtShort(w.lastDate)) + `<div class="d-wb end">${big(U.num(w.last), "kg")}<span class="d-cap">${miss}</span></div>` };
        const v = w.win.map((x) => Number(x.kg));
        let spark = "";
        if (v.length > 1) {
          const lo = Math.min(...v, t != null && Math.abs(t - Math.min(...v)) < 2 ? t : Infinity), hi = Math.max(...v);
          const mn = lo - 0.3, mx = hi + 0.3;
          const X = (i) => 4 + (i / (v.length - 1)) * 292, Y = (k) => 50 - ((k - mn) / (mx - mn)) * 44;
          const line = v.map((k, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(k).toFixed(1)}`).join(" ");
          spark = `<svg class="d-spark" viewBox="0 0 300 54" preserveAspectRatio="none" aria-hidden="true"><path d="${line} L296,54 L4,54 Z" fill="var(--hot, #E8792F)" fill-opacity=".16"/><path d="${line}" fill="none" stroke="var(--hot, #E8792F)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        const dl = w.delta == null ? "" : ` · ${w.delta > 0 ? "+" : w.delta < 0 ? "−" : ""}${U.num(Math.abs(w.delta))} kg`;
        return { html: head("scale", "Peso", `${w.label}${dl}`) + `<div class="d-wb end" style="flex-direction:row;align-items:flex-end;gap:16px"><div style="display:grid;gap:4px;flex:none">${big(U.num(w.last), "kg")}<span class="d-cap">${miss}</span></div>${spark}</div>` };
      }
    },
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
        const cover = url ? `<div class="d-cover img"><img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"><span>${esc(r.title)}</span></div>` : `<div class="d-cover"><span>${esc(r.title)}</span></div>`;
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
    meals: {
      title: "Pasti", icon: "bowl", sizes: ["mv", "mh", "lv"], go: "food",
      render(sz) {
        if (typeof Food === "undefined") return { html: head("bowl", "Pasti di oggi") + `<div class="d-wb">${empty("Sezione non disponibile.")}</div>` };
        const today = U.today(), list = Food.entriesOn(today);
        if (!list.length) return { html: head("bowl", "Pasti di oggi", "Niente in programma") + `<div class="d-wb">${empty("Pianifica i pasti o segna cosa hai mangiato.", `<div class="d-acts"><button type="button" class="d-btn deep sm" data-act="go" data-id="food">Pianifica</button><button type="button" class="d-btn glassy sm" data-act="food-extra">${ic("plus", 14, 2.4)}Fuori programma</button></div>`)}</div>` };
        const planned = list.filter((e) => !e.extra), eaten = planned.filter((e) => e.eaten).length;
        const slots = Food.SLOTS.filter(([k]) => list.some((e) => e.slot === k));
        const max = sz === "lv" ? 5 : 3;
        const shown = sz === "lv" ? slots : slots.filter(([k]) => list.some((e) => e.slot === k && !e.eaten)).concat(slots.filter(([k]) => !list.some((e) => e.slot === k && !e.eaten))).slice(0, max)
          .sort((a, b) => Food.slotIdx(a[0]) - Food.slotIdx(b[0]));
        const cells = shown.map(([k, l]) => {
          const es = list.filter((e) => e.slot === k), all = es.every((e) => e.eaten);
          return `<div class="d-meal ${all ? "done" : ""}"><small>${all ? ic("check", 11, 3) : ""}${l}</small><span>${esc(es.map((e) => e.name).join(", "))}</span></div>`;
        }).join("");
        const diet = Food.dayState(today);
        let sub = planned.length ? (diet ? "Dieta rispettata" : `${eaten} di ${planned.length} mangiati`) : "Solo fuori programma";
        const g = Food.goal && Food.goal();
        if (g && sz !== "s") sub += ` · ${esc(g.title)}`;
        const foot = sz === "lv" ? (() => {
          const ad = Food.adherence(U.addDays(today, -6));
          return `<div class="d-row col"><b class="d-subhead">Ultimi 7 giorni</b><div class="d-macros"><span>${ad.ok} di ${ad.planned} giorni rispettati</span></div><button type="button" class="d-btn glassy sm" data-act="food-extra">${ic("plus", 14, 2.4)}Fuori programma</button></div>`;
        })() : "";
        return { html: head("bowl", "Pasti di oggi", sub) + `<div class="d-wb"><div class="d-meals ${sz === "mh" ? "three" : ""}">${cells}</div>${foot}</div>` };
      }
    },
    streak: {
      title: "Serie migliore", icon: "flame", sizes: ["c", "s", "p"], go: "habits",
      mini() {
        const best = Calc.activeHabits().map((h) => ({ h, s: Calc.streak(h) })).sort((a, b) => b.s - a.s)[0];
        return { cls: "orange", icon: "flame", title: "Serie migliore", value: best ? best.s : 0, unit: best && best.s === 1 ? "giorno" : "giorni", cap: best && best.s ? esc(best.h.name) : "Completa un'abitudine", p: null };
      },
      render() {
        const best = Calc.activeHabits().map((h) => ({ h, s: Calc.streak(h) })).sort((a, b) => b.s - a.s)[0];
        if (!best || !best.s) return { cls: "orange", html: head("flame", "Serie") + `<div class="d-wb end">${big(0, "giorni")}<span class="d-cap">${best ? "Completa un'abitudine per iniziare" : "Nessuna abitudine"}</span></div>` };
        const rec = Calc.bestStreak(best.h);
        return { cls: "orange", html: head("flame", "Serie") + `<div class="d-wb end">${big(best.s, best.s === 1 ? "giorno" : "giorni")}<span class="d-cap">${esc(best.h.name)}${rec > best.s ? ` · record ${rec}` : " · è il record"}</span></div>` };
      }
    },

    // ---------- Widget nuovi ----------
    nextHabit: {
      title: "Prossima abitudine", icon: "habit", sizes: ["c", "s", "p", "mh"], go: "habits",
      mini() {
        const d = todayData(), next = d.due.find((h) => !Calc.isDone(h, d.today));
        if (!next) return { icon: "check", title: "Prossima abitudine", value: d.stats.due ? "Fatto" : "—", cap: d.stats.due ? "Tutte le abitudini di oggi" : "Oggi riposo", p: d.stats.due ? 1 : null };
        return { icon: "habit", title: esc(next.name), value: Calc.streak(next), unit: Calc.streak(next) === 1 ? "giorno" : "giorni", cap: esc(next.name), p: null, action: nextBtn(next, d.today) };
      },
      render(sz) {
        const d = todayData(), next = d.due.find((h) => !Calc.isDone(h, d.today));
        if (!next) return { html: head("habit", "Prossima abitudine") + `<div class="d-wb">${empty(d.stats.due ? "Hai fatto tutto per oggi." : "Niente in programma oggi.")}</div>` };
        const s = Calc.streak(next), qty = next.kind !== "check";
        const info = qty ? `${U.num(Calc.value(next, d.today))} di ${U.num(next.target)} ${esc(next.unit || "")}` : s ? `${plural(s, "giorno", "giorni")} di fila` : "Da iniziare";
        return { html: head("habit", "Prossima", `${d.stats.due - d.stats.done} da fare oggi`) + `<div class="d-wb end"><b class="d-hname">${esc(next.name)}</b><div class="d-row"><span class="d-cap">${info}</span>${nextBtn(next, d.today, true)}</div></div>` };
      }
    },
    points: {
      title: "Punteggio", icon: "star", sizes: ["c", "s", "p"], go: "insights",
      mini() {
        const sc = Calc.score(), v = sc.score == null ? null : Math.round(sc.score);
        return { cls: "blue", icon: "star", title: "Punteggio della settimana", value: v == null ? "—" : v, unit: v == null ? "" : "/100", cap: Calc.scoreLabel(v).label, p: v == null ? null : v / 100 };
      },
      render() {
        const sc = Calc.score(), v = sc.score == null ? null : Math.round(sc.score);
        return { cls: "blue", html: head("star", "Punteggio", "Ultimi 7 giorni") + `<div class="d-wb end">${big(v == null ? "—" : v, v == null ? "" : "/100")}<span class="d-cap">${Calc.scoreLabel(v).label}</span></div>` };
      }
    },
    workouts: {
      title: "Allenamenti", icon: "run", sizes: ["c", "s", "p", "mh"], go: "body",
      data() {
        const today = U.today(), mon = U.mondayOf(today);
        const wk = Calc.workoutsIn(mon, today), days = new Set(wk.map((w) => w.workout_date));
        const last = [...Store.d.workouts].sort((a, b) => b.workout_date.localeCompare(a.workout_date))[0];
        return { wk, days, mon, today, last, min: U.sum(wk.map((w) => Number(w.minutes) || 0)) };
      },
      mini() {
        const x = this.data();
        return { icon: "run", title: "Allenamenti", value: x.wk.length, unit: x.wk.length === 1 ? "questa sett." : "questa sett.", cap: x.last ? `Ultimo: ${esc(x.last.kind)} · ${U.fmtShort(x.last.workout_date)}` : "Nessun allenamento", p: Math.min(1, x.days.size / 4), action: `<button type="button" class="d-cbtn" data-act="workout-add" aria-label="Registra un allenamento">${ic("plus", 15, 2.4)}</button>` };
      },
      render(sz) {
        const x = this.data();
        const dots = `<div class="d-wdots" aria-label="${x.days.size} giorni di allenamento questa settimana">${U.DOW_SHORT.map((l, i) => { const d = U.addDays(x.mon, i); return `<span class="${x.days.has(d) ? "on" : ""} ${d === x.today ? "today" : ""}"><i></i>${l}</span>`; }).join("")}</div>`;
        const add = `<button type="button" class="d-cbtn" data-act="workout-add" aria-label="Registra un allenamento">${ic("plus", 15, 2.4)}</button>`;
        if (sz === "s") return { html: head("run", "Allenamenti", "Questa settimana") + `<div class="d-wb end">${big(x.wk.length, x.wk.length === 1 ? "sessione" : "sessioni")}<span class="d-cap">${x.min} minuti</span></div>` };
        return { html: head("run", "Allenamenti", `${plural(x.wk.length, "sessione", "sessioni")} · ${x.min} minuti questa settimana`, add) + `<div class="d-wb end">${dots}<span class="d-cap">${x.last ? `Ultimo: ${esc(x.last.kind)}, ${U.fmtShort(x.last.workout_date)}` : "Ancora nessun allenamento"}</span></div>` };
      }
    },
    deadline: {
      title: "Prossima scadenza", icon: "hourglass", sizes: ["c", "s", "p"], go: "goals",
      pick() {
        return Calc.activeGoals().map((g) => ({ g, gi: goalInfo(g) })).filter((x) => x.gi.due && x.gi.left >= 0).sort((a, b) => a.gi.left - b.gi.left)[0];
      },
      mini() {
        const x = this.pick();
        if (!x) return { icon: "hourglass", title: "Prossima scadenza", value: "—", cap: "Nessuna scadenza", p: null };
        return { cls: "orange", icon: "hourglass", title: esc(x.g.title), value: x.gi.left, unit: x.gi.left === 1 ? "giorno" : "giorni", cap: esc(x.g.title), p: x.gi.pct / 100 };
      },
      render() {
        const x = this.pick();
        if (!x) return { html: head("hourglass", "Scadenza") + `<div class="d-wb">${empty("Nessun obiettivo con una data.")}</div>` };
        return { cls: "orange", html: head("hourglass", "Scadenza", `${x.gi.pct}% fatto`) + `<div class="d-wb end">${big(x.gi.left, x.gi.left === 1 ? "giorno" : "giorni")}<span class="d-cap">${esc(x.g.title)}</span></div>` };
      }
    },
    clock: {
      title: "Orologio", icon: "clock", sizes: ["c", "s"],
      face(size) {
        const ticks = Array.from({ length: 12 }, (_, i) => { const a = (i * 30) * Math.PI / 180, r1 = i % 3 ? 41 : 37; return `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * 44}" y2="${50 - Math.cos(a) * 44}" class="${i % 3 ? "tk" : "tk b"}"/>`; }).join("");
        const n = new Date(), hr = n.getHours() % 12, mi = n.getMinutes(), se = n.getSeconds();
        return `<svg class="d-clock" viewBox="0 0 100 100" style="width:${size}" role="img" aria-label="Ora attuale">${ticks}<line x1="50" y1="50" x2="50" y2="27" class="hh" data-hand="h" transform="rotate(${hr * 30 + mi / 2} 50 50)"/><line x1="50" y1="50" x2="50" y2="17" class="mh" data-hand="m" transform="rotate(${mi * 6 + se / 10} 50 50)"/><line x1="50" y1="56" x2="50" y2="14" class="sh" data-hand="s" transform="rotate(${se * 6} 50 50)"/><circle cx="50" cy="50" r="2.6" class="pin"/></svg>`;
      },
      mini() { return { icon: "clock", title: "Orologio", value: "", cap: "", p: null }; },
      render(sz) {
        const d = new Date();
        if (sz === "c") return { html: `<div class="d-circ clock">${this.face("100%")}</div>` };
        return { html: `<div class="d-wb center" style="gap:6px">${this.face("96px")}<span class="d-cap">${cap1(d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }))}</span></div>` };
      }
    },
    exam: {
      title: "Prossimo esame", icon: "cap", sizes: ["c", "s", "p"], go: "goals",
      pick() {
        const today = U.today();
        const m = Store.d.milestones.filter((x) => x.is_exam && x.exam_date && x.exam_date >= today && Calc.msPct(x) < 100).sort((a, b) => a.exam_date.localeCompare(b.exam_date))[0];
        return m ? { m, left: U.diffDays(today, m.exam_date), pct: Calc.msPct(m) } : null;
      },
      mini() {
        const x = this.pick();
        if (!x) return { icon: "cap", title: "Prossimo esame", value: "—", cap: "Nessun esame in programma", p: null };
        return { icon: "cap", title: esc(x.m.title), value: x.left, unit: x.left === 1 ? "giorno" : "giorni", cap: esc(x.m.title), p: x.pct / 100 };
      },
      render() {
        const x = this.pick();
        if (!x) return { html: head("cap", "Prossimo esame") + `<div class="d-wb">${empty("Nessun esame con una data d'appello.")}</div>` };
        return { html: head("cap", "Esame", `${U.fmtShort(x.m.exam_date)} · ${Math.round(x.pct)}% pronto`) + `<div class="d-wb end">${big(x.left, x.left === 1 ? "giorno" : "giorni")}<span class="d-cap">${esc(x.m.title)}</span></div>` };
      }
    },
    toRead: {
      title: "Da leggere", icon: "link", sizes: ["c", "s", "p"], go: "reading",
      list() { return Store.d.reading_items.filter((r) => r.kind !== "book" && r.status !== "done").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")); },
      mini() {
        const l = this.list();
        return { icon: "link", title: "Da leggere", value: l.length, unit: l.length === 1 ? "link" : "link", cap: l[0] ? esc(l[0].title || l[0].url || "") : "Lista vuota", p: null, action: `<button type="button" class="d-cbtn" data-act="read-add" aria-label="Aggiungi da leggere">${ic("plus", 15, 2.4)}</button>` };
      },
      render() {
        const l = this.list();
        return { html: head("link", "Da leggere", l.length ? "Il più recente" : "") + `<div class="d-wb end">${big(l.length, "link")}<span class="d-cap d-clamp">${l[0] ? esc(l[0].title || l[0].url || "") : "Niente in coda"}</span></div>` };
      }
    },
    quick: {
      title: "Azioni rapide", icon: "bolt", sizes: ["s", "p", "mh"],
      acts: [["scaleAdd", "Peso", "weight-add"], ["run", "Allenamento", "workout-add"], ["bowl", "Pasto", "food-quick"], ["timer", "Focus", "focus-start"], ["book", "Da leggere", "read-add"], ["habit", "Abitudine", "habit-new"]],
      render(sz) {
        const n = sz === "s" ? 4 : sz === "p" ? 5 : 6;
        const btns = this.acts.slice(0, n).map(([i, l, a]) => `<button type="button" class="d-qa" data-act="${a}" aria-label="${l}"><span>${ic(i, 20)}</span>${sz === "s" ? "" : `<small>${l}</small>`}</button>`).join("");
        if (sz === "p") return { html: `<div class="d-pillrow d-qrow">${btns}</div>` };
        if (sz === "s") return { html: `<div class="d-wb center"><div class="d-qas s">${btns}</div></div>` };
        return { html: head("bolt", "Azioni rapide") + `<div class="d-wb end"><div class="d-qas ${sz}">${btns}</div></div>` };
      }
    },
    heat: {
      title: "Ultime settimane", icon: "grid", sizes: ["mh", "lh"], go: "insights",
      render(sz) {
        const weeks = sz === "lh" ? 10 : 5, today = U.today(), mon = U.mondayOf(today);
        const start = U.addDays(mon, -7 * (weeks - 1));
        let cells = "";
        for (let w = 0; w < weeks; w++) for (let i = 0; i < 7; i++) {
          const d = U.addDays(start, w * 7 + i);
          if (d > today) { cells += `<i class="fut"></i>`; continue; }
          const s = Calc.dayStats(d), p = s.pct;
          const lv = p == null ? 0 : p >= 1 ? 4 : p >= .66 ? 3 : p >= .33 ? 2 : p > 0 ? 1 : 0;
          cells += `<i class="l${lv} ${d === today ? "today" : ""}" title="${U.fmtShort(d)}: ${p == null ? "riposo" : Math.round(p * 100) + "%"}"></i>`;
        }
        const r = Calc.rate(start, today);
        return { html: head("grid", "Ultime settimane", `${weeks} settimane · ${r == null ? "nessun dato" : Math.round(r) + "% di abitudini fatte"}`) + `<div class="d-wb center"><div class="d-heat" style="--w:${weeks}" role="img" aria-label="Costanza giorno per giorno nelle ultime ${weeks} settimane">${cells}</div></div>` };
      }
    }
  };

  // ---------- Disposizione ----------
  const valid = (l) => Array.isArray(l) && W[l[0]] && W[l[0]].sizes.includes(l[1]);
  function sanitize(arr) {
    if (!Array.isArray(arr)) return null;
    const seen = new Set(), out = [];
    for (const l of arr) if (valid(l) && !seen.has(l[0])) { seen.add(l[0]); out.push([l[0], l[1]]); }
    return out.length ? out : null;
  }
  function syncLayout() {
    const raw = Store.cfg().homeLayout;
    const json = JSON.stringify(raw || null);
    // Prima lettura, oppure cambiata da un altro dispositivo (e non ho modifiche in sospeso)
    if (!st.layout || (json !== st.seen && !st.saveT && !st.drag)) {
      st.layout = sanitize(raw) || DEFAULT.map((l) => [...l]);
      st.seen = json;
    }
  }
  function save(now = false) {
    clearTimeout(st.saveT);
    const run = () => {
      st.saveT = null;
      const data = st.layout.map((l) => [...l]);
      st.seen = JSON.stringify(data);
      Store.setSettings({ homeLayout: data });
    };
    if (now) run(); else st.saveT = setTimeout(run, 700);
  }
  function commit(focusIdx) { st.focusIdx = focusIdx; save(); App.render(); }

  // ---------- Toast con "Annulla" e annunci per lettori di schermo ----------
  function toast(msg, action, fn) {
    let t = document.getElementById("dash-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "dash-toast"; t.className = "dash-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.innerHTML = `<span></span>`;
    t.firstChild.textContent = msg;
    t.classList.toggle("act", !!action);
    if (action) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = action;
      b.onclick = () => { clearTimeout(toast.t); t.classList.remove("on"); fn(); };
      t.appendChild(b);
    }
    requestAnimationFrame(() => t.classList.add("on"));
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("on"), action ? 5000 : 2400);
  }
  function live(msg) {
    let l = document.getElementById("dash-live");
    if (!l) { l = document.createElement("div"); l.id = "dash-live"; l.className = "dash-sr"; l.setAttribute("aria-live", "assertive"); document.body.appendChild(l); }
    l.textContent = msg;
  }

  // ---------- Disegno ----------
  function widgetHTML([type, sz], idx) {
    const def = W[type];
    let r;
    try { r = (sz === "c" || sz === "p") && def.mini && !(type === "clock" && sz === "c") && type !== "quick" ? shapeHTML(sz, def, def.mini()) : def.render(sz); } catch (e) { console.error(e); r = { html: head(def.icon, def.title) + `<div class="d-wb">${empty("Non riesco a mostrare questi dati.")}</div>` }; }
    const sizes = def.sizes.length > 1 ? `<div class="d-sizes" role="group" aria-label="Formato di ${def.title}">${SIZE_ORDER.filter((x) => def.sizes.includes(x)).map((s) => `<button type="button" data-dash-size="${s}" aria-pressed="${s === sz}" aria-label="${SIZE_NAMES[s]}" title="${SIZE_NAMES[s]}"><svg width="22" height="18" viewBox="0 0 24 18" aria-hidden="true">${sizeIcon(s)}</svg></button>`).join("")}</div>` : "";
    const jd = st.editing ? `style="--jd:-${((idx * 37) % 14) / 100}s"` : "";
    const lbl = st.editing ? `${def.title}, ${SIZE_NAMES[sz].toLowerCase()}, posizione ${idx + 1} di ${st.layout.length}. Frecce per spostare, Canc per rimuovere` : `${def.title}: apri la sezione`;
    return `<article class="d-w d-glass ${r.cls || ""}" data-idx="${idx}" data-size="${sz}" data-type="${type}" tabindex="0" aria-label="${lbl}" ${jd}>${st.editing ? `<button type="button" class="d-x" data-dash-remove aria-label="Rimuovi ${def.title}">${ic("x", 15, 2.6)}</button>` : ""}${r.html}${st.editing ? sizes : ""}</article>`;
  }

  function render(el) {
    syncLayout();
    bindOnce();
    const tools = st.editing
      ? `<button class="d-btn glassy" type="button" data-dash-tool="reset">${ic("reset", 16)}Ripristina</button><button class="d-btn glassy" type="button" data-dash-tool="add">${ic("plus", 16)}Widget</button><button class="d-btn deep" type="button" data-dash-tool="done">Fine</button>`
      : `${unseenNew().length ? `<button class="d-btn orange-btn" type="button" data-dash-tool="add">${ic("star", 16)}${unseenNew().length} widget nuovi</button>` : ""}<button class="d-btn glassy" type="button" data-act="look-open">${ic("image", 16)}Aspetto</button><button class="d-btn deep" type="button" data-dash-tool="edit">${ic("edit", 16)}Modifica Home</button>`;
    el.innerHTML = `<div class="dash">
      <div class="d-bar"><h2>${st.editing ? "Modifica la Home" : "La tua giornata"}</h2><div class="d-tools">${tools}</div></div>
      <section class="d-grid ${st.editing ? "editing" : ""}" aria-label="Widget della Home">${st.layout.map(widgetHTML).join("")}${st.editing ? `<button type="button" class="d-w d-adder" data-size="s" data-dash-tool="add"><span class="d-plus">${ic("plus", 22, 2.4)}</span>Aggiungi widget</button>` : ""}</section>
    </div>`;
    if (st.focusIdx != null) {
      const f = el.querySelector(`.d-w[data-idx="${st.focusIdx}"]`);
      st.focusIdx = null;
      if (f) f.focus({ preventScroll: false });
    }
    startTicker();
  }

  // Il timer si aggiorna ogni secondo senza ridisegnare la pagina
  function startTicker() {
    if (st.timerI) return;
    st.timerI = setInterval(() => {
      const dash = document.querySelector(".view-today .dash");
      if (!dash || App.view !== "today") { clearInterval(st.timerI); st.timerI = null; return; }
      const now = new Date();
      dash.querySelectorAll(".d-clock").forEach((c) => {
        const h = now.getHours() % 12, m = now.getMinutes(), s2 = now.getSeconds();
        c.querySelector('[data-hand="h"]').setAttribute("transform", `rotate(${h * 30 + m / 2} 50 50)`);
        c.querySelector('[data-hand="m"]').setAttribute("transform", `rotate(${m * 6 + s2 / 10} 50 50)`);
        c.querySelector('[data-hand="s"]').setAttribute("transform", `rotate(${s2 * 6} 50 50)`);
      });
      const nodes = dash.querySelectorAll("[data-dash-timer]");
      if (!nodes.length) return;
      const running = focusOk() && !!Focus.run;
      if (nodes[0].dataset.running !== String(running)) return App.render();
      const txt = mmss(remainingSec());
      nodes.forEach((n) => { if (n.textContent !== txt) n.textContent = txt; });
    }, 1000);
  }

  function setEditing(v) {
    st.editing = v;
    App.render();
    if (v) toast("Trascina per spostare · tocca un formato per ridimensionare");
    else if (st.saveT) save(true);
  }
  function removeAt(i) {
    const [item] = st.layout.splice(i, 1);
    commit(Math.min(i, st.layout.length - 1));
    toast(`${W[item[0]].title} rimosso`, "Annulla", () => { st.layout.splice(Math.min(i, st.layout.length), 0, item); commit(i); });
  }
  function resetLayout() {
    const prev = st.layout.map((l) => [...l]);
    st.layout = DEFAULT.map((l) => [...l]);
    commit();
    toast("Disposizione iniziale ripristinata", "Annulla", () => { st.layout = prev; commit(); });
  }
  function openAdd() {
    const used = new Set(st.layout.map((l) => l[0]));
    const fresh = unseenNew();
    const free = Object.entries(W).filter(([k]) => !used.has(k)).sort((a, b) => fresh.includes(b[0]) - fresh.includes(a[0]));
    if (fresh.length) Store.setSettings({ seenWidgets: [...new Set([...(Store.cfg().seenWidgets || []), ...fresh])] });
    Sheet.open({
      title: "Aggiungi un widget",
      body: `<div class="dash-sheet">${free.length
        ? `<div class="d-picks">${free.map(([k, d]) => `<button class="d-pick" type="button" data-pick="${k}"><span class="d-ic">${ic(d.icon, 17)}</span><b>${d.title}${fresh.includes(k) ? ` <em class="d-new">Nuovo</em>` : ""}</b><small>${SIZE_ORDER.filter((x) => d.sizes.includes(x)).map((x) => SIZE_NAMES[x]).join(" · ")}</small></button>`).join("")}</div>`
        : `<p class="d-note">Tutti i widget sono già nella Home. Rimuovine uno per spostarlo altrove.</p>`}</div>`,
      onMount: (root) => {
        root.addEventListener("click", (e) => {
          const p = e.target.closest("[data-pick]");
          if (!p) return;
          const k = p.dataset.pick;
          st.layout.push([k, W[k].sizes.includes("c") ? "c" : W[k].sizes[0]]);
          Sheet.close();
          commit(st.layout.length - 1);
          toast(`${W[k].title} aggiunto in fondo`);
        });
        const first = root.querySelector("[data-pick]");
        if (first) setTimeout(() => first.focus(), 30);
      }
    });
  }
  function goTo(i) {
    const def = W[st.layout[i] && st.layout[i][0]];
    if (def && def.go) App.go(def.go);
  }

  // ---------- Eventi (delegati, installati una volta sola) ----------
  function bindOnce() {
    if (st.bound) return;
    st.bound = true;
    const inDash = (t) => t && t.closest && t.closest(".view-today .dash");

    document.addEventListener("click", (e) => {
      if (!inDash(e.target)) return;
      if (st.suppressClick) { st.suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
      const t = e.target.closest("button");
      if (t && t.dataset.dashTool) {
        const k = t.dataset.dashTool;
        if (k === "edit") return setEditing(true);
        if (k === "done") return setEditing(false);
        if (k === "reset") return resetLayout();
        if (k === "add") return openAdd();
      }
      const w = e.target.closest(".d-w[data-idx]");
      if (!w) return;
      const i = Number(w.dataset.idx);
      if (t) {
        if (t.hasAttribute("data-dash-remove")) return removeAt(i);
        if (t.dataset.dashSize) { st.layout[i][1] = t.dataset.dashSize; return commit(i); }
        if (t.dataset.dashTab) { st.calTab = t.dataset.dashTab; return App.render(); }
        if (t.dataset.dashCal) { st.calOff = Math.min(0, st.calOff + Number(t.dataset.dashCal)); return App.render(); }
        return; // gli altri pulsanti hanno data-act e li gestisce App
      }
      if (e.target.closest("[data-act], a, input, select")) return;
      if (!st.editing) goTo(i);
    }, true);

    document.addEventListener("keydown", (e) => {
      const w = e.target.closest && e.target.closest(".view-today .dash .d-w[data-idx]");
      if (!w || e.target !== w) return;
      const i = Number(w.dataset.idx);
      if (!st.editing) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(i); } return; }
      const mv = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
      if (mv) {
        e.preventDefault();
        const j = i + mv;
        if (j < 0 || j >= st.layout.length) return;
        [st.layout[i], st.layout[j]] = [st.layout[j], st.layout[i]];
        commit(j);
        live(`${W[st.layout[j][0]].title} in posizione ${j + 1} di ${st.layout.length}`);
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeAt(i); }
      if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
    });

    // trascinamento (mouse e dita); pressione lunga su telefono per entrare in modifica
    document.addEventListener("pointerdown", (e) => {
      if (!inDash(e.target)) return;
      const w = e.target.closest(".d-w[data-idx]");
      if (!w) return;
      if (!st.editing) {
        if (e.pointerType === "mouse") return;
        st.press = { t: setTimeout(() => { st.press = null; st.suppressClick = true; setTimeout(() => { st.suppressClick = false; }, 600); setEditing(true); if (navigator.vibrate) navigator.vibrate(15); }, 550), sx: e.clientX, sy: e.clientY };
        return;
      }
      if (e.target.closest("button")) return;
      e.preventDefault();
      const r = w.getBoundingClientRect();
      st.drag = { el: w, grid: w.parentElement, dx: e.clientX - r.left, dy: e.clientY - r.top, last: null, moved: false, sx: e.clientX, sy: e.clientY };
      w.classList.add("dragging");
      moveDrag(e);
    });
    window.addEventListener("pointermove", (e) => {
      if (st.press && Math.hypot(e.clientX - st.press.sx, e.clientY - st.press.sy) > 8) { clearTimeout(st.press.t); st.press = null; }
      if (st.drag) moveDrag(e);
    });
    const endPress = () => { if (st.press) { clearTimeout(st.press.t); st.press = null; } };
    window.addEventListener("pointerup", () => {
      endPress();
      const d = st.drag;
      if (!d) return;
      st.drag = null;
      if (!d.el.isConnected) return App.render();
      const nodes = [...d.grid.querySelectorAll(".d-w[data-idx]")];
      const order = nodes.map((n) => st.layout[Number(n.dataset.idx)]);
      const changed = order.some((l, k) => l !== st.layout[k]);
      st.layout = order;
      const ni = nodes.indexOf(d.el);
      if (changed) { commit(ni); live(`${W[order[ni][0]].title} in posizione ${ni + 1} di ${order.length}`); }
      else App.render();
    });
    window.addEventListener("pointercancel", () => { endPress(); if (st.drag) { st.drag = null; App.render(); } });
    // niente menu contestuale durante la pressione lunga
    document.addEventListener("contextmenu", (e) => { if (inDash(e.target) && e.target.closest(".d-w")) e.preventDefault(); });
  }

  function place(el, e) {
    el.style.transform = "none";
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${e.clientX - st.drag.dx - r.left}px, ${e.clientY - st.drag.dy - r.top}px) scale(1.03)`;
  }
  function moveDrag(e) {
    const d = st.drag, el = d.el;
    if (!el.isConnected) return;
    place(el, e);
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const t = hit && hit.closest && hit.closest(".d-w[data-idx]");
    if (!t || t === el || t.parentElement !== d.grid) { d.last = null; return; }
    if (t === d.last) return;
    d.last = t;
    const items = [...d.grid.querySelectorAll(".d-w[data-idx]")];
    const before = new Map(items.map((n) => [n, n.getBoundingClientRect()]));
    if (items.indexOf(el) < items.indexOf(t)) t.after(el); else t.before(el);
    if (!reduceMotion()) for (const n of items) {
      if (n === el) continue;
      const a = before.get(n), b = n.getBoundingClientRect();
      if (a.left === b.left && a.top === b.top) continue;
      n.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    place(el, e);
  }

  return { render, W, DEFAULT, state: st };
})();

Actions["go"] = (el) => App.go(el.dataset.id);
