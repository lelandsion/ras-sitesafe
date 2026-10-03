-- RLS + framer update guard for ready_for_review (run after 20261003000800).
-- Paste-ready copy: store docs/supabase-manual-sql.md Part 9.

-- ---------------------------------------------------------------------------
-- Guard: non-admins may only flip open/in_progress → ready_for_review
-- and may only touch framer completion fields (+ status/updated_at).
-- ---------------------------------------------------------------------------
create or replace function public.corrective_actions_framer_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.status not in ('open', 'in_progress') then
    raise exception 'Framer can only complete open or in-progress corrective actions';
  end if;

  if new.status is distinct from 'ready_for_review'::public.corrective_action_status then
    raise exception 'Framer can only set status to ready_for_review';
  end if;

  -- Lock admin-owned fields
  new.safety_issue_id := old.safety_issue_id;
  new.required_action := old.required_action;
  new.priority := old.priority;
  new.assignee_id := old.assignee_id;
  new.due_date := old.due_date;
  new.resolution_notes := old.resolution_notes;
  new.resolved_by := old.resolved_by;
  new.resolved_at := old.resolved_at;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if new.framer_completed_at is null then
    new.framer_completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists corrective_actions_framer_update_guard
  on public.corrective_actions;
create trigger corrective_actions_framer_update_guard
  before update on public.corrective_actions
  for each row execute function public.corrective_actions_framer_update_guard();

-- ---------------------------------------------------------------------------
-- RLS: framer may update CAs on their own submissions only
-- ---------------------------------------------------------------------------
drop policy if exists "corrective_actions_update_framer_ready"
  on public.corrective_actions;
create policy "corrective_actions_update_framer_ready"
  on public.corrective_actions for update
  to authenticated
  using (
    not public.is_admin()
    and status in (
      'open'::public.corrective_action_status,
      'in_progress'::public.corrective_action_status
    )
    and exists (
      select 1
      from public.safety_issues si
      join public.submissions s on s.id = si.submission_id
      where si.id = corrective_actions.safety_issue_id
        and s.submitted_by = auth.uid()
    )
  )
  with check (
    not public.is_admin()
    and status = 'ready_for_review'::public.corrective_action_status
    and exists (
      select 1
      from public.safety_issues si
      join public.submissions s on s.id = si.submission_id
      where si.id = corrective_actions.safety_issue_id
        and s.submitted_by = auth.uid()
    )
  );
