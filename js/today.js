// ============================================================
// Oggi: la Home a widget (stile iOS). Ogni widget legge i dati veri
// (Store/Calc) e si ridisegna a ogni modifica. La disposizione si salva
// nelle impostazioni (homeLayout: [{ id, type, size, opts }]), quindi è la stessa
// su tutti i dispositivi; lo stesso widget può esserci più volte.
// Modifica Home: trascina per spostare, × per togliere (con Annulla),
// «Formato» e «Personalizza» sotto ogni widget, + per aggiungere;
// da tastiera frecce e Canc sulla maniglia del widget.
// Su telefono: pressione lunga su un widget per entrare in modifica.
// ============================================================
const Today = (() => {
  // ---------- Icone: la raccolta comune (Icon), con i vecchi nomi della Home ----------
  const ICON_ALIAS = { habit: "habitBox", goal: "target", chart: "bars", play: "playFill" };
  const ic = (n, s = 18, w = 1.8) => Icon.svg(ICON_ALIAS[n] || n, s, "", w);
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
    cal: {},             // stato di ciascun calendario: { [id]: { tab, off } }
    timerI: null,
    bound: false,
    drag: null,
    press: null,
    focusIdx: null,
    focusFmt: false,
    suppressClick: false
  };

  const SIZE_NAMES = { c: "Cerchio", s: "Piccolo", p: "Capsula", mh: "Medio orizzontale", mv: "Medio verticale", lh: "Grande orizzontale", lv: "Grande verticale" };
  const SIZE_ORDER = ["c", "s", "p", "mh", "mv", "lh", "lv"];
  const NEW_WIDGETS = ["nextHabit", "points", "workouts", "deadline", "clock", "exam", "toRead", "quick", "heat"];
  const unseenNew = () => { const seen = Store.cfg().seenWidgets || []; const used = new Set((st.layout || []).map((l) => l.type)); return NEW_WIDGETS.filter((k) => !seen.includes(k) && !used.has(k)); };
  const sizeIcon = (s) => ({ c: '<circle cx="12" cy="9" r="7.5"/>', p: '<rect x="1" y="4.5" width="22" height="9" rx="4.5"/>', s: '<rect x="7" y="4" width="10" height="10" rx="3"/>', mh: '<rect x="2" y="5" width="20" height="9" rx="3"/>', mv: '<rect x="7" y="1" width="10" height="16" rx="3"/>', lh: '<rect x="1" y="2" width="22" height="14" rx="3"/>', lv: '<rect x="4" y="0.5" width="16" height="17" rx="3"/>' })[s];
  // Lo Storico parte compatto: la settimana su telefono, il mese a pallini sugli schermi larghi
  const DEFAULT = [["score", "c"], ["timer", "s"], ["calendar", "mv"], ["stats", "mh"], ["habits", "mv"], ["weight", "c"], ["streak", "c"], ["goals", "lh"], ["focusStats", "p"], ["quick", "p"], ["reading", "mh"], ["recall", "mh"], ["meals", "mh"], ["clock", "c"], ["points", "c"], ["deadline", "c"], ["nextHabit", "c"]];
  const isPhone = () => !!(window.matchMedia && matchMedia("(max-width: 720px)").matches);
  const defaults = () => DEFAULT.map(([k, z]) => ({ id: k, type: k, size: k === "calendar" && isPhone() ? "mh" : z }));

  // ---------- Pezzi comuni ----------
  const head = (icon, title, sub, right = "") => `<header class="d-wh"><span class="d-ic">${ic(icon, 17)}</span><div class="d-tt"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ""}</div>${right ? `<div class="d-right">${right}</div>` : ""}</header>`;
  const big = (v, u) => `<div class="d-big">${v}${u ? `<span class="d-u">${u}</span>` : ""}</div>`;
  const empty = (text, btn = "") => `<div class="d-empty"><p>${text}</p>${btn}</div>`;
  const cta = (label, act, extra = "") => `<button type="button" class="d-btn deep sm" data-act="${act}" ${extra}>${ic("plus", 14, 2.4)}${label}</button>`;
  const ring = (size, p, label, small) => {
    const r = 40, c = 2 * Math.PI * r, v = p == null ? 0 : U.clamp(p, 0, 1);
    return `<div class="d-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="t"/>${v > 0 ? `<circle cx="50" cy="50" r="${r}" class="v" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}"/>` : ""}</svg><div class="d-lbl"><span><b>${label}</b>${small ? `<small>${small}</small>` : ""}</span></div></div>`;
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
  const inArea = (o) => (h) => !o || !o.area || h.area === o.area;
  const areaTitle = (o) => (o && o.area && AREAS[o.area] ? `Abitudini · ${U.esc(AREAS[o.area].label)}` : "Abitudini");
  const pickHabit = (o) => (o && o.habit && Calc.activeHabits().find((h) => h.id === o.habit)) || null;
  const pickGoal = (o) => (o && o.goal && Calc.activeGoals().find((g) => g.id === o.goal)) || null;
  const todayData = (o) => {
    const today = U.today();
    const due = Calc.habitsDueOn(today).filter(inArea(o));
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

  // Primo giorno con dati per ciascuna scheda (prima non c'è niente da mostrare)
  function firstDataDay(tab) {
    const today = U.today();
    let min = today;
    const take = (d) => { if (d && d < min) min = d; };
    if (tab === "focus") Calc.focusDone().forEach((s) => take(U.dateOf(s.started_at)));
    else {
      const diet = tab === "diet" && typeof Food !== "undefined" && Food.habit ? Food.habit() : null;
      Store.d.habit_logs.forEach((l) => { if (!diet || l.habit_id === diet.id) take(l.log_date); });
      if (min === today) Store.d.habits.forEach((h) => { if (!diet || h.id === diet.id) take(h.start_date || (h.created_at ? U.dateOf(h.created_at) : null)); });
    }
    return min;
  }

  // Ultimi 7 mesi: costanza di quest'anno e degli stessi mesi dell'anno scorso.
  // I mesi prima del primo dato non si mostrano (pallini grigi vuoti sembrano un caricamento).
  function monthly(today) {
    const out = [];
    const first = today.slice(0, 8) + "01", since = firstDataDay("habits").slice(0, 8) + "01";
    for (let i = 6; i >= 0; i--) {
      const from = U.addMonths(first, -i);
      const to0 = U.addDays(U.addMonths(from, 1), -1), to = to0 > today ? today : to0;
      const pFrom = U.addMonths(from, -12), pTo = U.addDays(U.addMonths(pFrom, 1), -1);
      const m = U.parse(from).getMonth();
      const v = Calc.rate(from, to);
      if (!out.length && i > 0 && (from < since || v == null)) continue;
      out.push({ label: cap1(U.MONTHS[m]), v, prev: Calc.rate(pFrom, pTo) });
    }
    return out;
  }

  // Barre dei mesi (bianche sul widget blu: currentColor) e linea dell'anno scorso.
  // Con meno di 7 mesi le barre restano larghe uguali e si centrano.
  function barChart(wide, data) {
    const W = wide ? 470 : 330, H = wide ? 132 : 170, base = H - 26, bw = wide ? 40 : 30, step = (W - 20 - bw) / 6;
    const x0 = (W - ((data.length - 1) * step + bw)) / 2;
    const x = (i) => x0 + i * step, y = (v) => base - (v / 100) * (base - 14);
    const bars = data.map((d, i) => {
      const v = d.v == null ? 0 : d.v;
      const hh = Math.max(bw, base - y(v));
      return i === data.length - 1
        ? `<rect x="${x(i)}" y="${y(100)}" width="${bw}" height="${base - y(100)}" rx="${bw / 2}" fill="currentColor" fill-opacity=".16"/><rect x="${x(i) + 4}" y="${base - Math.max(bw - 8, base - y(v) - 8) - 4}" width="${bw - 8}" height="${Math.max(bw - 8, base - y(v) - 8)}" rx="${bw / 2 - 4}" fill="currentColor" fill-opacity="${d.v == null ? .35 : 1}"/>`
        : `<rect x="${x(i)}" y="${base - hh}" width="${bw}" height="${hh}" rx="${bw / 2}" fill="currentColor" fill-opacity="${d.v == null ? .25 : 1}"/>`;
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
    const labels = data.map((d, i) => `<text x="${x(i) + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" fill-opacity="${i === data.length - 1 ? 1 : .8}">${d.label}</text>`).join("");
    const aria = data.map((d) => `${d.label} ${d.v == null ? "nessun dato" : Math.round(d.v) + "%"}`).join(", ");
    return `<svg class="d-bars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Abitudini completate per mese: ${aria}"><defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>${bars}${path ? `<path d="${path.trim()}" fill="none" stroke="url(#${gid})" stroke-width="6" stroke-linecap="round"/>` : ""}${labels}</svg>`;
  }

  // Calendario: quali giorni sono "pieni" per ciascuna scheda
  // Calendario attivo: ogni istanza ha scheda e mese suoi (la scheda parte da quella scelta in Personalizza)
  let cs = { tab: "habits", off: 0 };
  const calState = (o) => (cs = st.cal[o.id] || (st.cal[o.id] = { tab: o.tab || "habits", off: 0 }));
  function calTabs() {
    const tabs = [["habits", "Abitudini"]];
    if (Store.d.focus_sessions.some((s) => s.completed)) tabs.push(["focus", "Focus"]);
    const diet = typeof Food !== "undefined" && Food.habit ? Food.habit() : null;
    if (diet) tabs.push(["diet", "Dieta"]);
    if (!tabs.some(([k]) => k === cs.tab)) cs.tab = "habits";
    return { tabs, diet };
  }

  // Quanti mesi indietro si può andare: non prima del mese del primo dato
  function calMinOff() {
    const t = U.parse(U.today()), f = U.parse(firstDataDay(cs.tab));
    return -((t.getFullYear() - f.getFullYear()) * 12 + t.getMonth() - f.getMonth());
  }
  function fullTest(diet) {
    if (cs.tab === "focus") { const days = new Set(Calc.focusDone().map((s) => U.dateOf(s.started_at))); return (d) => days.has(d); }
    if (cs.tab === "diet") return (d) => (diet ? Calc.isDone(diet, d) : false);
    return (d) => { const s = Calc.dayStats(d); return s.pct != null && s.pct >= 1; };
  }
  // la serie conta all'indietro da ieri (oggi è ancora in corso), anche oltre l'inizio del mese
  function runOf(isFull, today) {
    let run = 0, d = isFull(today) ? today : U.addDays(today, -1);
    for (let i = 0; i < 400 && isFull(d); i++, d = U.addDays(d, -1)) run++;
    return run;
  }
  const tabsOf = (tabs) => tabs.length > 1 ? `<div class="d-tabs" role="group" aria-label="Cosa mostrare">${tabs.map(([k, l]) => `<button type="button" data-dash-tab="${k}" aria-pressed="${cs.tab === k}">${l}</button>`).join("")}</div>` : "";

  // Giorni pieni nel mese in corso (per cerchio e piccolo)
  function monthCount() {
    const { diet } = calTabs(), today = U.today(), isFull = fullTest(diet), first = today.slice(0, 8) + "01";
    const days = U.range(first, today);
    return { count: days.filter(isFull).length, elapsed: days.length, m: U.parse(today).getMonth(), run: runOf(isFull, today) };
  }
  function calendar(mode) {
    const { tabs, diet } = calTabs();
    const today = U.today();
    cs.off = U.clamp(cs.off, Math.min(0, calMinOff()), 0);
    const base = U.addMonths(today.slice(0, 8) + "01", cs.off);
    const Y = U.parse(base).getFullYear(), M = U.parse(base).getMonth();
    const days = new Date(Y, M + 1, 0).getDate();
    const first = U.dow(base) - 1;
    const isFull = fullTest(diet);
    let h = U.DOW_SHORT.map((d) => `<span class="d-dn" aria-hidden="true">${d}</span>`).join(""), count = 0;
    for (let i = 0; i < first; i++) h += `<span class="d-d pad"></span>`;
    for (let n = 1; n <= days; n++) {
      const d = `${Y}-${U.pad(M + 1)}-${U.pad(n)}`;
      const fut = d > today, isToday = d === today, f = !fut && isFull(d);
      if (f) count++;
      h += `<span class="d-d ${fut ? "fut" : f ? "full" : ""} ${isToday ? "today" : ""}">${n}</span>`;
    }
    const run = cs.off === 0 ? runOf(isFull, today) : 0;
    const name = `${cap1(U.MONTHS_LONG[M])} ${Y}`;
    return { grid: `<div class="d-cal ${mode}" role="img" aria-label="${plural(count, "giorno completato", "giorni completati")} in ${name}">${h}</div>`, name, count, run, tabsHTML: tabsOf(tabs) };
  }
  // Versione compatta: solo la settimana in corso
  function calWeek() {
    const { tabs, diet } = calTabs();
    const today = U.today(), mon = U.mondayOf(today), isFull = fullTest(diet);
    let h = U.DOW_SHORT.map((d) => `<span class="d-dn" aria-hidden="true">${d}</span>`).join(""), count = 0;
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(mon, i), fut = d > today, f = !fut && isFull(d);
      if (f) count++;
      h += `<span class="d-d ${fut ? "fut" : f ? "full" : ""} ${d === today ? "today" : ""}">${U.parse(d).getDate()}</span>`;
    }
    const tab = tabs.find(([k]) => k === cs.tab)[1];
    return { grid: `<div class="d-cal week" role="img" aria-label="${tab}: ${plural(count, "giorno completato", "giorni completati")} questa settimana">${h}</div>`, count, run: runOf(isFull, today), tab };
  }
  const calNav = () => `<button type="button" class="d-navbtn" data-dash-cal="-1" aria-label="Mese precedente" ${cs.off <= calMinOff() ? "disabled" : ""}>${ic("left", 18, 2.2)}</button><button type="button" class="d-navbtn" data-dash-cal="1" aria-label="Mese successivo" ${cs.off >= 0 ? "disabled" : ""}>${ic("right", 18, 2.2)}</button>`;

  function goalInfo(g) {
    const pace = Calc.goalPace(g);
    const due = g.horizon === "recurring" ? Calc.periodRange(g.period)[1] : g.due_date;
    const left = Calc.daysLeft(g);
    const ms = Calc.milestonesOf(g);
    const steps = ms.map((m) => [m.title, Calc.msPct(m) >= 100]);
    const nexts = ms.filter((m) => Calc.msPct(m) < 100).slice(0, 2).map((m) => ({ title: m.title, date: m.exam_date || m.due_date || null }));
    return { pct: Math.round(pace.progress), pace, due, left, steps, nexts, doneSteps: steps.filter((x) => x[1]).length };
  }
  const leftChip = (gi) => gi.due ? `<span class="d-chip ${gi.left < 0 ? "late" : gi.left <= 7 ? "soon" : ""}">${ic("hourglass", 12, 2.2)}${gi.left > 0 ? plural(gi.left, "giorno", "giorni") : gi.left === 0 ? "Oggi" : "Scaduto"}</span>` : "";
  const dueTxt = (gi) => gi.due ? `Scade il ${U.fmtShort(gi.due)} · ${gi.left > 0 ? `tra ${plural(gi.left, "giorno", "giorni")}` : gi.left === 0 ? "oggi" : `scaduto da ${plural(-gi.left, "giorno", "giorni")}`}` : "";

  function linkLabel(run) {
    if (!run || !run.link) return "In corso";
    const [type, id] = run.link.split(":");
    const s = { goal_id: type === "g" ? id : null, milestone_id: type === "m" ? id : null, habit_id: type === "h" ? id : null };
    return (typeof Focus.linkName === "function" && Focus.linkName(s)) || "In corso";
  }
  const focusOk = () => typeof Focus !== "undefined";
  const minOf = (o) => Number(o && o.min) || (focusOk() ? Focus.minutes : 25);
  const remainingSec = (o) => (focusOk() && Focus.run ? Focus.run.durationMin * 60 - Focus.elapsedSec() : minOf(o) * 60);
  // avvio dal widget: con la durata scelta per quel widget (se c'è)
  const startBtn = (o, cls, size) => `<button type="button" ${cls ? `class="${cls}"` : ""} data-act="dash-focus" data-min="${minOf(o)}" aria-label="Avvia una sessione di ${minOf(o)} minuti">${ic("play", size, 2.6)}</button>`;

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
      mini(o) {
        const d = todayData(o), next = d.due.find((h) => !Calc.isDone(h, d.today));
        return { icon: "habit", title: areaTitle(o), value: `${d.stats.done}/${d.stats.due}`, cap: next ? `Prossima: ${esc(next.name)}` : d.stats.due ? "Tutte fatte" : "Oggi riposo", p: d.stats.due ? d.stats.pct || 0 : null, action: next ? nextBtn(next, d.today) : "" };
      },
      render(sz, o) {
        const d = todayData(o), title = areaTitle(o);
        if (!d.due.length) {
          const none = !Calc.activeHabits().filter(inArea(o)).length;
          return { html: head("habit", title, none ? "Nessuna abitudine" : "Oggi riposo") + `<div class="d-wb">${empty(none ? "Inizia con una sola: piccola e chiara." : "Niente in programma oggi: goditi il riposo.", cta("Nuova abitudine", "habit-new"))}</div>` };
        }
        const n = { mh: 2, mv: 4, lh: 8, lv: 7 }[sz];
        const order = [...d.due].sort((a, b) => Calc.isDone(a, d.today) - Calc.isDone(b, d.today));
        const list = order.slice(0, n).map((h) => habBtn(h, d.today)).join("");
        const rest = d.due.length - n, left = habitLeft(d);
        const pct = Math.round((d.stats.pct || 0) * 100);
        const foot = sz === "lv" ? `<div class="d-row"><div class="d-legend"><span>Fatte ${d.stats.done}</span><span class="b">Da fare ${left}</span></div>${big(pct, "%")}</div>` : rest > 0 ? `<span class="d-more">Altre ${rest} nella sezione Abitudini</span>` : "";
        return { html: head("habit", title, left ? `${left} da fare oggi` : "Tutte fatte") + `<div class="d-wb"><div class="d-habits ${sz === "lh" ? "two" : ""}">${list}</div>${foot}</div>` };
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
      mini(o) {
        const running = focusOk() && !!Focus.run;
        const btn = running
          ? `<button type="button" class="d-cbtn" data-act="focus-giveup" aria-label="Interrompi la sessione">${ic("stop", 14)}</button>`
          : startBtn(o, "d-cbtn", 15);
        const p = running ? Focus.elapsedSec() / (Focus.run.durationMin * 60) : null;
        return { cls: "blue", icon: "timer", title: "Sessione di focus", value: `<span data-dash-timer data-running="${running}" role="timer">${mmss(remainingSec(o))}</span>`, cap: running ? esc(linkLabel(Focus.run)) : `Pronta · ${minOf(o)} min`, p, action: btn };
      },
      render(sz, o) {
        const running = focusOk() && !!Focus.run;
        const btns = `<div class="d-tbtns">${running
          ? `<button type="button" data-act="focus-giveup" aria-label="Interrompi la sessione">${ic("stop", 16)}</button>`
          : startBtn(o, "", 18)}</div>`;
        const state = running ? linkLabel(Focus.run) : `Pronta · ${minOf(o)} min`;
        const time = `<span class="d-timer" data-dash-timer data-running="${running}" role="timer" aria-label="${running ? "Tempo rimanente" : "Durata"}">${mmss(remainingSec(o))}</span>`;
        if (sz === "s") return { cls: "blue", html: head("timer", "Focus", esc(state)) + `<div class="d-wb end" style="gap:10px">${time}${btns}</div>` };
        return { cls: "blue", html: head("timer", "Sessione di focus", esc(state)) + `<div class="d-wb"><div class="d-row">${time}${btns}</div></div>` };
      }
    },
    goals: {
      title: "Obiettivi", icon: "goal", sizes: ["c", "p", "mh", "mv", "lh", "lv"], go: "goals",
      mini(o) {
        const g = pickGoal(o) || Calc.activeGoals().slice().sort((a, b) => (goalInfo(a).due || "9999").localeCompare(goalInfo(b).due || "9999"))[0];
        if (!g) return { icon: "goal", title: "Obiettivi", value: "0", cap: "Nessun obiettivo attivo", p: null };
        const gi = goalInfo(g);
        return { icon: "goal", title: esc(g.title), value: gi.pct, unit: "%", cap: gi.due ? `Scade il ${U.fmtShort(gi.due)} · ${gi.pace.label}` : gi.pace.label, p: gi.pct / 100 };
      },
      render(sz, o) {
        const one = pickGoal(o);
        const goals = one ? [one] : Calc.activeGoals().slice().sort((a, b) => (goalInfo(a).due || "9999").localeCompare(goalInfo(b).due || "9999"));
        if (!goals.length) return { html: head("goal", "Obiettivi", "Nessuno attivo") + `<div class="d-wb">${empty("Definisci dove vuoi arrivare in 1, 4 o 12 mesi.", cta("Nuovo obiettivo", "goal-new"))}</div>` };
        const n = { mh: 2, mv: 3, lh: 3, lv: 4 }[sz];
        const items = goals.slice(0, n).map((g) => {
          const gi = goalInfo(g);
          if (sz === "lh") {
            // scheda piena: % grande e giorni rimasti, poi le prossime 2 tappe, in fondo ritmo e tappe fatte
            const nx = gi.nexts.length ? `<div class="d-nx"><small>${gi.nexts.length > 1 ? "Prossime tappe" : "Prossima tappa"}</small><ul>${gi.nexts.map((m) => `<li><span>${esc(m.title)}</span>${m.date ? `<em>${U.fmtShort(m.date)}</em>` : ""}</li>`).join("")}</ul></div>` : `<div class="d-nx"><small>Tappe</small><b>${gi.steps.length ? "Tutte completate" : "Nessuna tappa"}</b></div>`;
            const meta = [gi.pace.label, gi.steps.length ? `${gi.doneSteps} di ${gi.steps.length} tappe` : "", gi.due ? `scade il ${U.fmtShort(gi.due)}` : ""].filter(Boolean).join(" · ");
            return `<div class="d-goal"><div class="d-t"><span>${esc(g.title)}</span></div><div class="d-gtop"><div class="d-pbig">${gi.pct}<span class="d-u">%</span></div>${leftChip(gi)}</div>${track(gi.pct, `${gi.pct}%, ${gi.pace.label}`)}${nx}<span class="d-meta">${meta}</span></div>`;
          }
          const stepsHTML = sz === "lv" && gi.steps.length ? `<div class="d-steps">${gi.steps.slice(0, 5).map(([t, d]) => `<span class="d-step ${d ? "done" : ""}">${d ? ic("check", 12, 2.8) : ""}${esc(t)}</span>`).join("")}${gi.steps.length > 5 ? `<span class="d-step">+${gi.steps.length - 5}</span>` : ""}</div>` : "";
          return `<div class="d-goal"><div class="d-t"><span>${esc(g.title)}</span><span class="d-p">${gi.pct}%</span></div>${track(gi.pct, `${gi.pct}%, ${gi.pace.label}`)}${stepsHTML}<span class="d-meta">${dueTxt(gi)} · ${gi.pace.label}</span></div>`;
        }).join("");
        const g0 = goalInfo(goals[0]);
        const sub = one ? (dueTxt(g0) || g0.pace.label) : `${goals.length} ${goals.length === 1 ? "attivo" : "attivi"}${g0.due ? ` · il prossimo scade il ${U.fmtShort(g0.due)}` : ""}`;
        return { html: head("goal", "Obiettivi", sub) + `<div class="d-wb"><div class="d-goals ${sz === "lh" ? (goals.length > 1 ? "three" : "three one") : ""}">${items}</div></div>` };
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
      title: "Storico", icon: "cal", sizes: ["c", "s", "mh", "mv", "lh", "lv"],
      go(o) { const t = calState(o).tab; return t === "focus" ? "focus" : t === "diet" ? "food" : "habits"; },
      // cerchio: giorni pieni di questo mese, l'anello è la quota sui giorni passati
      mini(o) {
        calState(o);
        const c = monthCount(), tab = calTabs().tabs.find(([k]) => k === cs.tab)[1];
        return { icon: "cal", title: `Storico · ${tab}`, value: c.count, unit: c.count === 1 ? "giorno" : "giorni", cap: `pieni a ${U.MONTHS_LONG[c.m]}`, p: c.count / c.elapsed };
      },
      render(sz, o) {
        calState(o);
        if (sz === "s") {
          const c = monthCount();
          return { html: head("cal", "Storico", cap1(U.MONTHS_LONG[c.m])) + `<div class="d-wb end">${big(c.count, c.count === 1 ? "giorno" : "giorni")}<span class="d-cap">${c.run ? `Serie in corso: ${plural(c.run, "giorno", "giorni")}` : "pieni questo mese"}</span></div>` };
        }
        if (sz === "mh") {
          const c = calWeek();
          return { html: head("cal", "Storico", `${c.tab} · ${plural(c.count, "giorno pieno", "giorni pieni")} questa settimana`) + `<div class="d-wb end">${c.grid}<span class="d-cap">${c.run ? `Serie in corso: ${plural(c.run, "giorno", "giorni")}` : "Nessuna serie in corso"}</span></div>` };
        }
        const c = calendar(sz === "lh" ? "tight" : sz === "mv" ? "dots" : "");
        const sum = `<div class="d-sum"><b>${plural(c.count, "giorno completato", "giorni completati")}</b><span>${cs.off !== 0 ? "Mese passato" : c.run ? `Serie in corso: ${plural(c.run, "giorno", "giorni")}` : "Nessuna serie in corso"}</span></div>`;
        if (sz === "mv") return { html: head("cal", "Storico", c.name) + `<div class="d-wb">${c.grid}<div class="d-calfoot col">${sum}<div class="d-navs">${calNav()}</div></div></div>` };
        if (sz === "lh") return { html: head("cal", "Storico", c.name, c.tabsHTML + calNav()) + `<div class="d-wb d-calrow"><div class="d-calgrid">${c.grid}</div><div class="d-calfoot col">${sum}</div></div>` };
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
          spark = `<svg class="d-spark" viewBox="0 0 300 54" preserveAspectRatio="none" aria-hidden="true"><path d="${line} L296,54 L4,54 Z" class="a"/><path d="${line}" class="l" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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
    meals: {
      title: "Pasti", icon: "bowl", sizes: ["mh", "mv", "lv"], go: "food",
      render(sz, o) {
        if (typeof Food === "undefined") return { html: head("bowl", "Pasti di oggi") + `<div class="d-wb">${empty("Sezione non disponibile.")}</div>` };
        const want = o && Array.isArray(o.slots) && o.slots.length ? o.slots : null;
        const today = U.today(), list = Food.entriesOn(today).filter((e) => !want || want.includes(e.slot));
        if (!list.length) return { html: head("bowl", "Pasti di oggi", "Niente in programma") + `<div class="d-wb">${empty("Pianifica i pasti o segna cosa hai mangiato.", `<div class="d-acts"><button type="button" class="d-btn deep sm" data-act="go" data-id="food">Pianifica</button><button type="button" class="d-btn glassy sm" data-act="food-extra">${ic("plus", 14, 2.4)}Fuori programma</button></div>`)}</div>` };
        const planned = list.filter((e) => !e.extra), eaten = planned.filter((e) => e.eaten).length;
        const slots = Food.SLOTS.filter(([k]) => list.some((e) => e.slot === k));
        // fino a 4 pasti (prima quelli ancora da mangiare), tutti nel formato grande
        const open = ([k]) => list.some((e) => e.slot === k && !e.eaten);
        const shown = sz === "lv" ? slots : slots.filter(open).concat(slots.filter((x) => !open(x))).slice(0, 4).sort((a, b) => Food.slotIdx(a[0]) - Food.slotIdx(b[0]));
        // ogni pasto è un interruttore: segna mangiati (o no) tutti i piatti in programma di quel pasto
        const cells = shown.map(([k, l]) => {
          const es = list.filter((e) => e.slot === k), all = es.every((e) => e.eaten), names = esc(es.map((e) => e.name).join(", "));
          return `<button type="button" class="d-meal ${all ? "done" : ""}" data-act="dash-meal" data-slot="${k}" aria-pressed="${all}" aria-label="${l}: ${names}. ${all ? "Mangiato, tocca per annullare" : "Segna come mangiato"}"><span class="d-mck">${ic("check", 13, 3)}</span><span class="d-mtx"><small>${l}</small><span>${names}</span></span></button>`;
        }).join("");
        const diet = Food.dayState(today);
        let sub = planned.length ? (diet ? "Dieta rispettata" : `${eaten} di ${planned.length} mangiati`) : "Solo fuori programma";
        const g = Food.goal && Food.goal();
        if (g) sub += ` · ${esc(g.title)}`;
        const foot = sz === "lv" ? (() => {
          const ad = Food.adherence(U.addDays(today, -6));
          return `<div class="d-row col"><b class="d-subhead">Ultimi 7 giorni</b><div class="d-macros"><span>${ad.ok} di ${ad.planned} giorni rispettati</span></div><button type="button" class="d-btn glassy sm" data-act="food-extra">${ic("plus", 14, 2.4)}Fuori programma</button></div>`;
        })() : "";
        return { html: head("bowl", "Pasti di oggi", sub) + `<div class="d-wb"><div class="d-meals ${sz === "mh" ? "two" : ""}">${cells}</div>${foot}</div>` };
      }
    },
    streak: {
      title: "Serie", icon: "flame", sizes: ["c", "s", "p"], go: "habits",
      best(o) {
        const h = pickHabit(o);
        if (h) return { h, s: Calc.streak(h), fixed: true };
        return Calc.activeHabits().map((x) => ({ h: x, s: Calc.streak(x) })).sort((a, b) => b.s - a.s)[0];
      },
      mini(o) {
        const best = this.best(o);
        return { cls: "orange", icon: "flame", title: best && best.fixed ? esc(best.h.name) : "Serie migliore", value: best ? best.s : 0, unit: best && best.s === 1 ? "giorno" : "giorni", cap: best && (best.s || best.fixed) ? esc(best.h.name) : "Completa un'abitudine", p: null };
      },
      render(sz, o) {
        const best = this.best(o);
        const title = best && best.fixed ? "Serie" : "Serie migliore";
        if (!best || (!best.s && !best.fixed)) return { cls: "orange", html: head("flame", title) + `<div class="d-wb end">${big(0, "giorni")}<span class="d-cap">${best ? "Completa un'abitudine per iniziare" : "Nessuna abitudine"}</span></div>` };
        const rec = Calc.bestStreak(best.h);
        return { cls: "orange", html: head("flame", title) + `<div class="d-wb end">${big(best.s, best.s === 1 ? "giorno" : "giorni")}<span class="d-cap">${esc(best.h.name)}${rec > best.s ? ` · record ${rec}` : best.s ? " · è il record" : ""}</span></div>` };
      }
    },

    // ---------- Widget nuovi ----------
    nextHabit: {
      title: "Prossima abitudine", icon: "habit", sizes: ["c", "s", "p", "mh"], go: "habits",
      // con un'abitudine scelta mostra sempre quella; altrimenti la prima ancora da fare oggi
      pick(o) {
        const d = todayData(), h = pickHabit(o);
        if (h) return { d, h, due: d.due.includes(h), done: Calc.isDone(h, d.today), fixed: true };
        const n = d.due.find((x) => !Calc.isDone(x, d.today));
        return { d, h: n || null, due: !!n, done: false };
      },
      mini(o) {
        const { d, h, due, done, fixed } = this.pick(o);
        if (!h) return { icon: "check", title: "Prossima abitudine", value: d.stats.due ? "Fatto" : "—", cap: d.stats.due ? "Tutte le abitudini di oggi" : "Oggi riposo", p: d.stats.due ? 1 : null };
        const s = Calc.streak(h);
        return { icon: done ? "check" : "habit", title: esc(h.name), value: s, unit: s === 1 ? "giorno" : "giorni", cap: fixed && !due ? "Non in programma oggi" : esc(h.name), p: done ? 1 : null, action: due && !done ? nextBtn(h, d.today) : "" };
      },
      render(sz, o) {
        const { d, h, due, done, fixed } = this.pick(o);
        if (!h) return { html: head("habit", "Prossima abitudine") + `<div class="d-wb">${empty(d.stats.due ? "Hai fatto tutto per oggi." : "Niente in programma oggi.")}</div>` };
        const s = Calc.streak(h), qty = h.kind !== "check";
        const info = !due ? "Non in programma oggi" : done ? "Fatta oggi" : qty ? `${U.num(Calc.value(h, d.today))} di ${U.num(h.target)} ${esc(h.unit || "")}` : s ? `${plural(s, "giorno", "giorni")} di fila` : "Da iniziare";
        return { html: head("habit", fixed ? "Abitudine" : "Prossima", fixed ? (s ? `${plural(s, "giorno", "giorni")} di fila` : "") : `${d.stats.due - d.stats.done} da fare oggi`) + `<div class="d-wb end"><b class="d-hname">${esc(h.name)}</b><div class="d-row"><span class="d-cap">${info}</span>${due && !done ? nextBtn(h, d.today, true) : ""}</div></div>` };
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
        return { icon: "run", title: "Allenamenti", value: x.wk.length, unit: "questa sett.", cap: x.last ? `Ultimo: ${esc(x.last.kind)} · ${U.fmtShort(x.last.workout_date)}` : "Nessun allenamento", p: Math.min(1, x.days.size / 4), action: `<button type="button" class="d-cbtn" data-act="workout-add" aria-label="Registra un allenamento">${ic("plus", 15, 2.4)}</button>` };
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
      pick(o) {
        const g = pickGoal(o);
        if (g) { const gi = goalInfo(g); return gi.due ? { g, gi } : null; }
        return Calc.activeGoals().map((x) => ({ g: x, gi: goalInfo(x) })).filter((x) => x.gi.due && x.gi.left >= 0).sort((a, b) => a.gi.left - b.gi.left)[0];
      },
      mini(o) {
        const x = this.pick(o);
        if (!x) return { icon: "hourglass", title: "Prossima scadenza", value: "—", cap: "Nessuna scadenza", p: null };
        return { cls: "orange", icon: "hourglass", title: esc(x.g.title), value: Math.abs(x.gi.left), unit: x.gi.left < 0 ? "di ritardo" : x.gi.left === 1 ? "giorno" : "giorni", cap: esc(x.g.title), p: x.gi.pct / 100 };
      },
      render(sz, o) {
        const x = this.pick(o);
        if (!x) return { html: head("hourglass", "Scadenza") + `<div class="d-wb">${empty("Nessun obiettivo con una data.")}</div>` };
        return { cls: "orange", html: head("hourglass", "Scadenza", `${x.gi.pct}% fatto`) + `<div class="d-wb end">${big(Math.abs(x.gi.left), x.gi.left < 0 ? "di ritardo" : x.gi.left === 1 ? "giorno" : "giorni")}<span class="d-cap">${esc(x.g.title)}</span></div>` };
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
        return { icon: "link", title: "Da leggere", value: l.length, unit: "link", cap: l[0] ? esc(l[0].title || l[0].url || "") : "Lista vuota", p: null, action: `<button type="button" class="d-cbtn" data-act="read-add" aria-label="Aggiungi da leggere">${ic("plus", 15, 2.4)}</button>` };
      },
      render() {
        const l = this.list();
        return { html: head("link", "Da leggere", l.length ? "Il più recente" : "") + `<div class="d-wb end">${big(l.length, "link")}<span class="d-cap d-clamp">${l[0] ? esc(l[0].title || l[0].url || "") : "Niente in coda"}</span></div>` };
      }
    },
    quick: {
      title: "Azioni rapide", icon: "bolt", sizes: ["s", "p", "mh"],
      acts: [["scale", "Peso", "weight-add"], ["run", "Allenamento", "workout-add"], ["bowl", "Pasto", "food-quick"], ["timer", "Focus", "focus-start"], ["book", "Da leggere", "read-add"], ["habit", "Abitudine", "habit-new"]],
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
        return { html: head("grid", "Ultime settimane", `${weeks} settimane · ${r == null ? "nessun dato" : Math.round(r) + "% di abitudini fatte"}`) + `<div class="d-wb center"><div class="d-heat" role="img" aria-label="Costanza giorno per giorno nelle ultime ${weeks} settimane">${cells}</div></div>` };
      }
    }
  };

  // ---------- Disposizione ----------
  // Ogni voce è { id, type, size, opts? }: lo stesso tipo può comparire più volte (id diversi).
  // Le vecchie voci [tipo, formato] si convertono alla lettura (id = tipo).
  const TINTS = [["glass", "Vetro"], ["blue", "Blu"], ["orange", "Arancio"]];
  const newId = (type) => (st.layout || []).some((l) => l.id === type) ? `${type}-${Math.random().toString(36).slice(2, 7)}` : type;
  function toEntry(l) {
    const e = Array.isArray(l) ? { id: l[0], type: l[0], size: l[1] } : l && typeof l === "object" ? { id: l.id || l.type, type: l.type, size: l.size, opts: l.opts } : null;
    if (!e || !W[e.type] || !W[e.type].sizes.includes(e.size) || typeof e.id !== "string") return null;
    const opts = e.opts && typeof e.opts === "object" ? { ...e.opts } : null;
    return opts && Object.keys(opts).length ? { id: e.id, type: e.type, size: e.size, opts } : { id: e.id, type: e.type, size: e.size };
  }
  function sanitize(arr) {
    if (!Array.isArray(arr)) return null;
    const seen = new Set(), out = [];
    for (const l of arr) { const e = toEntry(l); if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); } }
    return out.length ? out : null;
  }
  const clone = (l) => ({ ...l, ...(l.opts ? { opts: { ...l.opts } } : {}) });
  const optsOf = (l) => ({ ...(l.opts || {}), id: l.id });
  function syncLayout() {
    const raw = Store.cfg().homeLayout;
    const json = JSON.stringify(raw || null);
    // Prima lettura, oppure cambiata da un altro dispositivo (e non ho modifiche in sospeso)
    if (!st.layout || (json !== st.seen && !st.saveT && !st.drag)) {
      st.layout = sanitize(raw) || defaults();
      st.seen = json;
    }
  }
  function save(now = false) {
    clearTimeout(st.saveT);
    const run = () => {
      st.saveT = null;
      const data = st.layout.map(clone);
      st.seen = JSON.stringify(data);
      Store.setSettings({ homeLayout: data });
    };
    if (now) run(); else st.saveT = setTimeout(run, 700);
  }
  function commit(focusIdx) { st.focusIdx = focusIdx; save(); App.render(); }

  // ---------- Annunci per lettori di schermo ----------
  function live(msg) {
    let l = document.getElementById("dash-live");
    if (!l) { l = document.createElement("div"); l.id = "dash-live"; l.className = "dash-sr"; l.setAttribute("aria-live", "assertive"); document.body.appendChild(l); }
    l.textContent = msg;
  }

  // ---------- Disegno ----------
  function inner(l) {
    const def = W[l.type], sz = l.size, o = optsOf(l);
    let r;
    try { r = (sz === "c" || sz === "p") && def.mini && !(l.type === "clock" && sz === "c") && l.type !== "quick" ? shapeHTML(sz, def, def.mini(o)) : def.render(sz, o); }
    catch (e) { console.error(e); r = { html: head(def.icon, def.title) + `<div class="d-wb">${empty("Non riesco a mostrare questi dati.")}</div>` }; }
    // colore scelto in Personalizza ("glass" = vetro semplice)
    if (o.tint) r.cls = o.tint === "glass" ? "" : o.tint;
    return r;
  }
  const sizesOf = (def) => SIZE_ORDER.filter((x) => def.sizes.includes(x));
  const shape = (s) => `<svg class="d-shape" width="22" height="18" viewBox="0 0 24 18" aria-hidden="true">${sizeIcon(s)}</svg>`;
  const goOf = (l) => { const g = W[l.type].go; return typeof g === "function" ? W[l.type].go(optsOf(l)) : g; };

  // Ogni widget ha un pulsante "maniglia" (.d-go) che copre la scheda: fuori dalla modifica apre
  // la sezione (Invio/Spazio), in modifica si sposta con le frecce. I pulsanti interni restano
  // fermate di tabulazione separate. Il clic sulla scheda è gestito dall'ascoltatore delegato.
  function widgetHTML(l, idx) {
    const def = W[l.type], sz = l.size, r = inner(l), go = !!def.go;
    let handle = "", ctl = "";
    if (st.editing) {
      handle = `<button type="button" class="d-go" aria-label="${def.title}, ${SIZE_NAMES[sz].toLowerCase()}, posizione ${idx + 1} di ${st.layout.length}. Frecce per spostare, Canc per rimuovere"></button>`;
      ctl = `<button type="button" class="d-x" data-dash-remove aria-label="Rimuovi ${def.title}">${ic("x", 15, 2.6)}</button><div class="d-ectl">`
        + (def.sizes.length > 1 ? `<button type="button" class="d-ebtn" data-dash-fmt aria-haspopup="menu" aria-expanded="false" aria-label="Formato di ${def.title}: ${SIZE_NAMES[sz]}">Formato</button>` : "")
        + `<button type="button" class="d-ebtn" data-dash-custom aria-haspopup="dialog" aria-label="Personalizza ${def.title}">Personalizza</button></div>`;
    } else if (go) handle = `<button type="button" class="d-go" aria-label="${def.title}: apri la sezione"></button>`;
    const jd = st.editing ? `style="--jd:-${((idx * 37) % 14) / 100}s"` : "";
    return `<article class="d-w d-glass ${r.cls || ""} ${go ? "" : "nogo"}" data-idx="${idx}" data-id="${esc(l.id)}" data-size="${sz}" data-type="${l.type}" aria-label="${def.title}" ${jd}>${handle}${ctl}${r.html}</article>`;
  }

  function render(el) {
    syncLayout();
    bindOnce();
    // un ridisegno "di fondo" (sincronizzazione, orologio) non deve chiudere il menu Formato aperto
    const open = document.getElementById("dash-fmt"), reopen = open && open._btn && open._btn.closest(".d-w").dataset.id;
    const refocus = open && open.contains(document.activeElement) ? document.activeElement.dataset.size : null;
    closeFmt(false);
    const fresh = unseenNew().length;
    const tools = st.editing
      ? `<button class="d-btn glassy" type="button" data-dash-tool="reset">${ic("reset", 16)}Ripristina</button><button class="d-btn glassy" type="button" data-dash-tool="add">${ic("plus", 16)}Widget</button><button class="d-btn deep" type="button" data-dash-tool="done">Fine</button>`
      : `${fresh ? `<button class="d-btn orange-btn" type="button" data-dash-tool="add">${ic("star", 16)}${fresh} widget nuovi</button>` : ""}<button class="d-btn glassy" type="button" data-act="look-open">${ic("image", 16)}Aspetto</button><button class="d-btn deep" type="button" data-dash-tool="edit">${ic("edit", 16)}Modifica Home</button>`;
    el.innerHTML = `<div class="dash">
      <div class="d-bar"><h2>${st.editing ? "Modifica la Home" : "La tua giornata"}</h2><div class="d-tools">${tools}</div></div>
      <section class="d-grid ${st.editing ? "editing" : ""}" aria-label="Widget della Home">${st.layout.map(widgetHTML).join("")}${st.editing ? `<button type="button" class="d-w d-adder" data-size="s" data-dash-tool="add"><span class="d-plus">${ic("plus", 22, 2.4)}</span>Aggiungi widget</button>` : ""}</section>
    </div>`;
    if (st.focusIdx != null) {
      const w = el.querySelector(`.d-w[data-idx="${st.focusIdx}"]`);
      const f = w && (st.focusFmt && w.querySelector("[data-dash-fmt]") || w.querySelector(".d-go"));
      st.focusIdx = null; st.focusFmt = false;
      if (f) f.focus();
    }
    if (reopen && st.editing) {
      const b = el.querySelector(`.d-w[data-id="${CSS.escape(reopen)}"] [data-dash-fmt]`);
      if (b) openFmt(b, refocus);
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
      if (!running) return;
      const txt = mmss(remainingSec());
      nodes.forEach((n) => { if (n.textContent !== txt) n.textContent = txt; });
    }, 1000);
  }

  function setEditing(v) {
    st.editing = v;
    App.render();
    if (v) U.toast("Trascina per spostare · «Formato» e «Personalizza» sotto ogni widget");
    else if (st.saveT) save(true);
  }
  function removeAt(i) {
    const [item] = st.layout.splice(i, 1);
    commit(Math.min(i, st.layout.length - 1));
    U.toast(`${W[item.type].title} rimosso`, { action: "Annulla", fn: () => { st.layout.splice(Math.min(i, st.layout.length), 0, item); commit(i); } });
  }
  function resetLayout() {
    const prev = st.layout.map(clone);
    st.layout = defaults();
    commit();
    U.toast("Disposizione iniziale ripristinata", { action: "Annulla", fn: () => { st.layout = prev; commit(); } });
  }

  // ---------- Menu "Formato" (uno per widget, sotto la scheda) ----------
  function closeFmt(refocus) {
    const m = document.getElementById("dash-fmt");
    if (!m) return;
    const b = m._btn;
    m.remove();
    if (b && b.isConnected) { b.setAttribute("aria-expanded", "false"); if (refocus) b.focus(); }
  }
  // sotto il pulsante (o sopra, se sotto non c'è spazio), dentro la finestra
  function placeMenu(m) {
    const r = m._btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    const below = r.bottom + 8 + mh <= window.innerHeight || r.top - 8 - mh < 0;
    m.style.left = `${U.clamp(r.left + r.width / 2 - mw / 2, 8, document.documentElement.clientWidth - mw - 8) + window.scrollX}px`;
    m.style.top = `${(below ? r.bottom + 8 : r.top - 8 - mh) + window.scrollY}px`;
  }
  function openFmt(btn, focusSize) {
    closeFmt(false);
    const i = Number(btn.closest(".d-w").dataset.idx), l = st.layout[i], def = W[l.type];
    const m = document.createElement("div");
    m.id = "dash-fmt"; m.className = "dash-menu"; m.setAttribute("role", "menu"); m.setAttribute("aria-label", `Formato di ${def.title}`);
    m.innerHTML = sizesOf(def).map((s) => `<button type="button" role="menuitemradio" tabindex="-1" aria-checked="${s === l.size}" data-size="${s}">${shape(s)}<span>${SIZE_NAMES[s]}</span>${s === l.size ? ic("check", 16, 2.4) : ""}</button>`).join("");
    m._btn = btn;
    document.body.appendChild(m);
    placeMenu(m);
    btn.setAttribute("aria-expanded", "true");
    const items = [...m.querySelectorAll("button")];
    (items.find((b) => b.dataset.size === focusSize) || items.find((b) => b.getAttribute("aria-checked") === "true") || items[0]).focus();
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-size]");
      if (!b) return;
      l.size = b.dataset.size;
      st.focusFmt = true;
      closeFmt(false);
      commit(st.layout.indexOf(l));
      live(`${def.title}: ${SIZE_NAMES[l.size].toLowerCase()}`);
    });
    m.addEventListener("keydown", (e) => {
      const k = items.indexOf(document.activeElement);
      const to = { ArrowDown: k + 1, ArrowRight: k + 1, ArrowUp: k - 1, ArrowLeft: k - 1, Home: 0, End: items.length - 1 }[e.key];
      if (to != null) { e.preventDefault(); items[(to + items.length) % items.length].focus(); }
      else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); closeFmt(true); }
    });
  }

  // ---------- Foglio "Personalizza": colore e opzioni del singolo widget ----------
  const radios = (name, legend, list, cur) => `<fieldset class="d-field"><legend>${legend}</legend><div class="d-seg">${list.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}" ${String(v) === String(cur) ? "checked" : ""}><span>${t}</span></label>`).join("")}</div></fieldset>`;
  const select = (name, legend, list, cur) => `<label class="d-field"><span class="d-lg">${legend}</span><select name="${name}">${list.map(([v, t]) => `<option value="${esc(v)}" ${v === (cur || "") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
  function customFields(l) {
    const o = l.opts || {}, t = l.type;
    const base = inner({ ...l, opts: { ...o, tint: "" } }).cls || "glass";
    let h = radios("tint", "Colore", TINTS, o.tint || base);
    const habits = Calc.activeHabits().map((x) => [x.id, x.name]);
    const goals = Calc.activeGoals().map((x) => [x.id, x.title]);
    if (t === "habits") {
      const used = [...new Set(Calc.activeHabits().map((x) => x.area).filter((a) => AREAS[a]))];
      h += select("area", "Abitudini da mostrare", [["", "Tutte"], ...used.map((a) => [a, `Solo ${AREAS[a].label}`])], o.area);
    }
    if (t === "nextHabit" || t === "streak") h += select("habit", "Abitudine", [["", t === "streak" ? "Automatica (la serie più lunga)" : "Automatica (la prossima da fare)"], ...habits], o.habit);
    if (t === "goals" || t === "deadline") h += select("goal", "Obiettivo", [["", t === "goals" ? "Tutti gli obiettivi attivi" : "Automatico (la scadenza più vicina)"], ...goals], o.goal);
    if (t === "timer") h += radios("min", "Durata della sessione", [["", "Come in Focus"], ...[15, 25, 45, 60].map((m) => [m, `${m} min`])], o.min || "");
    if (t === "meals" && typeof Food !== "undefined") h += `<fieldset class="d-field"><legend>Pasti da mostrare</legend><p class="d-note">Nessuno scelto = tutti.</p><div class="d-seg wrap">${Food.SLOTS.map(([k, n]) => `<label><input type="checkbox" name="slots" value="${k}" ${(o.slots || []).includes(k) ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></fieldset>`;
    if (t === "calendar") { calState(optsOf(l)); const tabs = calTabs().tabs; if (tabs.length > 1) h += radios("tab", "Scheda all'apertura", tabs, o.tab || "habits"); }
    return h;
  }
  function openCustom(btn) {
    const i = Number(btn.closest(".d-w").dataset.idx), l = st.layout[i], def = W[l.type];
    Sheet.open({
      title: `Personalizza · ${def.title}`,
      body: `<form class="dash-sheet d-form" data-dash-custom-form>${customFields(l)}<p class="d-note">Le modifiche si vedono subito nella Home.</p></form>`,
      onMount: (root) => {
        const f = root.querySelector("form");
        f.addEventListener("submit", (e) => e.preventDefault());
        f.addEventListener("change", () => {
          const fd = new FormData(f), o = {};
          for (const k of ["tint", "area", "habit", "goal", "min", "tab"]) { const v = fd.get(k); if (v) o[k] = k === "min" ? Number(v) : v; }
          const slots = fd.getAll("slots");
          if (slots.length) o.slots = slots;
          if (o.tint === (inner({ ...l, opts: { ...o, tint: "" } }).cls || "glass")) delete o.tint; // il colore di serie non si salva
          if (Object.keys(o).length) l.opts = o; else delete l.opts;
          if (st.cal[l.id]) st.cal[l.id].tab = o.tab || "habits";
          save(); App.render();
        });
        const h = root.querySelector(".sheet-head h2");
        if (h) { h.tabIndex = -1; setTimeout(() => h.focus(), 30); }
      },
      // alla chiusura il focus torna al pulsante Personalizza di quel widget
      onClose: () => setTimeout(() => { const w = document.querySelector(`.view-today .d-w[data-id="${CSS.escape(l.id)}"] [data-dash-custom]`); if (w) w.focus(); }, 0)
    });
  }

  // ---------- Foglio "Aggiungi un widget", con un'anteprima viva di ciascuno ----------
  const addSize = (k) => (W[k].sizes.includes("c") ? "c" : W[k].sizes[0]);
  const SPAN = { c: [1, 1], s: [1, 1], p: [2, 1], mh: [2, 1], mv: [1, 2], lh: [4, 2], lv: [2, 4] };
  function preview(k) {
    const sz = addSize(k), [cw, rh] = SPAN[sz], cell = 176, gap = 16;
    const w = cw * cell + (cw - 1) * gap, h = rh * cell + (rh - 1) * gap, f = Math.min(168 / w, 104 / h);
    const r = inner({ id: `preview-${k}`, type: k, size: sz });
    return `<div class="d-prev" aria-hidden="true" inert><div class="dash" style="width:${Math.round(w * f)}px;height:${Math.round(h * f)}px"><article class="d-w d-glass ${r.cls || ""}" data-size="${sz}" data-type="${k}" style="width:${w}px;height:${h}px;transform:scale(${f.toFixed(4)})">${r.html}</article></div></div>`;
  }
  function openAdd() {
    const used = new Set(st.layout.map((l) => l.type));
    const fresh = unseenNew();
    // prima i nuovi, poi quelli non ancora in Home; anche quelli già presenti si possono aggiungere di nuovo
    const rank = (k) => (fresh.includes(k) ? 0 : used.has(k) ? 2 : 1);
    const all = Object.entries(W).sort((a, b) => rank(a[0]) - rank(b[0]));
    if (fresh.length) Store.setSettings({ seenWidgets: [...new Set([...(Store.cfg().seenWidgets || []), ...fresh])] });
    Sheet.open({
      title: "Aggiungi un widget",
      body: `<div class="dash-sheet"><div class="d-picks">${all.map(([k, d]) => `<div class="d-pick">${preview(k)}<button class="d-pickbtn" type="button" data-pick="${k}"><span class="d-ic">${ic(d.icon, 17)}</span><span class="d-pt"><b>${d.title}${fresh.includes(k) ? ` <em class="d-new">Nuovo</em>` : ""}</b><small>${used.has(k) ? "Già nella Home · aggiungine un altro" : sizesOf(d).map((x) => SIZE_NAMES[x]).join(" · ")}</small></span></button></div>`).join("")}</div></div>`,
      onMount: (root) => {
        root.addEventListener("click", (e) => {
          const p = e.target.closest("[data-pick]");
          if (!p) return;
          const k = p.dataset.pick;
          st.layout.push({ id: newId(k), type: k, size: addSize(k) });
          Sheet.close();
          commit(st.layout.length - 1);
          U.toast(`${W[k].title} aggiunto in fondo`);
        });
        // il focus va al titolo del foglio, non alla prima scheda (sembrerebbe già scelta)
        const h = root.querySelector(".sheet-head h2");
        if (h) { h.tabIndex = -1; setTimeout(() => h.focus(), 30); }
      }
    });
  }
  function goTo(i) {
    const l = st.layout[i];
    if (l && W[l.type].go) App.go(goOf(l));
  }

  // ---------- Eventi (delegati, installati una volta sola) ----------
  function bindOnce() {
    if (st.bound) return;
    st.bound = true;
    const inDash = (t) => t && t.closest && t.closest(".view-today .dash");

    // copertine che non si caricano: via l'immagine, resta il titolo (niente onerror inline, per la CSP)
    document.addEventListener("error", (e) => {
      const t = e.target;
      if (t && t.tagName === "IMG" && t.closest(".dash, .dash-sheet")) t.remove();
    }, true);

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
      if (t && !t.classList.contains("d-go")) {
        if (t.hasAttribute("data-dash-remove")) return removeAt(i);
        if (t.hasAttribute("data-dash-custom")) return openCustom(t);
        if (t.hasAttribute("data-dash-fmt")) return document.getElementById("dash-fmt") && t.getAttribute("aria-expanded") === "true" ? closeFmt(true) : openFmt(t);
        if (t.dataset.dashTab || t.dataset.dashCal) {
          calState(optsOf(st.layout[i]));
          if (t.dataset.dashTab) { cs.tab = t.dataset.dashTab; cs.off = 0; }
          else cs.off = U.clamp(cs.off + Number(t.dataset.dashCal), Math.min(0, calMinOff()), 0);
          return App.render();
        }
        return; // gli altri pulsanti hanno data-act e li gestisce App
      }
      if (e.target.closest("[data-act], a, input, select")) return;
      if (!st.editing) goTo(i);
    }, true);

    document.addEventListener("keydown", (e) => {
      const g = e.target.closest && e.target.closest(".view-today .dash .d-go");
      if (!g || !st.editing) return;
      const i = Number(g.closest(".d-w").dataset.idx);
      const mv = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
      if (mv) {
        e.preventDefault();
        const j = i + mv;
        if (j < 0 || j >= st.layout.length) return;
        [st.layout[i], st.layout[j]] = [st.layout[j], st.layout[i]];
        commit(j);
        live(`${W[st.layout[j].type].title} in posizione ${j + 1} di ${st.layout.length}`);
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeAt(i); }
      if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
    });

    // il menu Formato si chiude toccando altrove; se la finestra cambia misura si riposiziona
    document.addEventListener("pointerdown", (e) => {
      const m = document.getElementById("dash-fmt");
      if (m && !m.contains(e.target) && !(m._btn && m._btn.contains(e.target))) closeFmt(false);
    }, true);
    window.addEventListener("resize", () => { const m = document.getElementById("dash-fmt"); if (m && m._btn.isConnected) placeMenu(m); });

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
      st.drag = { el: w, grid: w.parentElement, dx: e.clientX - r.left, dy: e.clientY - r.top, last: null };
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
      if (changed) { commit(ni); live(`${W[order[ni].type].title} in posizione ${ni + 1} di ${order.length}`); }
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

  return { render };
})();

Actions["go"] = (el) => App.go(el.dataset.id);
// Pasti dal widget: un tocco segna mangiati (o di nuovo da mangiare) i piatti in programma di quel pasto
Actions["dash-meal"] = (el) => {
  const today = U.today(), es = Food.entriesOn(today, el.dataset.slot), planned = es.filter((e) => !e.extra);
  const list = planned.length ? planned : es, all = list.every((e) => e.eaten);
  list.forEach((e) => { if (!!e.eaten === all) Store.update("meal_entries", e.id, { eaten: !all }); });
  Food.syncHabit([today]);
};
// Sessione di focus dal widget, con la durata scelta per quel widget
Actions["dash-focus"] = (el) => { if (el.dataset.min) Focus.minutes = Number(el.dataset.min); Focus.start(); };
