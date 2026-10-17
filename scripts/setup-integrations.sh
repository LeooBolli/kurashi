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
[ -n "$EMAIL" ] || { echo "Serve l'email: senza ALLOWED_EMAIL la funzione rifiuta ogni richiesta"; exit 1; }
supabase secrets set ALLOWED_EMAIL="$EMAIL"
read -rp "Il tuo user id Supabase (Authentication → Users; invio per saltare): " UIDV
[ -z "$UIDV" ] || supabase secrets set ALLOWED_UID="$UIDV"

# I token passano da un file temporaneo leggibile solo da te, non dagli argomenti del comando
# (visibili a tutti con "ps"); il file si cancella in ogni caso all'uscita.
ENVF="$(umask 077; mktemp)"
trap 'rm -f "$ENVF"' EXIT
read -rsp "Token Raindrop (invio per saltare): " RD; echo
[ -z "$RD" ] || printf 'RAINDROP_TOKEN=%s\n' "$RD" >> "$ENVF"
read -rsp "Token Notion (invio per saltare): " NT; echo
[ -z "$NT" ] || printf 'NOTION_TOKEN=%s\n' "$NT" >> "$ENVF"
unset RD NT
[ ! -s "$ENVF" ] || supabase secrets set --env-file "$ENVF"

supabase functions deploy integrations
echo "Fatto. In Kurashi: Impostazioni → Integrazioni → Verifica."
