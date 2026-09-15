# Pickyla Database Archive

This folder keeps the historical Supabase SQL used to build the current Pickyla production database.

These files are **reference/recovery migrations**. They are not loaded by the public site or admin page at runtime.

## Order used during development

1. `supabase-setup.sql`
2. `supabase-v4-migration.sql`
3. `supabase-v8-migration.sql`
4. `supabase-v16-migration.sql`
5. `supabase-v17a-migration.sql`
6. `supabase-v17b-migration.sql`
7. `supabase-v17d-migration.sql`
8. `supabase-v17e-migration.sql`
9. `supabase-v17f-migration.sql`

The live database is already migrated. Do not rerun these blindly against production.

Current production cleanup work is tracked directly in Supabase migration history where applicable.
