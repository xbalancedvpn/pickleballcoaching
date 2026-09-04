-- Pickyla v4 migration
-- Run ONCE in Supabase > SQL Editor before uploading v4 files.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  start_hour smallint not null check (start_hour between 8 and 23),
  end_hour smallint not null check (end_hour between 9 and 24),
  client_name text not null,
  contact text,
  participant_count smallint not null default 1 check (participant_count between 1 and 5),
  coaching_type text,
  rate_mode text not null default 'standard' check (rate_mode in ('standard','custom')),
  rate_per_person numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  notes text,
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_hour > start_hour)
);

create or replace function public.set_booking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
before update on public.bookings
for each row execute function public.set_booking_updated_at();

alter table public.bookings enable row level security;

drop policy if exists "Admin read bookings" on public.bookings;
drop policy if exists "Admin add bookings" on public.bookings;
drop policy if exists "Admin update bookings" on public.bookings;
drop policy if exists "Admin delete bookings" on public.bookings;

create policy "Admin read bookings"
on public.bookings for select to authenticated using (true);

create policy "Admin add bookings"
on public.bookings for insert to authenticated with check (true);

create policy "Admin update bookings"
on public.bookings for update to authenticated using (true) with check (true);

create policy "Admin delete bookings"
on public.bookings for delete to authenticated using (true);

grant select, insert, update, delete on table public.bookings to authenticated;
revoke all on table public.bookings from anon;

alter table public.schedule_slots
add column if not exists booking_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_slots_booking_id_fkey'
  ) then
    alter table public.schedule_slots
    add constraint schedule_slots_booking_id_fkey
    foreign key (booking_id)
    references public.bookings(id)
    on delete set null;
  end if;
end $$;

create index if not exists idx_schedule_slots_booking_id
on public.schedule_slots(booking_id);

-- Keep the public view privacy-safe: clients only see date/time/status.
drop view if exists public.public_schedule;

create view public.public_schedule
with (security_invoker = false)
as
select slot_date, start_hour, status
from public.schedule_slots;

grant select on public.public_schedule to anon, authenticated;
