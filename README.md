# Pickyla Pickleball Coaching v3

## New admin workflow
- Multi-hour booking: enter client details once, choose an available start time and an end time, then save once.
- End-time choices stop automatically before the next booked or unavailable hour.
- Quick Block: mark a date range and time range as Unavailable for tournaments or personal schedules.
- Whole-day preset: 8:00 AM to 12:00 Midnight.
- Clear Unavailable restores only blocked hours and does not delete existing bookings.
- The original hourly editor remains available for one-off corrections.

## Public calendar colors
- Green: no bookings on that date and open schedule.
- Amber: the date already has one or more bookings but is not fully booked.
- Red: every hourly slot from 8 AM to 12 Midnight is booked.
- Gray: date is fully or partly marked Unavailable and has no booking.

## Database
No new SQL migration is required if v2 is already working.

## Admin URL
https://xbalancedvpn.github.io/pickleballcoaching/admin.html

Upload/replace the files in the existing GitHub Pages repository.
