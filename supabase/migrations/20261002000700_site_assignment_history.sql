-- Assignment history for Daily Compliance missing-worker accuracy.
-- Soft-unassign via unassigned_at; keep assigned_at. Active = unassigned_at IS NULL.
-- Paste-ready copy: store docs/supabase-manual-sql.md Part 8.

alter table public.site_assignments
  add column if not exists unassigned_at timestamptz;

comment on column public.site_assignments.unassigned_at is
  'Null while assignment is active. Set on remove so historical Missing stays accurate.';

-- Replace hard unique(site_id, framer_id) with one active row per pair.
alter table public.site_assignments
  drop constraint if exists site_assignments_site_id_framer_id_key;

drop index if exists site_assignments_active_unique;
create unique index site_assignments_active_unique
  on public.site_assignments (site_id, framer_id)
  where unassigned_at is null;

create index if not exists site_assignments_site_active_idx
  on public.site_assignments (site_id)
  where unassigned_at is null;

create index if not exists site_assignments_history_idx
  on public.site_assignments (site_id, assigned_at, unassigned_at);

-- Active assignment only for site visibility + framer insert checks.
drop policy if exists "sites_select_admin_or_assigned" on public.sites;
create policy "sites_select_admin_or_assigned"
  on public.sites for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.site_assignments sa
      where sa.site_id = sites.id
        and sa.framer_id = auth.uid()
        and sa.unassigned_at is null
    )
  );

drop policy if exists "submissions_insert_own_framer" on public.submissions;
create policy "submissions_insert_own_framer"
  on public.submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.site_assignments sa
        where sa.site_id = submissions.site_id
          and sa.framer_id = auth.uid()
          and sa.unassigned_at is null
      )
    )
  );
