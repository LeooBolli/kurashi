-- ============================================================
-- Unione dei due account di Leonardo in uno solo: leonardobolli@gmail.com
--
--   23leo07@gmail.com       (b9a6dd3d-…) → resta: ha i dati di Kurashi e lo sfondo,
--                                          prende l'email leonardobolli@gmail.com
--   leonardobolli@gmail.com (4467734b-…) → i suoi dati di PDTravel passano all'account
--                                          sopra, poi viene eliminato (non possiede file)
--
-- La password che resta è quella che usavi per Kurashi (23leo07).
-- Nessun file viene spostato o cancellato. Chiara non viene toccata.
-- Da eseguire una volta nel SQL Editor di Supabase: è un'unica transazione,
-- se un controllo fallisce non cambia nulla.
-- ============================================================
begin;

do $$
declare
  keep constant uuid := 'b9a6dd3d-4d18-48a5-92c0-e648f969d421';  -- 23leo07
  gone constant uuid := '4467734b-79cb-423e-b597-e48fc6c0fb3c';  -- leonardobolli
  n int;
begin
  -- Controlli iniziali: i due account sono quelli giusti
  if (select email from auth.users where id = keep) is distinct from '23leo07@gmail.com'
     or (select email from auth.users where id = gone) is distinct from 'leonardobolli@gmail.com' then
    raise exception 'Gli account non sono quelli attesi: niente modificato';
  end if;
  if exists (select 1 from storage.objects where owner = gone) then
    raise exception 'Il vecchio account possiede dei file: niente modificato';
  end if;

  -- 1. Dati di PDTravel: da leonardobolli all'account che resta
  update public.trips              set created_by  = keep where created_by  = gone;
  update public.bookings           set created_by  = keep where created_by  = gone;
  update public.todos              set created_by  = keep where created_by  = gone;
  update public.itinerary_items    set created_by  = keep where created_by  = gone;
  update public.custom_options     set created_by  = keep where created_by  = gone;
  update public.documents          set uploaded_by = keep where uploaded_by = gone;
  update public.expenses           set paid_by     = keep where paid_by     = gone;
  update public.packing_items      set owner_id    = keep where owner_id    = gone;
  update public.packing_organizers set owner_id    = keep where owner_id    = gone;
  update public.packing_templates  set owner_id    = keep where owner_id    = gone;
  update public.user_preferences   set user_id     = keep where user_id     = gone;

  -- Nessuna riga deve restare legata al vecchio account (altrimenti si perderebbe)
  select (select count(*) from public.trips where created_by = gone)
       + (select count(*) from public.bookings where created_by = gone)
       + (select count(*) from public.todos where created_by = gone)
       + (select count(*) from public.itinerary_items where created_by = gone)
       + (select count(*) from public.custom_options where created_by = gone)
       + (select count(*) from public.documents where uploaded_by = gone)
       + (select count(*) from public.expenses where paid_by = gone)
       + (select count(*) from public.packing_items where owner_id = gone)
       + (select count(*) from public.packing_organizers where owner_id = gone)
       + (select count(*) from public.packing_templates where owner_id = gone)
       + (select count(*) from public.user_preferences where user_id = gone)
       + (select count(*) from public.goals where user_id = gone)
       + (select count(*) from public.meal_entries where user_id = gone)
       + (select count(*) from public.settings where user_id = gone)
    into n;
  if n > 0 then raise exception 'Restano % righe sul vecchio account: niente modificato', n; end if;

  -- 2. Elimino il vecchio account (libera l'email leonardobolli)
  delete from auth.users where id = gone;

  -- 3. L'account che resta prende l'email leonardobolli
  update auth.users
     set email = 'leonardobolli@gmail.com', updated_at = now()
   where id = keep;
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', '"leonardobolli@gmail.com"'), updated_at = now()
   where user_id = keep and provider = 'email';
end $$;

-- 4. Kurashi accetta la nuova email (23leo07 resta fino alla pulizia finale)
create or replace function public.kurashi_allowed()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('leonardobolli@gmail.com', '23leo07@gmail.com', 'biagettimariachiara@gmail.com'), false)
$$;

commit;

-- Verifica: 2 righe, leonardobolli con i dati di entrambe le app, e Chiara
select u.email,
  (select count(*) from public.trips where created_by = u.id)     as viaggi,
  (select count(*) from public.expenses where paid_by = u.id)     as spese,
  (select count(*) from public.goals where user_id = u.id)        as obiettivi_kurashi,
  (select count(*) from public.meal_entries where user_id = u.id) as pasti_kurashi
from auth.users u order by u.email;
