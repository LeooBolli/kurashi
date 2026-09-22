# Kurashi 暮らし

App web (PWA) personale per gestire la vita: **abitudini** (sì/no e quantitative),
**obiettivi** a breve (1 mese), medio (4 mesi) e lungo termine (1 anno o più) collegati
alle abitudini, **statistiche/KPI** con grafici, **caccia agli yokai** (focus timer gamificato) con livelli, HP, equipaggiamento e un Dojo,
**benessere** (umore, energia, sonno, peso, allenamenti), **lettura** (libri da Goodreads con
avanzamento a pagine + bookmark di Raindrop.io), sincronizzazione degli obiettivi con Notion, export Excel e CSV.

HTML/CSS/JS senza framework né build. Backend: Supabase (un solo utente, dati protetti
da RLS). Stesso approccio di PDTravel.

## 0. Provalo subito (modalità demo)

Lascia `SUPABASE_URL` vuoto in [js/config.js](js/config.js) e servi la cartella:

```bash
python3 -m http.server 8000     # poi apri http://localhost:8000
```

Compaiono dati di esempio salvati solo nel tuo browser. Da Impostazioni → "Azzera dati
demo" ricominci da capo.

## 1. Crea il progetto Supabase (nuovo, separato da PDTravel)

1. Su https://supabase.com crea un progetto gratuito.
2. **SQL Editor → New query**: incolla [supabase/schema.sql](supabase/schema.sql) ed esegui.
   Puoi rieseguirlo quando vuoi (non perde dati).
3. **Authentication → Users → Add user**: la tua email + una password robusta,
   spunta **Auto Confirm User**.
4. **Authentication → Providers → Email**: disattiva **Allow new users to sign up**.
   Da quel momento l'unico account esistente sei tu.
5. **Project Settings → API**: copia *Project URL* e *anon public key* in
   [js/config.js](js/config.js), e metti la tua email in `ALLOWED_EMAIL`.

La chiave anon è pubblica per definizione: non dà accesso a nulla senza il tuo login,
perché ogni tabella ha una policy `user_id = auth.uid()`.

## 2. Integrazioni (Raindrop.io e Notion)

Le chiavi API **non vanno mai nel browser** (puoi usare lo script `./scripts/setup-integrations.sh`, che fa tutto questo): vivono come segreti di una Edge Function
([supabase/functions/integrations](supabase/functions/integrations/index.ts)), che
controlla che la richiesta arrivi da te.

```bash
npm i -g supabase                       # oppure: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <ref-del-progetto>
supabase secrets set RAINDROP_TOKEN=... NOTION_TOKEN=... ALLOWED_EMAIL=tua@email.it
supabase functions deploy integrations
```

