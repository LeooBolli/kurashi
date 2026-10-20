#!/usr/bin/env bash
# Attiva la sincronizzazione automatica del second brain -> Kurashi.
#  1. salva la password di Supabase nel Portachiavi di macOS (mai in un file)
#  2. installa un LaunchAgent che lancia la sync quando cambia qualcosa nel vault
#     e comunque ogni 30 minuti
# Si può rilanciare quando vuoi. Per disattivare:  ./scripts/install-second-brain-sync.sh --remove
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VAULT="${KURASHI_VAULT:-$HOME/Documents/Personal Branding/Second Brain Personale}"
PYTHON="${PYTHON:-/usr/local/bin/python3}"     # lo stesso dei tuoi agenti del vault
LABEL="com.kurashi.second-brain-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/kurashi-sync.log"
SERVICE="kurashi-sync"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Sincronizzazione automatica disattivata."
  exit 0
fi

[ -d "$VAULT" ] || { echo "Vault non trovato: $VAULT (imposta KURASHI_VAULT)"; exit 1; }
[ -x "$PYTHON" ] || PYTHON="$(command -v python3)"
# L'account "owner" di USERS in js/config.js (lo stesso che usa la sync)
EMAIL="$("$PYTHON" "$APP_DIR/scripts/sync_second_brain.py" --print-email)" || exit 1

echo "Password di Supabase per $EMAIL: te la chiede il Portachiavi (due volte, non compare a schermo)."
# "-w" per ultimo e senza valore: è "security" a chiedere la password, così non finisce
# mai tra gli argomenti del comando (visibili a tutti con "ps").
security add-generic-password -U -a "$EMAIL" -s "$SERVICE" -w

echo "Prima sincronizzazione di prova…"
"$PYTHON" "$APP_DIR/scripts/sync_second_brain.py" --vault "$VAULT"

# Cartelle da osservare: ogni sotto-cartella di primo livello con contenuti (non script/log)
WATCH=""
while IFS= read -r d; do
  case "$(basename "$d")" in scripts|logs|.obsidian|evidenziazioni-app) continue;; esac
  WATCH="$WATCH    <string>$d</string>"$'\n'
done < <(find "$VAULT" -mindepth 1 -maxdepth 1 -type d)

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON</string>
    <string>$APP_DIR/scripts/sync_second_brain.py</string>
    <string>--vault</string>
    <string>$VAULT</string>
  </array>
  <key>WatchPaths</key>
  <array>
$WATCH  </array>
  <key>StartInterval</key><integer>1800</integer>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Attivo. Log: $LOG"
echo "Da ora ogni modifica al vault arriva in Kurashi (al massimo dopo un minuto)."
