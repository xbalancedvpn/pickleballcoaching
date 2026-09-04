-- Run this in Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_hour smallint not null check (start_hour between 8 and 23),
  status text not null default 'available'
    check (status in ('available', 'booked', 'unavailable')),
  client_name text,
  contact text,
  coaching_type text,
  rate numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(slot_date, start_hour)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_slots_updated_at on public.schedule_slots;
create trigger schedule_slots_updated_at
before update on public.schedule_slots
for each row execute function public.set_updated_at();

alter table public.schedule_slots enable row level security;

drop policy if exists "Admin read schedule" on public.schedule_slots;
drop policy if exists "Admin add schedule" on public.schedule_slots;
drop policy if exists "Admin update schedule" on public.schedule_slots;
drop policy if exists "Admin delete schedule" on public.schedule_slots;

create policy "Admin read schedule"
on public.schedule_slots for select to authenticated using (true);

create policy "Admin add schedule"
on public.schedule_slots for insert to authenticated with check (true);

create policy "Admin update schedule"
on public.schedule_slots for update to authenticated using (true) with check (true);

create policy "Admin delete schedule"
on public.schedule_slots for delete to authenticated using (true);

revoke all on table public.schedule_slots from anon;
grant select, insert, update, delete on table public.schedule_slots to authenticated;

drop view if exists public.public_schedule;
create view public.public_schedule as
select slot_date, start_hour, status
from public.schedule_slots;

grant select on public.public_schedule to anon, authenticated;
