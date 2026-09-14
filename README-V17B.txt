PICKYLA v17-B — PUBLIC ENGAGEMENT + SHARE TOOLS

Requires: v17-A migration already completed.

1) Run supabase-v17b-migration.sql in Supabase > SQL Editor > New Query.
2) Upload/replace these files in the GitHub repository root:
   - index.html
   - style.css
   - script.js
   - admin.html
   - admin.css
   - admin.js
   - site.webmanifest
   - service-worker.js
   - supabase-v17b-migration.sql (optional repo backup)
   - supabase-v17b-migration.txt (optional repo backup)
3) Wait for GitHub Pages deployment and hard refresh.

v17-B adds:
- Public improvement wizard and coaching-program recommendations
- Public structured program cards with session-by-session goals
- Public live-availability indicator
- Richer Coach Tips / Pickyla Says rotation
- Curated public testimonials managed by Admin
- Program focus tags + program editing in Admin
- Inquiry context: goal + program interest
- Shareable booking confirmation PNG
- Downloadable public-site QR code
- Installable PWA shell (static assets only; live Supabase data is never offline-cached)

Privacy:
- Public program catalog contains no client data.
- Testimonials are admin-curated and should only be published with permission.
- Public schedule remains privacy-safe and never reveals client names.
