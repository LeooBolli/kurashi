-- ============================================================
-- Kurashi - Supabase schema
-- Eseguire nel SQL Editor del progetto Supabase.
-- Si può rieseguire da cima a fondo quante volte si vuole: non
-- tocca i dati già salvati e non dà errori "esiste già".
-- Ogni riga appartiene a un utente (user_id) e le policy RLS
-- permettono di leggere/scrivere SOLO le proprie righe.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- OBIETTIVI (breve = 1 mese, medio = 4 mesi, lungo = 1 anno o più)
-- ------------------------------------------------------------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  area text not null default 'progetti',
  horizon text not null default 'short' check (horizon in ('short','medium','long')),
  description text,
  start_date date not null default current_date,
  due_date date not null default (current_date + 30),
  -- usato solo se l'obiettivo non ha né milestone né abitudini collegate
  manual_progress int not null default 0 check (manual_progress between 0 and 100),
  status text not null default 'active' check (status in ('active','done','archived')),
  notion_page_id text,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ABITUDINI
--   kind = 'check' (sì/no) oppure 'qty' (quantitativa: target + unità)
--   days = giorni della settimana in cui è prevista (1 = lunedì ... 7 = domenica)
--   goal_id = obiettivo a cui contribuisce
-- ------------------------------------------------------------
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  area text not null default 'salute',
  kind text not null default 'check' check (kind in ('check','qty')),
  target numeric(10,2) not null default 1,
  step numeric(10,2) not null default 1,
  unit text,
  days int[] not null default '{1,2,3,4,5,6,7}',
  goal_id uuid references goals(id) on delete set null,
  start_date date not null default current_date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  value numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- ------------------------------------------------------------
-- FOCUS (caccia allo yokai): ogni sessione completata sigilla uno yokai e dà XP e ryo;
-- se esci dall'app lo yokai scappa (completed = false) e perdi HP
-- ------------------------------------------------------------
create table if not exists focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_min int not null,
  completed boolean not null default false,
  xp int not null default 0,
  ryo int not null default 0,
  creature text,
  goal_id uuid references goals(id) on delete set null,
  habit_id uuid references habits(id) on delete set null,
  label text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- BENESSERE
-- ------------------------------------------------------------
create table if not exists mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sleep_date date not null,            -- la mattina in cui ti sei svegliato
  hours numeric(4,2) not null check (hours >= 0 and hours <= 24),
  quality int check (quality between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, sleep_date)
);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  kg numeric(5,2) not null check (kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_date date not null default current_date,
  kind text not null default 'Altro',
  minutes int not null default 30 check (minutes > 0),
  intensity int check (intensity between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- LETTURA (bookmark Raindrop.io + link aggiunti a mano)
-- ------------------------------------------------------------
create table if not exists reading_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null default 'manual',      -- 'manual' | 'raindrop'
  external_id text,
  title text not null,
  url text,
  cover text,
  status text not null default 'todo' check (status in ('todo','reading','done')),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

-- ------------------------------------------------------------
-- EVIDENZIAZIONI (dal second brain: Kindle, Raindrop...) per le "Riscoperte"
--   uid = id stabile (id Raindrop, oppure hash file+testo): rende la sync idempotente
--   La sync (scripts/sync_second_brain.py) scrive solo le colonne di contenuto;
--   favorite / muted / times_reviewed / last_reviewed_on li gestisce l'app.
-- ------------------------------------------------------------
create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  uid text not null,
  text text not null,
  note text,
  location text,                     -- "p. 7", oppure la data dell'evidenziazione
  source_title text not null,
  source_author text,
  source_url text,
  source_kind text,                  -- libro | articolo | video | nota ...
  source_file text,
  highlighted_at timestamptz,
  content_hash text,
  favorite boolean not null default false,
  muted boolean not null default false,
  times_reviewed int not null default 0,
  last_reviewed_on date,
  created_at timestamptz not null default now(),
  unique (user_id, uid)
);
create index if not exists highlights_source_idx on highlights (source_file);

-- ------------------------------------------------------------
-- IMPOSTAZIONI (una riga per utente, contenuto libero in JSON)
-- ------------------------------------------------------------
create table if not exists settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SICUREZZA: RLS - ognuno vede e modifica solo le proprie righe
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'goals','milestones','habits','habit_logs','focus_sessions',
    'mood_logs','sleep_logs','weight_logs','workouts','reading_items','highlights','settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- REALTIME: le modifiche arrivano in tempo reale su tutti i dispositivi
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'goals','milestones','habits','habit_logs','focus_sessions',
    'mood_logs','sleep_logs','weight_logs','workouts','reading_items','highlights'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then
      null; -- già presente
    end;
  end loop;
end $$;

create index if not exists habit_logs_date_idx on habit_logs (log_date);
create index if not exists focus_sessions_started_idx on focus_sessions (started_at);
create index if not exists mood_logs_logged_idx on mood_logs (logged_at);

-- ------------------------------------------------------------
-- MIGRAZIONE: se avevi già eseguito una versione precedente dello schema
-- (focus con alberi), queste colonne mancano. Sicuro rieseguirlo.
-- ------------------------------------------------------------
alter table focus_sessions add column if not exists xp int not null default 0;
alter table focus_sessions add column if not exists ryo int not null default 0;
alter table focus_sessions add column if not exists creature text;

-- Sottotappe: una tappa può avere tappe figlie (parent_id). Eliminando la tappa, spariscono anche le figlie.
alter table milestones add column if not exists parent_id uuid references milestones(id) on delete cascade;
create index if not exists milestones_parent_idx on milestones (parent_id);

-- Libri (da Goodreads o a mano): stessa tabella dei link da leggere, con pagine e avanzamento
alter table reading_items add column if not exists kind text not null default 'link';   -- link | book
alter table reading_items add column if not exists author text;
alter table reading_items add column if not exists pages int;
alter table reading_items add column if not exists current_page int not null default 0;
alter table reading_items add column if not exists goodreads_url text;
