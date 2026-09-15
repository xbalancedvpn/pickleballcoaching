-- Pickyla v17-A migration
-- Purpose: coaching-platform foundation without breaking existing v16 data.
-- Adds client profiles, coaching programs/packages, program enrollments,
-- progress assessments, session statuses, and program-payment ledger.
-- Run ONCE in Supabase > SQL Editor after the v16 migration.

begin;

-- ------------------------------------------------------------
-- 1) CLIENT PROFILES
-- ------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) >= 2),
  contact text,
  contact_key text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_clients_contact_key
  on public.clients(contact_key)
  where contact_key is not null and length(contact_key) > 0;
create index if not exists idx_clients_name on public.clients(lower(full_name));

-- ------------------------------------------------------------
-- 2) COACHING PROGRAMS / PACKAGES
-- ------------------------------------------------------------
create table if not exists public.coaching_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  overall_goal text,
  session_count smallint not null default 10 check (session_count between 1 and 50),
  session_duration_hours numeric(4,2) not null default 1 check (session_duration_hours > 0 and session_duration_hours <= 8),
  fixed_price numeric(10,2) not null default 0 check (fixed_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coaching_program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.coaching_programs(id) on delete cascade,
  session_number smallint not null check (session_number between 1 and 50),
  title text not null,
  goal text,
  created_at timestamptz not null default now(),
  unique(program_id, session_number)
);

create index if not exists idx_program_sessions_program on public.coaching_program_sessions(program_id, session_number);

-- ------------------------------------------------------------
-- 3) CLIENT PROGRAM ENROLLMENT
-- ------------------------------------------------------------
create table if not exists public.client_programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  program_id uuid not null references public.coaching_programs(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active','completed','paused','cancelled')),
  price_at_enrollment numeric(10,2) not null default 0 check (price_at_enrollment >= 0),
  enrolled_at date not null default current_date,
  completed_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_programs_client on public.client_programs(client_id);
create index if not exists idx_client_programs_program on public.client_programs(program_id);
create index if not exists idx_client_programs_status on public.client_programs(status);

-- Package-level payment ledger. This is intentionally separate from booking_payments,
-- because a fixed-price 10-session package can be paid before individual sessions occur.
create table if not exists public.client_program_payments (
  id uuid primary key default gen_random_uuid(),
  client_program_id uuid not null references public.client_programs(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at date not null default current_date,
  payment_method text not null default 'Cash',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_program_payments_enrollment on public.client_program_payments(client_program_id);
create index if not exists idx_program_payments_paid_at on public.client_program_payments(paid_at);

-- ------------------------------------------------------------
-- 4) SESSION STATUS + LINKS ON EXISTING BOOKINGS
-- ------------------------------------------------------------
alter table public.bookings add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.bookings add column if not exists client_program_id uuid references public.client_programs(id) on delete set null;
alter table public.bookings add column if not exists program_session_number smallint;
alter table public.bookings add column if not exists session_status text not null default 'scheduled';
alter table public.bookings add column if not exists session_closed_at timestamptz;
alter table public.bookings add column if not exists session_outcome_note text;

-- Add constraints only if not already present.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='bookings_program_session_number_check'
  ) then
    alter table public.bookings
      add constraint bookings_program_session_number_check
      check (program_session_number is null or program_session_number between 1 and 50);
  end if;
  if not exists (
    select 1 from pg_constraint where conname='bookings_session_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_session_status_check
      check (session_status in ('scheduled','completed','client_cancelled','coach_cancelled','no_show','cancelled'));
  end if;
end $$;

create index if not exists idx_bookings_client_id on public.bookings(client_id);
create index if not exists idx_bookings_client_program on public.bookings(client_program_id);
create index if not exists idx_bookings_session_status on public.bookings(session_status);

-- Preserve legacy cancellation information.
update public.bookings
set session_status='cancelled'
where status='cancelled' and session_status='scheduled';

-- ------------------------------------------------------------
-- 5) PLAYER PROGRESS ASSESSMENTS
-- ------------------------------------------------------------
create table if not exists public.progress_assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  client_program_id uuid references public.client_programs(id) on delete set null,
  assessment_date date not null default current_date,
  assessment_type text not null default 'session'
    check (assessment_type in ('initial','session','mid','final')),
  serve smallint check (serve between 1 and 5),
  return_score smallint check (return_score between 1 and 5),
  forehand smallint check (forehand between 1 and 5),
  backhand smallint check (backhand between 1 and 5),
  dinking smallint check (dinking between 1 and 5),
  footwork smallint check (footwork between 1 and 5),
  positioning smallint check (positioning between 1 and 5),
  consistency smallint check (consistency between 1 and 5),
  strategy smallint check (strategy between 1 and 5),
  confidence smallint check (confidence between 1 and 5),
  coach_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_progress_client_date on public.progress_assessments(client_id, assessment_date desc);
create index if not exists idx_progress_program on public.progress_assessments(client_program_id);

-- ------------------------------------------------------------
-- 6) UPDATED_AT HELPERS
-- ------------------------------------------------------------
create or replace function public.pickyla_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
for each row execute function public.pickyla_set_updated_at();

drop trigger if exists coaching_programs_updated_at on public.coaching_programs;
create trigger coaching_programs_updated_at before update on public.coaching_programs
for each row execute function public.pickyla_set_updated_at();

