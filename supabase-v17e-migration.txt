-- Pickyla v17-E migration
-- Admin navigation does not need database changes.
-- This migration adds a public testimonial review workflow.
-- Run ONCE after v17-D.

begin;

-- 1) Review metadata for testimonials.
alter table public.testimonials
  add column if not exists source text not null default 'admin',
  add column if not exists review_status text not null default 'approved';

-- Existing testimonials were already admin-curated, so keep them approved.
update public.testimonials
set source = coalesce(nullif(source,''),'admin'),
    review_status = coalesce(nullif(review_status,''),'approved');

alter table public.testimonials
  drop constraint if exists testimonials_source_check;
alter table public.testimonials
  add constraint testimonials_source_check
  check (source in ('admin','public'));

alter table public.testimonials
  drop constraint if exists testimonials_review_status_check;
alter table public.testimonials
  add constraint testimonials_review_status_check
  check (review_status in ('pending','approved','rejected'));

-- A testimonial can only be public after admin approval.
alter table public.testimonials
  drop constraint if exists testimonials_publish_requires_approval;
alter table public.testimonials
  add constraint testimonials_publish_requires_approval
  check (is_published = false or review_status = 'approved');

create index if not exists idx_testimonials_review_queue
  on public.testimonials(review_status, created_at desc);

-- 2) Public visitors still read only admin-approved + published testimonials.
drop policy if exists "Public read published testimonials" on public.testimonials;
create policy "Public read published testimonials"
  on public.testimonials for select to anon
  using (is_published = true and review_status = 'approved');

-- 3) Safe public testimonial submission.
-- Public users do NOT get direct INSERT access to the testimonials table.
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

  -- Basic duplicate protection for accidental repeated taps/submits.
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
    display_name,
    player_level,
    quote,
    is_published,
    source,
    review_status
  ) values (
    v_name,
    v_level,
    v_quote,
    false,
    'public',
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_public_testimonial_v17e(text,text,text) from public;
grant execute on function public.submit_public_testimonial_v17e(text,text,text) to anon, authenticated;

commit;
