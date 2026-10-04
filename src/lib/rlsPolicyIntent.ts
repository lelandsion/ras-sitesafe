/**
 * Static helpers for RLS policy intent tests.
 * Parses migration SQL text (no DB required) so CI can catch regressions
 * in privilege boundaries even when live Supabase is unavailable.
 */

export type PolicyOp = 'select' | 'insert' | 'update' | 'delete' | 'all'

export type ParsedPolicy = {
  name: string
  table: string
  op: PolicyOp
  roles: string[]
  using?: string
  withCheck?: string
}

const POLICY_RE =
  /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.|storage\.)?(\w+)\s+for\s+(select|insert|update|delete|all)\s+to\s+([^\n]+)\s*(?:using\s*\(([\s\S]*?)\))?\s*(?:with\s+check\s*\(([\s\S]*?)\))?\s*;/gi

export function parseCreatePolicies(sql: string): ParsedPolicy[] {
  const out: ParsedPolicy[] = []
  for (const match of sql.matchAll(POLICY_RE)) {
    out.push({
      name: match[1],
      table: match[2],
      op: match[3].toLowerCase() as PolicyOp,
      roles: match[4]
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean),
      using: match[5]?.replace(/\s+/g, ' ').trim(),
      withCheck: match[6]?.replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}

export function hasSecurityDefinerFunction(sql: string, name: string): boolean {
  const re = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\)\\s*[\\s\\S]*?security\\s+definer`,
    'i',
  )
  return re.test(sql)
}

export function mentionsAuthUid(expr: string | undefined): boolean {
  return Boolean(expr && /auth\.uid\s*\(\s*\)/i.test(expr))
}

export function mentionsIsAdmin(expr: string | undefined): boolean {
  return Boolean(expr && /public\.is_admin\s*\(\s*\)/i.test(expr))
}

/** True when policy expression scopes framers to own rows via submitted_by. */
export function scopesToOwnSubmission(expr: string | undefined): boolean {
  return Boolean(
    expr &&
      /submitted_by\s*=\s*auth\.uid\s*\(\s*\)/i.test(expr) &&
      mentionsIsAdmin(expr),
  )
}

/** True when sites visibility requires an active assignment (Part 8). */
export function requiresActiveAssignment(expr: string | undefined): boolean {
  return Boolean(
    expr &&
      /site_assignments/i.test(expr) &&
      /unassigned_at\s+is\s+null/i.test(expr),
  )
}
