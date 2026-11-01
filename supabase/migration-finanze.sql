-- Sezione Finanze: da eseguire una volta nel SQL Editor del progetto Kurashi.
-- Aggiunge solo la tabella finance_entries (vuota); si può rieseguire senza danni.
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category text not null,
  amount numeric(10,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);
alter table public.finance_entries enable row level security;
drop policy if exists "own rows" on public.finance_entries;
create policy "own rows" on public.finance_entries for all to authenticated
  using (user_id = (select auth.uid()) and (select public.kurashi_allowed()))
  with check (user_id = (select auth.uid()) and (select public.kurashi_allowed()));
do $$
begin
  alter publication supabase_realtime add table public.finance_entries;
exception when duplicate_object then
  null; -- già presente
end $$;
notify pgrst, 'reload schema';
