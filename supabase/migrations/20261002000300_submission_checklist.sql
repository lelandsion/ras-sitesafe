-- Structured daily safety check payload (JSONB) on submissions.
-- Client schema: src/types/safetyChecklist.ts (schemaVersion: 1).

alter table public.submissions
  add column if not exists checklist jsonb not null default '{}'::jsonb;

comment on column public.submissions.checklist is
  'Daily Safety Check structured answers (PPE, fall protection, hazards, etc.)';

create index if not exists submissions_checklist_gin_idx
  on public.submissions using gin (checklist);
