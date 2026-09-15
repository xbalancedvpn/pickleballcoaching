-- Pickyla v17-D migration
-- Client Identity & Participant Management
-- Run ONCE after v17-B. Non-destructive: existing bookings, payments, programs, and reports remain intact.

begin;

-- 1) Canonical client identity fields. Existing full_name remains the compatibility/display field.
alter table public.clients add column if not exists first_name text;
alter table public.clients add column if not exists last_name text;
alter table public.clients add column if not exists name_key text;

update public.clients
set name_key=lower(regexp_replace(trim(full_name),'\s+',' ','g'))
where name_key is null and nullif(trim(full_name),'') is not null;

-- Safely backfill first/last for older profiles. New v17-D records always require both in the app.
update public.clients
set first_name=coalesce(first_name, split_part(regexp_replace(trim(full_name),'\s+',' ','g'),' ',1)),
    last_name=coalesce(last_name, nullif(regexp_replace(regexp_replace(trim(full_name),'\s+',' ','g'),'^[^ ]+\s*','','g'),''))
where nullif(trim(full_name),'') is not null;

-- v17-A treated contact as globally unique. v17-D allows family/partner clients to share a contact,
-- and uses contact + normalized name as the strong identity match.
drop index if exists public.uq_clients_contact_key;
create index if not exists idx_clients_contact_key on public.clients(contact_key) where contact_key is not null;
create index if not exists idx_clients_name_key on public.clients(name_key) where name_key is not null;
create unique index if not exists uq_clients_name_contact
  on public.clients(name_key,contact_key)
  where name_key is not null and contact_key is not null;

-- 2) Structured participants for confirmed bookings.
create table if not exists public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  participant_order smallint not null check (participant_order between 1 and 8),
  first_name text,
  last_name text,
  full_name text not null check (length(trim(full_name)) >= 2),
  contact text,
  contact_key text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(booking_id,participant_order)
);
create index if not exists idx_booking_participants_booking on public.booking_participants(booking_id,participant_order);
create index if not exists idx_booking_participants_client on public.booking_participants(client_id);
create index if not exists idx_booking_participants_name on public.booking_participants(lower(full_name));

-- Backfill the known primary person on existing bookings. Old group-member names were never stored,
-- so only the primary person can be recovered historically.
insert into public.booking_participants(booking_id,client_id,participant_order,first_name,last_name,full_name,contact,contact_key,is_primary)
select b.id,b.client_id,1,
       split_part(regexp_replace(trim(b.client_name),'\s+',' ','g'),' ',1),
       nullif(regexp_replace(regexp_replace(trim(b.client_name),'\s+',' ','g'),'^[^ ]+\s*','','g'),''),
       regexp_replace(trim(b.client_name),'\s+',' ','g'),
       nullif(trim(coalesce(b.contact,'')),''),
       nullif(lower(trim(coalesce(b.contact,''))),'') ,true
from public.bookings b
where nullif(trim(coalesce(b.client_name,'')),'') is not null
  and not exists (select 1 from public.booking_participants p where p.booking_id=b.id and p.participant_order=1)
on conflict (booking_id,participant_order) do nothing;

-- 3) Structured participants on public/pending inquiries.
create table if not exists public.inquiry_participants (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  participant_order smallint not null check (participant_order between 1 and 8),
  first_name text not null,
  last_name text not null,
  full_name text not null,
  contact text,
  contact_key text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(inquiry_id,participant_order)
);
create index if not exists idx_inquiry_participants_inquiry on public.inquiry_participants(inquiry_id,participant_order);
create index if not exists idx_inquiry_participants_name on public.inquiry_participants(lower(full_name));

alter table public.booking_participants enable row level security;
alter table public.inquiry_participants enable row level security;

