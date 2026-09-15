-- Pickyla v17-B migration
-- Public engagement + safe public program catalog + testimonials.
-- Run ONCE after v17-A.

begin;

-- 1) Program focus areas used by the public improvement wizard.
alter table public.coaching_programs
  add column if not exists focus_areas text[] not null default '{}'::text[];

-- Allow anonymous visitors to read ONLY active program catalog data.
drop policy if exists "Public read active coaching programs" on public.coaching_programs;
create policy "Public read active coaching programs"
  on public.coaching_programs for select to anon
  using (is_active = true);

drop policy if exists "Public read active program sessions" on public.coaching_program_sessions;
create policy "Public read active program sessions"
  on public.coaching_program_sessions for select to anon
  using (exists (
    select 1 from public.coaching_programs p
    where p.id = coaching_program_sessions.program_id
      and p.is_active = true
  ));

grant select on public.coaching_programs to anon;
grant select on public.coaching_program_sessions to anon;

-- 2) Curated testimonials. Public visitors only see published entries.
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) >= 2),
  player_level text,
  quote text not null check (length(trim(quote)) >= 8),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

drop policy if exists "Admin read testimonials" on public.testimonials;
drop policy if exists "Admin add testimonials" on public.testimonials;
drop policy if exists "Admin update testimonials" on public.testimonials;
drop policy if exists "Admin delete testimonials" on public.testimonials;
drop policy if exists "Public read published testimonials" on public.testimonials;

create policy "Admin read testimonials" on public.testimonials for select to authenticated using (true);
create policy "Admin add testimonials" on public.testimonials for insert to authenticated with check (true);
create policy "Admin update testimonials" on public.testimonials for update to authenticated using (true) with check (true);
create policy "Admin delete testimonials" on public.testimonials for delete to authenticated using (true);
create policy "Public read published testimonials" on public.testimonials for select to anon using (is_published = true);

grant select,insert,update,delete on public.testimonials to authenticated;
grant select on public.testimonials to anon;

-- Reuse the v17-A updated_at helper.
drop trigger if exists testimonials_updated_at on public.testimonials;
create trigger testimonials_updated_at
before update on public.testimonials
for each row execute function public.pickyla_set_updated_at();

create index if not exists idx_testimonials_public
  on public.testimonials(is_published, sort_order, created_at desc);

-- 3) Store engagement context on inquiries so admin can see the client's goal/program interest.
alter table public.inquiries add column if not exists goal_focus text;
alter table public.inquiries add column if not exists program_interest text;

-- New public RPC keeps v16 RPC intact for backward compatibility.
create or replace function public.submit_public_inquiry_v17(
  p_client_name text,
  p_contact text,
  p_preferred_date date,
  p_start_hour smallint,
  p_end_hour smallint,
  p_participant_count smallint,
  p_coaching_type text,
  p_quoted_rate numeric,
  p_source_text text,
  p_goal_focus text,
  p_program_interest text
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

  insert into public.inquiries(
    client_name,contact,preferred_date,start_hour,end_hour,participant_count,
    coaching_type,quoted_rate,status,source_text,notes,goal_focus,program_interest
  ) values (
    trim(p_client_name),nullif(left(trim(coalesce(p_contact,'')),120),''),
    p_preferred_date,p_start_hour,p_end_hour,p_participant_count,
    left(coalesce(p_coaching_type,''),80),p_quoted_rate,'new',
    left(coalesce(p_source_text,''),2000),'Submitted directly from public website',
    nullif(left(trim(coalesce(p_goal_focus,'')),120),''),
    nullif(left(trim(coalesce(p_program_interest,'')),160),'')
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_public_inquiry_v17(text,text,date,smallint,smallint,smallint,text,numeric,text,text,text) from public;
grant execute on function public.submit_public_inquiry_v17(text,text,date,smallint,smallint,smallint,text,numeric,text,text,text) to anon,authenticated;

commit;
