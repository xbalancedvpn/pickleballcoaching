-- Pickyla v17-G client maintenance
-- Adds admin-safe helpers for editing legacy client identities and preserving linked display data.

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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'First name and last name are required';
  end if;

  v_full := v_first || ' ' || v_last;
  v_name_key := lower(v_full);
  v_contact_key := case when v_contact is null then null else lower(v_contact) end;

  if v_contact_key is not null then
    select id into v_duplicate
    from public.clients
    where id <> p_client_id
      and is_active = true
      and name_key = v_name_key
      and contact_key = v_contact_key
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

  if not found then
    raise exception 'Client not found';
  end if;

  select array_agg(id) into v_booking_ids
  from public.bookings
  where client_id = p_client_id;

  update public.bookings
  set client_name = v_full,
      contact = v_contact
  where client_id = p_client_id;

  update public.booking_participants
  set first_name = v_first,
      last_name = v_last,
      full_name = v_full,
      contact = v_contact,
      contact_key = v_contact_key
  where client_id = p_client_id;

  if v_booking_ids is not null then
    update public.schedule_slots
    set client_name = v_full,
        contact = v_contact
    where booking_id = any(v_booking_ids);
  end if;

  return jsonb_build_object('client_id',p_client_id,'full_name',v_full,'updated',true);
end;
$$;

revoke all on function public.admin_update_client_identity(uuid,text,text,text,text) from public, anon;
grant execute on function public.admin_update_client_identity(uuid,text,text,text,text) to authenticated;
