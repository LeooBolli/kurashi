// ============================================================
// Edge Function "integrations": unico punto in cui vivono le chiavi API
// di Raindrop.io. L'app (browser) non le vede mai.
//
// Segreti richiesti (vedi README):
//   RAINDROP_TOKEN   - "Test token" da raindrop.io > Settings > Integrations
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

      default:
        return json({ error: "Azione sconosciuta" }, 400);
    }
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, e.status);
    console.error("integrations", e);
    return json({ error: "Errore interno, riprova più tardi" }, 500);
  }
});