drop trigger if exists client_programs_updated_at on public.client_programs;
create trigger client_programs_updated_at before update on public.client_programs
for each row execute function public.pickyla_set_updated_at();

-- ------------------------------------------------------------
-- 7) SAFE CLIENT BACKFILL FROM EXISTING BOOKINGS
-- Only bookings with a non-empty contact are auto-linked.
-- We DO NOT merge name-only records automatically.
-- ------------------------------------------------------------
insert into public.clients(full_name, contact, contact_key)
select distinct on (lower(trim(b.contact)))
       b.client_name,
       trim(b.contact),
       lower(trim(b.contact))
from public.bookings b
where nullif(trim(coalesce(b.contact,'')),'') is not null
order by lower(trim(b.contact)), b.created_at desc
on conflict (contact_key) where contact_key is not null and length(contact_key) > 0 do nothing;

update public.bookings b
set client_id=c.id
from public.clients c
where b.client_id is null
  and nullif(trim(coalesce(b.contact,'')),'') is not null
  and c.contact_key=lower(trim(b.contact));

-- ------------------------------------------------------------
-- 8) RLS / PERMISSIONS
-- Admin access remains authenticated-only, consistent with v16.
-- ------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.coaching_programs enable row level security;
alter table public.coaching_program_sessions enable row level security;
alter table public.client_programs enable row level security;
alter table public.client_program_payments enable row level security;
alter table public.progress_assessments enable row level security;

-- Clients
DROP POLICY IF EXISTS "Admin read clients" ON public.clients;
DROP POLICY IF EXISTS "Admin add clients" ON public.clients;
DROP POLICY IF EXISTS "Admin update clients" ON public.clients;
DROP POLICY IF EXISTS "Admin delete clients" ON public.clients;
CREATE POLICY "Admin read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin add clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update clients" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- Programs
DROP POLICY IF EXISTS "Admin read coaching programs" ON public.coaching_programs;
DROP POLICY IF EXISTS "Admin add coaching programs" ON public.coaching_programs;
DROP POLICY IF EXISTS "Admin update coaching programs" ON public.coaching_programs;
DROP POLICY IF EXISTS "Admin delete coaching programs" ON public.coaching_programs;
CREATE POLICY "Admin read coaching programs" ON public.coaching_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin add coaching programs" ON public.coaching_programs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update coaching programs" ON public.coaching_programs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete coaching programs" ON public.coaching_programs FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin read program sessions" ON public.coaching_program_sessions;
DROP POLICY IF EXISTS "Admin add program sessions" ON public.coaching_program_sessions;
DROP POLICY IF EXISTS "Admin update program sessions" ON public.coaching_program_sessions;
DROP POLICY IF EXISTS "Admin delete program sessions" ON public.coaching_program_sessions;
CREATE POLICY "Admin read program sessions" ON public.coaching_program_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin add program sessions" ON public.coaching_program_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update program sessions" ON public.coaching_program_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete program sessions" ON public.coaching_program_sessions FOR DELETE TO authenticated USING (true);

-- Enrollments
DROP POLICY IF EXISTS "Admin read client programs" ON public.client_programs;
DROP POLICY IF EXISTS "Admin add client programs" ON public.client_programs;
DROP POLICY IF EXISTS "Admin update client programs" ON public.client_programs;
DROP POLICY IF EXISTS "Admin delete client programs" ON public.client_programs;
CREATE POLICY "Admin read client programs" ON public.client_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin add client programs" ON public.client_programs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update client programs" ON public.client_programs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete client programs" ON public.client_programs FOR DELETE TO authenticated USING (true);

-- Program payments
DROP POLICY IF EXISTS "Admin read program payments" ON public.client_program_payments;
DROP POLICY IF EXISTS "Admin add program payments" ON public.client_program_payments;
DROP POLICY IF EXISTS "Admin update program payments" ON public.client_program_payments;
DROP POLICY IF EXISTS "Admin delete program payments" ON public.client_program_payments;
CREATE POLICY "Admin read program payments" ON public.client_program_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin add program payments" ON public.client_program_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update program payments" ON public.client_program_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete program payments" ON public.client_program_payments FOR DELETE TO authenticated USING (true);

-- Progress
DROP POLICY IF EXISTS "Admin read progress" ON public.progress_assessments;
DROP POLICY IF EXISTS "Admin add progress" ON public.progress_assessments;
DROP POLICY IF EXISTS "Admin update progress" ON public.progress_assessments;
DROP POLICY IF EXISTS "Admin delete progress" ON public.progress_assessments;
CREATE POLICY "Admin read progress" ON public.progress_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin add progress" ON public.progress_assessments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update progress" ON public.progress_assessments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete progress" ON public.progress_assessments FOR DELETE TO authenticated USING (true);

GRANT SELECT,INSERT,UPDATE,DELETE ON public.clients TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.coaching_programs TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.coaching_program_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.client_programs TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.client_program_payments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.progress_assessments TO authenticated;

REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.coaching_programs FROM anon;
REVOKE ALL ON public.coaching_program_sessions FROM anon;
REVOKE ALL ON public.client_programs FROM anon;
REVOKE ALL ON public.client_program_payments FROM anon;
REVOKE ALL ON public.progress_assessments FROM anon;

commit;
