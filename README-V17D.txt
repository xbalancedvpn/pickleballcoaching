PICKYLA v17-D — CLIENT IDENTITY & PARTICIPANT MANAGEMENT

Run supabase-v17d-migration.sql (or .txt) once in Supabase SQL Editor before uploading the site files.

What changes:
- Public booking dynamically asks for Player 1–8 details.
- First name + last name are required for every player; contact is optional.
- Optional “Remember Player 1” browser autofill plus recent-player suggestions on that device.
- Public inquiries store each player separately without exposing them publicly.
- Admin inquiry cards show the roster and Load to Booking carries all players across.
- Confirmed bookings create participant records and individual client profiles.
- Client history includes sessions where the client joined as Player 2/3/etc., not only bookings they personally made.
- Matching uses normalized name + contact as the strongest match; shared family contacts are allowed.
- Name-only repeat matches require admin confirmation before linking.
- Existing bookings/payments/programs remain intact; historical primary clients are backfilled where possible.

GitHub update files:
index.html
style.css
script.js
admin.html
admin.css
admin.js
service-worker.js

Version: v17-D
