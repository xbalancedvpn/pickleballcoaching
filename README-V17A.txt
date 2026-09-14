PICKYLA v17-A — COACHING PLATFORM FOUNDATION

This is the first internal build of v17. It upgrades the ADMIN + DATABASE only.
The public v16 page stays unchanged for now so the live client booking flow remains stable while we test the new coaching foundation.

RUN FIRST
1. Supabase > SQL Editor > New Query
2. Paste supabase-v17a-migration.sql (or .txt)
3. Run it once.
4. Confirm: Success. No rows returned.

THEN UPLOAD TO GITHUB ROOT
- admin.html
- admin.css
- admin.js

Hard refresh admin.html after GitHub Pages redeploys.

WHAT v17-A ADDS
- Today Command Center
  * Today's sessions
  * Past sessions that still need closing
  * Mark Completed / No Show / Client Cancelled / Coach Cancelled
  * Quick payment action for completed sessions with balance

- Collection alerts are now status-aware
  * Completed + outstanding balance = collection alert
  * Past but still Scheduled = needs-closing alert first

- Client Profiles
  * Contact-based automatic linking for existing/new bookings
  * Session history
  * Completed sessions / coaching hours
  * Booked value / collected amount
  * Active coaching programs
  * Latest player progress assessment

- Coaching Programs / Fixed-price Packages
  * Custom program name
  * Number of sessions (e.g. 10)
  * Fixed package price
  * Hours per session
  * Overall program goal
  * Goal/title for every session
  * Enroll a client
  * Schedule the next program session
  * Program sessions use the same calendar and do NOT add another hourly charge

- Program Payment Ledger
  * Cash / GCash / Bank Transfer / Other
  * Payment date
  * Package balance tracking

- Player Progress Foundation
  * Serve
  * Return
  * Forehand
  * Backhand
  * Dinking
  * Footwork
  * Positioning
  * Consistency
  * Strategy
  * Confidence
  * 1–5 rating + coach note

- Payment Dashboard
  * Cash received today
  * Cash received this month
  * Booking outstanding
  * Program outstanding
  * Monthly payment-method breakdown

DATA SAFETY
- Migration is non-destructive.
- Existing v16 bookings and payment ledger remain.
- Existing bookings are automatically linked to a Client Profile ONLY when they have a non-empty matching contact.
- Name-only bookings are NOT auto-merged, avoiding accidental merging of two people with the same name.

NOT YET IN v17-A
These are planned for the next v17 build after v17-A is verified in production:
- Public “What do you want to improve?” wizard
- Public coaching-program recommendations
- Pickyla Says / richer coaching tips
- Testimonials
- Live public availability indicator
- Full progress charts / initial-vs-current comparison
- Shareable booking confirmation card
- Public QR generator
- PWA install mode

Recommended test after deployment:
1. Open Admin.
2. Create one test client.
3. Create one 2-session TEST program first (faster than 10 for testing).
4. Enroll the test client.
5. Schedule Session 1 from the client profile.
6. Mark it Completed.
7. Add a progress assessment.
8. Record a program payment.
9. Confirm Today Dashboard and Payment Dashboard update.

After the test passes, create the real 10-session program and we proceed to v17-B Public Engagement.
