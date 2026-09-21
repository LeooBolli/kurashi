-- Aggiornamento del database: libri (con Goodreads) e sottotappe.
-- Incollalo in Supabase → SQL Editor → Run. È sicuro rieseguirlo, non tocca i tuoi dati.

alter table milestones add column if not exists parent_id uuid references milestones(id) on delete cascade;
create index if not exists milestones_parent_idx on milestones (parent_id);

alter table reading_items add column if not exists kind text not null default 'link';
alter table reading_items add column if not exists author text;
alter table reading_items add column if not exists pages int;
alter table reading_items add column if not exists current_page int not null default 0;
alter table reading_items add column if not exists goodreads_url text;

-- Fa riconoscere subito le colonne nuove all'API
notify pgrst, 'reload schema';
