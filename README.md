# Pickyla Pickleball Coaching

Current stable release: **v17-G**

Live site: `https://pickyla-coaching.xbalanced.net`
Admin entry: `https://pickyla-coaching.xbalanced.net/admin.html`

## Repository layout
The repository root is intentionally minimal.

- `index.html` — lightweight redirect to the live app
- `admin.html` — lightweight redirect to the admin app
- `CNAME` — GitHub Pages custom domain
- `README.md` — project notes
- `app/` — complete live Pickyla website and admin runtime
- `database/` — Supabase notes and historical migrations

## App folder
`app/` contains the production public/admin HTML, CSS, JavaScript, PWA files, icons, coach image, and current Pickyla brand assets.

The files inside `app/` keep their original relative paths so the tested v17-G runtime continues to work without rewriting the application code.

## Current coaching rates
- 1-on-1: ₱400/hour
- Partners (2–3): ₱300 each/hour
- Group (4–8): ₱250 each/hour
- Court fee is separate and is not counted as Pickyla coaching income.

## Backend
Supabase project ref: `bnekbuwfloagqjzselxp`

Historical SQL files are organized under `database/migrations/` and are retained for recovery/reference.

## Recovery branches
- `archive/pre-cleanup-v17g-20260915`
- `archive/pre-reorg-v17g-20260915`
