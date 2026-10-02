-- Safety issues (failed checklist items) + corrective actions workflow.
-- Extends photo_kind for issue / resolution evidence.
-- Paste-ready copy: store docs/supabase-manual-sql.md Part 7.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.issue_severity as enum ('low', 'medium', 'high');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.corrective_action_status as enum (
    'open',
    'in_progress',
    'resolved'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.corrective_action_priority as enum (
    'low',
    'medium',
    'high'
  );
exception when duplicate_object then null;
end $$;

-- Extend submission_photo_kind (Part 5). Safe if values already exist.
alter type public.submission_photo_kind add value if not exists 'issue';
alter type public.submission_photo_kind add value if not exists 'resolution';
alter type public.submission_photo_kind add value if not exists 'corrective_action';

-- ---------------------------------------------------------------------------
-- safety_issues — one row per failed checklist item / hazard / incident
-- ---------------------------------------------------------------------------
create table if not exists public.safety_issues (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  checklist_item_key text not null,
  item_label text not null,
  description text not null,
  severity public.issue_severity not null,
  immediate_action text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, checklist_item_key)
);

create index if not exists safety_issues_submission_id_idx
  on public.safety_issues (submission_id);
create index if not exists safety_issues_severity_idx
  on public.safety_issues (severity);
create index if not exists safety_issues_created_at_idx
  on public.safety_issues (created_at desc);

comment on table public.safety_issues is
  'Field-captured issues from No answers / hazards / incidents; formal CA is admin-owned.';

-- ---------------------------------------------------------------------------
-- corrective_actions — admin response to a safety issue
-- ---------------------------------------------------------------------------
create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  safety_issue_id uuid not null references public.safety_issues (id) on delete cascade,
  required_action text not null,
  priority public.corrective_action_priority not null default 'medium',
  status public.corrective_action_status not null default 'open',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  resolution_notes text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corrective_actions_safety_issue_id_idx
  on public.corrective_actions (safety_issue_id);
create index if not exists corrective_actions_status_idx
  on public.corrective_actions (status);
create index if not exists corrective_actions_assignee_id_idx
  on public.corrective_actions (assignee_id);
create index if not exists corrective_actions_due_date_idx
  on public.corrective_actions (due_date);

comment on table public.corrective_actions is
  'Admin corrective actions: open → in_progress → resolved. Framers read only.';

-- Optional link from photos to issue / CA (kinds issue | resolution | corrective_action)
alter table public.submission_photos
  add column if not exists safety_issue_id uuid references public.safety_issues (id) on delete set null;

alter table public.submission_photos
  add column if not exists corrective_action_id uuid references public.corrective_actions (id) on delete set null;

create index if not exists submission_photos_safety_issue_id_idx
  on public.submission_photos (safety_issue_id)
  where safety_issue_id is not null;

create index if not exists submission_photos_corrective_action_id_idx
  on public.submission_photos (corrective_action_id)
  where corrective_action_id is not null;

comment on column public.submission_photos.photo_kind is
  'site | hazard | issue | resolution | corrective_action';

drop trigger if exists safety_issues_set_updated_at on public.safety_issues;
create trigger safety_issues_set_updated_at
  before update on public.safety_issues
  for each row execute function public.set_updated_at();

drop trigger if exists corrective_actions_set_updated_at on public.corrective_actions;
create trigger corrective_actions_set_updated_at
  before update on public.corrective_actions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.safety_issues enable row level security;
alter table public.corrective_actions enable row level security;

-- Framer: read/write issues on own submissions. Admin: full.
drop policy if exists "safety_issues_select_own_or_admin" on public.safety_issues;
create policy "safety_issues_select_own_or_admin"
  on public.safety_issues for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = safety_issues.submission_id
        and s.submitted_by = auth.uid()
    )
  );

drop policy if exists "safety_issues_insert_own_or_admin" on public.safety_issues;
create policy "safety_issues_insert_own_or_admin"
  on public.safety_issues for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = safety_issues.submission_id
        and s.submitted_by = auth.uid()
    )
  );

drop policy if exists "safety_issues_update_own_or_admin" on public.safety_issues;
create policy "safety_issues_update_own_or_admin"
  on public.safety_issues for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = safety_issues.submission_id
        and s.submitted_by = auth.uid()
        and s.status = 'draft'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = safety_issues.submission_id
        and s.submitted_by = auth.uid()
        and s.status = 'draft'
    )
  );

drop policy if exists "safety_issues_delete_own_draft_or_admin" on public.safety_issues;
create policy "safety_issues_delete_own_draft_or_admin"
  on public.safety_issues for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = safety_issues.submission_id
        and s.submitted_by = auth.uid()
        and s.status = 'draft'
    )
  );

-- Corrective actions: admin write; framer read when they own the parent submission.
drop policy if exists "corrective_actions_select_own_or_admin" on public.corrective_actions;
create policy "corrective_actions_select_own_or_admin"
  on public.corrective_actions for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.safety_issues si
      join public.submissions s on s.id = si.submission_id
      where si.id = corrective_actions.safety_issue_id
        and s.submitted_by = auth.uid()
    )
  );

drop policy if exists "corrective_actions_insert_admin" on public.corrective_actions;
create policy "corrective_actions_insert_admin"
  on public.corrective_actions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "corrective_actions_update_admin" on public.corrective_actions;
create policy "corrective_actions_update_admin"
  on public.corrective_actions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "corrective_actions_delete_admin" on public.corrective_actions;
create policy "corrective_actions_delete_admin"
  on public.corrective_actions for delete
  to authenticated
  using (public.is_admin());
