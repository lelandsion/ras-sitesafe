-- Admin-generated monthly site safety reports (persisted metadata + summary snapshot).

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  site_id uuid references public.sites (id) on delete set null,
  site_name text not null,
  period_year integer not null check (period_year >= 2020 and period_year <= 2100),
  period_month integer not null check (period_month between 1 and 12),
  title text not null,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index saved_reports_created_by_idx on public.saved_reports (created_by);
create index saved_reports_site_period_idx on public.saved_reports (site_id, period_year, period_month);

alter table public.saved_reports enable row level security;

create policy "saved_reports_admin_all"
  on public.saved_reports for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.saved_reports is
  'Monthly site safety reports generated from daily checks (admin only).';
