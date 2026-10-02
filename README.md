# RAS SiteSafe

Mobile-first construction safety form and compliance dashboard built for **Ron Anderson & Sons**.

Living foundation plan (assessment checklist & build order): see the Project store doc `docs/foundation-plan.md` in the Cursor Project context. Keep that checklist updated as milestones land.

## Tech stack

- Vite + React + TypeScript
- Supabase (Auth, Postgres, Storage)
- React Router
- Recharts (dashboard — after login milestone)
- Lucide React

## Setup

```bash
npm install
cp .env.example .env.local
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project
npm run dev
```

Dev server defaults to port **4321** (`http://127.0.0.1:4321`).

## Assumptions

- Supabase project already exists; wire URL + anon key via env (never commit secrets).
- Roles live on `profiles.role`: `admin` | `framer`.
- Official RAS logo must be sourced from RAS site/Instagram into `src/assets/branding/` (not invented).
- Assessment demo accounts are fictional SiteSafe identities (not personal emails).

## Test Credentials

| Role   | Name           | Email                         | Password                          |
| ------ | -------------- | ----------------------------- | --------------------------------- |
| Admin  | Sarah Mitchell | `admin@ras-sitesafe-demo.com` | *(set when seeding Supabase Auth)* |
| Framer | Daniel Ortiz   | `framer@ras-sitesafe-demo.com`| *(set when seeding Supabase Auth)* |

## ERD

- Target: [`docs/ras-sitesafe-erd.png`](docs/ras-sitesafe-erd.png) *(placeholder until schema/ERD milestone)*
- See `docs/ras-sitesafe-erd.png.PLACEHOLDER.txt` until the diagram is exported.

## Deployed app

- *(Vercel production URL — add after connecting GitHub → Vercel)*

## Create / push GitHub repo (if not done yet)

```bash
# After `gh auth login` (or create the empty repo on github.com first)
gh repo create ras-sitesafe --public \
  --description "Mobile-first construction safety form and compliance dashboard built for Ron Anderson & Sons." \
  --source=. --remote=github --push
```

Or without `gh`:

```bash
git remote add github https://github.com/<YOUR_USER>/ras-sitesafe.git
git push -u github main
```

Then import the repo in Vercel, set `VITE_SUPABASE_*` env vars, and paste the deploy URL above.
