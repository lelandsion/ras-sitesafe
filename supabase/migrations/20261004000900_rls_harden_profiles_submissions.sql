-- Harden RLS: block framer role self-escalation + submission status tampering.
-- Paste-ready copy: store docs/supabase-manual-sql.md Part 10.
-- Safe to re-run (create or replace / drop policy if exists).

-- ---------------------------------------------------------------------------
-- Profiles: only admins may change role (closes self-promotion via UPDATE)
-- ---------------------------------------------------------------------------
create or replace function public.profiles_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.profiles_role_guard();

-- Never trust signup metadata for privilege — always provision as framer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'framer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submissions: framers may edit drafts and submit; cannot rewrite post-submit
-- ---------------------------------------------------------------------------
create or replace function public.submissions_framer_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.status is distinct from 'draft'::public.submission_status then
    raise exception 'Framer can only update draft submissions'
      using errcode = '42501';
  end if;

  if new.status not in (
    'draft'::public.submission_status,
    'submitted'::public.submission_status
  ) then
    raise exception 'Framer can only keep draft or submit'
      using errcode = '42501';
  end if;

  -- Lock ownership + admin review fields
  new.submitted_by := old.submitted_by;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;

  return new;
end;
$$;

drop trigger if exists submissions_framer_update_guard on public.submissions;
create trigger submissions_framer_update_guard
  before update on public.submissions
  for each row execute function public.submissions_framer_update_guard();

drop policy if exists "submissions_update_own_or_admin" on public.submissions;
drop policy if exists "submissions_update_admin" on public.submissions;
drop policy if exists "submissions_update_own_draft" on public.submissions;

create policy "submissions_update_admin"
  on public.submissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "submissions_update_own_draft"
  on public.submissions for update
  to authenticated
  using (
    not public.is_admin()
    and submitted_by = auth.uid()
    and status = 'draft'::public.submission_status
  )
  with check (
    not public.is_admin()
    and submitted_by = auth.uid()
    and status in (
      'draft'::public.submission_status,
      'submitted'::public.submission_status
    )
  );
