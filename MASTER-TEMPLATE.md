# Coach Booking Master Template v1.2

This branch is the reusable white-label base for future coach implementations.

## Core rule

Do not place real client-specific data in this branch.

Each client build should receive its own:
- GitHub repository
- Supabase project
- deployment/domain
- branding assets
- admin account

## New client setup

1. Copy this template into a new client repository.
2. Open `app/config.js` and replace the placeholder brand, coach, location, rates, schedule, contact links and assets.
3. Create a NEW Supabase project for that client.
4. Open Supabase > SQL Editor and run **only** `database/fresh-install.sql` for a fresh client project.
5. Create the client's admin user in Supabase Auth.
6. Copy the client's Supabase Project URL and publishable key into `app/config.js`.
7. Set `backend.demoMode` to `false`.
8. Set `publicSiteUrl` to the final public URL when known.
9. Deploy the client repository to its own site/domain.
10. Test public booking, admin login, booking confirmation, payments, programs, client history, progress, testimonials, reports, QR, weekly schedule export, and RLS before launch.

## Database rule

`database/fresh-install.sql` is the **single fresh-project installer** starting with Master Template v1.2.

The files inside `database/migrations/` are historical Pickyla development migrations and recovery references. Do **not** replay them for a new client after running `fresh-install.sql`.

The fresh installer intentionally includes the final current schema directly, including:
- up to 8 participants per booking/inquiry
- configurable hourly operating range support at database level (`0` through `24`)
- bookings and privacy-safe live schedule
- inquiries and structured participants
- client profiles
- programs, program sessions and enrollments
- booking and program payment ledgers
- session status tracking
- progress assessments
- public initial self-assessment intake
- testimonial review workflow
- public booking/testimonial RPCs
- client identity maintenance RPCs
- RLS and public-safe access rules

The installer contains a guard that stops if core Coach Booking tables already exist. It is meant for a **fresh Supabase project only**.

## White-label files

- `app/config.js` — single source of truth for client customization
- `app/template-runtime.js` — branding/backend safety layer
- `app/template-public-patches.js` — public configurability layer
- `app/template-admin-patches.js` — admin configurability layer
- `app/template-admin-business.js` — admin business-logic configurability layer
- `app/brand-placeholder.svg` — default logo placeholder
- `app/coach-placeholder.svg` — default coach photo placeholder
- `app/legacy-script.js` — preserved working public engine
- `app/legacy-admin.js` — preserved working admin engine
- `app/script.js` — public loader
- `app/admin.js` — admin loader

## Safety

The template defaults to `backend.demoMode: true` with empty Supabase credentials. A fresh copy must not connect to the original Pickyla database.

Never place a Supabase service-role/secret key in frontend code. Only the publishable browser key belongs in `app/config.js`.

Use a separate Supabase project for every client so bookings, clients, auth users and payments remain isolated.

## Package direction

Master Template v1 targets the Pro feature set by default. Starter and Advanced differences should be implemented through feature flags or client-specific modules rather than deleting core reusable code.
