# Coach Booking Master Template v1

This branch is the reusable white-label base for future coach implementations.

## Core rule

Do not place real client-specific data in this branch.

Client builds should receive their own:
- GitHub repository
- Supabase project
- deployment/domain
- branding assets
- admin account

## New client setup

1. Copy this template into a new client repository.
2. Open `app/config.js`.
3. Replace the placeholder brand, coach, location, rates, schedule, contact links and assets.
4. Create a NEW Supabase project for that client.
5. Apply the database migrations from `database/migrations` in order unless/until a consolidated master migration is available.
6. Put the client's Supabase URL and publishable key in `app/config.js`.
7. Set `backend.demoMode` to `false`.
8. Create the client's admin auth account in Supabase.
9. Deploy the client repository to its own site/domain.
10. Test public booking, admin login, booking confirmation, payment tracking, programs, reports and RLS before launch.

## Files added for the white-label layer

- `app/config.js` — single source of truth for client customization
- `app/template-runtime.js` — applies neutral/client branding and protects unconfigured templates from using the original backend
- `app/brand-placeholder.svg` — default logo placeholder
- `app/coach-placeholder.svg` — default coach photo placeholder
- `app/legacy-script.js` — preserved working public engine
- `app/legacy-admin.js` — preserved working admin engine
- `app/script.js` — template loader for public engine
- `app/admin.js` — template loader for admin engine

## Safety

The template defaults to `backend.demoMode: true` with empty Supabase credentials. A fresh copy must not connect to the original Pickyla database.

Never place a Supabase service-role/secret key in frontend code. Only the publishable browser key belongs in a client-side configuration.

## Package direction

Master Template v1 targets the Pro feature set by default. Starter and Advanced differences should be implemented through feature flags or client-specific modules rather than deleting core reusable code.
