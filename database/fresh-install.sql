-- Coach Booking Master Template v1.2
-- FRESH SUPABASE PROJECT INSTALLER
--
-- Run this ONCE in Supabase > SQL Editor for a NEW client project.
-- Do NOT run this against the existing Pickyla production database.
-- Historical migration files in database/migrations/ remain for recovery/reference only.

create extension if not exists pgcrypto;

-- Refuse to run over an existing Coach Booking installation.
do $$
begin
  if to_regclass('public.schedule_slots') is not null
     or to_regclass('public.bookings') is not null
     or to_regclass('public.clients') is not null
     or to_regclass('public.inquiries') is not null then
    raise exception 'Fresh installer stopped: existing Coach Booking tables were found. Use migrations/maintenance scripts for an existing database.';
  end if;
end
$$;

begin;

-- ============================================================
-- 1) CORE CLIENT + PROGRAM DATA
-- ============================================================

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
create unique index uq_clients_name_contact
  on public.clients(name_key, contact_key)
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

create index idx_program_sessions_program
  on public.coaching_program_sessions(program_id, session_number);

create table public.client_programs (
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

create index idx_client_programs_client on public.client_programs(client_id);
create index idx_client_programs_program on public.client_programs(program_id);
create index idx_client_programs_status on public.client_programs(status);

-- ============================================================
-- 2) BOOKINGS + LIVE SCHEDULE
-- Hours intentionally support any hourly client schedule from
-- 12:00 AM (0) through midnight (24). The app config controls
-- the actual visible operating range per client.
-- ============================================================

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
  status text not null default 'available'
    check (status in ('available','booked','unavailable')),
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

-- ============================================================
-- 3) INQUIRIES + PARTICIPANTS
-- ============================================================

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
  status text not null default 'new'
    check (status in ('new','waiting','tentative','confirmed','cancelled')),
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

-- ============================================================
-- 4) PAYMENT LEDGERS
-- ============================================================

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

-- ============================================================
-- 5) PLAYER PROGRESS + PUBLIC SELF-ASSESSMENT
-- ============================================================

create table public.progress_assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  client_program_id uuid references public.client_programs(id) on delete set null,
  source_inquiry_id uuid references public.inquiries(id) on delete set null,
  assessment_date date not null default current_date,
  assessment_type text not null default 'session'
    check (assessment_type in ('initial','session','mid','final')),
  assessment_source text not null default 'coach'
    check (assessment_source in ('coach','client_self')),
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
create unique index uq_progress_source_inquiry_self
  on public.progress_assessments(source_inquiry_id)
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

-- ============================================================
-- 6) TESTIMONIALS
-- ============================================================

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

-- ============================================================
-- 7) UPDATED_AT + PAYMENT SYNC TRIGGERS
-- ============================================================

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

create trigger clients_updated_at
before update on public.clients
for each row execute function public.coach_set_updated_at();

create trigger coaching_programs_updated_at
before update on public.coaching_programs
for each row execute function public.coach_set_updated_at();

create trigger client_programs_updated_at
before update on public.client_programs
for each row execute function public.coach_set_updated_at();

create trigger bookings_updated_at
before update on public.bookings
for each row execute function public.coach_set_updated_at();

create trigger schedule_slots_updated_at
before update on public.schedule_slots
for each row execute function public.coach_set_updated_at();

create trigger inquiries_updated_at
before update on public.inquiries
for each row execute function public.coach_set_updated_at();

create trigger testimonials_updated_at
before update on public.testimonials
for each row execute function public.coach_set_updated_at();

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
     set amount_paid = coalesce((
       select sum(p.amount)
       from public.booking_payments p
       where p.booking_id = v_booking
     ), 0)
   where b.id = v_booking;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger booking_payments_sync_total
after insert or update or delete on public.booking_payments
for each row execute function public.sync_booking_amount_paid();

-- ============================================================
-- 8) ROW LEVEL SECURITY
-- One Supabase project belongs to one client. Authenticated users
-- are trusted coach/admin accounts for that client project.
-- ============================================================

