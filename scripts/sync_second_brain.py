#!/usr/bin/env python3
"""
Sincronizza le evidenziazioni del second brain (file .md con i blocchi
'> [!quote]') verso Supabase, così l'app Kurashi le ripropone ogni giorno.

- Solo libreria standard di Python: nessuna installazione.
- URL, chiave publishable ed email si leggono da js/config.js (un'unica fonte).
- La password NON sta in nessun file: si legge dal Portachiavi di macOS
  (vedi scripts/install-second-brain-sync.sh) oppure da KURASHI_PASSWORD.
- Accede con il TUO login, quindi valgono le regole RLS: nessuna chiave segreta.
- È idempotente: carica solo le evidenziazioni nuove o modificate, senza toccare
  preferite / "non riproporre" / ripassi fatti nell'app.

Uso:  python3 scripts/sync_second_brain.py [--vault CARTELLA] [--dry-run] [--force]
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
DEFAULT_VAULT = Path.home() / "Documents" / "Personal Branding" / "Second Brain Personale"
KEYCHAIN_SERVICE = "kurashi-sync"

# Stesse esclusioni dello script del ripasso giornaliero del vault
EXCLUDED_DIRS = {"scripts", ".obsidian", "logs", "evidenziazioni-app", "🎧 Podcast"}
EXCLUDED_FILES = {"🔁 Ripasso Evidenziazioni.md", "🗂 Indice.md"}

ID_RE = re.compile(r"\s*<!--\s*id:(\S+?)\s*-->")
MESI = {m: i + 1 for i, m in enumerate(
    ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
     "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"])}
DATE_RE = re.compile(r"(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})", re.I)
KIND = {"libro": "libro", "article": "articolo", "video": "video", "nota": "nota", "podcast": "podcast"}


def log(msg):
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {msg}", flush=True)


# ---------------------------------------------------------------- config

def read_app_config():
    text = (APP_DIR / "js" / "config.js").read_text(encoding="utf-8")

    def field(name):
        m = re.search(rf'{name}\s*:\s*"([^"]*)"', text)
        return m.group(1).strip() if m else ""

    cfg = {"url": field("SUPABASE_URL").rstrip("/"), "key": field("SUPABASE_ANON_KEY"), "email": field("ALLOWED_EMAIL")}
    missing = [k for k, v in cfg.items() if not v]
    if missing:
        sys.exit(f"js/config.js incompleto: mancano {', '.join(missing)} (url = SUPABASE_URL)")
    return cfg


def read_password(email):
    if os.environ.get("KURASHI_PASSWORD"):
        return os.environ["KURASHI_PASSWORD"]
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-a", email, "-s", KEYCHAIN_SERVICE, "-w"],
            capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        sys.exit("Password non trovata nel Portachiavi. Esegui scripts/install-second-brain-sync.sh")


# ---------------------------------------------------------------- HTTP

def http(method, url, key, token=None, body=None, headers=None):
    h = {"apikey": key, "Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        sys.exit(f"Errore {e.code} da Supabase ({method} {url.split('?')[0].split('/')[-1]}): {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"Impossibile raggiungere Supabase: {e.reason}")


def login(cfg, password):
    res = http("POST", f"{cfg['url']}/auth/v1/token?grant_type=password", cfg["key"],
               body={"email": cfg["email"], "password": password})
    return res["access_token"], res["user"]["id"]


# ---------------------------------------------------------------- parsing del vault

def frontmatter(lines):
    fm = {}
    if lines and lines[0].strip() == "---":
        for line in lines[1:]:
            if line.strip() == "---":
                break
            m = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
            if m:
                fm[m.group(1)] = m.group(2).strip().strip('"')
    return fm


def parse_date(label):
    m = DATE_RE.search(label or "")
    if not m or m.group(2).lower() not in MESI:
        return None
    try:
        d = datetime(int(m.group(3)), MESI[m.group(2).lower()], int(m.group(1)),
                     int(m.group(4)), int(m.group(5)), int(m.group(6)))
        return d.astimezone().isoformat()
    except ValueError:
        return None


def parse_file(path, vault):
    lines = path.read_text(encoding="utf-8").splitlines()
    fm = frontmatter(lines)
    title = fm.get("title") or path.stem
    kind = KIND.get(fm.get("tipo", ""), fm.get("tipo") or "nota")
    rel = str(path.relative_to(vault))
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        if not line.startswith("> [!quote]"):
            i += 1
            continue
        header = line[len("> [!quote]"):]
        idm = ID_RE.search(header)
        label = ID_RE.sub("", header).strip()
        body = []
        i += 1
        while i < len(lines) and lines[i].startswith(">"):
            body.append(lines[i][1:].strip())
            i += 1
        note, quote = "", body
        for k, b in enumerate(body):
            if b.startswith("**Nota:**"):
                quote = body[:k]
                note = " ".join([b[len("**Nota:**"):].strip()] + [x for x in body[k + 1:] if x]).strip()
                break
        text = " ".join(x for x in quote if x).strip()
        if not text:
            continue
        uid = f"rd:{idm.group(1)}" if idm else "md:" + hashlib.sha1(f"{rel}|{text}".encode()).hexdigest()[:20]
        row = {
            "uid": uid, "text": text, "note": note or None,
            "location": label or None, "highlighted_at": parse_date(label),
            "source_title": title, "source_author": fm.get("author") or None,
            "source_url": fm.get("url") or None, "source_kind": kind, "source_file": rel,
        }
        row["content_hash"] = hashlib.sha1(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
        out.append(row)
    return out


def scan_vault(vault, extra_excluded):
    excluded = EXCLUDED_DIRS | set(extra_excluded)
    rows = []
    for path in sorted(vault.rglob("*.md")):
        rel = path.relative_to(vault)
        if rel.parts[0] in excluded or path.name in EXCLUDED_FILES:
            continue
        try:
            rows.extend(parse_file(path, vault))
        except Exception as exc:  # un file rotto non blocca gli altri
            log(f"  ! saltato {rel}: {exc}")
    # uid duplicati (stesso testo due volte nello stesso file): tengo il primo
    seen, unique = set(), []
    for r in rows:
        if r["uid"] not in seen:
            seen.add(r["uid"])
            unique.append(r)
    return unique


# ---------------------------------------------------------------- sync

def fetch_existing(cfg, token):
    out, start = [], 0
    while True:
        rows = http("GET", f"{cfg['url']}/rest/v1/highlights?select=uid,content_hash,source_file&order=uid",
                    cfg["key"], token, headers={"Range-Unit": "items", "Range": f"{start}-{start + 999}"})
        out.extend(rows)
        if len(rows) < 1000:
            return out
        start += 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", default=os.environ.get("KURASHI_VAULT", str(DEFAULT_VAULT)))
    ap.add_argument("--exclude", action="append", default=[], help="cartella di primo livello da ignorare")
    ap.add_argument("--dry-run", action="store_true", help="mostra cosa farebbe, senza scrivere")
    ap.add_argument("--force", action="store_true", help="consente cancellazioni massicce")
    args = ap.parse_args()

    vault = Path(args.vault).expanduser()
    if not vault.is_dir():
        sys.exit(f"Cartella del vault non trovata: {vault}")

    cfg = read_app_config()
    rows = scan_vault(vault, args.exclude)
    log(f"Vault: {len(rows)} evidenziazioni in {len({r['source_file'] for r in rows})} file")
    if not rows:
        sys.exit("Nessuna evidenziazione trovata: mi fermo per sicurezza (nessuna modifica).")

    token, user_id = login(cfg, read_password(cfg["email"]))
    existing = fetch_existing(cfg, token)
    by_uid = {e["uid"]: e for e in existing}

    to_write = [r for r in rows if r["uid"] not in by_uid or by_uid[r["uid"]]["content_hash"] != r["content_hash"]]
    new = sum(1 for r in to_write if r["uid"] not in by_uid)

    # Cancello solo le evidenziazioni sparite da file che esistono ancora nel vault
    files_now = {r["source_file"] for r in rows}
    current_uids = {r["uid"] for r in rows}
    to_delete = [e["uid"] for e in existing if e["source_file"] in files_now and e["uid"] not in current_uids]

    log(f"Da caricare: {len(to_write)} ({new} nuove, {len(to_write) - new} modificate) · da rimuovere: {len(to_delete)}")
    if existing and len(to_delete) > max(5, len(existing) * 0.3) and not args.force:
        sys.exit("Troppe cancellazioni in una volta: mi fermo. Controlla il vault (o usa --force).")
    if args.dry_run:
        log("Dry run: nessuna scrittura.")
        return

    for i in range(0, len(to_write), 200):
        batch = [{**r, "user_id": user_id} for r in to_write[i:i + 200]]
        http("POST", f"{cfg['url']}/rest/v1/highlights?on_conflict=user_id,uid", cfg["key"], token, body=batch,
             headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
    for i in range(0, len(to_delete), 50):
        quoted = ",".join('"' + u.replace('"', '') + '"' for u in to_delete[i:i + 50])
        http("DELETE", f"{cfg['url']}/rest/v1/highlights?uid=in.({urllib.parse.quote(quoted)})", cfg["key"], token)
    log("Sync completata.")


if __name__ == "__main__":
    main()
