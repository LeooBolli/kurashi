// La copia offline (APP_SHELL in sw.js) deve contenere ogni file che la pagina carica:
// un file nuovo dimenticato lì farebbe aprire l'app senza un pezzo quando manca la rete.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
const shell = new Set([...sw.slice(sw.indexOf("APP_SHELL"), sw.indexOf("];")).matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]));
const local = [...html.matchAll(/<(?:script[^>]*src|link[^>]*href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:)?\/\//.test(u));

test("ogni file locale di index.html è nella copia offline di sw.js", () => {
  const missing = local.filter((u) => !shell.has(u.replace(/^\.\//, "")));
  assert.deepEqual(missing, [], "aggiungili ad APP_SHELL in sw.js (e aumenta CACHE_NAME)");
});

test("ogni file della copia offline esiste davvero", () => {
  const gone = [...shell].filter((p) => p && !existsSync(join(ROOT, p)));
  assert.deepEqual(gone, []);
});
