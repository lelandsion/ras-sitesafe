# RAS SiteSafe — Manual Test Plan (Leland)

Presentation-ready smoke + regression checklist. Pair with automated Vitest (`npm run test:run`) for unit/guard coverage. Steps are concrete: **click X → expect Y**.

**Live app:** [https://ras-sitesafe.vercel.app](https://ras-sitesafe.vercel.app)  
**Local:** `npm install` → `npm run dev` → [http://127.0.0.1:4321](http://127.0.0.1:4321)

---

## Prerequisites

| Item | Detail |
| --- | --- |
| Demo admin | Sarah Mitchell — `admin@ras-sitesafe-demo.com` |
| Demo framer | Daniel Ortiz — `framer@ras-sitesafe-demo.com` |
| Password | Shared demo password from **README → Test credentials** (do not invent; paste the seeded value there if blank) |
| Env | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable/anon only) in `.env.local` or Vercel |
| Schema / seed | Applied once per project — see `docs/supabase-seed-notes.md` and store `docs/supabase-manual-sql.md` (developer docs only; **not** shown in the app UI) |
| Photos | JPEG / PNG / WebP, max **8 MiB** each |

> There is **no public sign-up**. Accounts are provisioned in Supabase Auth.

---

## 0. Quick smoke (10 minutes)

| # | Step | Expected |
| --- | --- | --- |
| 0.1 | Open `/` | Brand lockup (logo + RAS / SITESAFE / tag); hero has **Sign in** + **How it works**; **no** SQL / Parts / migration / seed / `.env` copy |
| 0.2 | Click **How it works** | Scrolls to Overview: Sign in → File a daily check → Review and report |
| 0.3 | Click **Sign in** → log in as admin | Lands on `/admin` Site Safety Report |
| 0.4 | Sign out → log in as framer | Lands on `/framer` |
| 0.5 | Framer: **New report** → fill required items → **Submit Safety Check** | Status **Submitted** |
| 0.6 | Admin: open same submission → set **Approved** | Status persists after refresh |
| 0.7 | Resize to phone width (~390px) | Header + primary CTAs usable; no horizontal page scroll |

---

## 1. Landing & branding

| # | Step | Expected |
| --- | --- | --- |
| 1.1 | Open `/` (local or live) | Header: official no-text logo + **RAS / SITESAFE / Site Safety & Compliance** as one lockup |
| 1.2 | Read hero title + lead | **SiteSafe** hero; one short lead about mobile field safety; one CTA group |
| 1.3 | Read hero meta / footer | Mentions Daily Safety Check + admin dashboard in **user** language; footer `RAS · SiteSafe · …`; **no** “Apply Supabase SQL (Parts 1–3)” or seed instructions |
| 1.4 | Click **How it works** (hero button) | Smooth scroll to `#how-it-works`; URL hash updates |
| 1.5 | Read the three Overview steps | (1) Sign in / company account + README demo hint (2) File a daily check (3) Review and report (filters / Sites / PDFs) |
| 1.6 | Click **Sign in** (hero or Overview) | Navigates to `/login` |
| 1.7 | Hard-refresh `/` | Styles and brand fonts still load (Barlow Condensed + Source Sans 3) |

---

## 2. Login

| # | Step | Expected |
| --- | --- | --- |
| 2.1 | Open `/login` | Lead talks about company account / admin vs framer destinations — **not** `profiles.role` or env file paths |
| 2.2 | Inspect email / password fields | Placeholders `you@example.com` and `••••••••` (not demo emails) |
| 2.3 | Read hint under the form | Mentions no public sign-up + demo credentials in README |
| 2.4 | Submit empty form | Browser required-field validation blocks submit |
| 2.5 | Sign in with a **wrong** password | Error banner (e.g. invalid credentials); stay on `/login` |
| 2.6 | Sign in as **admin** (`admin@ras-sitesafe-demo.com` + README password) | Lands on `/admin` |
| 2.7 | Sign out (header or page action) → sign in as **framer** | Lands on `/framer` |
| 2.8 | While signed in, visit `/login` | Redirect to role home (`/admin` or `/framer`) |

---

## 3. Framer — daily check

### 3.A Home & empty state

| # | Step | Expected |
| --- | --- | --- |
| 3.1 | Open `/framer` as Daniel | Lead shows display name; **New report** / **Refresh** / **Sign out** |
| 3.2 | If list empty | Empty state: “No safety reports yet” + **Start first report** → `/framer/new` (no SQL / seed copy) |
| 3.3 | If list has items | Cards show site, status badge, notes snippet, updated time; click opens edit route |

### 3.B New report form

| # | Step | Expected |
| --- | --- | --- |
| 3.4 | Click **New report** (`/framer/new`) | **DAILY SAFETY CHECK** header; check date; worker name; jobsite select |
| 3.5 | If no assigned sites | Banner: ask admin to assign on **Sites**, then refresh — **no** `ras_jobsites.sql` |
| 3.6 | Select an assigned jobsite | Dropdown shows active assigned sites only |
| 3.7 | Leave PPE / fall / tools unanswered → **Submit Safety Check** | Validation banner; no successful submit |
| 3.8 | Answer all Yes·No·N/A; leave Hazards unanswered → submit | Prompt to indicate whether hazards were observed |
| 3.9 | Hazards **Yes** without description/severity → submit | Asks for description and/or severity |
| 3.10 | Incident **Yes** without detail → submit | Asks for incident / near miss details |

### 3.C Photos, preview, PDF

| # | Step | Expected |
| --- | --- | --- |
| 3.11 | Under **Site photos**, add a valid JPEG/PNG/WebP &lt; 8 MiB | Thumbnail appears (draft auto-created if needed) |
| 3.12 | Attach GIF / PDF or file **&gt; 8 MiB** | Rejected with clear client message (type or size) |
| 3.13 | Hazards **Yes** → add a **Hazard photo** | Thumbnail under hazard photos section |
| 3.14 | Click a photo thumbnail | Lightbox / zoom opens; Esc or close dismisses |
| 3.15 | **Save draft** | Status **Draft**; appears on `/framer`; reopen editable |
| 3.16 | **Preview report** | Preview page shows checklist + photos; back returns to form |
| 3.17 | **Export PDF** | Downloads `ras-sitesafe-daily-check-…pdf` with header, meta, PPE / fall / tools / hazards, notes, photo notes |
| 3.18 | Complete all required answers → **Submit Safety Check** | Status **Submitted**; form locked (read-only) |
| 3.19 | Reopen submitted check | Read-only; **Preview** + **Export PDF** still work |

### 3.D Account

| # | Step | Expected |
| --- | --- | --- |
| 3.20 | Header **Account** (or `/account`) | Shows email/role, assigned sites, activity counts |
| 3.21 | If no sites assigned | Empty copy about no sites — not developer SQL |

---

## 4. Admin — dashboard & filters

| # | Step | Expected |
| --- | --- | --- |
| 4.1 | Open `/admin` as Sarah | **Site Safety Report**: avg compliance, hazards, incidents, open issues, checks submitted |
| 4.2 | Charts | Issues by category + issues/compliance over time (Recharts) or empty-chart message |
| 4.3 | **Open issues** summary | Count + link to **Safety Issues** (`/admin/issues`); no full issue list / CA actions on Dashboard |
| 4.4 | Set **Site** filter to one jobsite | Worker submissions table shows only that site |
| 4.5 | Set **Worker** filter to Daniel | Only Daniel’s rows |
| 4.6 | Set date From/To that excludes known rows | Matching rows only (or empty filtered state) |
| 4.7 | Set **Issues** = Has issues / No issues | Filters by structured issue count |
| 4.8 | Set **Status** = Submitted / Approved / etc. | Table matches status |
| 4.9 | Click **Clear filters** (or equivalent) | All filters reset; full list returns |
| 4.10 | Empty filtered state | “No submissions match these filters” (user guidance, not SQL) |
| 4.11 | Review dropdown on a submitted row → **Under review** / **Approved** / **Rejected** | Status updates; persists after refresh |
| 4.12 | **Export PDF** on a row | Daily-check PDF downloads |
| 4.13 | Click a submission photo in admin UI | Lightbox / zoom works |
| 4.14 | Admin nav: **Dashboard / Safety Issues / Reports / Sites** | `/admin`, `/admin/issues`, `/admin/reports`, `/admin/sites` all reachable |
| 4.15 | **New report** (admin) | Form opens; Save / Preview / Export without **Submit Safety Check** (admin path) |

---

## 5. Admin — Sites & assignments

| # | Step | Expected |
| --- | --- | --- |
| 5.1 | Open `/admin/sites` | Jobsite list: name, address, active/inactive pill, assigned framer count |
| 5.2 | If list empty | “No jobsites yet. Create a site…” + **Add first site** — **no** seed SQL |
| 5.3 | **Add site** | Modal saves name/address/active; new row after save/refresh |
| 5.4 | **Edit** a site → mark inactive | Framer jobsite dropdown on `/framer/new` hides that site |
| 5.5 | **Assign workers** | Modal lists current assignments; search by name or email finds Daniel |
| 5.6 | **Add** Daniel to a site | Assignment count increases; Daniel sees site on `/framer/new` |
| 5.7 | **Remove** assignment | Count drops; Daniel no longer sees that site (unless still assigned elsewhere) |

---

## 6. Admin — Reports (aggregate / saved)

| # | Step | Expected |
| --- | --- | --- |
| 6.1 | Open `/admin/reports` | Generate form: site, month/period, include toggles; saved reports list |
| 6.2 | Choose site + month → leave all includes on → **Generate** | PDF downloads; entry appears in saved list |
| 6.3 | Click **View** on a saved report | Detail page shows summary metrics / sections matching includes |
| 6.4 | Generate with Photos / Corrective actions off | PDF omits those sections |
| 6.5 | Empty saved list (fresh env) | “No saved reports yet. Generate one above.” |

---

## 7. Role isolation & session

| # | Step | Expected |
| --- | --- | --- |
| 7.1 | As framer, visit `/admin` | Redirected to `/framer` (no admin UI) |
| 7.2 | As admin, visit `/framer` | Redirected to `/admin` |
| 7.3 | Signed out, visit `/admin` or `/framer` | Redirect to `/login` (return path retained where applicable) |
| 7.4 | Framer list / RLS | Framer sees only own submissions; cannot change others’ review status |
| 7.5 | Missing profile (edge) | User-facing “ask an admin to finish provisioning” — no SQL docs link |

---

## 8. Mobile & chrome

| # | Step | Expected |
| --- | --- | --- |
| 8.1 | Phone width (~390×844) on `/` | Hero + CTAs stack cleanly; brand lockup readable |
| 8.2 | Phone: `/framer/new` | Tri-state controls and photo buttons are large touch targets |
| 8.3 | Phone: `/admin` filters | Filters usable; table/cards don’t overflow off-screen |
| 8.4 | Header brand lockup desktop + mobile | Logo + wordmark stay one unit; no clipped tagline |
| 8.5 | Photo lightbox on phone | Opens full-bleed-ish; closes reliably |

---

## 9. Deploy smoke (production)

Run against **[https://ras-sitesafe.vercel.app](https://ras-sitesafe.vercel.app)** with seeded demo credentials from README:

| # | Step | Expected |
| --- | --- | --- |
| 9.1 | `/` over HTTPS | Brand + How it works + Sign in; **no** developer SQL copy |
| 9.2 | `/login` | Placeholders + successful admin/framer redirects |
| 9.3 | Framer: draft + site photo + submit | Persists in production Supabase |
| 9.4 | Admin: filters + approve/reject | Status changes survive refresh |
| 9.5 | Admin: Sites assign + Reports generate | Assignment + saved report visible |
| 9.6 | Direct `/admin` while framer session | Role redirect (no privilege escalation) |
| 9.7 | Hard-refresh deep links (`/framer/new`, `/admin/reports`, `/admin/sites`) | SPA rewrite serves app (no Vercel 404) |

---

## Automated coverage (companion)

```bash
npm test          # watch
npm run test:run  # CI / one-shot
```

Vitest + React Testing Library (mocked Supabase — **no live network**):

- `RequireAuth` / `RedirectIfAuthed` role redirects + user-facing missing-profile / config copy
- Login placeholders, validation, error banner, admin vs framer redirect, no-dev-setup copy
- `HomePage` brand / CTA smoke + asserts no SQL/Parts/seed copy
- Empty states: framer home, admin sites (in-app actions only)
- `StatusBadge` labels/classes
- `validatePhotoFile` type/size rules; `photo_kind` defaulting / missing-column detection
- Checklist parse / validate / serialize; analytics aggregates + open issues
- `filterSubmissions` + `countActiveFilters` + unique site/worker helpers
- Period/report stats + saved-report labels
- Daily-check PDF structure (sections/meta/footer) + period PDF include toggles
- `humanizeDbError` user-facing messaging
- Corrective-action helpers: issue triggers on No/hazard/incident, draft reconcile (no dup keys), validation (`src/lib/safetyIssueKeys.test.ts`)
- Daily Compliance: assignment-on-date windows, Missing ≠ Not Assigned, filters/summary (`src/lib/dailyCompliance.test.ts`)

**Gap:** no Playwright/Cypress live E2E against Supabase or Vercel in CI. Use this manual plan (esp. §10 / §11 in the Project store test-plan) for end-to-end after Part 7 + Part 8 SQL.

---

## 10. Corrective Actions (Safety Issues)

Requires store SQL **Part 7** (`safety_issues` + `corrective_actions`).

| # | Step | Expected |
| --- | --- | --- |
| 10.1 | Framer: new check → answer **No** on Hard hat | Issue capture panel: description*, severity*, immediate action*, optional photo |
| 10.2 | Fill issue fields → **Save draft** twice | Still **one** safety issue for that item (no duplicates) |
| 10.3 | Submit the check | Status Submitted; checklist answers unchanged |
| 10.4 | Admin → **Safety Issues** | Row shows site, worker, item, severity, CA status |
| 10.5 | **Create CA** → Open → **Mark in progress** → **Resolve** (notes*) | Status Open → In progress → Resolved |
| 10.6 | Framer opens submitted check | Locked; Safety issues shows CA + resolution |
| 10.7 | Admin → Worker submissions → click a row | Opens submission preview/detail |

---

## 11. Daily Compliance / Crew Status

Requires store SQL **Part 8** (`site_assignments.unassigned_at`).

| # | Step | Expected |
| --- | --- | --- |
| 11.1 | Admin → Sites → **Daily Compliance** | Date defaults to today; summary Assigned / Submitted / Missing / Issues |
| 11.2 | Tabs All / Submitted / Missing / Issues | Filters worker rows |
| 11.3 | Submitted worker | Status Submitted + time; View Submission |
| 11.4 | Assigned, no submission | Not Submitted / NOT SUBMITTED messaging (no reminders yet) |
| 11.5 | Never assigned / unassigned before date | Not listed as Missing |
| 11.6 | Dashboard **Today's compliance** | X/Y submitted; Missing N → links to site Daily Compliance `filter=missing` |
