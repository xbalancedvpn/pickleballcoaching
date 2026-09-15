-- Coach Booking Master Template v1.2.1
-- CLIENT DATA RESET
-- Use AFTER validation/testing and BEFORE client handoff.
-- This clears all coaching/business data but keeps:
--   - database schema
--   - RLS policies
--   - RPC functions
--   - triggers
--   - Supabase Auth users/admin accounts
--
-- WARNING: This permanently deletes all app data in the tables below.

begin;

truncate table
  public.inquiry_self_assessments,
  public.progress_assessments,
  public.client_program_payments,
  public.booking_payments,
  public.inquiry_participants,
  public.booking_participants,
  public.schedule_slots,
  public.bookings,
  public.client_programs,
  public.coaching_program_sessions,
  public.coaching_programs,
  public.inquiries,
  public.testimonials,
  public.clients
restart identity cascade;

commit;

select
  'COACH BOOKING CLIENT DATA RESET COMPLETE' as status,
  (select count(*) from public.bookings) as bookings,
  (select count(*) from public.booking_payments) as booking_payments,
  (select count(*) from public.clients) as clients,
  (select count(*) from public.inquiries) as inquiries,
  (select count(*) from public.coaching_programs) as programs,
  (select count(*) from public.testimonials) as testimonials;
