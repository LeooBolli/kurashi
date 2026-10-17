-- ============================================================
-- Unione dei dati di Leonardo in un solo account (leonardobolli@gmail.com)
-- e 23leo07@gmail.com libero e vuoto, come account di prova.
--
-- Nessun account viene eliminato e nessun file viene spostato: i dati di
-- PDTravel passano all'account che ha già Kurashi e lo sfondo, poi i due
-- account si scambiano l'email.
--
--   b9a6dd3d-… (oggi 23leo07, ha Kurashi + sfondo) → diventa leonardobolli,
--              riceve anche i dati di PDTravel. Password: quella di Kurashi.
--   4467734b-… (oggi leonardobolli, ha PDTravel)   → si svuota e diventa 23leo07,
--              l'account di prova. Password: quella che usavi per PDTravel.
--
-- Chiara non viene toccata. Dopo l'esecuzione esci e rientra nelle app.
-- Da eseguire una volta nel SQL Editor di Supabase: è un'unica transazione,
-- se un controllo fallisce non cambia nulla.
-- ============================================================
begin;

do $$
declare
  main constant uuid := 'b9a6dd3d-4d18-48a5-92c0-e648f969d421';  -- diventerà leonardobolli
  demo constant uuid := '4467734b-79cb-423e-b597-e48fc6c0fb3c';  -- diventerà 23leo07 (prova)
  n int;
begin
  -- Controlli iniziali: i due account sono quelli giusti e nessuno dei due è già stato scambiato
  if (select email from auth.users where id = main) is distinct from '23leo07@gmail.com'
     or (select email from auth.users where id = demo) is distinct from 'leonardobolli@gmail.com' then
    raise exception 'Gli account non sono quelli attesi: niente modificato';
  end if;

  -- 1. Dati di PDTravel: dall'account che diventerà di prova a quello principale
  update public.trips              set created_by  = main where created_by  = demo;
  update public.bookings           set created_by  = main where created_by  = demo;
  update public.todos              set created_by  = main where created_by  = demo;
  update public.itinerary_items    set created_by  = main where created_by  = demo;
  update public.custom_options     set created_by  = main where created_by  = demo;
  update public.documents          set uploaded_by = main where uploaded_by = demo;
  update public.expenses           set paid_by     = main where paid_by     = demo;
  update public.packing_items      set owner_id    = main where owner_id    = demo;
  update public.packing_organizers set owner_id    = main where owner_id    = demo;
  update public.packing_templates  set owner_id    = main where owner_id    = demo;
  update public.user_preferences   set user_id     = main where user_id     = demo;
  update storage.objects           set owner       = main where owner       = demo;

  -- L'account di prova deve restare completamente vuoto (PDTravel e Kurashi)
  select (select count(*) from public.trips where created_by = demo)
       + (select count(*) from public.bookings where created_by = demo)
       + (select count(*) from public.todos where created_by = demo)
       + (select count(*) from public.itinerary_items where created_by = demo)
       + (select count(*) from public.custom_options where created_by = demo)
       + (select count(*) from public.documents where uploaded_by = demo)
       + (select count(*) from public.expenses where paid_by = demo)
       + (select count(*) from public.packing_items where owner_id = demo)
       + (select count(*) from public.packing_organizers where owner_id = demo)
       + (select count(*) from public.packing_templates where owner_id = demo)
       + (select count(*) from public.user_preferences where user_id = demo)
       + (select count(*) from public.goals where user_id = demo)
       + (select count(*) from public.milestones where user_id = demo)
       + (select count(*) from public.habits where user_id = demo)
       + (select count(*) from public.habit_logs where user_id = demo)
       + (select count(*) from public.focus_sessions where user_id = demo)
       + (select count(*) from public.mood_logs where user_id = demo)
       + (select count(*) from public.sleep_logs where user_id = demo)
       + (select count(*) from public.weight_logs where user_id = demo)
       + (select count(*) from public.workouts where user_id = demo)
       + (select count(*) from public.reading_items where user_id = demo)
       + (select count(*) from public.highlights where user_id = demo)
       + (select count(*) from public.foods where user_id = demo)
       + (select count(*) from public.meal_entries where user_id = demo)
       + (select count(*) from public.meal_templates where user_id = demo)
       + (select count(*) from public.settings where user_id = demo)
       + (select count(*) from storage.objects where owner = demo)
       + (select count(*) from storage.objects where name like demo::text || '%' or name like '%/' || demo::text || '/%')
    into n;
  if n > 0 then raise exception 'Restano % righe sull''account di prova: niente modificato', n; end if;

  -- 2. Scambio delle email (passando da un indirizzo temporaneo: le email sono uniche)
  update auth.users set email = 'scambio-temporaneo@kurashi.invalid', updated_at = now() where id = demo;
  update auth.users set email = 'leonardobolli@gmail.com', updated_at = now() where id = main;
  update auth.users set email = '23leo07@gmail.com',       updated_at = now() where id = demo;
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(u.email)), updated_at = now()
    from auth.users u
   where u.id = auth.identities.user_id and auth.identities.user_id in (main, demo) and provider = 'email';

  -- 3. Chiudo le sessioni aperte dei due account: al prossimo accesso l'email è quella nuova
  delete from auth.sessions where user_id in (main, demo);
end $$;

-- 4. Kurashi: leonardobolli (tu), Chiara e 23leo07 come account di prova
create or replace function public.kurashi_allowed()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('leonardobolli@gmail.com', 'biagettimariachiara@gmail.com', '23leo07@gmail.com'), false)
$$;

commit;

-- Verifica: leonardobolli con i dati di entrambe le app, 23leo07 tutto a zero, Chiara come prima
select u.email,
  (select count(*) from public.trips where created_by = u.id)     as viaggi,
  (select count(*) from public.expenses where paid_by = u.id)     as spese,
  (select count(*) from public.goals where user_id = u.id)        as obiettivi_kurashi,
  (select count(*) from public.meal_entries where user_id = u.id) as pasti_kurashi,
  (select count(*) from storage.objects where owner = u.id)       as file
from auth.users u order by u.email;
