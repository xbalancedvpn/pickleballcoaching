# Pickyla Coaching v8

## New in v8
- Mobile/desktop navigation menu on the client page.
- Random mixed pickleball sayings on load and every 15 seconds.
- Client name/contact included in the generated booking request.
- Exact group size selector for 3–5 player requests.
- Admin Smart Paste: paste the client-generated script, auto-fill the booking form, and check overlaps.
- Final booking confirmation dialog before saving.
- Pending Inquiry tracker with New / Waiting / Tentative / Confirmed / Cancelled statuses.
- Daily/weekly/monthly/all-time summary plus charts.
- Month calendar + day view retained.
- Pickyla green/cream UI restored. Black/yellow is limited to the temporary logo mark direction only.

## SQL
Run `supabase-v8-migration.sql` ONCE before using Pending Inquiries. The existing booking system still uses the v4 tables you already created.

## Logo
The website currently uses a lightweight Signature + Monogram placeholder. Separate premium logo concepts are generated for selection; after choosing one, replace the placeholder with the final logo asset.


## V9 final polish
- Added integrated Pickyla premium logo system (light + dark SVG variants + icon).
- Public page header, hero, and footer now use the approved Pickyla branding.
- Admin login and topbar updated to use the same logo set.
- Existing v8 features remain: menu, rotating sayings, calendar scheduling, copy/open Facebook flow, inquiry parser, reports, and booking group actions.


## V10 logo + palette adjustment
- Reworked logo icon so it no longer reads like a letter D.
- Wordmark now reads as one word: PICKYLA (PIC dark/white depending on background, KYLA yellow).
- Refreshed site accents from green to premium yellow + black.
- No new database changes required; same Supabase setup as v8/v9.
