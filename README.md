# RAS SiteSafe

**Mobile-first site safety form + compliance dashboard** for [Ron Anderson & Sons](https://www.ronandersonandsons.com/) — built as a junior developer technical assessment.

Framers submit jobsite safety checks (with photos) from a phone. Admins review submissions and track compliance from a dashboard with charts.

| | |
| --- | --- |
| **Live app** | **[https://ras-sitesafe.vercel.app](https://ras-sitesafe.vercel.app)** |
| **Repository** | [https://github.com/lelandsion/ras-sitesafe](https://github.com/lelandsion/ras-sitesafe) |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React + TypeScript |
| Build | Vite |
| Backend | Supabase (Auth, Postgres, Storage) |
| Routing | React Router |
| Charts | Recharts |
| Icons | Lucide |
| Hosting | Vercel |

---

## Features

- **Login & roles** — Supabase Auth; route guards for `admin` and `framer` (no public sign-up)
- **Framer flow** — assigned sites, safety form, JPEG/PNG/WebP photo upload to private Storage
- **Admin dashboard** — submission list, status review, Recharts status breakdown

---

## Test credentials

Demo accounts for assessors (fictional identities — not personal emails). Shared password for both:

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Admin | Sarah Mitchell | `admin@ras-sitesafe-demo.com` | *(paste shared demo password here)* |
| Framer | Daniel Ortiz | `framer@ras-sitesafe-demo.com` | *(same as above)* |

> Seed Auth users in Supabase first — see [`docs/supabase-seed-notes.md`](docs/supabase-seed-notes.md).

---

## Setup / local development

```bash
git clone https://github.com/lelandsion/ras-sitesafe.git
cd ras-sitesafe
npm install
cp .env.example .env.local
```

Fill `.env.local` (never commit real values):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Use the **publishable / anon** key only — never the service role key.

```bash
npm run dev
```

Dev server: [http://127.0.0.1:4321](http://127.0.0.1:4321) (port `4321` in `vite.config.ts`).

## Testing

```bash
npm test          # Vitest watch mode
npm run test:run  # single CI run
```

Manual QA (landing, login, framer, admin, role isolation, deploy smoke): [`docs/test-plan.md`](docs/test-plan.md).

### Apply schema (once)

1. Paste [`supabase/migrations/20261002000100_sitesafe_schema.sql`](supabase/migrations/20261002000100_sitesafe_schema.sql) in Supabase → **SQL Editor**, or
2. `npx supabase login` → `npx supabase link` → `npx supabase db push`

Then create the demo Auth users and optional sample site — steps in [`docs/supabase-seed-notes.md`](docs/supabase-seed-notes.md).

---

## ERD

![RAS SiteSafe ERD](docs/ras-sitesafe-erd.png)

- Diagram: [`docs/ras-sitesafe-erd.png`](docs/ras-sitesafe-erd.png)
- Mermaid / notes: [`docs/ras-sitesafe-erd.md`](docs/ras-sitesafe-erd.md)
- Schema + RLS + Storage: [`supabase/migrations/20261002000100_sitesafe_schema.sql`](supabase/migrations/20261002000100_sitesafe_schema.sql)

---

## Assumptions

- Internal RAS tool — accounts are provisioned by an admin; **no public sign-up**
- Roles on `profiles.role`: **`admin` | `framer`** only
- Postgres **RLS** on all app tables; photos in private bucket `submission-photos`
- Photos: JPEG / PNG / WebP, max **~8 MiB** each
- Official RAS logo sourced from RAS (not invented)
- Demo emails are fictional assessment identities
- Built for a Canadian construction-company assessment context (demo jobsite data)

---

## Project structure

```
src/
  components/   # auth guards, layout, form photo upload, admin chart
  pages/        # login, admin dashboard, framer home + safety form
  hooks/        # AuthProvider / useAuth
  services/     # sites, submissions, photos (Supabase client calls)
  lib/          # supabase client
  types/        # DB / domain types
supabase/migrations/   # schema, enums, RLS, storage policies
docs/                  # ERD, seed notes
```

---

## Deploy

Production is on Vercel: **[https://ras-sitesafe.vercel.app](https://ras-sitesafe.vercel.app)**

SPA routes are rewritten via `vercel.json`. Required env vars (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
