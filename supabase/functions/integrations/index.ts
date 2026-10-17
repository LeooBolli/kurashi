// ============================================================
// Edge Function "integrations": unico punto in cui vivono le chiavi API
// di Raindrop.io e Notion. L'app (browser) non le vede mai.
//
// Segreti richiesti (vedi README):
//   RAINDROP_TOKEN   - "Test token" da raindrop.io > Settings > Integrations
//   NOTION_TOKEN     - token di un'integrazione interna Notion
//   ALLOWED_EMAIL    - (obbligatorio) l'unica email che può usare la funzione:
//                      se manca, la funzione rifiuta ogni richiesta
//   ALLOWED_UID      - (facoltativo) l'id utente Supabase autorizzato, controllo in più
//
// SUPABASE_URL e SUPABASE_ANON_KEY sono già iniettate da Supabase.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: solo l'app pubblicata su GitHub Pages e, per lo sviluppo, http://localhost:<porta>
const PAGES_ORIGIN = "https://leoobolli.github.io";
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin === PAGES_ORIGIN || LOCALHOST.test(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}


// Errore con un messaggio già pensato per l'utente (in italiano, senza dettagli interni)
class UserError extends Error {
  status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

// La chiave anon è pubblica: senza questo controllo chiunque potrebbe usare i tuoi token.
// Senza ALLOWED_EMAIL configurato non passa nessuno.
async function requireOwner(req: Request): Promise<string | null> {
  const allowed = (Deno.env.get("ALLOWED_EMAIL") ?? "").trim().toLowerCase();
  if (!allowed) {
    console.error("ALLOWED_EMAIL non impostato: richiesta rifiutata");
    return "Funzione non configurata";
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return "Accesso non valido";
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return "Accesso non valido";
  if ((data.user.email ?? "").toLowerCase() !== allowed) return "Utente non autorizzato";
  const uid = (Deno.env.get("ALLOWED_UID") ?? "").trim();
  if (uid && data.user.id !== uid) return "Utente non autorizzato";
  return null;
}

// ID Notion: 32 caratteri esadecimali oppure un UUID con i trattini
const NOTION_ID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const validId = (v: unknown): v is string => typeof v === "string" && NOTION_ID.test(v);

// ---------- Raindrop ----------
async function raindrop(path: string) {
  const token = Deno.env.get("RAINDROP_TOKEN");
  if (!token) throw new UserError("Raindrop non è configurato sul server", 500);
  const r = await fetch(`https://api.raindrop.io/rest/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    console.error("Raindrop", r.status, (await r.text().catch(() => "")).slice(0, 500));
    throw new UserError(r.status === 401 || r.status === 403 ? "Raindrop ha rifiutato il token" : "Raindrop non risponde correttamente, riprova più tardi");
  }
  return r.json();
}

// ---------- Notion ----------
async function notion(path: string, method = "GET", body?: unknown) {
  const token = Deno.env.get("NOTION_TOKEN");
  if (!token) throw new UserError("Notion non è configurato sul server", 500);
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Notion", method, path, r.status, JSON.stringify(data).slice(0, 500));
    const msg = r.status === 401 ? "Notion ha rifiutato il token"
      : r.status === 404 ? "Notion non trova la pagina o il database (è condiviso con l'integrazione?)"
      : r.status === 400 ? "Notion ha rifiutato i dati: controlla le colonne del database"
      : r.status === 429 ? "Notion è occupato, riprova tra poco"
      : "Notion non risponde correttamente, riprova più tardi";
    throw new UserError(msg, r.status === 404 ? 404 : 502);
  }
  return data;
}

// Cerca una proprietà del database per nome (senza badare alle maiuscole)
function findProp(props: Record<string, any>, names: string[], types: string[]) {
  for (const [key, p] of Object.entries(props)) {
    if (types.includes(p.type) && names.includes(key.toLowerCase())) return { key, p };
  }
  return null;
}

async function buildProperties(databaseId: string, g: any) {
  const db = await notion(`/databases/${databaseId}`);
  const props = db.properties as Record<string, any>;
  const out: Record<string, unknown> = {};

  const titleKey = Object.keys(props).find((k) => props[k].type === "title");
  if (!titleKey) throw new UserError("Il database Notion non ha una colonna titolo", 400);
  out[titleKey] = { title: [{ text: { content: String(g.title).slice(0, 200) } }] };

  const text = (v: string) => [{ text: { content: String(v).slice(0, 1900) } }];
  const setSelectOrText = (names: string[], value: string) => {
    const f = findProp(props, names, ["select", "rich_text"]);
    if (!f || !value) return;
    out[f.key] = f.p.type === "select" ? { select: { name: value } } : { rich_text: text(value) };
  };
  setSelectOrText(["area"], g.area);
  setSelectOrText(["orizzonte", "horizon"], g.horizon);
  setSelectOrText(["stato", "status"], g.status);

  const prog = findProp(props, ["progresso", "avanzamento", "progress"], ["number"]);
  if (prog) out[prog.key] = { number: prog.p.number?.format === "percent" ? g.progress / 100 : g.progress };

  const due = findProp(props, ["scadenza", "due", "data"], ["date"]);
  if (due && g.due) out[due.key] = { date: { start: g.due } };

  const note = findProp(props, ["note", "descrizione"], ["rich_text"]);
  if (note && g.note) out[note.key] = { rich_text: text(g.note) };

  return out;
}

Deno.serve(async (req) => {
  // intestazioni CORS calcolate per questa richiesta (le richieste possono arrivare in parallelo)
  const cors = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  try {
    const denied = await requireOwner(req);
    if (denied) return json({ error: denied }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Richiesta non valida" }, 400);
    switch (body.action) {
      case "raindrop_ping": {
        const u = await raindrop("/user");
        return json({ ok: true, user: u.user?.fullName ?? null });
      }

      case "raindrop_list": {
        const id = Number.isInteger(body.collectionId) ? body.collectionId : 0;
        const items: unknown[] = [];
        for (let page = 0; page < 4; page++) {
          const r = await raindrop(`/raindrops/${id}?perpage=50&page=${page}&sort=-created`);
          for (const it of r.items ?? []) {
            items.push({ id: it._id, title: it.title, link: it.link, cover: it.cover || null, created: it.created });
          }
          if ((r.items ?? []).length < 50) break;
        }
        return json({ items });
      }

      case "notion_ping": {
        if (!body.databaseId) return json({ error: "Manca l'ID del database Notion" }, 400);
        if (!validId(body.databaseId)) return json({ error: "ID del database Notion non valido" }, 400);
        const db = await notion(`/databases/${body.databaseId}`);
        return json({ ok: true, title: (db.title ?? []).map((t: any) => t.plain_text).join("") || "senza titolo" });
      }

      case "notion_upsert_goal": {
        if (!body.databaseId || !body.goal) return json({ error: "Richiesta incompleta" }, 400);
        if (!validId(body.databaseId)) return json({ error: "ID del database Notion non valido" }, 400);
        if (body.goal.pageId != null && !validId(body.goal.pageId)) return json({ error: "ID della pagina Notion non valido" }, 400);
        const properties = await buildProperties(body.databaseId, body.goal);
        if (body.goal.pageId) {
          try {
            const page = await notion(`/pages/${body.goal.pageId}`, "PATCH", { properties });
            return json({ pageId: page.id });
          } catch (e) {
            // pagina eliminata su Notion: ne creo una nuova
            if (!(e instanceof UserError) || e.status !== 404) throw e;
          }
        }
        const page = await notion("/pages", "POST", { parent: { database_id: body.databaseId }, properties });
        return json({ pageId: page.id });
      }

      default:
        return json({ error: "Azione sconosciuta" }, 400);
    }
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, e.status);
    console.error("integrations", e);
    return json({ error: "Errore interno, riprova più tardi" }, 500);
  }
});
