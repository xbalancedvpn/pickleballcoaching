-- Coach Booking Master Template v1.2
-- MOBILE INSTALLER PART 2 OF 4: RLS + GRANTS + PUBLIC VIEW

begin;

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

create policy "Public read active coaching programs"
on public.coaching_programs for select to anon
using (is_active = true);

create policy "Public read active program sessions"
on public.coaching_program_sessions for select to anon
using (exists (
  select 1 from public.coaching_programs p
  where p.id = coaching_program_sessions.program_id and p.is_active = true
));

create policy "Public read published testimonials"
on public.testimonials for select to anon
using (is_published = true and review_status = 'approved');

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

grant select on public.coaching_programs to anon;
grant select on public.coaching_program_sessions to anon;
grant select on public.testimonials to anon;

create view public.public_schedule
with (security_invoker = true)
as
select slot_date, start_hour, status
from public.schedule_slots;

grant select on public.public_schedule to anon, authenticated;

commit;

select 'MOBILE INSTALLER PART 2/4 OK - SECURITY READY' as status;