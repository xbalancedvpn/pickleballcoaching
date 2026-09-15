-- Coach Booking Master Template v1.2
-- MOBILE INSTALLER PART 1 OF 4: SCHEMA + TRIGGERS
-- Run on a NEW Supabase project only.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.schedule_slots') is not null
     or to_regclass('public.bookings') is not null
     or to_regclass('public.clients') is not null
     or to_regclass('public.inquiries') is not null then
    raise exception 'Part 1 stopped: existing Coach Booking tables were found.';
  end if;
end
$$;

begin;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  full_name text not null check (length(trim(full_name)) >= 2),
  name_key text,
  contact text,
  contact_key text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_clients_name on public.clients(lower(full_name));
create index idx_clients_name_key on public.clients(name_key) where name_key is not null;
create index idx_clients_contact_key on public.clients(contact_key) where contact_key is not null;
create unique index uq_clients_name_contact on public.clients(name_key, contact_key)
  where name_key is not null and contact_key is not null;

create table public.coaching_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  overall_goal text,
  session_count smallint not null default 10 check (session_count between 1 and 50),
  session_duration_hours numeric(4,2) not null default 1 check (session_duration_hours > 0 and session_duration_hours <= 8),
  fixed_price numeric(10,2) not null default 0 check (fixed_price >= 0),
  focus_areas text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coaching_program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.coaching_programs(id) on delete cascade,
  session_number smallint not null check (session_number between 1 and 50),
  title text not null,
  goal text,
  created_at timestamptz not null default now(),
  unique(program_id, session_number)
);
create index idx_program_sessions_program on public.coaching_program_sessions(program_id, session_number);

create table public.client_programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  program_id uuid not null references public.coaching_programs(id) on delete restrict,
  status text not null default 'active' check (status in ('active','completed','paused','cancelled')),
  price_at_enrollment numeric(10,2) not null default 0 check (price_at_enrollment >= 0),
  enrolled_at date not null default current_date,
  completed_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_programs_client on public.client_programs(client_id);
create index idx_client_programs_program on public.client_programs(program_id);
create index idx_client_programs_status on public.client_programs(status);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  start_hour smallint not null check (start_hour between 0 and 23),
  end_hour smallint not null check (end_hour between 1 and 24),
  client_name text not null,
  contact text,
  participant_count smallint not null default 1 check (participant_count between 1 and 8),
  coaching_type text,
  rate_mode text not null default 'standard' check (rate_mode in ('standard','custom')),
  rate_per_person numeric(10,2) not null default 0 check (rate_per_person >= 0),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(10,2) not null default 0 check (amount_paid >= 0),
  notes text,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  cancelled_at timestamptz,
  client_id uuid references public.clients(id) on delete set null,
  client_program_id uuid references public.client_programs(id) on delete set null,
  program_session_number smallint check (program_session_number is null or program_session_number between 1 and 50),
  session_status text not null default 'scheduled'
    check (session_status in ('scheduled','completed','client_cancelled','coach_cancelled','no_show','cancelled')),
  session_closed_at timestamptz,
  session_outcome_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_hour > start_hour)
);
create index idx_bookings_session_date on public.bookings(session_date, start_hour);
create index idx_bookings_client_id on public.bookings(client_id);
create index idx_bookings_client_program on public.bookings(client_program_id);
create index idx_bookings_session_status on public.bookings(session_status);
create index idx_bookings_status on public.bookings(status);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_hour smallint not null check (start_hour between 0 and 23),
  status text not null default 'available' check (status in ('available','booked','unavailable')),
  client_name text,
  contact text,
  coaching_type text,
  rate numeric(10,2),
  notes text,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(slot_date, start_hour)
);
create index idx_schedule_slots_booking_id on public.schedule_slots(booking_id);
create index idx_schedule_slots_date_status on public.schedule_slots(slot_date, status);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  contact text,
  preferred_date date,
  start_hour smallint check (start_hour between 0 and 23),
  end_hour smallint check (end_hour between 1 and 24),
  participant_count smallint check (participant_count between 1 and 8),
  coaching_type text,
  quoted_rate numeric(10,2),
  status text not null default 'new' check (status in ('new','waiting','tentative','confirmed','cancelled')),
  source_text text,
  notes text,
  goal_focus text,
  program_interest text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_hour is null or end_hour is null or end_hour > start_hour)
);
create index idx_inquiries_status on public.inquiries(status);
create index idx_inquiries_date on public.inquiries(preferred_date);
create index idx_inquiries_created_at on public.inquiries(created_at desc);

