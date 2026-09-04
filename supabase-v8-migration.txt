-- Pickyla v8 migration: Pending Inquiry Tracker
-- Run ONCE in Supabase > SQL Editor.

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  contact text,
  preferred_date date,
  start_hour smallint check (start_hour between 8 and 23),
  end_hour smallint check (end_hour between 9 and 24),
  participant_count smallint check (participant_count between 1 and 5),
  coaching_type text,
  quoted_rate numeric(10,2),
  status text not null default 'new'
    check (status in ('new','waiting','tentative','confirmed','cancelled')),
  source_text text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_inquiry_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inquiries_updated_at on public.inquiries;
create trigger inquiries_updated_at
before update on public.inquiries
for each row execute function public.set_inquiry_updated_at();

alter table public.inquiries enable row level security;

drop policy if exists "Admin read inquiries" on public.inquiries;
drop policy if exists "Admin add inquiries" on public.inquiries;
drop policy if exists "Admin update inquiries" on public.inquiries;
drop policy if exists "Admin delete inquiries" on public.inquiries;

create policy "Admin read inquiries" on public.inquiries for select to authenticated using (true);
create policy "Admin add inquiries" on public.inquiries for insert to authenticated with check (true);
create policy "Admin update inquiries" on public.inquiries for update to authenticated using (true) with check (true);
create policy "Admin delete inquiries" on public.inquiries for delete to authenticated using (true);

grant select, insert, update, delete on table public.inquiries to authenticated;
revoke all on table public.inquiries from anon;

create index if not exists idx_inquiries_status on public.inquiries(status);
create index if not exists idx_inquiries_date on public.inquiries(preferred_date);
