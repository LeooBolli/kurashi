// ============================================================
// Oggi: la Home a widget (stile iOS). Ogni widget legge i dati veri
// (Store/Calc) e si ridisegna a ogni modifica. La disposizione si salva
// nelle impostazioni (homeLayout: [{ id, type, size, opts }]), quindi è la stessa
// su tutti i dispositivi; lo stesso widget può esserci più volte.
// Modifica Home (con il mouse): trascina per spostare, × per togliere (con Annulla),
// «Formato» e «Personalizza» sotto ogni widget, + per aggiungere;
// da tastiera frecce e Canc sulla maniglia del widget.
// Sugli schermi touch: lista «Riordina», si trascina solo dalla maniglia e il resto scorre.
// ============================================================
// Gli strumenti comuni sono in js/home/kit.js, i widget in js/home/w-*.js.
const Today = (() => {
  const { ic, esc, reduceMotion, st, SIZE_NAMES, SIZE_ORDER, unseenNew, sizeIcon, touchUI, defaults, head,
    empty, mmss, shapeHTML, calState, calTabs, calMinOff, calendar, focusOk, remainingSec, sectionOn, ORDER } = HomeKit;
  const W = HomeWidgets;

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
  function commit(focusIdx) { st.focusIdx = focusIdx; save(); App.render(); refreshReorder(); }

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
    if (!sectionOn(l.type)) return "";
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
    if (v && touchUI()) return openReorder();
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
    if (t === "finGroup") h += select("finGroup", "Macro area", [["", "Automatica (la più alta del mese)"], ...Finance.groups().map((g) => [g.id, g.label])], o.finGroup);
    if (t === "timer") h += radios("min", "Durata della sessione", [["", "Come in Focus"], ...[15, 25, 45, 60].map((m) => [m, `${m} min`])], o.min || "");
    if (t === "meals" && typeof Food !== "undefined") h += `<fieldset class="d-field"><legend>Pasti da mostrare</legend><p class="d-note">Nessuno scelto = tutti.</p><div class="d-seg wrap">${Food.SLOTS.map(([k, n]) => `<label><input type="checkbox" name="slots" value="${k}" ${(o.slots || []).includes(k) ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></fieldset>`;
    if (t === "calendar") { calState(optsOf(l)); const tabs = calTabs().tabs; if (tabs.length > 1) h += radios("tab", "Scheda all'apertura", tabs, o.tab || "habits"); }
    return h;
  }
  // after: cosa fare alla chiusura (la lista «Riordina» si riapre); di base il focus torna al widget
  function openCustom(i, after) {
    const l = st.layout[i], def = W[l.type];
    Sheet.open({
      title: `Personalizza · ${def.title}`,
      body: `<form class="dash-sheet d-form" data-dash-custom-form>${customFields(l)}<p class="d-note">Le modifiche si vedono subito nella Home.</p></form>`,
      onMount: (root) => {
        const f = root.querySelector("form");
        f.addEventListener("submit", (e) => e.preventDefault());
        f.addEventListener("change", () => {
          const fd = new FormData(f), o = {};
          for (const k of ["tint", "area", "habit", "goal", "min", "tab", "finGroup"]) { const v = fd.get(k); if (v) o[k] = k === "min" ? Number(v) : v; }
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
      onClose: after || (() => setTimeout(() => { const w = document.querySelector(`.view-today .d-w[data-id="${CSS.escape(l.id)}"] [data-dash-custom]`); if (w) w.focus(); }, 0))
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
  function openAdd(after) {
    const used = new Set(st.layout.map((l) => l.type));
    const fresh = unseenNew();
    // prima i nuovi, poi quelli non ancora in Home; anche quelli già presenti si possono aggiungere di nuovo
    const rank = (k) => (fresh.includes(k) ? 0 : used.has(k) ? 2 : 1);
    const keys = [...ORDER.filter((k) => W[k]), ...Object.keys(W).filter((k) => !ORDER.includes(k))];
    const all = keys.map((k) => [k, W[k]]).filter(([k]) => sectionOn(k)).sort((a, b) => rank(a[0]) - rank(b[0]));
    if (fresh.length) Store.setSettings({ seenWidgets: [...new Set([...(Store.cfg().seenWidgets || []), ...fresh])] });
    Sheet.open({
      title: "Aggiungi un widget",
      onClose: after,
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
  // ---------- Lista «Riordina» (schermi touch) ----------
  // Si trascina solo dalla maniglia: il resto della riga scorre la lista e, toccata, apre
  // Formato, Personalizza e Rimuovi. Con la tastiera la maniglia si sposta con le frecce.
  // I widget di sezioni spente non si elencano ma tengono il loro posto nella disposizione.
  const shown = () => st.layout.map((l, i) => ({ l, i })).filter((x) => sectionOn(x.l.type));
  function reorderHTML() {
    const rows = shown().map(({ l, i }) => {
      const def = W[l.type], open = st.roOpen === l.id;
      const panel = !open ? "" : `<div class="d-ropanel">${def.sizes.length > 1 ? `<div class="d-rosizes" role="group" aria-label="Formato">${sizesOf(def).map((s) => `<button type="button" aria-pressed="${s === l.size}" data-ro-size="${s}" aria-label="${SIZE_NAMES[s]}">${shape(s)}</button>`).join("")}</div>` : ""}<div class="d-roacts"><button type="button" class="btn ghost sm" data-ro-custom>Personalizza</button><button type="button" class="btn ghost sm danger" data-ro-remove>Rimuovi</button></div></div>`;
      return `<li class="d-ro ${open ? "open" : ""}" data-i="${i}" data-id="${esc(l.id)}"><div class="d-romain"><button type="button" class="d-rorow" data-ro-toggle aria-expanded="${open}"><span class="d-ic">${ic(def.icon, 17)}</span><span class="d-rotx"><b>${def.title}</b><small>${SIZE_NAMES[l.size]}</small></span></button><button type="button" class="d-rogrip" aria-label="Sposta ${def.title}: trascina, o usa le frecce">${ic("grip", 20, 2.2)}</button></div>${panel}</li>`;
    }).join("");
    return `<div class="d-rolist"><p class="hint">Trascina dalla maniglia a destra. Tocca un widget per formato e opzioni.</p><ul>${rows}</ul><div class="btn-row"><button type="button" class="btn ghost" data-ro-add>${ic("plus", 16)} Aggiungi</button><button type="button" class="btn ghost" data-ro-reset>${ic("reset", 16)} Ripristina</button><button type="button" class="btn primary" data-sheet-close>Fine</button></div></div>`;
  }
  function refreshReorder() { if (document.querySelector(".d-rolist")) Sheet.setBody(reorderHTML()); }
  const reopen = () => setTimeout(openReorder, 0);
  function openReorder() {
    Sheet.open({
      title: "Riordina la Home",
      body: reorderHTML(),
      onClose: () => { if (st.saveT) save(true); },
      onMount: (root) => {
        root.addEventListener("click", (e) => {
          const t = e.target.closest("button");
          if (!t) return;
          if (t.hasAttribute("data-ro-add")) return openAdd(reopen);
          if (t.hasAttribute("data-ro-reset")) return resetLayout();
          const li = t.closest(".d-ro");
          if (!li) return;
          const i = Number(li.dataset.i), l = st.layout[i];
          if (t.hasAttribute("data-ro-toggle")) { st.roOpen = st.roOpen === l.id ? null : l.id; return refreshReorder(); }
          if (t.dataset.roSize) { l.size = t.dataset.roSize; return commit(); }
          if (t.hasAttribute("data-ro-custom")) return openCustom(i, reopen);
          if (t.hasAttribute("data-ro-remove")) return removeAt(i);
        });
        root.addEventListener("pointerdown", (e) => { const g = e.target.closest(".d-rogrip"); if (g) gripDrag(g, e); });
        root.addEventListener("keydown", (e) => {
          const g = e.target.closest(".d-rogrip"), mv = { ArrowUp: -1, ArrowDown: 1 }[e.key];
          if (!g || !mv) return;
          e.preventDefault();
          const list = shown(), k = list.findIndex((x) => x.i === Number(g.closest(".d-ro").dataset.i)), to = list[k + mv];
          if (!to) return;
          const id = list[k].l.id;
          applyOrder(list.map((x) => x.l).map((l, n, a) => (n === k ? a[k + mv] : n === k + mv ? a[k] : l)));
          const again = root.querySelector(`.d-ro[data-id="${CSS.escape(id)}"] .d-rogrip`);
          if (again) again.focus();
          live(`${W[list[k].l.type].title} in posizione ${k + mv + 1} di ${list.length}`);
        });
      }
    });
  }
  // Nuovo ordine dei widget elencati, sugli stessi posti della disposizione
  function applyOrder(order) {
    const slots = shown().map((x) => x.i);
    slots.forEach((slot, n) => { st.layout[slot] = order[n]; });
    commit();
  }
  function gripDrag(grip, e) {
    e.preventDefault();
    const row = grip.closest(".d-ro"), list = row.parentElement, sc = row.closest(".sheet");
    const startTop = row.getBoundingClientRect().top;
    let y = e.clientY, raf = 0;
    const dy = y - startTop;
    grip.setPointerCapture(e.pointerId);
    row.classList.add("dragging");
    // sposto le righe vicine, non quella trascinata: toglierla dal suo posto perderebbe il dito
    const swap = (other, before) => {
      const a = other.getBoundingClientRect().top;
      if (before) list.insertBefore(other, row); else row.after(other);
      const b = other.getBoundingClientRect().top;
      if (!reduceMotion()) other.animate([{ transform: `translateY(${a - b}px)` }, { transform: "none" }], { duration: 160, easing: "ease-out" });
    };
    const update = () => {
      row.style.transform = "none";
      const r = row.getBoundingClientRect(), next = row.nextElementSibling, prev = row.previousElementSibling, mid = y - dy + r.height / 2;
      if (next) { const n = next.getBoundingClientRect(); if (mid > n.top + n.height / 2) swap(next, true); }
      if (prev) { const p = prev.getBoundingClientRect(); if (mid < p.top + p.height / 2) swap(prev, false); }
      row.style.transform = `translateY(${y - dy - row.getBoundingClientRect().top}px)`;
    };
    // vicino ai bordi la lista scorre da sola
    const tick = () => {
      const b = sc.getBoundingClientRect(), v = y < b.top + 70 ? -8 : y > b.bottom - 70 ? 8 : 0;
      if (v) { const was = sc.scrollTop; sc.scrollTop += v; if (sc.scrollTop !== was) update(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const move = (ev) => { y = ev.clientY; update(); };
    const end = () => {
      cancelAnimationFrame(raf);
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", end);
      grip.removeEventListener("pointercancel", end);
      row.classList.remove("dragging");
      row.style.transform = "";
      const order = [...list.children].map((n) => st.layout[Number(n.dataset.i)]);
      if (order.some((l, k) => l !== shown()[k].l)) applyOrder(order); else refreshReorder();
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
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
        if (t.hasAttribute("data-dash-custom")) return openCustom(i);
        if (t.hasAttribute("data-dash-fmt")) return document.getElementById("dash-fmt") && t.getAttribute("aria-expanded") === "true" ? closeFmt(true) : openFmt(t);
        if (t.dataset.dashTab || t.dataset.dashCal) {
          calState(optsOf(st.layout[i]));
          if (t.dataset.dashTab) { st.cs.tab = t.dataset.dashTab; st.cs.off = 0; }
          else st.cs.off = U.clamp(st.cs.off + Number(t.dataset.dashCal), Math.min(0, calMinOff()), 0);
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

    // trascinamento col mouse (sugli schermi touch si riordina dalla lista «Riordina»)
    document.addEventListener("pointerdown", (e) => {
      if (!inDash(e.target) || !st.editing) return;
      const w = e.target.closest(".d-w[data-idx]");
      if (!w || e.target.closest("button")) return;
      e.preventDefault();
      const r = w.getBoundingClientRect();
      st.drag = { el: w, grid: w.parentElement, dx: e.clientX - r.left, dy: e.clientY - r.top, last: null };
      w.classList.add("dragging");
      moveDrag(e);
    });
    window.addEventListener("pointermove", (e) => {
      if (st.drag) moveDrag(e);
    });
    window.addEventListener("pointerup", () => {
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
    window.addEventListener("pointercancel", () => { if (st.drag) { st.drag = null; App.render(); } });
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
// Dalla Home la sessione è libera, mai collegata a un esame.
// Con la durata già nota parte subito; nei formati piccoli, senza il pulsante dei minuti, si sceglie prima.
const dashMinutes = (act, label) => Sheet.open({
  title: "Quanti minuti?",
  body: `<div class="dur">${[15, 25, 45, 60].map((m) => `<button class="pill ${Focus.minutes === m ? "on" : ""}" data-act="${act}" data-min="${m}" data-close="1">${m} min</button>`).join("")}</div>
    <form class="inline-add dash-min-form" data-act-submit="dash-focus-custom" data-then="${act}"><input type="number" name="min" min="1" max="180" inputmode="numeric" placeholder="Altri minuti" aria-label="Altri minuti"><button class="btn ghost sm" type="submit">${label}</button></form>`
});
Actions["dash-focus"] = (el) => (el.dataset.min ? Focus.startFree(Number(el.dataset.min)) : dashMinutes("dash-focus-min", "Avvia"));
Actions["dash-focus-min"] = (el) => Focus.startFree(Number(el.dataset.min));
Actions["dash-focus-pick"] = () => dashMinutes("dash-focus-set", "Imposta");
Actions["dash-focus-set"] = (el) => { Focus.minutes = Number(el.dataset.min); App.render(); };
Actions["dash-focus-custom"] = (form) => {
  const m = Math.round(Number(form.elements.min.value));
  if (!(m >= 1 && m <= 180)) return U.toast("Scegli tra 1 e 180 minuti");
  Sheet.close();
  Actions[form.dataset.then]({ dataset: { min: m } });
};