create table public.booking_participants (
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
  unique(booking_id, participant_order)
);
create index idx_booking_participants_booking on public.booking_participants(booking_id, participant_order);
create index idx_booking_participants_client on public.booking_participants(client_id);
create index idx_booking_participants_name on public.booking_participants(lower(full_name));

create table public.inquiry_participants (
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
  unique(inquiry_id, participant_order)
);
create index idx_inquiry_participants_inquiry on public.inquiry_participants(inquiry_id, participant_order);
create index idx_inquiry_participants_name on public.inquiry_participants(lower(full_name));

create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at date not null default current_date,
  payment_method text not null default 'Cash',
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index idx_booking_payments_booking_id on public.booking_payments(booking_id);
create index idx_booking_payments_paid_at on public.booking_payments(paid_at);

create table public.client_program_payments (
  id uuid primary key default gen_random_uuid(),
  client_program_id uuid not null references public.client_programs(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at date not null default current_date,
  payment_method text not null default 'Cash',
  note text,
  created_at timestamptz not null default now()
);
create index idx_program_payments_enrollment on public.client_program_payments(client_program_id);
create index idx_program_payments_paid_at on public.client_program_payments(paid_at);

create table public.progress_assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  client_program_id uuid references public.client_programs(id) on delete set null,
  source_inquiry_id uuid references public.inquiries(id) on delete set null,
  assessment_date date not null default current_date,
  assessment_type text not null default 'session' check (assessment_type in ('initial','session','mid','final')),
  assessment_source text not null default 'coach' check (assessment_source in ('coach','client_self')),
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
create index idx_progress_client_date on public.progress_assessments(client_id, assessment_date desc);
create index idx_progress_program on public.progress_assessments(client_program_id);
create unique index uq_progress_source_inquiry_self on public.progress_assessments(source_inquiry_id)
  where source_inquiry_id is not null and assessment_source = 'client_self';

create table public.inquiry_self_assessments (
  inquiry_id uuid primary key references public.inquiries(id) on delete cascade,
  participant_order smallint not null default 1 check (participant_order = 1),
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
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) >= 2),
  player_level text,
  quote text not null check (length(trim(quote)) >= 8),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  source text not null default 'admin' check (source in ('admin','public')),
  review_status text not null default 'approved' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_published = false or review_status = 'approved')
);
create index idx_testimonials_public on public.testimonials(is_published, sort_order, created_at desc);
create index idx_testimonials_review_queue on public.testimonials(review_status, created_at desc);

create or replace function public.coach_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at before update on public.clients for each row execute function public.coach_set_updated_at();
create trigger coaching_programs_updated_at before update on public.coaching_programs for each row execute function public.coach_set_updated_at();
create trigger client_programs_updated_at before update on public.client_programs for each row execute function public.coach_set_updated_at();
create trigger bookings_updated_at before update on public.bookings for each row execute function public.coach_set_updated_at();
create trigger schedule_slots_updated_at before update on public.schedule_slots for each row execute function public.coach_set_updated_at();
create trigger inquiries_updated_at before update on public.inquiries for each row execute function public.coach_set_updated_at();
create trigger testimonials_updated_at before update on public.testimonials for each row execute function public.coach_set_updated_at();

create or replace function public.sync_booking_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking uuid;
begin
  if tg_op = 'DELETE' then v_booking := old.booking_id; else v_booking := new.booking_id; end if;
  update public.bookings b
     set amount_paid = coalesce((select sum(p.amount) from public.booking_payments p where p.booking_id = v_booking), 0)
   where b.id = v_booking;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger booking_payments_sync_total
after insert or update or delete on public.booking_payments
for each row execute function public.sync_booking_amount_paid();

commit;

select 'MOBILE INSTALLER PART 1/4 OK - SCHEMA CREATED' as status;