alter table public.clients enable row level security;
alter table public.coaching_programs enable row level security;
alter table public.coaching_program_sessions enable row level security;
alter table public.client_programs enable row level security;
alter table public.bookings enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.inquiries enable row level security;
alter table public.booking_participants enable row level security;
alter table public.inquiry_participants enable row level security;
alter table public.booking_payments enable row level security;
alter table public.client_program_payments enable row level security;
alter table public.progress_assessments enable row level security;
alter table public.inquiry_self_assessments enable row level security;
alter table public.testimonials enable row level security;

-- Authenticated admin CRUD.
create policy "Admin clients" on public.clients for all to authenticated using (true) with check (true);
create policy "Admin coaching programs" on public.coaching_programs for all to authenticated using (true) with check (true);
create policy "Admin program sessions" on public.coaching_program_sessions for all to authenticated using (true) with check (true);
create policy "Admin client programs" on public.client_programs for all to authenticated using (true) with check (true);
create policy "Admin bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "Admin schedule" on public.schedule_slots for all to authenticated using (true) with check (true);
create policy "Admin inquiries" on public.inquiries for all to authenticated using (true) with check (true);
create policy "Admin booking participants" on public.booking_participants for all to authenticated using (true) with check (true);
create policy "Admin inquiry participants" on public.inquiry_participants for all to authenticated using (true) with check (true);
create policy "Admin booking payments" on public.booking_payments for all to authenticated using (true) with check (true);
create policy "Admin program payments" on public.client_program_payments for all to authenticated using (true) with check (true);
create policy "Admin progress" on public.progress_assessments for all to authenticated using (true) with check (true);
create policy "Admin inquiry self assessments" on public.inquiry_self_assessments for all to authenticated using (true) with check (true);
create policy "Admin testimonials" on public.testimonials for all to authenticated using (true) with check (true);

-- Public catalog access only.
create policy "Public read active coaching programs"
on public.coaching_programs for select to anon
using (is_active = true);

create policy "Public read active program sessions"
on public.coaching_program_sessions for select to anon
using (exists (
  select 1
  from public.coaching_programs p
  where p.id = coaching_program_sessions.program_id
    and p.is_active = true
));

create policy "Public read published testimonials"
on public.testimonials for select to anon
using (is_published = true and review_status = 'approved');

-- Explicit table privileges.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.coaching_programs to authenticated;
grant select, insert, update, delete on public.coaching_program_sessions to authenticated;
grant select, insert, update, delete on public.client_programs to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.schedule_slots to authenticated;
grant select, insert, update, delete on public.inquiries to authenticated;
grant select, insert, update, delete on public.booking_participants to authenticated;
grant select, insert, update, delete on public.inquiry_participants to authenticated;
grant select, insert, update, delete on public.booking_payments to authenticated;
grant select, insert, update, delete on public.client_program_payments to authenticated;
grant select, insert, update, delete on public.progress_assessments to authenticated;
grant select, insert, update, delete on public.inquiry_self_assessments to authenticated;
grant select, insert, update, delete on public.testimonials to authenticated;

grant select on public.coaching_programs to anon;
grant select on public.coaching_program_sessions to anon;
grant select on public.testimonials to anon;

revoke all on public.clients from anon;
revoke all on public.client_programs from anon;
revoke all on public.bookings from anon;
revoke all on public.schedule_slots from anon;
revoke all on public.inquiries from anon;
revoke all on public.booking_participants from anon;
revoke all on public.inquiry_participants from anon;
revoke all on public.booking_payments from anon;
revoke all on public.client_program_payments from anon;
revoke all on public.progress_assessments from anon;
revoke all on public.inquiry_self_assessments from anon;

-- Re-grant only the intentionally public catalog tables after broad revokes above.
grant select on public.coaching_programs to anon;
grant select on public.coaching_program_sessions to anon;
grant select on public.testimonials to anon;

-- ============================================================
-- 9) PRIVACY-SAFE PUBLIC SCHEDULE VIEW
-- Anonymous visitors can see only date/hour/status, never client data.
-- ============================================================

create view public.public_schedule as
select slot_date, start_hour, status
from public.schedule_slots;

grant select on public.public_schedule to anon, authenticated;

