-- Framer mark-complete for corrective actions (ready_for_review).
-- Paste-ready copy: store docs/supabase-manual-sql.md Part 9.
-- Enum add must commit before policies/triggers reference the new label
-- (see 20261003000801_… for RLS + guard).

alter type public.corrective_action_status add value if not exists 'ready_for_review';

alter table public.corrective_actions
  add column if not exists framer_completed_at timestamptz;

alter table public.corrective_actions
  add column if not exists framer_completion_notes text;

comment on column public.corrective_actions.framer_completed_at is
  'When the framer marked the CA ready for admin review. Not a formal resolve.';

comment on column public.corrective_actions.framer_completion_notes is
  'Optional note from the framer when marking ready for review.';

comment on table public.corrective_actions is
  'Admin corrective actions: open → in_progress → ready_for_review → resolved. Framers may mark ready_for_review on own submissions; only admin resolves.';
