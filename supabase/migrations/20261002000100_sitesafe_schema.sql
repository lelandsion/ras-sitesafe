-- RAS SiteSafe — core schema, enums, RLS, storage policies
-- Apply via Supabase Dashboard → SQL Editor, or: supabase db push / supabase migration up
-- Never run service-role keys from the Vite client.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'framer');

create type public.submission_status as enum (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Extends auth.users; one profile per signed-in user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.user_role not null default 'framer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which framer works which site (admin manages; framer reads own).
create table public.site_assignments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  framer_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (site_id, framer_id)
);

create index site_assignments_framer_id_idx on public.site_assignments (framer_id);
create index site_assignments_site_id_idx on public.site_assignments (site_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete restrict,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  status public.submission_status not null default 'draft',
  notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submissions_submitted_by_idx on public.submissions (submitted_by);
create index submissions_site_id_idx on public.submissions (site_id);
create index submissions_status_idx on public.submissions (status);

-- Metadata for Storage objects in bucket `submission-photos`.
create table public.submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  storage_path text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer check (byte_size is null or byte_size > 0),
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create index submission_photos_submission_id_idx on public.submission_photos (submission_id);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — used by RLS; avoid recursion on profiles)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a framer profile when a new auth user signs up.
-- Admins / demo roles should be set explicitly after seed (see seed notes).
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
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'framer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_photos enable row level security;

-- profiles: own row; admin reads all; admin can update roles/names
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- sites: admin full; framer reads sites they are assigned to
create policy "sites_select_admin_or_assigned"
  on public.sites for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.site_assignments sa
      where sa.site_id = sites.id and sa.framer_id = auth.uid()
    )
  );

create policy "sites_insert_admin"
  on public.sites for insert
  to authenticated
  with check (public.is_admin());

create policy "sites_update_admin"
  on public.sites for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "sites_delete_admin"
  on public.sites for delete
  to authenticated
  using (public.is_admin());

-- site_assignments: admin full; framer reads own assignments
create policy "assignments_select_admin_or_own"
  on public.site_assignments for select
  to authenticated
  using (public.is_admin() or framer_id = auth.uid());

create policy "assignments_insert_admin"
  on public.site_assignments for insert
  to authenticated
  with check (public.is_admin());

create policy "assignments_update_admin"
  on public.site_assignments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "assignments_delete_admin"
  on public.site_assignments for delete
  to authenticated
  using (public.is_admin());

-- submissions: framer CRUD own; admin read + update (status review)
create policy "submissions_select_own_or_admin"
  on public.submissions for select
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin());

create policy "submissions_insert_own_framer"
  on public.submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.site_assignments sa
        where sa.site_id = submissions.site_id and sa.framer_id = auth.uid()
      )
    )
  );

create policy "submissions_update_own_or_admin"
  on public.submissions for update
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin())
  with check (submitted_by = auth.uid() or public.is_admin());

create policy "submissions_delete_own_draft_or_admin"
  on public.submissions for delete
  to authenticated
  using (
    public.is_admin()
    or (submitted_by = auth.uid() and status = 'draft')
  );

-- submission_photos: same ownership as parent submission
create policy "photos_select_via_submission"
  on public.submission_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_photos.submission_id
        and (s.submitted_by = auth.uid() or public.is_admin())
    )
  );

create policy "photos_insert_via_own_submission"
  on public.submission_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.submissions s
      where s.id = submission_photos.submission_id
        and (s.submitted_by = auth.uid() or public.is_admin())
    )
  );

create policy "photos_delete_via_own_or_admin"
  on public.submission_photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_photos.submission_id
        and (s.submitted_by = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket + policies (submission photos)
-- Path convention: {user_id}/{submission_id}/{filename}
-- Client should enforce max ~8 MB; accept jpeg/png/webp only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-photos',
  'submission-photos',
  false,
  8388608, -- 8 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated users may upload under their own user-id folder prefix.
create policy "storage_photos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submission-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: owner folder or admin
create policy "storage_photos_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submission-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "storage_photos_update_own_or_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'submission-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  )
  with check (
    bucket_id = 'submission-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "storage_photos_delete_own_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'submission-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
