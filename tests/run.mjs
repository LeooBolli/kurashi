// "node --test tests/" apre la cartella come modulo (vedi package.json → main):
// qui carico tutti i file *.test.mjs. Funziona anche "node --test tests/*.test.mjs".
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(here).filter((n) => n.endsWith(".test.mjs")).sort()) await import(`./${f}`);
