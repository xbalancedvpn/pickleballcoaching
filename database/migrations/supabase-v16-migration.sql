-- Pickyla v16 migration
-- Adds: public booking-request RPC + payment ledger for accurate cash reports.
-- Run ONCE in Supabase > SQL Editor after the earlier Pickyla migrations.

-- 1) Payment ledger
create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at date not null default current_date,
  payment_method text not null default 'Cash',
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_payments_booking_id on public.booking_payments(booking_id);
create index if not exists idx_booking_payments_paid_at on public.booking_payments(paid_at);

alter table public.booking_payments enable row level security;
drop policy if exists "Admin read booking payments" on public.booking_payments;
drop policy if exists "Admin add booking payments" on public.booking_payments;
drop policy if exists "Admin update booking payments" on public.booking_payments;
drop policy if exists "Admin delete booking payments" on public.booking_payments;
create policy "Admin read booking payments" on public.booking_payments for select to authenticated using (true);
create policy "Admin add booking payments" on public.booking_payments for insert to authenticated with check (true);
create policy "Admin update booking payments" on public.booking_payments for update to authenticated using (true) with check (true);
create policy "Admin delete booking payments" on public.booking_payments for delete to authenticated using (true);
grant select,insert,update,delete on public.booking_payments to authenticated;
revoke all on public.booking_payments from anon;

create or replace function public.sync_booking_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking uuid;
begin
  if tg_op = 'DELETE' then
    v_booking := old.booking_id;
  else
    v_booking := new.booking_id;
  end if;

  update public.bookings b
     set amount_paid = coalesce((select sum(p.amount) from public.booking_payments p where p.booking_id=v_booking),0)
   where b.id=v_booking;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists booking_payments_sync_total on public.booking_payments;
create trigger booking_payments_sync_total
after insert or update or delete on public.booking_payments
for each row execute function public.sync_booking_amount_paid();

-- Backfill existing cumulative collections into one legacy ledger row per booking.
-- Historical payment date was not previously recorded, so session_date is used as an estimate.
insert into public.booking_payments (booking_id,amount,paid_at,payment_method,note,source)
select b.id,b.amount_paid,b.session_date,'Legacy','Existing collected balance before v16; original payment date was not recorded.','legacy_backfill'
from public.bookings b
where coalesce(b.amount_paid,0)>0
  and not exists (select 1 from public.booking_payments p where p.booking_id=b.id);

-- Recalculate booking.amount_paid from ledger after backfill.
update public.bookings b
set amount_paid=coalesce((select sum(p.amount) from public.booking_payments p where p.booking_id=b.id),0);

-- 2) Privacy-safe public inquiry submission.
-- Anon users can execute this function but still cannot read the inquiries table.
create or replace function public.submit_public_inquiry(
  p_client_name text,
  p_contact text,
  p_preferred_date date,
  p_start_hour smallint,
  p_end_hour smallint,
  p_participant_count smallint,
  p_coaching_type text,
  p_quoted_rate numeric,
  p_source_text text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if length(trim(coalesce(p_client_name,''))) < 2 or length(p_client_name) > 120 then
    raise exception 'Please enter a valid name.';
  end if;
  if p_preferred_date < current_date then raise exception 'That date has already passed.'; end if;
  if p_start_hour < 8 or p_start_hour > 23 or p_end_hour < 9 or p_end_hour > 24 or p_end_hour <= p_start_hour then
    raise exception 'Invalid requested time.';
  end if;
  if p_participant_count < 1 or p_participant_count > 5 then raise exception 'Invalid number of players.'; end if;
  if exists (
    select 1 from public.schedule_slots s
    where s.slot_date=p_preferred_date
      and s.start_hour>=p_start_hour and s.start_hour<p_end_hour
      and s.status in ('booked','unavailable')
  ) then raise exception 'One or more selected hours are no longer available. Please refresh the schedule.'; end if;
  if exists (
    select 1 from public.inquiries i
    where lower(i.client_name)=lower(trim(p_client_name))
      and i.preferred_date=p_preferred_date and i.start_hour=p_start_hour and i.end_hour=p_end_hour
      and i.created_at > now()-interval '5 minutes'
  ) then raise exception 'A similar request was already submitted recently.'; end if;

  insert into public.inquiries(client_name,contact,preferred_date,start_hour,end_hour,participant_count,coaching_type,quoted_rate,status,source_text,notes)
  values(trim(p_client_name),nullif(left(trim(coalesce(p_contact,'')),120),''),p_preferred_date,p_start_hour,p_end_hour,p_participant_count,left(coalesce(p_coaching_type,''),80),p_quoted_rate,'new',left(coalesce(p_source_text,''),2000),'Submitted directly from public website')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_public_inquiry(text,text,date,smallint,smallint,smallint,text,numeric,text) from public;
grant execute on function public.submit_public_inquiry(text,text,date,smallint,smallint,smallint,text,numeric,text) to anon,authenticated;