drop policy if exists "Admin read booking participants" on public.booking_participants;
drop policy if exists "Admin add booking participants" on public.booking_participants;
drop policy if exists "Admin update booking participants" on public.booking_participants;
drop policy if exists "Admin delete booking participants" on public.booking_participants;
create policy "Admin read booking participants" on public.booking_participants for select to authenticated using (true);
create policy "Admin add booking participants" on public.booking_participants for insert to authenticated with check (true);
create policy "Admin update booking participants" on public.booking_participants for update to authenticated using (true) with check (true);
create policy "Admin delete booking participants" on public.booking_participants for delete to authenticated using (true);

drop policy if exists "Admin read inquiry participants" on public.inquiry_participants;
drop policy if exists "Admin add inquiry participants" on public.inquiry_participants;
drop policy if exists "Admin update inquiry participants" on public.inquiry_participants;
drop policy if exists "Admin delete inquiry participants" on public.inquiry_participants;
create policy "Admin read inquiry participants" on public.inquiry_participants for select to authenticated using (true);
create policy "Admin add inquiry participants" on public.inquiry_participants for insert to authenticated with check (true);
create policy "Admin update inquiry participants" on public.inquiry_participants for update to authenticated using (true) with check (true);
create policy "Admin delete inquiry participants" on public.inquiry_participants for delete to authenticated using (true);

grant select,insert,update,delete on public.booking_participants to authenticated;
grant select,insert,update,delete on public.inquiry_participants to authenticated;
revoke all on public.booking_participants from anon;
revoke all on public.inquiry_participants from anon;

-- 4) Privacy-safe public RPC. Anonymous users can submit participants but cannot read inquiry records.
create or replace function public.submit_public_inquiry_v17d(
  p_preferred_date date,
  p_start_hour smallint,
  p_end_hour smallint,
  p_participant_count smallint,
  p_coaching_type text,
  p_quoted_rate numeric,
  p_source_text text,
  p_goal_focus text,
  p_program_interest text,
  p_participants jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_primary jsonb;
  v_first text;
  v_last text;
  v_name text;
  v_contact text;
  v_item jsonb;
  v_ord bigint;
begin
  if p_preferred_date < current_date then raise exception 'That date has already passed.'; end if;
  if p_start_hour < 8 or p_start_hour > 23 or p_end_hour < 9 or p_end_hour > 24 or p_end_hour <= p_start_hour then
    raise exception 'Invalid requested time.';
  end if;
  if p_participant_count < 1 or p_participant_count > 8 then raise exception 'Invalid number of players.'; end if;
  if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) <> p_participant_count then
    raise exception 'Please complete the details for every player.';
  end if;

  for v_item,v_ord in select value,ordinality from jsonb_array_elements(p_participants) with ordinality loop
    v_first := regexp_replace(trim(coalesce(v_item->>'first_name','')),'\s+',' ','g');
    v_last := regexp_replace(trim(coalesce(v_item->>'last_name','')),'\s+',' ','g');
    if length(v_first) < 1 or length(v_first) > 60 or length(v_last) < 1 or length(v_last) > 80 then
      raise exception 'Every player needs a valid first name and last name.';
    end if;
    if length(coalesce(v_item->>'contact','')) > 120 then raise exception 'A contact value is too long.'; end if;
  end loop;

  if exists (
    select 1 from public.schedule_slots s
    where s.slot_date=p_preferred_date and s.start_hour>=p_start_hour and s.start_hour<p_end_hour
      and s.status in ('booked','unavailable')
  ) then raise exception 'One or more selected hours are no longer available. Please refresh the schedule.'; end if;

  v_primary := p_participants->0;
  v_first := regexp_replace(trim(coalesce(v_primary->>'first_name','')),'\s+',' ','g');
  v_last := regexp_replace(trim(coalesce(v_primary->>'last_name','')),'\s+',' ','g');
  v_name := trim(v_first||' '||v_last);
  v_contact := nullif(left(trim(coalesce(v_primary->>'contact','')),120),'');

  if exists (
    select 1 from public.inquiries i
    where lower(regexp_replace(trim(i.client_name),'\s+',' ','g'))=lower(v_name)
      and i.preferred_date=p_preferred_date and i.start_hour=p_start_hour and i.end_hour=p_end_hour
      and i.created_at > now()-interval '5 minutes'
  ) then raise exception 'A similar request was already submitted recently.'; end if;

  insert into public.inquiries(
    client_name,contact,preferred_date,start_hour,end_hour,participant_count,
    coaching_type,quoted_rate,status,source_text,notes,goal_focus,program_interest
  ) values (
    v_name,v_contact,p_preferred_date,p_start_hour,p_end_hour,p_participant_count,
    left(coalesce(p_coaching_type,''),80),p_quoted_rate,'new',left(coalesce(p_source_text,''),2000),
    'Submitted directly from public website',nullif(left(trim(coalesce(p_goal_focus,'')),120),''),
    nullif(left(trim(coalesce(p_program_interest,'')),160),'')
  ) returning id into v_id;

  insert into public.inquiry_participants(inquiry_id,participant_order,first_name,last_name,full_name,contact,contact_key,is_primary)
  select v_id,ord::smallint,
         regexp_replace(trim(coalesce(item->>'first_name','')),'\s+',' ','g'),
         regexp_replace(trim(coalesce(item->>'last_name','')),'\s+',' ','g'),
         trim(regexp_replace(trim(coalesce(item->>'first_name','')),'\s+',' ','g')||' '||regexp_replace(trim(coalesce(item->>'last_name','')),'\s+',' ','g')),
         nullif(left(trim(coalesce(item->>'contact','')),120),''),
         nullif(lower(left(trim(coalesce(item->>'contact','')),120)),''),
         ord=1
  from jsonb_array_elements(p_participants) with ordinality as x(item,ord);

  return v_id;
