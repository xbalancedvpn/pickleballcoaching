# Pickyla Pickleball Coaching

Static, mobile-first coaching schedule and booking website for Kyla Nicole Soriano.

## Schedule
Monday–Sunday, 8:00 AM–12:00 Midnight. All sessions use fixed 1-hour slots.

## Rates
- 1-on-1: PHP 300/hour
- 2 Players: PHP 250/person/hour
- 3–5 Players: PHP 200/person/hour

## Updating booked/unavailable slots
Open `script.js` and edit the `BOOKED` or `UNAVAILABLE` sets.

Example:
```js
const BOOKED = new Set([
  "2026-09-05|18", // Sep 5, 6 PM–7 PM
]);
```

Hours use 24-hour format. `8` = 8 AM, `13` = 1 PM, `23` = 11 PM.

## Hosting
This is a static website and can be deployed on Vercel or GitHub Pages.
