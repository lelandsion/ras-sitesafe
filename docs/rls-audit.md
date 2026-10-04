# RAS SiteSafe — RLS audit

**Grade: B− live / A− after Part 10**  
**Part 10 applied on live DB? NO** — run `supabase/migrations/20261004000900_rls_harden_profiles_submissions.sql` (store **Part 10** in `docs/supabase-manual-sql.md`).  
**Branch:** [`cursor/rls-audit-tests-d61f`](https://github.com/lelandsion/ras-sitesafe/tree/cursor/rls-audit-tests-d61f) · deeper live pass 2026-10-04  
**Demo framer role:** restored to `framer` after probes.

## Verdict

Tenancy is **robust** against framer↔admin and anonymous abuse (sites, assignments, submissions, photos, storage paths, issues/CAs, saved reports, RPC). Two **critical/high holes remain open on the live project** because Part 10 was never applied: role self-promotion and post-submit status rewrite. Ship Part 10, re-run live suite — expect full green.

## Deeper live pass (Vitest `src/lib/rlsLive.test.ts`)

| Result | Count |
| --- | --- |
| Pass | **15** |
| Fail (Part 10 only) | **2** |
| Skip | 1 (no-env branch) |

### Passed
- Anonymous: no SELECT leak on all tenancy tables; no INSERT sites/submissions
- Profiles: framer cannot read/update admin; admin reads framer; `admin_list_framers` allow/deny
- Sites: active-assignment visibility; no insert; no update on unassigned site (0 rows)
- Assignments: no write; own history readable; foreign assignments hidden; unassigned-site submit denied
- Submissions: draft create/update/submit works; **cross-tenant** admin-owned row invisible/unwritable to framer
- Photos metadata: foreign submission photos hidden; cannot attach to foreign submission
- Storage: upload to other uid folder denied (RLS); own folder OK; anon download blocked; list other folder empty
- CA: framer reads own; cannot insert/resolve/rewrite `required_action`; can `ready_for_review`; foreign CA invisible
- Saved reports: framer denied; admin select OK

### Failed (expected until Part 10)
1. Framer `profiles.role` → `admin` (self-promote) — **still works on live**
2. Framer submitted → `draft` flip — **still works on live**

### Coverage gap
- True **second Auth framer** not creatable (signup domain/rate-limit). Cross-owner isolation covered via **admin-owned** submissions/issues/CAs/photos instead.

## Residual risks
1. **Part 10 not applied** — privilege escalation + status tamper (must run SQL)
2. No second demo framer for peer-to-peer proof
3. Storage scoped by uid folder only (not submission FK) — acceptable with photos-table RLS
4. Soft-unassigned assignment **history** still visible to that framer (by design for compliance)

## SQL to run
Supabase SQL Editor → paste migration `20261004000900…` / store Part 10 → then:

```bash
npm run test:run -- src/lib/rlsLive.test.ts
```

Expect **0 failures**.