end;
$$;

revoke all on function public.submit_public_inquiry_v17d(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb) from public;
grant execute on function public.submit_public_inquiry_v17d(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb) to anon,authenticated;

-- 5) Backward compatibility for any cached v17-B/v17-C page: allow up to 8 players.
create or replace function public.submit_public_inquiry_v17(
  p_client_name text,p_contact text,p_preferred_date date,p_start_hour smallint,p_end_hour smallint,
  p_participant_count smallint,p_coaching_type text,p_quoted_rate numeric,p_source_text text,
  p_goal_focus text,p_program_interest text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if length(trim(coalesce(p_client_name,''))) < 2 or length(p_client_name) > 120 then raise exception 'Please enter a valid name.'; end if;
  if p_preferred_date < current_date then raise exception 'That date has already passed.'; end if;
  if p_start_hour < 8 or p_start_hour > 23 or p_end_hour < 9 or p_end_hour > 24 or p_end_hour <= p_start_hour then raise exception 'Invalid requested time.'; end if;
  if p_participant_count < 1 or p_participant_count > 8 then raise exception 'Invalid number of players.'; end if;
  if exists (select 1 from public.schedule_slots s where s.slot_date=p_preferred_date and s.start_hour>=p_start_hour and s.start_hour<p_end_hour and s.status in ('booked','unavailable')) then raise exception 'One or more selected hours are no longer available. Please refresh the schedule.'; end if;
  if exists (select 1 from public.inquiries i where lower(i.client_name)=lower(trim(p_client_name)) and i.preferred_date=p_preferred_date and i.start_hour=p_start_hour and i.end_hour=p_end_hour and i.created_at>now()-interval '5 minutes') then raise exception 'A similar request was already submitted recently.'; end if;
  insert into public.inquiries(client_name,contact,preferred_date,start_hour,end_hour,participant_count,coaching_type,quoted_rate,status,source_text,notes,goal_focus,program_interest)
  values(trim(p_client_name),nullif(left(trim(coalesce(p_contact,'')),120),''),p_preferred_date,p_start_hour,p_end_hour,p_participant_count,left(coalesce(p_coaching_type,''),80),p_quoted_rate,'new',left(coalesce(p_source_text,''),2000),'Submitted directly from public website',nullif(left(trim(coalesce(p_goal_focus,'')),120),''),nullif(left(trim(coalesce(p_program_interest,'')),160),'')) returning id into v_id;
  return v_id;
end; $$;

commit;
