# Seed / apply notes — RAS SiteSafe

## Apply the migration

Supabase CLI is not logged in on this machine (`SUPABASE_ACCESS_TOKEN` unset), so the schema was **not** applied remotely from the agent. Apply it yourself:

### Option A — Dashboard SQL Editor (fastest)

1. Open your project: https://supabase.com/dashboard/project/kgqxbyrgjxglboulrqft
2. Go to **SQL Editor** → New query
3. Paste the full contents of [`supabase/migrations/20261002000100_sitesafe_schema.sql`](../supabase/migrations/20261002000100_sitesafe_schema.sql)
4. Run. Confirm tables under **Table Editor**: `profiles`, `sites`, `site_assignments`, `submissions`, `submission_photos`
5. Confirm bucket **submission-photos** under **Storage**
6. For **Admin → Sites** framer search, also run [`supabase/migrations/20261002000200_admin_framer_directory.sql`](../supabase/migrations/20261002000200_admin_framer_directory.sql) (creates `admin_list_framers()` RPC)

### Option B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref kgqxbyrgjxglboulrqft
npx supabase db push
```

## Create demo Auth users

In **Authentication → Users → Add user** (or Auth Admin API), create:

| Name | Role | Email | Password |
| --- | --- | --- | --- |
| Sarah Mitchell | admin | `admin@ras-sitesafe-demo.com` | *(choose a shared demo password; put it in README Test Credentials)* |
| Daniel Ortiz | framer | `framer@ras-sitesafe-demo.com` | *(same shared demo password)* |

When creating each user, set user metadata so the `handle_new_user` trigger assigns role/name:

```json
{ "display_name": "Sarah Mitchell", "role": "admin" }
```

```json
{ "display_name": "Daniel Ortiz", "role": "framer" }
```

If profiles already exist with the wrong role, fix in SQL:

```sql
update public.profiles
set display_name = 'Sarah Mitchell', role = 'admin'
where id = (select id from auth.users where email = 'admin@ras-sitesafe-demo.com');

update public.profiles
set display_name = 'Daniel Ortiz', role = 'framer'
where id = (select id from auth.users where email = 'framer@ras-sitesafe-demo.com');
```

## Seed RAS jobsites (form dropdown)

After Auth users exist, populate the framer safety form **Jobsite** dropdown with realistic Ron Anderson & Sons / Vancouver Island framing sites and assign them to Daniel.

### Option A — Dashboard SQL Editor (recommended)

1. Open **SQL Editor** → New query
2. Paste the full contents of [`supabase/seed/ras_jobsites.sql`](../supabase/seed/ras_jobsites.sql)
3. Run once (safe to re-run: inserts by name only if missing; assignments use `ON CONFLICT DO NOTHING`)

Example site names included:

- Langford Yard — Shop & Prefab Staging
- North Yard — Truss & Panel Laydown
- Millstream Heights — Phase 2 Framing
- Royal Bay — Colwood Residential
- Bear Mountain — Townhomes Framing
- Westshore Commons — Multi-Family Formwork
- View Royal Waterfront — Stick Frame
- Cobble Hill — Cowichan Valley Spec Homes

Then sign in as `framer@ras-sitesafe-demo.com` → **New report** (`/framer/new`) — the dropdown should list those assigned sites. Admins see all active sites via RLS; framers only see assignments.

If Daniel’s profile is missing, the site rows still insert; re-run the seed after creating the Auth user to attach `site_assignments`.

### Option B — one-off sample (legacy)

```sql
insert into public.sites (name, address)
select 'RAS Demo Jobsite — North Yard', '123 Framing Lane'
where not exists (
  select 1 from public.sites where name = 'RAS Demo Jobsite — North Yard'
);

insert into public.site_assignments (site_id, framer_id)
select s.id, p.id
from public.sites s
cross join lateral (
  select pr.id
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where u.email = 'framer@ras-sitesafe-demo.com'
  limit 1
) p
where s.name = 'RAS Demo Jobsite — North Yard'
on conflict (site_id, framer_id) do nothing;
```

## Photo constraints (client + bucket)

- MIME: `image/jpeg`, `image/png`, `image/webp`
- Max size: **8 MiB** (enforced on the Storage bucket; mirror in UI later)
- Path: `{auth.uid()}/{submission_id}/{filename}`
