# Pickyla Pickleball Coaching v2

Public coaching page plus Supabase-powered admin schedule.

## Schedule
Monday-Sunday, 8:00 AM-12:00 Midnight, fixed 1-hour slots.

## Rates
- 1-on-1: PHP 300/hour
- 2 Players: PHP 250/person/hour
- 3-5 Players: PHP 200/person/hour

## Admin page
After upload to GitHub Pages:
https://xbalancedvpn.github.io/pickleballcoaching/admin.html

## Supabase setup
1. Open Supabase > SQL Editor.
2. Run `supabase-setup.sql`.
3. Create your admin user in Authentication > Users.
4. Disable public email sign-ups in Authentication > Sign In / Providers after creating the admin user.

The public website only reads date, hour, and status. Client name, contact, rate, and notes are only available to authenticated admin users.

Never add a Supabase Secret key or service_role key to these website files.
