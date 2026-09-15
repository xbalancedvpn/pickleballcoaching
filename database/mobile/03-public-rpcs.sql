-- Coach Booking Master Template v1.2
-- MOBILE INSTALLER PART 3 OF 4: PUBLIC RPCs

begin;

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
  if p_start_hour < 0 or p_start_hour > 23 or p_end_hour < 1 or p_end_hour > 24 or p_end_hour <= p_start_hour then
    raise exception 'Invalid requested time.';
  end if;
  if p_participant_count < 1 or p_participant_count > 8 then
    raise exception 'Invalid number of players.';
  end if;
  if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) <> p_participant_count then
    raise exception 'Please complete the details for every player.';
  end if;

  for v_item, v_ord in
    select value, ordinality from jsonb_array_elements(p_participants) with ordinality
  loop
    v_first := regexp_replace(trim(coalesce(v_item->>'first_name','')), '\s+', ' ', 'g');
    v_last := regexp_replace(trim(coalesce(v_item->>'last_name','')), '\s+', ' ', 'g');
    if length(v_first) < 1 or length(v_first) > 60 or length(v_last) < 1 or length(v_last) > 80 then
      raise exception 'Every player needs a valid first name and last name.';
    end if;
    if length(coalesce(v_item->>'contact','')) > 120 then
      raise exception 'A contact value is too long.';
    end if;
  end loop;

  if exists (
    select 1 from public.schedule_slots s
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
    select 1 from public.inquiries i
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
    inquiry_id, participant_order, first_name, last_name, full_name, contact, contact_key, is_primary
  )
  select
    v_id,
    ord::smallint,
    regexp_replace(trim(coalesce(item->>'first_name','')), '\s+', ' ', 'g'),
    regexp_replace(trim(coalesce(item->>'last_name','')), '\s+', ' ', 'g'),
    trim(regexp_replace(trim(coalesce(item->>'first_name','')), '\s+', ' ', 'g') || ' ' || regexp_replace(trim(coalesce(item->>'last_name','')), '\s+', ' ', 'g')),
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
  v_keys text[] := array['serve','return_score','forehand','backhand','dinking','footwork','positioning','consistency','strategy','confidence'];
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
  if length(v_name) < 3 or length(v_name) > 120 then raise exception 'Please enter a valid first and last name.'; end if;
  if length(v_quote) < 8 or length(v_quote) > 800 then raise exception 'Testimonial must be between 8 and 800 characters.'; end if;
  if v_level is not null and length(v_level) > 100 then raise exception 'Player level is too long.'; end if;

  if exists (
    select 1 from public.testimonials t
    where t.source = 'public'
      and lower(t.display_name) = lower(v_name)
      and lower(t.quote) = lower(v_quote)
      and t.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'This testimonial was already submitted recently.';
  end if;

  insert into public.testimonials(display_name, player_level, quote, is_published, source, review_status)
  values (v_name, v_level, v_quote, false, 'public', 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_public_testimonial_v17e(text,text,text) from public;
grant execute on function public.submit_public_testimonial_v17e(text,text,text) to anon, authenticated;

commit;

select 'MOBILE INSTALLER PART 3/4 OK - PUBLIC RPCS READY' as status;