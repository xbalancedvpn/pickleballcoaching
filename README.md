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

## Production files
Public: `index.html`, `style.css`, `script.js`, `v17f.css`, `v17f.js`, `v17g.css`, `v17g.js`

Admin: `admin.html`, `admin.css`, `admin.js`, `admin-v17f.css`, `admin-v17f.js`, `admin-v17g.css`, `admin-v17g.js`

PWA: `site.webmanifest`, `service-worker.js`, favicon/app-icon files

Brand assets in use: `pickyla-emblem-final.png`, `pickyla-logo-final.png`, `pickyla-wordmark-final.png`, `kyla-coach.jpg`

## Backend
Supabase project ref: `bnekbuwfloagqjzselxp`

Historical SQL migration files are retained in the repository for recovery/reference. Production data should not be deleted during repository cleanup.

## Backup
Before the repository cleanup, a backup branch was created:
`archive/pre-cleanup-v17g-20260915`
