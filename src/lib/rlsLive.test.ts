/**
 * Live RLS checks against the configured Supabase project.
 * Requires `.env.local` with VITE_SUPABASE_* and demo users
 * (admin@ras-sitesafe-demo.com / framer@… / testpassword).
 * Skips the whole file when env or login is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const DEMO_PASSWORD = 'testpassword'
const ADMIN_EMAIL = 'admin@ras-sitesafe-demo.com'
const FRAMER_EMAIL = 'framer@ras-sitesafe-demo.com'

function loadEnvLocal(): Record<string, string> {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i <= 0) continue
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim()
  }
  return out
}

const env = loadEnvLocal()
const url = env.VITE_SUPABASE_URL?.trim() ?? ''
const anon = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const configured = url.length > 0 && anon.length > 0

async function signIn(email: string): Promise<SupabaseClient | null> {
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await sb.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  })
  if (error) return null
  return sb
}

describe.skipIf(!configured)('RLS live (Supabase demo project)', () => {
  let admin: SupabaseClient
  let framer: SupabaseClient
  let adminId = ''
  let framerId = ''
  let ready = false
  let skipReason = ''

  beforeAll(async () => {
    const a = await signIn(ADMIN_EMAIL)
    const f = await signIn(FRAMER_EMAIL)
    if (!a || !f) {
      skipReason =
        'Could not sign in demo users (admin@… / framer@… / testpassword). Seed Auth users or skip live RLS.'
      return
    }
    admin = a
    framer = f
    adminId = (await admin.auth.getUser()).data.user?.id ?? ''
    framerId = (await framer.auth.getUser()).data.user?.id ?? ''
    if (!adminId || !framerId) {
      skipReason = 'Missing auth user ids after sign-in.'
      return
    }
    ready = true
  }, 30_000)

  afterAll(async () => {
    await admin?.auth.signOut()
    await framer?.auth.signOut()
  })

  it('env + demo logins available', () => {
    if (!ready) {
      console.warn(`[rls-live] SKIP suite body: ${skipReason}`)
    }
    expect(configured).toBe(true)
    expect(ready, skipReason || 'demo logins').toBe(true)
  })

  it('framer cannot self-promote to admin (Part 10)', async ({ skip }) => {
    if (!ready) skip()
    const { data: before } = await framer
      .from('profiles')
      .select('role')
      .eq('id', framerId)
      .single()
    expect(before?.role).toBe('framer')

    const { data: updated, error } = await framer
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', framerId)
      .select('role')

    // Prefer hard deny (error / 0 rows). If rows returned, hole still open — revert + fail.
    if (updated && updated.length > 0 && updated[0].role === 'admin') {
      await admin.from('profiles').update({ role: 'framer' }).eq('id', framerId)
      expect.fail(
        'RLS hole: framer updated profiles.role to admin. Run migration 20261004000900 / Part 10 SQL, then re-test.',
      )
    }
    expect(error || updated?.length === 0).toBeTruthy()
    const { data: after } = await framer
      .from('profiles')
      .select('role')
      .eq('id', framerId)
      .single()
    expect(after?.role).toBe('framer')
  })

  it('framer cannot insert sites or assignments; admin_list_framers denied', async ({
    skip,
  }) => {
    if (!ready) skip()
    const { error: siteErr } = await framer.from('sites').insert({ name: '__rls_probe_site__' })
    expect(siteErr?.code ?? siteErr?.message).toBeTruthy()

    const { data: sites } = await admin.from('sites').select('id').limit(1)
    const siteId = sites?.[0]?.id
    expect(siteId).toBeTruthy()
    const { error: assignErr } = await framer.from('site_assignments').insert({
      site_id: siteId,
      framer_id: framerId,
    })
    expect(assignErr?.code ?? assignErr?.message).toBeTruthy()

    const { error: rpcErr } = await framer.rpc('admin_list_framers')
    expect(rpcErr?.message ?? '').toMatch(/not authorized|42501|permission/i)
  })

  it('framer only sees actively assigned sites (not all admin sites)', async ({
    skip,
  }) => {
    if (!ready) skip()
    const { data: adminSites } = await admin
      .from('sites')
      .select('id')
      .eq('is_active', true)
    const { data: framerSites } = await framer.from('sites').select('id')
    expect((adminSites?.length ?? 0)).toBeGreaterThan(0)
    expect((framerSites?.length ?? 0)).toBeLessThan(adminSites!.length)
  })

  it('framer cannot rewrite a non-draft submission status (Part 10)', async ({
    skip,
  }) => {
    if (!ready) skip()
    const { data: rows } = await framer
      .from('submissions')
      .select('id,status')
      .eq('submitted_by', framerId)
      .neq('status', 'draft')
      .limit(1)
    const target = rows?.[0]
    if (!target) {
      skip()
      return
    }
    const original = target.status
    const { data: flipped } = await framer
      .from('submissions')
      .update({ status: 'draft' })
      .eq('id', target.id)
      .select('id,status')

    if (flipped && flipped.length > 0 && flipped[0].status === 'draft') {
      await admin.from('submissions').update({ status: original }).eq('id', target.id)
      expect.fail(
        'RLS hole: framer flipped non-draft submission to draft. Run migration 20261004000900 / Part 10 SQL.',
      )
    }
    const { data: after } = await framer
      .from('submissions')
      .select('status')
      .eq('id', target.id)
      .single()
    expect(after?.status).toBe(original)
  })

  it('framer cannot read/write saved_reports; admin can select', async ({ skip }) => {
    if (!ready) skip()
    const { data: framerRows, error: framerErr } = await framer
      .from('saved_reports')
      .select('id')
      .limit(5)
    // RLS may return empty list (no error) or a permission error — both deny access.
    expect((framerRows?.length ?? 0) === 0 || framerErr).toBeTruthy()

    const { error: insertErr } = await framer.from('saved_reports').insert({
      created_by: framerId,
      site_name: '__rls_probe__',
      period_year: 2026,
      period_month: 1,
      title: 'probe',
      options: {},
      summary: {},
    })
    expect(insertErr?.code ?? insertErr?.message).toBeTruthy()

    const { error: adminErr } = await admin.from('saved_reports').select('id').limit(1)
    expect(adminErr).toBeNull()
  })

  it('framer safety_issues / CAs scoped to own submissions', async ({ skip }) => {
    if (!ready) skip()
    const { data: adminIssues } = await admin
      .from('safety_issues')
      .select('id,submission_id')
      .limit(20)
    const { data: framerIssues } = await framer
      .from('safety_issues')
      .select('id,submission_id')
      .limit(50)

    for (const issue of framerIssues ?? []) {
      const { data: sub } = await framer
        .from('submissions')
        .select('submitted_by')
        .eq('id', issue.submission_id)
        .maybeSingle()
      expect(sub?.submitted_by).toBe(framerId)
    }

    // If admin can see an issue the framer cannot, isolation holds.
    const framerIds = new Set((framerIssues ?? []).map((i) => i.id))
    const foreign = (adminIssues ?? []).find((i) => !framerIds.has(i.id))
    if (foreign) {
      const { data: leak } = await framer
        .from('safety_issues')
        .select('id')
        .eq('id', foreign.id)
      expect(leak?.length ?? 0).toBe(0)
    }

    const { data: framerCas } = await framer
      .from('corrective_actions')
      .select('id,status,safety_issue_id')
      .limit(50)
    for (const ca of framerCas ?? []) {
      const { data: si } = await framer
        .from('safety_issues')
        .select('submission_id')
        .eq('id', ca.safety_issue_id)
        .maybeSingle()
      expect(si?.submission_id).toBeTruthy()
    }

    // Foreign CA update must not succeed
    const { data: allCas } = await admin
      .from('corrective_actions')
      .select('id,safety_issue_id,status')
      .limit(30)
    for (const ca of allCas ?? []) {
      const { data: si } = await admin
        .from('safety_issues')
        .select('submission_id')
        .eq('id', ca.safety_issue_id)
        .single()
      const { data: sub } = await admin
        .from('submissions')
        .select('submitted_by')
        .eq('id', si!.submission_id)
        .single()
      if (sub?.submitted_by !== framerId && ['open', 'in_progress'].includes(ca.status)) {
        const { data: touched } = await framer
          .from('corrective_actions')
          .update({ status: 'ready_for_review' })
          .eq('id', ca.id)
          .select('id')
        expect(touched?.length ?? 0).toBe(0)
        break
      }
    }
  })

  it('admin can list framers via RPC', async ({ skip }) => {
    if (!ready) skip()
    const { data, error } = await admin.rpc('admin_list_framers')
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect((data as { email?: string }[]).some((r) => r.email === FRAMER_EMAIL)).toBe(
      true,
    )
  })
})

describe.runIf(!configured)('RLS live (skipped — no env)', () => {
  it('skips gracefully when .env.local lacks Supabase credentials', () => {
    console.warn(
      '[rls-live] Skipped: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env.local to run live RLS tests.',
    )
    expect(configured).toBe(false)
  })
})