-- ============================================================
-- 10) PUBLIC BOOKING REQUEST RPCs
-- Keep exact RPC names expected by the current template frontend.
-- ============================================================

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
  if p_preferred_date is null or p_preferred_date < current_date then
    raise exception 'That date has already passed.';
  end if;

  if p_start_hour < 0 or p_start_hour > 23
     or p_end_hour < 1 or p_end_hour > 24
     or p_end_hour <= p_start_hour then
    raise exception 'Invalid requested time.';
  end if;

  if p_participant_count < 1 or p_participant_count > 8 then
    raise exception 'Invalid number of players.';
  end if;

  if p_participants is null
     or jsonb_typeof(p_participants) <> 'array'
     or jsonb_array_length(p_participants) <> p_participant_count then
    raise exception 'Please complete the details for every player.';
  end if;

  for v_item, v_ord in
    select value, ordinality
    from jsonb_array_elements(p_participants) with ordinality
  loop
    v_first := regexp_replace(trim(coalesce(v_item->>'first_name','')), '\s+', ' ', 'g');
    v_last := regexp_replace(trim(coalesce(v_item->>'last_name','')), '\s+', ' ', 'g');

    if length(v_first) < 1 or length(v_first) > 60
       or length(v_last) < 1 or length(v_last) > 80 then
      raise exception 'Every player needs a valid first name and last name.';
    end if;

    if length(coalesce(v_item->>'contact','')) > 120 then
      raise exception 'A contact value is too long.';
    end if;
  end loop;

  if exists (
    select 1
    from public.schedule_slots s
    where s.slot_date = p_preferred_date
      and s.start_hour >= p_start_hour
      and s.start_hour < p_end_hour
      and s.status in ('booked','unavailable')
  ) then
    raise exception 'One or more selected hours are no longer available. Please refresh the schedule.';
  end if;

  v_primary := p_participants->0;
  v_first := regexp_replace(trim(coalesce(v_primary->>'first_name','')), '\s+', ' ', 'g');
  v_last := regexp_replace(trim(coalesce(v_primary->>'last_name','')), '\s+', ' ', 'g');
  v_name := trim(v_first || ' ' || v_last);
  v_contact := nullif(left(trim(coalesce(v_primary->>'contact','')),120),'');

  if exists (
    select 1
    from public.inquiries i
    where lower(regexp_replace(trim(i.client_name),'\s+',' ','g')) = lower(v_name)
      and i.preferred_date = p_preferred_date
      and i.start_hour = p_start_hour
      and i.end_hour = p_end_hour
      and i.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'A similar request was already submitted recently.';
  end if;

  insert into public.inquiries(
    client_name, contact, preferred_date, start_hour, end_hour, participant_count,
    coaching_type, quoted_rate, status, source_text, notes, goal_focus, program_interest
  ) values (
    v_name, v_contact, p_preferred_date, p_start_hour, p_end_hour, p_participant_count,
    left(coalesce(p_coaching_type,''),80), p_quoted_rate, 'new',
    left(coalesce(p_source_text,''),2000), 'Submitted directly from public website',
    nullif(left(trim(coalesce(p_goal_focus,'')),120),''),
    nullif(left(trim(coalesce(p_program_interest,'')),160),'')
  ) returning id into v_id;

  insert into public.inquiry_participants(
    inquiry_id, participant_order, first_name, last_name, full_name,
    contact, contact_key, is_primary
  )
  select
    v_id,
    ord::smallint,
    regexp_replace(trim(coalesce(item->>'first_name','')), '\s+', ' ', 'g'),
    regexp_replace(trim(coalesce(item->>'last_name','')), '\s+', ' ', 'g'),
    trim(
      regexp_replace(trim(coalesce(item->>'first_name','')), '\s+', ' ', 'g')
      || ' ' ||
      regexp_replace(trim(coalesce(item->>'last_name','')), '\s+', ' ', 'g')
    ),
    nullif(left(trim(coalesce(item->>'contact','')),120),''),
    nullif(lower(left(trim(coalesce(item->>'contact','')),120)),''),
    ord = 1
  from jsonb_array_elements(p_participants) with ordinality as x(item,ord);

  return v_id;
end;
$$;

revoke all on function public.submit_public_inquiry_v17d(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb) from public;
grant execute on function public.submit_public_inquiry_v17d(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb) to anon, authenticated;

create or replace function public.submit_public_inquiry_v17f(
  p_preferred_date date,
  p_start_hour smallint,
  p_end_hour smallint,
  p_participant_count smallint,
  p_coaching_type text,
  p_quoted_rate numeric,
  p_source_text text,
  p_goal_focus text,
  p_program_interest text,
  p_participants jsonb,
  p_self_assessment jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_score smallint;
  v_key text;
  v_keys text[] := array[
    'serve','return_score','forehand','backhand','dinking',
    'footwork','positioning','consistency','strategy','confidence'
  ];
begin
  v_id := public.submit_public_inquiry_v17d(
    p_preferred_date, p_start_hour, p_end_hour, p_participant_count,
    p_coaching_type, p_quoted_rate, p_source_text, p_goal_focus,
    p_program_interest, p_participants
  );

  if p_self_assessment is not null and jsonb_typeof(p_self_assessment) = 'object' then
    foreach v_key in array v_keys loop
      if nullif(p_self_assessment->>v_key,'') is not null then
        begin
          v_score := (p_self_assessment->>v_key)::smallint;
        exception when others then
          raise exception 'Self-assessment scores must be numbers from 1 to 5.';
        end;

        if v_score < 1 or v_score > 5 then
          raise exception 'Self-assessment scores must be from 1 to 5.';
        end if;
      end if;
    end loop;

    if length(coalesce(p_self_assessment->>'note','')) > 500 then
      raise exception 'Self-assessment note is too long.';
    end if;

    insert into public.inquiry_self_assessments(
      inquiry_id, participant_order, serve, return_score, forehand, backhand,
      dinking, footwork, positioning, consistency, strategy, confidence, note
    ) values (
      v_id, 1,
      nullif(p_self_assessment->>'serve','')::smallint,
      nullif(p_self_assessment->>'return_score','')::smallint,
      nullif(p_self_assessment->>'forehand','')::smallint,
      nullif(p_self_assessment->>'backhand','')::smallint,
      nullif(p_self_assessment->>'dinking','')::smallint,
      nullif(p_self_assessment->>'footwork','')::smallint,
      nullif(p_self_assessment->>'positioning','')::smallint,
      nullif(p_self_assessment->>'consistency','')::smallint,
      nullif(p_self_assessment->>'strategy','')::smallint,
      nullif(p_self_assessment->>'confidence','')::smallint,
      nullif(left(trim(coalesce(p_self_assessment->>'note','')),500),'')
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.submit_public_inquiry_v17f(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb,jsonb) from public;
grant execute on function public.submit_public_inquiry_v17f(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb,jsonb) to anon, authenticated;

-- ============================================================
-- 11) PUBLIC TESTIMONIAL SUBMISSION
-- ============================================================

create or replace function public.submit_public_testimonial_v17e(
  p_display_name text,
  p_player_level text,
  p_quote text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_name text := trim(regexp_replace(coalesce(p_display_name,''), '\s+', ' ', 'g'));
  v_level text := nullif(trim(regexp_replace(coalesce(p_player_level,''), '\s+', ' ', 'g')), '');
  v_quote text := trim(regexp_replace(coalesce(p_quote,''), '\s+', ' ', 'g'));
begin
  if length(v_name) < 3 or length(v_name) > 120 then
    raise exception 'Please enter a valid first and last name.';
  end if;

  if length(v_quote) < 8 or length(v_quote) > 800 then
    raise exception 'Testimonial must be between 8 and 800 characters.';
  end if;

  if v_level is not null and length(v_level) > 100 then
    raise exception 'Player level is too long.';
  end if;

  if exists (
    select 1
    from public.testimonials t
    where t.source = 'public'
      and lower(t.display_name) = lower(v_name)
      and lower(t.quote) = lower(v_quote)
      and t.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'This testimonial was already submitted recently.';
  end if;

  insert into public.testimonials(
    display_name, player_level, quote, is_published, source, review_status
  ) values (
    v_name, v_level, v_quote, false, 'public', 'pending'
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_public_testimonial_v17e(text,text,text) from public;
grant execute on function public.submit_public_testimonial_v17e(text,text,text) to anon, authenticated;

-- ============================================================
-- 12) ADMIN CLIENT IDENTITY MAINTENANCE
-- Exact RPC names expected by the current admin overlays.
-- ============================================================

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

  if not found then raise exception 'Client not found'; end if;

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
  where id <> p_client_id
    and is_active = true
    and name_key = v_p_name_key
    and (v_p_contact_key is null or contact_key = v_p_contact_key)
  limit 1;

  if v_duplicate is not null then
    raise exception 'An active client matching Player 1 already exists. Edit or merge that client first.';
  end if;

  if v_s_contact_key is not null then
    select id into v_secondary_id
    from public.clients
    where id <> p_client_id
      and is_active = true
      and name_key = v_s_name_key
      and contact_key = v_s_contact_key
    limit 1;
  else
    select count(*) into v_same_name_count
    from public.clients
    where id <> p_client_id
      and is_active = true
      and name_key = v_s_name_key;

    if v_same_name_count > 1 then
      raise exception 'More than one active client matches Player 2. Add a contact or clean the duplicates first.';
    elsif v_same_name_count = 1 then
      select id into v_secondary_id
      from public.clients
      where id <> p_client_id
        and is_active = true
        and name_key = v_s_name_key
      limit 1;
    else
      v_secondary_id := null;
    end if;
  end if;

  if v_secondary_id is null then
    insert into public.clients(
      first_name, last_name, full_name, name_key, contact, contact_key, notes, is_active
    ) values (
      v_s_first, v_s_last, v_s_full, v_s_name_key, v_s_contact, v_s_contact_key,
      nullif(trim(coalesce(p_secondary_notes,'')),''), true
    ) returning id into v_secondary_id;
  else
    update public.clients
    set first_name = v_s_first,
        last_name = v_s_last,
        full_name = v_s_full,
        name_key = v_s_name_key,
        contact = coalesce(v_s_contact, contact),
        contact_key = coalesce(v_s_contact_key, contact_key),
        notes = coalesce(nullif(trim(coalesce(p_secondary_notes,'')),''), notes),
        updated_at = now()
    where id = v_secondary_id;
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
    select distinct b.id, b.client_id, b.participant_count
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
      set client_name = v_p_full,
          contact = v_p_contact
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

    if not exists (
      select 1 from public.booking_participants
      where booking_id = v_booking.id and client_id = p_client_id
    ) then
      select gs::smallint into v_order
      from generate_series(1,8) gs
      where not exists (
        select 1 from public.booking_participants bp2
        where bp2.booking_id = v_booking.id and bp2.participant_order = gs
      )
      order by gs
      limit 1;

      if v_order is null then raise exception 'No free participant position for booking %', v_booking.id; end if;

      insert into public.booking_participants(
        booking_id, client_id, participant_order, first_name, last_name,
        full_name, contact, contact_key, is_primary
      ) values (
        v_booking.id, p_client_id, v_order, v_p_first, v_p_last,
        v_p_full, v_p_contact, v_p_contact_key, v_booking.client_id = p_client_id
      );
    end if;

    if not exists (
      select 1 from public.booking_participants
      where booking_id = v_booking.id and client_id = v_secondary_id
    ) then
      select gs::smallint into v_order
      from generate_series(1,8) gs
      where not exists (
        select 1 from public.booking_participants bp2
        where bp2.booking_id = v_booking.id and bp2.participant_order = gs
      )
      order by gs
      limit 1;

      if v_order is null then raise exception 'No free participant position for booking %', v_booking.id; end if;

      insert into public.booking_participants(
        booking_id, client_id, participant_order, first_name, last_name,
        full_name, contact, contact_key, is_primary
      ) values (
        v_booking.id, v_secondary_id, v_order, v_s_first, v_s_last,
        v_s_full, v_s_contact, v_s_contact_key, false
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
  'Coach Booking Master Template v1.2 installed' as status,
  14 as tables_created,
  'Next: create Supabase Auth admin user, then put project URL + publishable key in app/config.js and set demoMode=false.' as next_step;
