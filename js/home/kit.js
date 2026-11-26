// ============================================================
// Home a widget: strumenti comuni (stato, icone, disegni, dati di oggi).
// I widget stanno in js/home/w-*.js e si registrano in HomeWidgets; js/today.js li dispone
// e gestisce Modifica Home. Ordine di caricamento: kit, widget, today.
// ============================================================
const HomeWidgets = {};

const HomeKit = (() => {
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
    roOpen: null,        // id del widget aperto nella lista «Riordina»
    focusIdx: null,
    focusFmt: false
  };

  const SIZE_NAMES = { c: "Cerchio", s: "Piccolo", p: "Capsula", mh: "Medio orizzontale", mv: "Medio verticale", lh: "Grande orizzontale", lv: "Grande verticale" };
  const SIZE_ORDER = ["c", "s", "p", "mh", "mv", "lh", "lv"];
  const NEW_WIDGETS = ["nextHabit", "habit", "points", "workouts", "deadline", "countdown", "clock", "exam", "toRead", "quick", "heat", "finMonth", "finAreas", "finTrend", "finTodo", "finTop", "finBalance", "finYear", "finVsAvg", "finGroup", "finTrips", "finSave", "finCompare", "finBudget", "finRenew", "finSubs", "studyToday", "habit", "countdown"];
  const unseenNew = () => { const seen = Store.cfg().seenWidgets || []; const used = new Set((st.layout || []).map((l) => l.type)); return NEW_WIDGETS.filter((k) => !seen.includes(k) && !used.has(k) && sectionOn(k)); };
  const sizeIcon = (s) => ({ c: '<circle cx="12" cy="9" r="7.5"/>', p: '<rect x="1" y="4.5" width="22" height="9" rx="4.5"/>', s: '<rect x="7" y="4" width="10" height="10" rx="3"/>', mh: '<rect x="2" y="5" width="20" height="9" rx="3"/>', mv: '<rect x="7" y="1" width="10" height="16" rx="3"/>', lh: '<rect x="1" y="2" width="22" height="14" rx="3"/>', lv: '<rect x="4" y="0.5" width="16" height="17" rx="3"/>' })[s];
  // Lo Storico parte compatto: la settimana su telefono, il mese a pallini sugli schermi larghi
  const DEFAULT = [["score", "c"], ["timer", "s"], ["calendar", "mv"], ["stats", "mh"], ["habits", "mv"], ["weight", "c"], ["streak", "c"], ["goals", "lh"], ["focusStats", "p"], ["quick", "p"], ["reading", "mh"], ["recall", "mh"], ["meals", "mh"], ["clock", "c"], ["points", "c"], ["deadline", "c"], ["nextHabit", "c"]];
  const isPhone = () => !!(window.matchMedia && matchMedia("(max-width: 720px)").matches);
  const touchUI = () => isPhone() || !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
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
  // Filtro delle abitudini di un widget: area e/o abitudini scelte in Personalizza
  const inArea = (o) => (h) => !o || ((!o.area || h.area === o.area) && (!o.habits || !o.habits.length || o.habits.includes(h.id)));
  const areaTitle = (o) => (o && o.area && AREAS[o.area] ? `Abitudini · ${U.esc(AREAS[o.area].label)}` : o && o.habits && o.habits.length ? "Abitudini scelte" : "Abitudini");
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
  st.cs = { tab: "habits", off: 0 }; // calendario attivo (lo imposta calState)
  const calState = (o) => (st.cs = st.cal[o.id] || (st.cal[o.id] = { tab: o.tab || "habits", off: 0 }));
  function calTabs() {
    const tabs = [["habits", "Abitudini"]];
    if (Store.d.focus_sessions.some((s) => s.completed)) tabs.push(["focus", "Focus"]);
    const diet = typeof Food !== "undefined" && Food.habit ? Food.habit() : null;
    if (diet) tabs.push(["diet", "Dieta"]);
    if (!tabs.some(([k]) => k === st.cs.tab)) st.cs.tab = "habits";
    return { tabs, diet };
  }

  // Quanti mesi indietro si può andare: non prima del mese del primo dato
  function calMinOff() {
    const t = U.parse(U.today()), f = U.parse(firstDataDay(st.cs.tab));
    return -((t.getFullYear() - f.getFullYear()) * 12 + t.getMonth() - f.getMonth());
  }
  function fullTest(diet) {
    if (st.cs.tab === "focus") { const days = new Set(Calc.focusDone().map((s) => U.dateOf(s.started_at))); return (d) => days.has(d); }
    if (st.cs.tab === "diet") return (d) => (diet ? Calc.isDone(diet, d) : false);
    return (d) => { const s = Calc.dayStats(d); return s.pct != null && s.pct >= 1; };
  }
  // la serie conta all'indietro da ieri (oggi è ancora in corso), anche oltre l'inizio del mese
  function runOf(isFull, today) {
    let run = 0, d = isFull(today) ? today : U.addDays(today, -1);
    for (let i = 0; i < 400 && isFull(d); i++, d = U.addDays(d, -1)) run++;
    return run;
  }
  const tabsOf = (tabs) => tabs.length > 1 ? `<div class="d-tabs" role="group" aria-label="Cosa mostrare">${tabs.map(([k, l]) => `<button type="button" data-dash-tab="${k}" aria-pressed="${st.cs.tab === k}">${l}</button>`).join("")}</div>` : "";

  // Giorni pieni nel mese in corso (per cerchio e piccolo)
  function monthCount() {
    const { diet } = calTabs(), today = U.today(), isFull = fullTest(diet), first = today.slice(0, 8) + "01";
    const days = U.range(first, today);
    return { count: days.filter(isFull).length, elapsed: days.length, m: U.parse(today).getMonth(), run: runOf(isFull, today) };
  }
  function calendar(mode) {
    const { tabs, diet } = calTabs();
    const today = U.today();
    st.cs.off = U.clamp(st.cs.off, Math.min(0, calMinOff()), 0);
    const base = U.addMonths(today.slice(0, 8) + "01", st.cs.off);
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
    const run = st.cs.off === 0 ? runOf(isFull, today) : 0;
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
    const tab = tabs.find(([k]) => k === st.cs.tab)[1];
    return { grid: `<div class="d-cal week" role="img" aria-label="${tab}: ${plural(count, "giorno completato", "giorni completati")} questa settimana">${h}</div>`, count, run: runOf(isFull, today), tab };
  }
  const calNav = () => `<button type="button" class="d-navbtn" data-dash-cal="-1" aria-label="Mese precedente" ${st.cs.off <= calMinOff() ? "disabled" : ""}>${ic("left", 18, 2.2)}</button><button type="button" class="d-navbtn" data-dash-cal="1" aria-label="Mese successivo" ${st.cs.off >= 0 ? "disabled" : ""}>${ic("right", 18, 2.2)}</button>`;

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
  const startBtn = (o, cls, size) => `<button type="button" ${cls ? `class="${cls}"` : ""} data-act="dash-focus" ${o && o.min ? `data-min="${o.min}" aria-label="Avvia una sessione di ${o.min} minuti"` : `aria-label="Scegli i minuti e avvia una sessione"`}>${ic("play", size, 2.6)}</button>`;

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
  // Un widget legato a una sezione spenta non si mostra (resta nel layout: riaccendendola torna al suo posto)
  const sectionOn = (k) => typeof HomeWidgets[k].go !== "string" || App.isOn(HomeWidgets[k].go);
  // Ordine dei widget nel foglio «Aggiungi un widget» (i file dei widget si caricano per tema)
  const ORDER = ["score", "habits", "focusStats", "timer", "goals", "stats", "calendar", "weight", "reading", "recall", "meals", "streak", "nextHabit", "points", "workouts", "deadline", "clock", "exam", "toRead", "quick", "heat", "finMonth", "finAreas", "finTrend", "finTodo", "finBalance", "studyToday", "finYear", "finVsAvg", "finGroup", "finTrips", "finSave", "finCompare", "finBudget", "finRenew", "finSubs", "finTop"];

  return { ICON_ALIAS, ic, esc, reduceMotion, cap1, plural, st, SIZE_NAMES, SIZE_ORDER, NEW_WIDGETS, unseenNew, sizeIcon, DEFAULT, isPhone, touchUI, defaults, head, big, empty, cta, ring, track, hours, mmss, arc, shapeHTML, inArea, areaTitle, pickHabit, pickGoal, todayData, habitLeft, habBtn, nextBtn, weekRates, firstDataDay, monthly, barChart, calState, calTabs, calMinOff, fullTest, runOf, tabsOf, monthCount, calendar, calWeek, calNav, goalInfo, leftChip, dueTxt, linkLabel, focusOk, minOf, remainingSec, startBtn, weightSeries, sectionOn, ORDER };
})();
