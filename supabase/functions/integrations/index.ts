// ============================================================
// Edge Function "integrations": unico punto in cui vivono le chiavi API
// di Raindrop.io e Notion. L'app (browser) non le vede mai.
//
// Segreti richiesti (vedi README):
//   RAINDROP_TOKEN   - "Test token" da raindrop.io > Settings > Integrations
//   NOTION_TOKEN     - token di un'integrazione interna Notion
//   ALLOWED_EMAIL    - (consigliato) l'unica email che può usare la funzione
//
// SUPABASE_URL e SUPABASE_ANON_KEY sono già iniettate da Supabase.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// La chiave anon è pubblica: senza questo controllo chiunque potrebbe usare i tuoi token.
async function requireOwner(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return "Accesso non valido";
  const allowed = Deno.env.get("ALLOWED_EMAIL");
  if (allowed && data.user.email?.toLowerCase() !== allowed.toLowerCase()) return "Utente non autorizzato";
  return null;
}

// ---------- Raindrop ----------
async function raindrop(path: string) {
  const token = Deno.env.get("RAINDROP_TOKEN");
  if (!token) throw new Error("RAINDROP_TOKEN non configurato");
  const r = await fetch(`https://api.raindrop.io/rest/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Raindrop ha risposto ${r.status}`);
  return r.json();
}

// ---------- Notion ----------
async function notion(path: string, method = "GET", body?: unknown) {
  const token = Deno.env.get("NOTION_TOKEN");
  if (!token) throw new Error("NOTION_TOKEN non configurato");
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || `Notion ha risposto ${r.status}`) as Error & { status?: number };
    err.status = r.status;
    throw err;
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
  if (!titleKey) throw new Error("Il database Notion non ha una colonna titolo");
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const denied = await requireOwner(req);
    if (denied) return json({ error: denied }, 401);

    const body = await req.json();
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
        const db = await notion(`/databases/${body.databaseId}`);
        return json({ ok: true, title: (db.title ?? []).map((t: any) => t.plain_text).join("") || "senza titolo" });
      }

      case "notion_upsert_goal": {
        if (!body.databaseId || !body.goal) return json({ error: "Richiesta incompleta" }, 400);
        const properties = await buildProperties(body.databaseId, body.goal);
        if (body.goal.pageId) {
          try {
            const page = await notion(`/pages/${body.goal.pageId}`, "PATCH", { properties });
            return json({ pageId: page.id });
          } catch (e) {
            // pagina eliminata su Notion: ne creo una nuova
            if ((e as { status?: number }).status !== 404) throw e;
          }
        }
        const page = await notion("/pages", "POST", { parent: { database_id: body.databaseId }, properties });
        return json({ pageId: page.id });
      }

      default:
        return json({ error: "Azione sconosciuta" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
