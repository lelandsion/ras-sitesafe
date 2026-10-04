# RAS SiteSafe — RLS audit

**Grade: B− (B+ after Part 10 is applied on the live project)**  
**Audit base:** `main` @ `f8a2b11` + branch `cursor/rls-audit-tests-d61f`  
**Date:** 2026-10-04

## Summary

Core tenancy is sound: framers only see assigned sites, own submissions/photos/issues/CAs, and admin-only surfaces (`saved_reports`, site CRUD, assignments write, `admin_list_framers`) reject framers. Two **confirmed live holes** on the demo Supabase project required a hardening migration:

1. **Privilege escalation** — framer could `UPDATE profiles.role = 'admin'` on their own row.
2. **Submission tamper** — framer could flip a non-draft submission back to `draft` (and rewrite review fields).

Fixes ship as `supabase/migrations/20261004000900_rls_harden_profiles_submissions.sql` and store **Part 10** in `docs/supabase-manual-sql.md`. **You must run Part 10 in the SQL Editor** (no service-role / CLI token available to this agent). Until then, live Part 10 Vitest assertions fail by design.

## What’s solid

| Area | Verdict |
| --- | --- |
| `is_admin` / `current_user_role` | `SECURITY DEFINER` + `search_path = public` — avoids profiles RLS recursion |
| Sites | Framer SELECT via **active** assignment (`unassigned_at is null`); admin full CRUD |
| Site assignments | Framer SELECT own; write admin-only |
| Submissions SELECT | Own or admin (drafts visible to owner + admin — intentional) |
| Submissions INSERT | Own uid + active assignment (or admin) |
| Submissions DELETE | Own **draft** or admin |
| Photos | Join parent submission ownership for select/insert/delete |
| Safety issues | Own submission; update/delete only while parent is draft |
| Corrective actions | Admin write; framer SELECT own; Part 9 update + trigger for `ready_for_review` only |
| Saved reports | Admin `FOR ALL` |
| Storage `submission-photos` | Private bucket; path prefix `{auth.uid}/…`; admin can read all |
| `admin_list_framers` | Definer RPC with explicit `is_admin` gate + `REVOKE` from `PUBLIC` |

## Gaps / risks

| Risk | Severity | Status |
| --- | --- | --- |
| Framer self-promote via `profiles` UPDATE | **Critical** | Fixed in migration / Part 10 — **apply on live DB** |
| Framer rewrite submitted/approved → draft | **High** | Fixed in migration / Part 10 — **apply on live DB** |
| `handle_new_user` trusted metadata `role` | Medium | Fixed to always insert `framer` (Part 10); promote admins via SQL |
| Storage path not tied to submission RLS | Low | Owner-folder isolation only; metadata table still tenancy-gated |
| No second demo framer | Test gap | Cross-user denial inferred from ownership joins; add a second framer for stronger live proof |
| Photos: no UPDATE policy | Info | Intentional; clients insert/delete |

## SQL you must run

In **Supabase → SQL Editor**, run:

`supabase/migrations/20261004000900_rls_harden_profiles_submissions.sql`

(or store **Part 10** in `docs/supabase-manual-sql.md`).

Then confirm demo framer is still `framer`:

```sql
update public.profiles
set role = 'framer'
where id = (select id from auth.users where email = 'framer@ras-sitesafe-demo.com')
  and role <> 'framer';
```

## Test results

| Suite | Result | Count |
| --- | --- | --- |
| Static policy intent (`rlsPolicyIntent.test.ts`) | **Pass** | 13 |
| Live RLS (`rlsLive.test.ts`) with `.env.local` + demo users | **2 fail / 6 pass / 1 skip** until Part 10 | 8 + skip branch |
| Full `npm run test:run` | Expect **fail** until Part 10 applied (live assertions) | — |

Live coverage exercised: role escalate (reverted on detect), site/assignment insert deny, assignment-scoped sites, non-draft status flip (reverted), `saved_reports` deny, issues/CA ownership, `admin_list_framers` deny/allow.

After Part 10: re-run `npm run test:run -- src/lib/rlsLive.test.ts` — both Part 10 cases should pass, then merge is safe.

## Files added

- `supabase/migrations/20261004000900_rls_harden_profiles_submissions.sql`
- `src/lib/rlsPolicyIntent.ts` + `rlsPolicyIntent.test.ts`
- `src/lib/rlsLive.test.ts`
- `docs/rls-audit.md` (this file)
