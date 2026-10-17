// Carica i file dell'app (script "classici" con globali) in un contesto node:vm,
// come farebbe il browser, senza DOM.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function makeContext(extra = {}) {
  const window = {
    APP_CONFIG: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "", ALLOWED_EMAIL: "demo@example.com", USER_NAME: "Test" },
    crypto: globalThis.crypto
  };
  const ctx = {
    window, console, crypto: globalThis.crypto, structuredClone, setTimeout, clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    document: { getElementById: () => null, addEventListener() {} },
    localStorage: new MemoryStorage(),
    ...extra
  };
  window.window = window;
  vm.createContext(ctx);
  return ctx;
}

export function load(ctx, ...files) {
  for (const f of files) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  return ctx;
}

// Legge un globale dichiarato con const/let (non sta sull'oggetto globale del contesto)
export const get = (ctx, name) => vm.runInContext(name, ctx);
export const run = (ctx, code) => vm.runInContext(code, ctx);

export class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

// Store finto per calc.js: solo i dati, l'indice dei log e cfg()
export const STORE_STUB = `
var Store = {
  d: { habits: [], goals: [], milestones: [], habit_logs: [], focus_sessions: [], mood_logs: [], sleep_logs: [],
       weight_logs: [], workouts: [], reading_items: [], highlights: [], foods: [], meal_entries: [], meal_templates: [] },
  settings: {},
  logIdx: new Map(),
  reindex() { this.logIdx.clear(); for (const l of this.d.habit_logs) this.logIdx.set(l.habit_id + "|" + l.log_date, Number(l.value)); },
  cfg() { return { focusWeeklyMin: 600, sleepTarget: 8, weightTarget: null, goalBooks: {}, ...this.settings }; }
};`;
