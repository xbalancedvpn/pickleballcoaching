PICKYLA v17-E — Admin Navigation + Public Testimonial Review

WHAT CHANGED
- Admin login page now has a Back to Public Site button.
- Logged-in Admin topbar now has Public Site + Menu + Sign out.
- Admin Menu jumps directly to Dashboard, Today, Payments, Reports, Weekly Schedule, Marketing & Testimonials, Client Profiles, Programs, Booking Tools, Inquiries, Calendar, and Day View.
- Public Testimonials section now has Write a Testimonial.
- Public testimonials are submitted as PENDING and are never shown immediately.
- Admin can Review/Edit wording, Approve & Publish, Reject, Hide, or Delete testimonials.
- Existing published testimonials remain approved/published.

DEPLOYMENT ORDER
1) Run supabase-v17e-migration.sql (or .txt) once in Supabase SQL Editor.
2) Replace index.html, style.css, script.js, admin.html, admin.css, admin.js, service-worker.js in GitHub.
3) Hard refresh public and admin pages.

TEST
- Login page -> Back to Public Site.
- Admin -> Menu -> each section jump.
- Public -> Write a Testimonial -> submit.
- Admin -> Testimonials -> Pending -> Review/Edit -> Approve & Publish.
- Public -> approved testimonial appears; rejected/pending one does not.
