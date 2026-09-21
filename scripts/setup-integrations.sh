#!/usr/bin/env bash
# Collega la cartella al tuo progetto Supabase, salva i segreti e pubblica la
# funzione "integrations" (Raindrop + Notion). Si può rilanciare quando vuoi.
# Uso:  ./scripts/setup-integrations.sh
set -euo pipefail
cd "$(dirname "$0")/.."

command -v supabase >/dev/null || { echo "Installa la CLI: brew install supabase/tap/supabase"; exit 1; }

read -rp "Project ref (la parte prima di .supabase.co nell'URL): " REF
[ -n "$REF" ] || { echo "Serve il project ref"; exit 1; }
supabase link --project-ref "$REF"

read -rp "La tua email (l'unica autorizzata a usare la funzione): " EMAIL
supabase secrets set ALLOWED_EMAIL="$EMAIL"

read -rsp "Token Raindrop (invio per saltare): " RD; echo
[ -z "$RD" ] || supabase secrets set RAINDROP_TOKEN="$RD"
read -rsp "Token Notion (invio per saltare): " NT; echo
[ -z "$NT" ] || supabase secrets set NOTION_TOKEN="$NT"

supabase functions deploy integrations
echo "Fatto. In Kurashi: Impostazioni → Integrazioni → Verifica."
