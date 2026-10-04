import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  hasSecurityDefinerFunction,
  mentionsAuthUid,
  mentionsIsAdmin,
  parseCreatePolicies,
  requiresActiveAssignment,
  scopesToOwnSubmission,
} from './rlsPolicyIntent'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), 'utf8')
}

function allMigrationSql(): string {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readMigration(f))
    .join('\n\n')
}

describe('RLS policy intent (static)', () => {
  const core = readMigration('20261002000100_sitesafe_schema.sql')
  const ca = readMigration('20261002000600_corrective_actions.sql')
  const history = readMigration('20261002000700_site_assignment_history.sql')
  const framerCa = readMigration('20261003000801_framer_ca_ready_for_review_rls.sql')
  const harden = readMigration('20261004000900_rls_harden_profiles_submissions.sql')
  const bundled = allMigrationSql()

  it('ships SECURITY DEFINER helpers with pinned search_path', () => {
    expect(hasSecurityDefinerFunction(core, 'is_admin')).toBe(true)
    expect(hasSecurityDefinerFunction(core, 'current_user_role')).toBe(true)
    expect(hasSecurityDefinerFunction(core, 'handle_new_user')).toBe(true)
    expect(core).toMatch(/set\s+search_path\s*=\s*public/i)
  })

  it('admin_list_framers rejects non-admins before querying auth.users', () => {
    const dir = readMigration('20261002000200_admin_framer_directory.sql')
    expect(hasSecurityDefinerFunction(dir, 'admin_list_framers')).toBe(true)
    expect(dir).toMatch(/if\s+not\s+public\.is_admin\s*\(\s*\)/i)
    expect(dir).toMatch(/grant\s+execute[\s\S]*authenticated/i)
    expect(dir).toMatch(/revoke\s+all[\s\S]*from\s+public/i)
  })

  it('profiles select/update require own row or admin', () => {
    const policies = parseCreatePolicies(core)
    const select = policies.find((p) => p.name === 'profiles_select_own_or_admin')
    const update = policies.find((p) => p.name === 'profiles_update_own_or_admin')
    expect(select?.op).toBe('select')
    expect(mentionsAuthUid(select?.using)).toBe(true)
    expect(mentionsIsAdmin(select?.using)).toBe(true)
    expect(mentionsAuthUid(update?.using)).toBe(true)
    expect(mentionsIsAdmin(update?.withCheck)).toBe(true)
  })

  it('hardening migration blocks non-admin role changes + signup role metadata', () => {
    expect(harden).toMatch(/profiles_role_guard/i)
    expect(harden).toMatch(/Only admins can change roles/i)
    expect(harden).toMatch(
      /new\.role\s+is\s+distinct\s+from\s+old\.role\s+and\s+not\s+public\.is_admin/i,
    )
    // handle_new_user must force framer (no metadata role cast)
    expect(harden).toMatch(/values\s*\([\s\S]*'framer'/i)
    expect(harden).not.toMatch(
      /raw_user_meta_data->>'role'\)::public\.user_role/,
    )
  })

  it('sites: framer visibility uses active assignment after Part 8', () => {
    const policies = parseCreatePolicies(history)
    const select = policies.find((p) => p.name === 'sites_select_admin_or_assigned')
    expect(requiresActiveAssignment(select?.using)).toBe(true)
    const insert = policies.find((p) => p.name === 'submissions_insert_own_framer')
    expect(requiresActiveAssignment(insert?.withCheck)).toBe(true)
  })

  it('submissions: select scopes to own or admin; delete drafts only for framer', () => {
    const policies = parseCreatePolicies(core)
    const select = policies.find((p) => p.name === 'submissions_select_own_or_admin')
    const del = policies.find((p) => p.name === 'submissions_delete_own_draft_or_admin')
    expect(scopesToOwnSubmission(select?.using)).toBe(true)
    expect(del?.using).toMatch(/status\s*=\s*'draft'/i)
    expect(mentionsIsAdmin(del?.using)).toBe(true)
  })

  it('hardening: framer submission updates only from draft → draft|submitted', () => {
    const policies = parseCreatePolicies(harden)
    const admin = policies.find((p) => p.name === 'submissions_update_admin')
    const framer = policies.find((p) => p.name === 'submissions_update_own_draft')
    expect(admin?.using).toMatch(/is_admin/i)
    expect(framer?.using).toMatch(/status\s*=\s*'draft'/i)
    expect(framer?.withCheck).toMatch(/'submitted'/i)
    expect(harden).toMatch(/submissions_framer_update_guard/i)
    expect(harden).toMatch(/reviewed_by\s*:=\s*old\.reviewed_by/i)
  })

  it('photos policies join parent submission ownership', () => {
    const policies = parseCreatePolicies(core).filter((p) =>
      p.name.startsWith('photos_'),
    )
    expect(policies.length).toBeGreaterThanOrEqual(3)
    for (const p of policies) {
      expect(p.using || p.withCheck).toMatch(/submissions/i)
      expect(mentionsAuthUid(p.using || p.withCheck)).toBe(true)
      expect(mentionsIsAdmin(p.using || p.withCheck)).toBe(true)
    }
  })

  it('safety_issues: framer write limited; draft required for update/delete', () => {
    const policies = parseCreatePolicies(ca)
    const update = policies.find((p) => p.name === 'safety_issues_update_own_or_admin')
    const del = policies.find((p) => p.name === 'safety_issues_delete_own_draft_or_admin')
    expect(update?.using).toMatch(/status\s*=\s*'draft'/i)
    expect(del?.using).toMatch(/status\s*=\s*'draft'/i)
    expect(mentionsAuthUid(update?.using)).toBe(true)
  })

  it('corrective_actions: admin write; framer ready_for_review guard', () => {
    const base = parseCreatePolicies(ca)
    expect(base.find((p) => p.name === 'corrective_actions_insert_admin')?.withCheck).toMatch(
      /is_admin/i,
    )
    expect(base.find((p) => p.name === 'corrective_actions_delete_admin')?.using).toMatch(
      /is_admin/i,
    )
    const framerUpdate = parseCreatePolicies(framerCa).find(
      (p) => p.name === 'corrective_actions_update_framer_ready',
    )
    expect(framerUpdate?.using).toMatch(/not\s+public\.is_admin/i)
    expect(framerUpdate?.using).toMatch(/'open'|'in_progress'/i)
    expect(framerUpdate?.withCheck).toMatch(/ready_for_review/i)
    expect(framerCa).toMatch(/corrective_actions_framer_update_guard/i)
    expect(framerCa).toMatch(/required_action\s*:=\s*old\.required_action/i)
  })

  it('saved_reports is admin-only', () => {
    const sql = readMigration('20261002000500_saved_reports.sql')
    const policy = parseCreatePolicies(sql).find((p) => p.name === 'saved_reports_admin_all')
    expect(policy?.op).toBe('all')
    expect(mentionsIsAdmin(policy?.using)).toBe(true)
    expect(mentionsIsAdmin(policy?.withCheck)).toBe(true)
  })

  it('storage policies scope to own uid folder or admin', () => {
    const policies = parseCreatePolicies(core).filter((p) =>
      p.name.startsWith('storage_photos_'),
    )
    expect(policies.length).toBe(4)
    for (const p of policies) {
      const expr = `${p.using ?? ''} ${p.withCheck ?? ''}`
      expect(expr).toMatch(/submission-photos/)
      expect(expr).toMatch(/foldername|auth\.uid/i)
    }
    const insert = policies.find((p) => p.op === 'insert')
    expect(insert?.withCheck).toMatch(/auth\.uid/i)
    expect(insert?.withCheck).not.toMatch(/is_admin/i)
  })

  it('bundled migrations keep is_admin helper definition', () => {
    expect(bundled).toMatch(/create\s+or\s+replace\s+function\s+public\.is_admin/i)
    expect(parseCreatePolicies(bundled).length).toBeGreaterThan(15)
  })
})
