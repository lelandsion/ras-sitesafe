# RAS SiteSafe — Manual Test Plan

Presentation-ready QA checklist for assessors and demos. Pair with automated Vitest coverage (`npm run test:run`) for unit/guard regressions.

**Live app:** [https://ras-sitesafe.vercel.app](https://ras-sitesafe.vercel.app)  
**Local:** `npm install` → `npm run dev` → [http://127.0.0.1:4321](http://127.0.0.1:4321)

---

## Prerequisites

| Item | Detail |
| --- | --- |
| Demo admin | Sarah Mitchell — `admin@ras-sitesafe-demo.com` |
| Demo framer | Daniel Ortiz — `framer@ras-sitesafe-demo.com` |
| Password | *(shared demo password set when seeding Supabase Auth — see README Test credentials; do not invent one)* |
| Env | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable/anon only) in `.env.local` or Vercel |
| Schema | Migration applied + demo users / site assignments seeded (`docs/supabase-seed-notes.md`) |
| Photos | JPEG / PNG / WebP, max **8 MiB** each |

> There is **no public sign-up**. Accounts are provisioned in Supabase Auth.

---

## 1. Landing

| # | Step | Expected |
| --- | --- | --- |
| 1.1 | Open `/` (local or live) | RAS logo + **RAS / SITESAFE / Site Safety & Compliance** wordmark; hero reads as one branded composition |
| 1.2 | Click **How it works** (hero or Overview) | Smooth scroll to `#how-it-works`; three-step overview visible |
| 1.3 | Click **Sign in** | Navigates to `/login` |

---

## 2. Login

| # | Step | Expected |
| --- | --- | --- |
| 2.1 | Inspect email / password fields | Placeholders `you@example.com` and `••••••••` (not demo emails) |
| 2.2 | Submit empty form | Browser required-field validation blocks submit |
| 2.3 | Sign in with a **wrong** password | Error banner (e.g. invalid credentials); stay on `/login` |
| 2.4 | Sign in as **admin** demo | Lands on `/admin` |
| 2.5 | Sign out → sign in as **framer** demo | Lands on `/framer` |
| 2.6 | While signed in, visit `/login` | Redirect to role home (`/admin` or `/framer`) |

---

## 3. Framer flow

| # | Step | Expected |
| --- | --- | --- |
| 3.1 | Open `/framer` as Daniel | List of own submissions (or empty state); **New report** available |
| 3.2 | Start **New report** (`/framer/new`) | Site selector (assigned sites), notes, photo upload, **Save draft** / submit actions |
| 3.3 | Submit with required fields missing | Inline / banner validation; no successful submit |
| 3.4 | Attach a valid JPEG/PNG/WebP under 8 MiB | Thumbnail appears; upload succeeds |
| 3.5 | Attach GIF / PDF or file **> 8 MiB** | Rejected with clear client message (type or size) |
| 3.6 | **Save draft** | Status **Draft**; appears in framer list; can reopen and edit |
| 3.7 | Submit for review | Status moves to **Submitted** (no longer editable as draft) |
| 3.8 | Open an existing submission from the list | Detail/edit route shows status badge and photos |

---

## 4. Admin dashboard

| # | Step | Expected |
| --- | --- | --- |
| 4.1 | Open `/admin` as Sarah | Metrics: Total / Needs review / Approved / Rejected |
| 4.2 | Check chart | Recharts bar breakdown by status (or empty-chart message) |
| 4.3 | Use filter tabs | List filters to the selected status set |
| 4.4 | Set a submitted report to **Under review** / **Start review** | Status updates; reviewed stamp fields set |
| 4.5 | **Approve** a report | Status **Approved**; persists after refresh |
| 4.6 | **Reject** a report | Status **Rejected**; persists after refresh |

---

## 5. Role isolation

| # | Step | Expected |
| --- | --- | --- |
| 5.1 | As framer, visit `/admin` | Redirected to `/framer` (no admin UI) |
| 5.2 | As admin, visit `/framer` | Redirected to `/admin` |
| 5.3 | Signed out, visit `/admin` or `/framer` | Redirect to `/login` with return path retained where applicable |
| 5.4 | Framer list / RLS | Framer sees only own submissions; cannot review others’ status as admin |

---

## 6. Deploy smoke (production)

Run against **[https://ras-sitesafe.vercel.app](https://ras-sitesafe.vercel.app)** with seeded demo credentials:

| # | Step | Expected |
| --- | --- | --- |
| 6.1 | `/` loads over HTTPS | Brand + How it works + Sign in |
| 6.2 | `/login` | Placeholders + successful admin/framer redirects |
| 6.3 | Framer: create draft + photo + submit | Persists in production Supabase |
| 6.4 | Admin: metrics/chart + approve/reject | Status changes survive refresh |
| 6.5 | Direct `/admin` while framer session | Role redirect (no privilege escalation) |
| 6.6 | Hard-refresh deep links (`/framer/new`, `/admin`) | SPA rewrite serves app (no Vercel 404) |

---

## Automated coverage (companion)

```bash
npm test          # watch
npm run test:run  # CI / one-shot
```

Vitest + React Testing Library cover (mocked Supabase — **no live network**):

- `RequireAuth` / `RedirectIfAuthed` role redirects
- Login placeholders, validation attributes, error banner, admin vs framer redirect
- `StatusBadge` labels/classes
- `validatePhotoFile` type/size rules
- `SUBMISSION_STATUS_LABELS` / admin review status helpers
- `buildStatusCounts` chart aggregation
- `humanizeDbError` messaging
- Light `HomePage` brand / CTA smoke

**Gap:** no Playwright/Cypress live E2E against Supabase or Vercel in CI. Use this manual plan for end-to-end and deploy confidence.
