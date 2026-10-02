# Seed / apply notes — RAS SiteSafe

## Apply the migration

Supabase CLI is not logged in on this machine (`SUPABASE_ACCESS_TOKEN` unset), so the schema was **not** applied remotely from the agent. Apply it yourself:

### Option A — Dashboard SQL Editor (fastest)

1. Open your project: https://supabase.com/dashboard/project/kgqxbyrgjxglboulrqft
2. Go to **SQL Editor** → New query
3. Paste the full contents of [`supabase/migrations/20261002000100_sitesafe_schema.sql`](../supabase/migrations/20261002000100_sitesafe_schema.sql)
4. Run. Confirm tables under **Table Editor**: `profiles`, `sites`, `site_assignments`, `submissions`, `submission_photos`
5. Confirm bucket **submission-photos** under **Storage**

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

## Optional sample site + assignment

After both users exist:

```sql
insert into public.sites (name, address)
values ('RAS Demo Jobsite — North Yard', '123 Framing Lane')
returning id;

-- Replace UUIDs with real ids from profiles / sites
insert into public.site_assignments (site_id, framer_id)
values (
  '<site-uuid>',
  (select id from public.profiles where role = 'framer' limit 1)
);
```

## Photo constraints (client + bucket)

- MIME: `image/jpeg`, `image/png`, `image/webp`
- Max size: **8 MiB** (enforced on the Storage bucket; mirror in UI later)
- Path: `{auth.uid()}/{submission_id}/{filename}`
