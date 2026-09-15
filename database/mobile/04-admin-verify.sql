-- Coach Booking Master Template v1.2
-- MOBILE INSTALLER PART 4 OF 4: ADMIN RPCs + FINAL VERIFICATION

begin;

create or replace function public.admin_update_client_identity(
  p_client_id uuid,
  p_first_name text,
  p_last_name text,
  p_contact text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first text := regexp_replace(trim(coalesce(p_first_name,'')), '\s+', ' ', 'g');
  v_last text := regexp_replace(trim(coalesce(p_last_name,'')), '\s+', ' ', 'g');
  v_full text;
  v_name_key text;
  v_contact text := nullif(regexp_replace(trim(coalesce(p_contact,'')), '\s+', ' ', 'g'),'');
  v_contact_key text;
  v_duplicate uuid;
  v_booking_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_first = '' or v_last = '' then raise exception 'First name and last name are required'; end if;

  v_full := v_first || ' ' || v_last;
  v_name_key := lower(v_full);
  v_contact_key := case when v_contact is null then null else lower(v_contact) end;

  if v_contact_key is not null then
    select id into v_duplicate
    from public.clients
    where id <> p_client_id and is_active = true
      and name_key = v_name_key and contact_key = v_contact_key
    limit 1;
    if v_duplicate is not null then
      raise exception 'An active client with the same name and contact already exists';
    end if;
  end if;

  update public.clients
  set first_name = v_first,
      last_name = v_last,
      full_name = v_full,
      name_key = v_name_key,
      contact = v_contact,
      contact_key = v_contact_key,
      notes = nullif(trim(coalesce(p_notes,'')),''),
      updated_at = now()
  where id = p_client_id;

  if not found then raise exception 'Client not found'; end if;

  select array_agg(id) into v_booking_ids from public.bookings where client_id = p_client_id;

  update public.bookings set client_name = v_full, contact = v_contact where client_id = p_client_id;

  update public.booking_participants
  set first_name = v_first,
      last_name = v_last,
      full_name = v_full,
      contact = v_contact,
      contact_key = v_contact_key
  where client_id = p_client_id;

  if v_booking_ids is not null then
    update public.schedule_slots
    set client_name = v_full, contact = v_contact
    where booking_id = any(v_booking_ids);
  end if;

  return jsonb_build_object('client_id', p_client_id, 'full_name', v_full, 'updated', true);
end;
$$;

revoke all on function public.admin_update_client_identity(uuid,text,text,text,text) from public, anon;
grant execute on function public.admin_update_client_identity(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_split_legacy_client(
  p_client_id uuid,
  p_primary_first text,
  p_primary_last text,
  p_secondary_first text,
  p_secondary_last text,
  p_primary_contact text default null,
  p_secondary_contact text default null,
  p_primary_notes text default null,
  p_secondary_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p_first text := regexp_replace(trim(coalesce(p_primary_first,'')), '\s+', ' ', 'g');
  v_p_last text := regexp_replace(trim(coalesce(p_primary_last,'')), '\s+', ' ', 'g');
  v_s_first text := regexp_replace(trim(coalesce(p_secondary_first,'')), '\s+', ' ', 'g');
  v_s_last text := regexp_replace(trim(coalesce(p_secondary_last,'')), '\s+', ' ', 'g');
  v_p_full text;
  v_s_full text;
  v_p_name_key text;
  v_s_name_key text;
  v_p_contact text := nullif(regexp_replace(trim(coalesce(p_primary_contact,'')), '\s+', ' ', 'g'),'');
  v_s_contact text := nullif(regexp_replace(trim(coalesce(p_secondary_contact,'')), '\s+', ' ', 'g'),'');
  v_p_contact_key text;
  v_s_contact_key text;
  v_secondary_id uuid;
  v_same_name_count integer;
  v_booking record;
  v_order smallint;
  v_linked integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_p_first = '' or v_p_last = '' or v_s_first = '' or v_s_last = '' then
    raise exception 'Both players need a first name and last name';
  end if;

  perform 1 from public.clients where id = p_client_id;
  if not found then raise exception 'Legacy client not found'; end if;

  v_p_full := v_p_first || ' ' || v_p_last;
  v_s_full := v_s_first || ' ' || v_s_last;
  v_p_name_key := lower(v_p_full);
  v_s_name_key := lower(v_s_full);
  v_p_contact_key := case when v_p_contact is null then null else lower(v_p_contact) end;
  v_s_contact_key := case when v_s_contact is null then null else lower(v_s_contact) end;

  if v_p_name_key = v_s_name_key and coalesce(v_p_contact_key,'') = coalesce(v_s_contact_key,'') then
    raise exception 'Player 1 and Player 2 cannot be the same client';
  end if;

  if v_s_contact_key is not null then
    select id into v_secondary_id
    from public.clients
    where id <> p_client_id and is_active = true
      and name_key = v_s_name_key and contact_key = v_s_contact_key
    limit 1;
  else
    select count(*) into v_same_name_count
    from public.clients
    where id <> p_client_id and is_active = true and name_key = v_s_name_key;

    if v_same_name_count > 1 then
      raise exception 'More than one active client matches Player 2. Add a contact or clean the duplicates first.';
    elsif v_same_name_count = 1 then
      select id into v_secondary_id
      from public.clients
      where id <> p_client_id and is_active = true and name_key = v_s_name_key
      limit 1;
    end if;
  end if;

  if v_secondary_id is null then
    insert into public.clients(first_name,last_name,full_name,name_key,contact,contact_key,notes,is_active)
    values (v_s_first,v_s_last,v_s_full,v_s_name_key,v_s_contact,v_s_contact_key,nullif(trim(coalesce(p_secondary_notes,'')),''),true)
    returning id into v_secondary_id;
  end if;

  update public.clients
  set first_name = v_p_first,
      last_name = v_p_last,
      full_name = v_p_full,
      name_key = v_p_name_key,
      contact = v_p_contact,
      contact_key = v_p_contact_key,
      notes = nullif(trim(coalesce(p_primary_notes,'')),''),
      is_active = true,
      updated_at = now()
  where id = p_client_id;

  for v_booking in
    select distinct b.id, b.client_id
    from public.bookings b
    left join public.booking_participants bp on bp.booking_id = b.id
    where b.client_id = p_client_id or bp.client_id = p_client_id
  loop
    v_linked := v_linked + 1;

    if v_booking.client_id = p_client_id then
      update public.bookings
      set client_name = v_p_full,
          contact = v_p_contact,
          participant_count = greatest(coalesce(participant_count,1),2)
      where id = v_booking.id;

      update public.schedule_slots
      set client_name = v_p_full, contact = v_p_contact
      where booking_id = v_booking.id;
    end if;

    update public.booking_participants
    set first_name = v_p_first,
        last_name = v_p_last,
        full_name = v_p_full,
        contact = v_p_contact,
        contact_key = v_p_contact_key,
        is_primary = case when v_booking.client_id = p_client_id then true else is_primary end
    where booking_id = v_booking.id and client_id = p_client_id;

    if not exists (select 1 from public.booking_participants where booking_id = v_booking.id and client_id = v_secondary_id) then
      select gs::smallint into v_order
      from generate_series(1,8) gs
      where not exists (
        select 1 from public.booking_participants bp2
        where bp2.booking_id = v_booking.id and bp2.participant_order = gs
      )
      order by gs limit 1;

      if v_order is null then raise exception 'No free participant position for booking %', v_booking.id; end if;

      insert into public.booking_participants(
        booking_id, client_id, participant_order, first_name, last_name, full_name,
        contact, contact_key, is_primary
      ) values (
        v_booking.id, v_secondary_id, v_order, v_s_first, v_s_last, v_s_full,
        v_s_contact, v_s_contact_key, false
      );
    end if;
  end loop;

  return jsonb_build_object(
    'primary_client_id', p_client_id,
    'primary_name', v_p_full,
    'secondary_client_id', v_secondary_id,
    'secondary_name', v_s_full,
    'linked_bookings', v_linked
  );
end;
$$;

revoke all on function public.admin_split_legacy_client(uuid,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_split_legacy_client(uuid,text,text,text,text,text,text,text,text) to authenticated;

commit;

select
  'COACH BOOKING MASTER TEMPLATE v1.2 INSTALLED' as status,
  (select count(*) from information_schema.tables where table_schema='public' and table_name in (
    'clients','coaching_programs','coaching_program_sessions','client_programs','bookings','schedule_slots','inquiries',
    'booking_participants','inquiry_participants','booking_payments','client_program_payments','progress_assessments',
    'inquiry_self_assessments','testimonials'
  )) as core_tables_found,
  to_regclass('public.public_schedule') is not null as public_schedule_ready,
  to_regprocedure('public.submit_public_inquiry_v17f(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb,jsonb)') is not null as public_booking_rpc_ready,
  to_regprocedure('public.submit_public_testimonial_v17e(text,text,text)') is not null as testimonial_rpc_ready,
  'Next: create an Auth admin user, then connect app/config.js to this project.' as next_step;