-- Pickyla v17-G hotfix: client split UUID lookup
-- Fixes PostgreSQL error: function min(uuid) does not exist

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
  v_duplicate uuid;
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

  select id into v_duplicate
  from public.clients
  where id <> p_client_id and is_active = true and name_key = v_p_name_key
    and (v_p_contact_key is null or contact_key = v_p_contact_key)
  limit 1;
  if v_duplicate is not null then
    raise exception 'An active client matching Player 1 already exists. Edit or merge that client first.';
  end if;

  if v_s_contact_key is not null then
    select id into v_secondary_id
    from public.clients
    where id <> p_client_id and is_active = true and name_key = v_s_name_key and contact_key = v_s_contact_key
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
    else
      v_secondary_id := null;
    end if;
  end if;

  if v_secondary_id is null then
    insert into public.clients(first_name,last_name,full_name,name_key,contact,contact_key,notes,is_active)
    values(v_s_first,v_s_last,v_s_full,v_s_name_key,v_s_contact,v_s_contact_key,nullif(trim(coalesce(p_secondary_notes,'')),''),true)
    returning id into v_secondary_id;
  else
    update public.clients
    set first_name=v_s_first,last_name=v_s_last,full_name=v_s_full,name_key=v_s_name_key,
        contact=coalesce(v_s_contact,contact),contact_key=coalesce(v_s_contact_key,contact_key),
        notes=coalesce(nullif(trim(coalesce(p_secondary_notes,'')),''),notes),updated_at=now()
    where id=v_secondary_id;
  end if;

  update public.clients
  set first_name=v_p_first,last_name=v_p_last,full_name=v_p_full,name_key=v_p_name_key,
      contact=v_p_contact,contact_key=v_p_contact_key,
      notes=nullif(trim(coalesce(p_primary_notes,'')),''),is_active=true,updated_at=now()
  where id=p_client_id;

  for v_booking in
    select distinct b.id,b.client_id,b.participant_count
    from public.bookings b
    left join public.booking_participants bp on bp.booking_id=b.id
    where b.client_id=p_client_id or bp.client_id=p_client_id
  loop
    v_linked := v_linked + 1;

    if v_booking.client_id = p_client_id then
      update public.bookings
      set client_name=v_p_full,contact=v_p_contact,participant_count=greatest(coalesce(participant_count,1),2)
      where id=v_booking.id;
      update public.schedule_slots
      set client_name=v_p_full,contact=v_p_contact
      where booking_id=v_booking.id;
    end if;

    update public.booking_participants
    set first_name=v_p_first,last_name=v_p_last,full_name=v_p_full,contact=v_p_contact,contact_key=v_p_contact_key,
        is_primary=case when v_booking.client_id=p_client_id then true else is_primary end
    where booking_id=v_booking.id and client_id=p_client_id;

    if not exists(select 1 from public.booking_participants where booking_id=v_booking.id and client_id=p_client_id) then
      select gs::smallint into v_order
      from generate_series(1,8) gs
      where not exists(select 1 from public.booking_participants bp2 where bp2.booking_id=v_booking.id and bp2.participant_order=gs)
      order by gs limit 1;
      if v_order is null then raise exception 'No free participant position for booking %',v_booking.id; end if;
      insert into public.booking_participants(booking_id,client_id,participant_order,first_name,last_name,full_name,contact,contact_key,is_primary)
      values(v_booking.id,p_client_id,v_order,v_p_first,v_p_last,v_p_full,v_p_contact,v_p_contact_key,v_booking.client_id=p_client_id);
    end if;

    if not exists(select 1 from public.booking_participants where booking_id=v_booking.id and client_id=v_secondary_id) then
      select gs::smallint into v_order
      from generate_series(1,8) gs
      where not exists(select 1 from public.booking_participants bp2 where bp2.booking_id=v_booking.id and bp2.participant_order=gs)
      order by gs limit 1;
      if v_order is null then raise exception 'No free participant position for booking %',v_booking.id; end if;
      insert into public.booking_participants(booking_id,client_id,participant_order,first_name,last_name,full_name,contact,contact_key,is_primary)
      values(v_booking.id,v_secondary_id,v_order,v_s_first,v_s_last,v_s_full,v_s_contact,v_s_contact_key,false);
    end if;
  end loop;

  return jsonb_build_object('primary_client_id',p_client_id,'primary_name',v_p_full,'secondary_client_id',v_secondary_id,'secondary_name',v_s_full,'linked_bookings',v_linked);
end;
$$;

revoke all on function public.admin_split_legacy_client(uuid,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_split_legacy_client(uuid,text,text,text,text,text,text,text,text) to authenticated;
