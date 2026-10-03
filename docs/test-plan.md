# RAS SiteSafe — Manual Test Plan

Presentation-ready smoke + regression checklist. Pair with automated Vitest (`npm run test:run`). Steps: **click X → expect Y**.

**Live app:** [https://ras-sitesafe.vercel.app](https://ras-sitesafe.vercel.app)  
**Local:** `npm install` → `npm run dev` → [http://127.0.0.1:4321](http://127.0.0.1:4321)

---

## Prerequisites

| Item | Detail |
| --- | --- |
| Demo admin | Sarah Mitchell — `admin@ras-sitesafe-demo.com` |
| Demo framer | Daniel Ortiz — `framer@ras-sitesafe-demo.com` |
| Password | **`testpassword`** (both accounts; see README Test credentials) |
| Env | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env.local` (from `.env.example`) |
| Schema / seed | Migrations + jobsites — [`docs/supabase-seed-notes.md`](./supabase-seed-notes.md) |
| Photos | JPEG / PNG / WebP, max **8 MiB** |

> There is **no public sign-up**. Accounts are provisioned in Supabase Auth.

---

## 0. Quick smoke (~10 minutes)

| # | Step | Expected |
| --- | --- | --- |
| 0.1 | Open `/` | Brand lockup; hero **Sign in** + **How it works**; no developer SQL copy |
| 0.2 | Sign in as admin | Lands on `/admin` |
| 0.3 | Sign out → sign in as framer | Lands on `/framer` |
| 0.4 | Framer: **New report** → fill required → **Submit Safety Check** | Status **Submitted** |
| 0.5 | Admin: open same submission → **Mark reviewed** | Status **Reviewed**; persists after refresh |
| 0.6 | Phone width (~390px) | Header + primary CTAs usable; no horizontal page scroll |

---

## 1. Landing & branding

| # | Step | Expected |
| --- | --- | --- |
| 1.1 | Open `/` | Logo + **RAS / SITESAFE** lockup |
| 1.2 | Hero | SiteSafe headline, short lead, one CTA group |
| 1.3 | **How it works** | Scrolls to Overview steps |
| 1.4 | **Sign in** | `/login` |

---

## 2. Login

| # | Step | Expected |
| --- | --- | --- |
| 2.1 | Empty submit | Browser required-field validation |
| 2.2 | Wrong password | Error banner; stay on `/login` |
| 2.3 | Admin: `admin@ras-sitesafe-demo.com` / `testpassword` | `/admin` |
| 2.4 | Framer: `framer@ras-sitesafe-demo.com` / `testpassword` | `/framer` |
| 2.5 | Signed-in visit `/login` | Redirect to role home |

---

## 3. Framer — Daily Safety Check

| # | Step | Expected |
| --- | --- | --- |
| 3.1 | `/framer` | List + **New report**; Account in header |
| 3.2 | `/framer/new` with assignments | Jobsite select shows assigned active sites |
| 3.3 | No assignments | Banner: ask admin to assign on Sites |
| 3.4 | Incomplete checklist → Submit | Validation; no submit |
| 3.5 | Answer **No** (e.g. Hard hat) | Issue capture: description*, severity*, immediate action*, optional photo |
| 3.6 | **Save draft** twice on same No item | One safety issue for that item (no duplicates); UI does **not** look like submit |
| 3.7 | Site photo + hazard photo (Hazards Yes) | Thumbnails; lightbox opens |
| 3.8 | Reject GIF / &gt; 8 MiB | Clear client error |
| 3.9 | **Preview** / **Export PDF** | Preview + `ras-sitesafe-daily-check-…pdf` |
| 3.10 | **Submit Safety Check** | **Submitted**; form locked |
| 3.11 | `/account` | Email, role, sites, activity |

---

## 4. Admin — dashboard & filters

| # | Step | Expected |
| --- | --- | --- |
| 4.1 | `/admin` | Metrics + charts + worker submissions |
| 4.2 | Filters: site / worker / dates / issues / status | Table matches; **Clear** resets |
| 4.3 | Status filter includes Reviewed | Rows with Reviewed (`approved`) appear |
| 4.4 | Selected filter / nav tab: hover | Background stays selected; **text stays readable** (no green wash + invisible text) |
| 4.5 | Open issues summary | Count + link to **Safety Issues** |
| 4.6 | Click submission row | Opens **form** (not preview-only) |
| 4.7 | Review → Under review / Reviewed / Rejected | Persists after refresh |
| 4.8 | Nav: Dashboard / Safety Issues / Reports / Sites | All reachable |

---

## 5. Admin — Safety Issues & corrective actions

| # | Step | Expected |
| --- | --- | --- |
| 5.1 | `/admin/issues` | Issues from framer No / hazard / incident |
| 5.2 | Filters: All / Ready for review / Open / In progress / Resolved / No CA | List filters; selected chip hover stays readable |
| 5.3 | Sort | Open → In progress → Ready for review → Resolved → No CA; newest within bucket |
| 5.4 | **Create CA** → optional **Mark in progress** | Status Open / In progress |
| 5.5 | Framer: open submitted check → **Mark completed / Ready for review** | CA **Ready for review**; awaiting admin |
| 5.6 | Admin Resolve with notes* | **Resolved**; framer sees resolution |
| 5.7 | Dashboard open-issues count | Does not list full CA queue (consolidated on Safety Issues) |

---

## 6. Admin — Sites & Daily Compliance

| # | Step | Expected |
| --- | --- | --- |
| 6.1 | `/admin/sites` | List; Add / Edit / Assign |
| 6.2 | Assign Daniel → framer `/framer/new` | Site appears |
| 6.3 | Soft-remove assignment | Framer loses site; history kept for compliance |
| 6.4 | **Daily Compliance** | Date default today; Assigned / Submitted / Missing / Issues |
| 6.5 | Tabs All / Submitted / Missing / Issues | Filters workers; selected tab hover readable |
| 6.6 | Never assigned / unassigned before date | Not listed as Missing |
| 6.7 | Dashboard Today’s compliance | Links into Daily Compliance |

---

## 7. Admin — Aggregate reports + appendix

| # | Step | Expected |
| --- | --- | --- |
| 7.1 | `/admin/reports` | Site, month, include toggles; saved list |
| 7.2 | Generate for a site/month with known issues | Summary tiles; **Safety issues** count &gt; 0 when issues exist |
| 7.3 | Appendix | Lists **all** period issues (open, in_progress, ready_for_review, **resolved**, and no-CA) — not “none” when issues existed |
| 7.4 | Period uses checklist **check date** | Issues from checks in range appear even if later Reviewed |
| 7.5 | Photos include on | Appendix photos (capped) + PDF embeds |
| 7.6 | Export PDF | Branded monthly PDF; appendix when issues/photos included |
| 7.7 | Save + View | Saved report detail matches includes |

---

## 8. Role isolation & session

| # | Step | Expected |
| --- | --- | --- |
| 8.1 | Framer → `/admin` | Redirect `/framer` |
| 8.2 | Admin → `/framer` | Redirect `/admin` |
| 8.3 | Signed out → `/admin` or `/framer` | `/login` |
| 8.4 | Framer RLS | Own submissions only |

---

## 9. Mobile & deploy smoke

| # | Step | Expected |
| --- | --- | --- |
| 9.1 | Phone: landing, form, admin filters | Usable touch targets; no page overflow |
| 9.2 | Production HTTPS | Login, draft/submit, review, Sites assign, Reports generate |
| 9.3 | Hard-refresh deep links | SPA rewrite (no 404) |

---

## Automated coverage (companion)

```bash
npm test          # watch
npm run test:run  # CI / one-shot
```

Vitest covers auth guards, login, homepage smoke, photo validation / `photo_kind`, checklist analytics, filters, period/report stats (incl. appendix on Reviewed rows), PDF structure, CA helpers, Daily Compliance windows, Safety Issues UI smoke.

**Gap:** no Playwright live E2E in CI — use this plan against local or Vercel after schema + seed.
