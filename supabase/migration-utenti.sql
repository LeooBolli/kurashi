-- ============================================================
-- Kurashi per più account (Leonardo + Chiara), ognuno con i propri dati.
-- Da eseguire una volta nel SQL Editor di Supabase. Rieseguirlo non fa danni.
-- È la stessa parte di schema.sql (sezione SICUREZZA + sfondi), senza la PULIZIA.
-- ============================================================
create or replace function public.kurashi_allowed()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('23leo07@gmail.com', 'biagettimariachiara@gmail.com'), false)
$$;
revoke execute on function public.kurashi_allowed() from public, anon;
grant execute on function public.kurashi_allowed() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'goals','milestones','habits','habit_logs','focus_sessions',
    'mood_logs','sleep_logs','weight_logs','workouts','reading_items','highlights','settings',
    'foods','meal_entries','meal_templates'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated '
      'using (user_id = (select auth.uid()) and (select public.kurashi_allowed())) '
      'with check (user_id = (select auth.uid()) and (select public.kurashi_allowed()))',
      t
    );
  end loop;
end $$;

drop policy if exists "kurashi backgrounds own" on storage.objects;
create policy "kurashi backgrounds own" on storage.objects for all to authenticated
  using (bucket_id = 'kurashi-backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.kurashi_allowed()))
  with check (bucket_id = 'kurashi-backgrounds' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.kurashi_allowed()));
