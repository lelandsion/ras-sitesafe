# Supabase setup & seed — RAS SiteSafe

Short redistributable checklist. Pair with README Test credentials and (if present) `docs/supabase-manual-sql.md` for paste-ready SQL parts.

## 1. Apply schema

Apply every file in [`supabase/migrations/`](../supabase/migrations/) **in filename order** (SQL Editor or CLI).

### Option A — Dashboard SQL Editor

1. Open your Supabase project → **SQL Editor**
2. Paste and run each migration file from oldest to newest
3. Confirm tables: `profiles`, `sites`, `site_assignments`, `submissions`, `submission_photos`, `safety_issues`, `corrective_actions`, `saved_reports`
4. Confirm Storage bucket **`submission-photos`**

### Option B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## 2. Create demo Auth users

**Authentication → Users → Add user** (auto-confirm email). Password for both: **`testpassword`**.

| Name | Role | Email | Password |
| --- | --- | --- | --- |
| Sarah Mitchell | admin | `admin@ras-sitesafe-demo.com` | `testpassword` |
| Daniel Ortiz | framer | `framer@ras-sitesafe-demo.com` | `testpassword` |

User metadata (so `handle_new_user` sets role/name):

```json
{ "display_name": "Sarah Mitchell", "role": "admin" }
```

```json
{ "display_name": "Daniel Ortiz", "role": "framer" }
```

If roles are wrong after create:

```sql
update public.profiles
set display_name = 'Sarah Mitchell', role = 'admin'
where id = (select id from auth.users where email = 'admin@ras-sitesafe-demo.com');

update public.profiles
set display_name = 'Daniel Ortiz', role = 'framer'
where id = (select id from auth.users where email = 'framer@ras-sitesafe-demo.com');
```

## 3. Seed jobsites + assign the framer

**Auth users must exist first.** Run [`supabase/seed/ras_jobsites.sql`](../supabase/seed/ras_jobsites.sql):

- Inserts demo RAS jobsites (idempotent by name)
- Assigns them to `framer@ras-sitesafe-demo.com`

If the framer Auth user was missing, sites still insert and assignments no-op — re-run the seed after creating the user, or use Admin → Sites → Assign.

- Framers need **site_assignments** to see jobsites on `/framer/new`
- Admins see all active `sites` via RLS (no assignment required)

## 4. App env

```bash
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon only). Never commit real keys.

## 5. Smoke

```bash
npm install
npm run dev   # http://127.0.0.1:4321
```

Sign in as admin and framer with **`testpassword`**. Full manual coverage: [`docs/test-plan.md`](./test-plan.md).

## Photo constraints

- MIME: `image/jpeg`, `image/png`, `image/webp`
- Max size: **8 MiB**
- Path pattern: `{auth.uid()}/{submission_id}/{filename}`
