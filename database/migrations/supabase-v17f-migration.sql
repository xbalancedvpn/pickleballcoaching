-- Pickyla v17-F migration
-- Public self-assessment intake + progress source tracking
-- Run ONCE after v17-E. Non-destructive.

begin;

-- 1) Keep coach assessments and client self-assessments distinguishable.
alter table public.progress_assessments
  add column if not exists assessment_source text not null default 'coach';

alter table public.progress_assessments
  add column if not exists source_inquiry_id uuid references public.inquiries(id) on delete set null;

alter table public.progress_assessments
  drop constraint if exists progress_assessments_assessment_source_check;

alter table public.progress_assessments
  add constraint progress_assessments_assessment_source_check
  check (assessment_source in ('coach','client_self'));

create unique index if not exists uq_progress_source_inquiry_self
  on public.progress_assessments(source_inquiry_id)
  where source_inquiry_id is not null and assessment_source='client_self';

-- 2) Store a privacy-safe initial self-assessment with a public inquiry.
--    v17-F keeps this to the primary player (Player 1) to avoid forcing
--    an 8-player group to complete 80 rating fields during booking.
create table if not exists public.inquiry_self_assessments (
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

alter table public.inquiry_self_assessments enable row level security;

drop policy if exists "Admin read inquiry self assessments" on public.inquiry_self_assessments;
drop policy if exists "Admin add inquiry self assessments" on public.inquiry_self_assessments;
drop policy if exists "Admin update inquiry self assessments" on public.inquiry_self_assessments;
drop policy if exists "Admin delete inquiry self assessments" on public.inquiry_self_assessments;

create policy "Admin read inquiry self assessments" on public.inquiry_self_assessments
  for select to authenticated using (true);
create policy "Admin add inquiry self assessments" on public.inquiry_self_assessments
  for insert to authenticated with check (true);
create policy "Admin update inquiry self assessments" on public.inquiry_self_assessments
  for update to authenticated using (true) with check (true);
create policy "Admin delete inquiry self assessments" on public.inquiry_self_assessments
  for delete to authenticated using (true);

grant select,insert,update,delete on public.inquiry_self_assessments to authenticated;
revoke all on public.inquiry_self_assessments from anon;

-- 3) Public RPC. Reuses the already-tested v17-D inquiry transaction,
--    then stores Player 1's optional initial self-assessment.
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
  v_keys text[] := array['serve','return_score','forehand','backhand','dinking','footwork','positioning','consistency','strategy','confidence'];
begin
  v_id := public.submit_public_inquiry_v17d(
    p_preferred_date,p_start_hour,p_end_hour,p_participant_count,
    p_coaching_type,p_quoted_rate,p_source_text,p_goal_focus,p_program_interest,p_participants
  );

  if p_self_assessment is not null and jsonb_typeof(p_self_assessment)='object' then
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
      inquiry_id,participant_order,serve,return_score,forehand,backhand,dinking,
      footwork,positioning,consistency,strategy,confidence,note
    ) values (
      v_id,1,
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
grant execute on function public.submit_public_inquiry_v17f(date,smallint,smallint,smallint,text,numeric,text,text,text,jsonb,jsonb) to anon,authenticated;

commit;
