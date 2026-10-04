# RAS SiteSafe — RLS audit

**Grade: A−**  
**Part 10 applied on live DB? YES** (self-promote + submitted→draft blocked)  
**Branch:** [`cursor/rls-audit-tests-d61f`](https://github.com/lelandsion/ras-sitesafe/tree/cursor/rls-audit-tests-d61f) · verified 2026-10-04  
**Live adversarial suite:** **17 passed / 0 failed / 1 skipped** (`npm run test:run -- src/lib/rlsLive.test.ts`)

## Verdict

RLS tenancy is **robust** on the live project after Part 10. Remaining work was an **app write-order bug** (not a missing policy): framers upserted `safety_issues` *after* flipping the submission to `submitted`, so the draft-only **UPDATE** policy fired with `USING expression`.

## Part 10 (confirmed live)
- Framer `profiles.role → admin` → denied (`Only admins can change roles`)
- Framer non-draft → `draft` → denied (0 rows / guard)
- `submissions_update_own_draft` + `submissions_update_admin` coexist with issue sync when submit flow keeps the row as `draft` until issues are written

## Framer `safety_issues` error (fixed in app — no new SQL)
**Root cause:** `syncSafetyIssuesForSubmission` used `.upsert()` after status was already `submitted`. Upsert’s `ON CONFLICT DO UPDATE` must pass the UPDATE policy, which requires parent `status = 'draft'`. Plain INSERT on owned submissions still works.

**Fix:** Persist/sync issues while submission is still `draft`, then set `submitted`; replace upsert with insert/update. **No extra SQL for Leland.**

## Product fixes on this branch
- Admin Worker Submissions: newest **checkDate** within attention buckets
- Site report generate: non-admins must be assigned (`canGenerateSiteReport`); admins keep all-sites
- Safety Issues list: **resolved last** (after no-CA)

## Residual risks
- No second demo Auth framer (cross-framer covered via admin-owned rows)
- Storage scoped by uid folder (photos table still tenancy-gated)
- Soft-unassigned assignment history visible to that framer (compliance)

## Ready to merge?
Live RLS suite is green with Part 10 applied. Branch is ready to merge to `main` after Leland’s OK.