**Raindrop**: raindrop.io → Settings → Integrations → For Developers → crea un'app →
*Create test token*. In Kurashi: Lettura → pulsante *Raindrop* (importa i nuovi
bookmark; l'ID collezione si imposta da Impostazioni, 0 = tutte).

**Notion**: notion.so/profile/integrations → nuova integrazione interna → copia il
segreto. Nel database che vuoi usare: `⋯` → *Connections* → aggiungi l'integrazione.
Colonne riconosciute (ignora quelle che mancano): titolo, `Area` (select),
`Orizzonte` (select), `Stato` (select), `Progresso` (numero), `Scadenza` (data),
`Note` (testo). Incolla l'URL o l'ID del database in Impostazioni; poi "Invia a
Notion" dal dettaglio di un obiettivo, o tutti insieme.

### Perché API dirette e non Composio

Sei l'unico utente e le due app usano un token personale: Composio aggiungerebbe un
servizio (e un costo) senza risolvere nulla. La funzione è già il punto d'accesso
unico: se un giorno colleghi molte app con OAuth (Google Calendar, Gmail…), si può
aggiungere Composio dietro la stessa funzione senza toccare l'app.

## 3. Second brain → Riscoperte (stile Readwise)

Le evidenziazioni dei file `.md` del tuo vault (blocchi `> [!quote]`: Kindle, Raindrop…)
arrivano nell'app e ogni giorno te ne vengono riproposte alcune (di default 5).

```
vault .md  ──(scripts/sync_second_brain.py)──▶  Supabase  ──(realtime)──▶  app
```

1. Esegui `supabase/schema.sql` (ha la tabella `highlights`; è sicuro rieseguirlo).
2. Compila `js/config.js` (URL, chiave publishable, email).
3. Nel terminale: `./scripts/install-second-brain-sync.sh`. Salva la password nel
   **Portachiavi di macOS** (mai in un file), fa una prima sincronizzazione e installa un
   LaunchAgent che riparte **quando cambia qualcosa nel vault** e comunque ogni 30 minuti.
   Log: `~/Library/Logs/kurashi-sync.log`. Per disattivare: `--remove`.

Lo script usa il **tuo login** (niente chiavi segrete), legge il vault **senza mai
modificarlo** e carica solo ciò che è nuovo o cambiato. Le evidenziazioni Raindrop hanno un
id stabile (`<!-- id:… -->`), le altre un hash di file + testo. Se un'evidenziazione sparisce
da un file, sparisce anche dall'app; per sicurezza si ferma se dovrebbe cancellarne troppe.
Prova a secco: `python3 scripts/sync_second_brain.py --dry-run`.

Nell'app: *Ricordo* (ripasso, +4 XP), ★ preferita (esce più spesso), «non riproporre»,
«Altre 3 per oggi», libreria con ricerca e filtri. Sotto i 30 caratteri (es. il nome di un
canale) non viene proposta ma resta in libreria.

## 4. Pubblica

Qualunque hosting statico va bene (Cloudflare Pages, Netlify, GitHub Pages). L'app
ha `noindex`, e senza il tuo login non si vede nessun dato. Per nascondere anche la
pagina, con Cloudflare Access puoi limitarla alla tua email.

Su iPhone: Safari → Condividi → *Aggiungi alla schermata Home*.

## Come funziona

- **Abitudini**: sì/no o quantitative (obiettivo + unità + incremento del tasto +),
  giorni della settimana, serie (streak), record, mappa di calore correggibile.
- **Obiettivi**: brevi (1 mese), medi (4 mesi), lunghi (1 anno o più), oppure
  **ricorrenti** (settimanale/mensile/annuale: es. «leggi un libro al mese») con un periodo
  che si rinnova da solo e uno storico dei periodi passati fatto/non fatto. L'avanzamento è
  la media di tutte le fonti collegate: tappe completate, costanza delle abitudini (giorni
  fatti / previsti), libri letti, peso, e **obiettivi figli**. La tacca sulla barra è dove
  dovresti essere in base al tempo trascorso (nel periodo, per i ricorrenti) → *Avanti / In
  linea / Da recuperare / Indietro*.
  Ogni **tappa** si può dividere in **sottotappe**: la sua percentuale è sottotappe fatte / totali
  e l'avanzamento dell'obiettivo ne tiene conto.
  Un obiettivo a breve o medio termine può avere come **genitore** un obiettivo a orizzonte
  più lungo (es. «Superare esame diritto» dentro «Finire gli esami del primo anno»):
  l'avanzamento del genitore fa la media anche dei figli collegati.
  Se imposti un **peso obiettivo**, l'avanzamento segue la distanza dal peso registrato più
  vicino all'inizio (funziona sia per dimagrire sia per aumentare di peso), ed è visibile
  anche in Benessere → Peso.
  Una tappa può diventare un **esame** (tocca 📖): tre fasi — primo studio, ripasso,
  preparazione — ognuna con una checklist di argomenti da spuntare; la percentuale della
  tappa è la media delle tre fasi. Nel gestore dell'esame tieni anche data dell'appello, CFU
  e voto, e puoi dedicargli sessioni di Focus (le ore di studio si sommano lì).
- **Libri**: in Lettura → *Libro*, incolla il link di Goodreads (o scrivi titolo e autore). Goodreads
  non ha più un'API pubblica: dal link si ricava il titolo e si cercano autore, pagine e copertina
  su Open Library. Poi segni le pagine (+10, oppure «Pagina») e vedi la percentuale.
- **Punteggio 0-100** (ultimi 7 giorni): abitudini 35%, obiettivi 25%, benessere 25%,
  focus 15%; le voci senza dati non contano. Si aggiorna in tempo reale.
- **Focus = caccia allo yokai**: lo yokai si indebolisce mentre resti concentrato; a fine
  timer viene sigillato (1 XP al minuto, 1 ryo ogni 5 minuti), con bonus a catena fino a ×2.
  Se rinunci scappa e ti colpisce (**−12 HP**) e la serie riparte.
  - **Cambio app:** hai **10 secondi** per tornare, altrimenti lo yokai scappa.
  - **Schermo bloccato:** tocca prima **«Blocco lo schermo»** (un tocco, poi il tasto laterale):
    il timer va avanti anche a telefono bloccato e al rientro trovi lo yokai sigillato, senza danni.
  - *Perché un tocco?* Il browser non può distinguere «blocco lo schermo» da «cambio app»: per
    una pagina web è lo stesso evento. Solo un'app nativa potrebbe saperlo da sola.
  - Il tempo si calcola dall'orario di inizio, quindi il timer è sempre esatto.
  - Da Impostazioni si può spegnere del tutto la fuga dello yokai (nessun danno, mai).
- **Gioco (stile Habitica)**: XP e ryo (両) arrivano da abitudini (+10 XP, +5 両), tappe
  (+30/+15), obiettivi completati (+150/+75) e yokai sigillati. Il focus è diviso in
  **4 zone** (Hitodama → Chōchin-obake → Kasa-obake → Oni), ognuna con un **boss** di fine
  zona: puoi dedicargli una sfida invece che a uno yokai comune, e ogni sessione completata
  gli toglie danno (minuti × attacco dell'arma equipaggiata) finché non è sconfitto. Per
  passare alla zona successiva serve **sia** il livello richiesto **sia** aver sconfitto il
  boss precedente.
  Ogni oggetto ha un potere vero, non solo estetico: le **armi** (bokken, fude, katana, e la
  Masamune sbloccata sconfiggendo il Tengu) danneggiano i boss; i **cappelli** rigenerano HP
  nel tempo; le **vesti** aumentano gli HP massimi; i **compagni** danno un bonus percentuale
  a XP o ryo guadagnati (ricalcolato dal vivo, come il resto).
  Gli **HP** calano se lo yokai scappa (−12) o se salti un'abitudine prevista (−2, max −5 al
  giorno) e guariscono da soli dopo 7 giorni, oppure con una pozione. Nel **Dojo**
  personalizzi l'eroe, consulti il bestiario (zone, boss e barra vita) e sblocchi 14 traguardi.
  XP, ryo, HP e danno ai boss sono *calcolati* dai tuoi dati: se correggi un giorno passato, o
  cambi equipaggiamento, si correggono da soli. Nel database restano solo acquisti ed
  equipaggiamento (nelle impostazioni).
- **Tempo reale**: le modifiche sono immediate e si sincronizzano tra i dispositivi.

## Struttura

```
index.html · manifest.json · sw.js
css/style.css                 design system (carta washi, blu e arancio pastello)
js/config.js                  Supabase, email, aree e orizzonti
js/store.js · calc.js         dati (Supabase/demo) e logica dei KPI
js/charts.js                  grafici SVG (anelli, colonne, linee, heatmap)
js/game.js                    XP, HP, negozio, yokai ed eroe (SVG)
js/today · habits · goals · focus · dojo · body · reading · recall · insights · settings · export
scripts/sync_second_brain.py  vault .md → Supabase (Riscoperte)
scripts/install-second-brain-sync.sh   Portachiavi + LaunchAgent
supabase/schema.sql           tabelle, RLS, realtime
supabase/functions/integrations   Raindrop + Notion
```

Quando modifichi i file, incrementa `CACHE_NAME` in [sw.js](sw.js).
