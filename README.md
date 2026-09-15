# Pickyla Pickleball Coaching

Current stable release: **v17-G**

Live site: `https://pickyla-coaching.xbalanced.net`
Admin: `https://pickyla-coaching.xbalanced.net/admin.html`

## Current features
- Public coaching profile, rates, programs, testimonials, live availability and weekly schedule preview
- Booking requests for 1–8 players with structured participant names
- Browser-side remembered client details and repeat-player suggestions
- Admin inquiries, bookings, session status, collections and reports
- Client profiles and coaching history
- Fixed-price coaching programs with per-session goals
- Player progress assessments and downloadable progress cards
- Public testimonial submission with admin review before publishing
- Weekly schedule PNG generator, booking confirmation cards and QR tools
- PWA / installable mobile experience
- Admin reminders, quick navigation, mobile dock and Today workflow

## Current coaching rates
- 1-on-1: ₱400/hour
- Partners (2–3): ₱300 each/hour
- Group (4–8): ₱250 each/hour
- Court fee is separate and is not counted as Pickyla coaching income.

## Repository layout
The root now contains mostly **live production files** only.

- Public runtime: `index.html`, `style.css`, `script.js`, `v17f.*`, `v17g.*`
- Admin runtime: `admin.html`, `admin.css`, `admin.js`, `admin-v17f.*`, `admin-v17g.*`
- PWA/runtime: `service-worker.js`, `site.webmanifest`, icons and current brand assets
- Database history: `database/migrations/`
- Database notes: `database/README.md`

## Backend
Supabase project ref: `bnekbuwfloagqjzselxp`

Historical SQL files were moved out of the repository root into `database/migrations/`; they were **not deleted**.

## Recovery branches
- `archive/pre-cleanup-v17g-20260915`
- `archive/pre-reorg-v17g-20260915`
