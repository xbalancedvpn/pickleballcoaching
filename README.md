# Pickyla Coaching v4

## New in v4
- One-tap whole-booking cancellation: all hours tied to that booking become available again.
- Standard rate presets based on player count:
  - 1 player = PHP 300/person/hour
  - 2 players = PHP 250/person/hour
  - 3-5 players = PHP 200/person/hour
- Custom agreed rate option.
- Booking total is calculated automatically.
- Amount received tracking.
- Earnings dashboard: Today, This Week, This Month, All Time.
- Quick tournament/unavailable presets.
- Public calendar:
  - Green = open
  - Amber = has booking but still has open hours
  - Red = all 16 hours are booked
  - Gray = no availability due to blocks / limited availability

## IMPORTANT
Run `supabase-v4-migration.sql` once BEFORE uploading the v4 website files.

## Legacy v3 bookings
Old v3 bookings do not have a booking group ID. They remain visible in Hourly View, but the new one-tap whole-booking cancellation and earnings report are designed for bookings created in v4 onward.

## Admin URL
https://xbalancedvpn.github.io/pickleballcoaching/admin.html


## v5 client booking improvements
- Client can choose Start Time + End Time for multi-hour booking requests.
- End Time only shows consecutive available hours and stops before a booked/unavailable slot.
- Ready-made booking message is generated automatically.
- `Copy Booking Details` copies the message.
- `Copy & Open Facebook` copies the message then opens Kyla's Facebook so the client can paste it into Messenger.
- No new Supabase SQL migration is needed if v4 is already working.

Note: Facebook/Messenger does not reliably support pre-filling arbitrary message text from a normal website link, so copy-then-open is the most dependable flow.


## v6
- Restored Admin Month Calendar.
- Tap a date to open Booking Groups and Hourly View.
- Same color coding as public calendar.
- No new SQL required.
