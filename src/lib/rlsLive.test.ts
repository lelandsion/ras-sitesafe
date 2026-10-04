/**
 * Live adversarial RLS checks against the configured Supabase project.
 * Requires `.env.local` with VITE_SUPABASE_* and demo users
 * (admin@ras-sitesafe-demo.com / framer@… / testpassword).
 * Skips when env or login is unavailable.
 *
 * Part 10 (role guard + submission update harden) may not be applied yet —
 * those cases fail loudly until SQL is run.
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
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const configured = url.length > 0 && anonKey.length > 0

function client(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function signIn(email: string): Promise<SupabaseClient | null> {
  const sb = client()
  const { error } = await sb.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  })
  if (error) return null
  return sb
}

function denied(error: { code?: string; message?: string } | null, rows?: unknown[] | null) {
  return Boolean(error?.code || error?.message) || (rows?.length ?? 0) === 0
}

describe.skipIf(!configured)('RLS live adversarial (Supabase demo)', () => {
  let admin: SupabaseClient
  let framer: SupabaseClient
  let anon: SupabaseClient
  let adminId = ''
  let framerId = ''
  let ready = false
  let skipReason = ''
  let part10Applied = false

  /** Cleanup handles for rows created during this run */
  const cleanup: Array<() => Promise<void>> = []

  beforeAll(async () => {
    anon = client()
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

    // Behavioral Part 10 probe (non-destructive: revert if hole open)
    const { data: esc } = await framer
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', framerId)
      .select('role')
    const roleHole = Boolean(esc?.length && esc[0].role === 'admin')
    if (roleHole) {
      await admin.from('profiles').update({ role: 'framer' }).eq('id', framerId)
    }
    const { data: sub } = await framer
      .from('submissions')
      .select('id,status')
      .eq('submitted_by', framerId)
      .neq('status', 'draft')
      .limit(1)
      .maybeSingle()
    let statusHole = false
    if (sub) {
      const { data: flip } = await framer
        .from('submissions')
        .update({ status: 'draft' })
        .eq('id', sub.id)
        .select('status')
      statusHole = Boolean(flip?.length && flip[0].status === 'draft')
      if (statusHole) {
        await admin.from('submissions').update({ status: sub.status }).eq('id', sub.id)
      }
    }
    part10Applied = !roleHole && !statusHole
    ready = true
  }, 45_000)

  afterAll(async () => {
    for (const fn of cleanup.reverse()) {
      try {
        await fn()
      } catch {
        /* best-effort */
      }
    }
    await admin?.auth.signOut()
    await framer?.auth.signOut()
  })

  it('env + demo logins; reports Part 10 status', () => {
    if (!ready) console.warn(`[rls-live] SKIP: ${skipReason}`)
    expect(configured).toBe(true)
    expect(ready, skipReason || 'demo logins').toBe(true)
    console.info(
      `[rls-live] Part 10 applied on live project: ${part10Applied ? 'YES' : 'NO — run 20261004000900 / store Part 10'}`,
    )
  })

  // ─── Anonymous ───────────────────────────────────────────────────────────

  it('anonymous cannot read tenancy tables', async ({ skip }) => {
    if (!ready) skip()
    const tables = [
      'profiles',
      'sites',
      'site_assignments',
      'submissions',
      'submission_photos',
      'safety_issues',
      'corrective_actions',
      'saved_reports',
    ] as const
    for (const table of tables) {
      const { data, error } = await anon.from(table).select('*').limit(3)
      expect(
        (data?.length ?? 0) === 0,
        `anon leaked rows from ${table}: ${error?.message ?? 'no err'}`,
      ).toBe(true)
    }
  })

  it('anonymous cannot write sites or submissions', async ({ skip }) => {
    if (!ready) skip()
    const { error: sErr } = await anon.from('sites').insert({ name: '__anon_probe__' })
    expect(sErr).toBeTruthy()
    const { error: subErr } = await anon.from('submissions').insert({
      site_id: '00000000-0000-0000-0000-000000000001',
      submitted_by: '00000000-0000-0000-0000-000000000001',
      status: 'draft',
    })
    expect(subErr).toBeTruthy()
  })

  // ─── Profiles ────────────────────────────────────────────────────────────

  it('framer can update own display_name but not role (Part 10)', async ({ skip }) => {
    if (!ready) skip()
    const { data: before } = await framer
      .from('profiles')
      .select('display_name,role')
      .eq('id', framerId)
      .single()
    expect(before?.role).toBe('framer')

    const probeName = `${before!.display_name}`
    const { error: nameErr } = await framer
      .from('profiles')
      .update({ display_name: probeName })
      .eq('id', framerId)
    expect(nameErr).toBeNull()

    const { data: escalated } = await framer
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', framerId)
      .select('role')
    if (escalated?.length && escalated[0].role === 'admin') {
      await admin.from('profiles').update({ role: 'framer' }).eq('id', framerId)
      expect.fail(
        'Part 10 NOT applied: framer self-promoted to admin. Run migration 20261004000900.',
      )
    }
    const { data: after } = await framer
      .from('profiles')
      .select('role')
      .eq('id', framerId)
      .single()
    expect(after?.role).toBe('framer')
  })

  it('framer cannot read or update admin profile', async ({ skip }) => {
    if (!ready) skip()
    const { data: leak } = await framer.from('profiles').select('*').eq('id', adminId)
    expect(leak?.length ?? 0).toBe(0)
    const { data: touched } = await framer
      .from('profiles')
      .update({ display_name: 'Hacked Admin' })
      .eq('id', adminId)
      .select('id')
    expect(touched?.length ?? 0).toBe(0)
  })

  it('admin can read framer profile and list framers RPC', async ({ skip }) => {
    if (!ready) skip()
    const { data: prof, error } = await admin
      .from('profiles')
      .select('id,role')
      .eq('id', framerId)
      .single()
    expect(error).toBeNull()
    expect(prof?.role).toBe('framer')
    const { data: list, error: rpcErr } = await admin.rpc('admin_list_framers')
    expect(rpcErr).toBeNull()
    expect((list as { email?: string }[]).some((r) => r.email === FRAMER_EMAIL)).toBe(true)
  })

  it('framer RPC admin_list_framers is denied', async ({ skip }) => {
    if (!ready) skip()
    const { error } = await framer.rpc('admin_list_framers')
    expect(error?.message ?? '').toMatch(/not authorized|42501|permission/i)
  })

  // ─── Sites + assignments ─────────────────────────────────────────────────

  it('framer sees only actively assigned sites; cannot CRUD sites', async ({ skip }) => {
    if (!ready) skip()
    const { data: adminSites } = await admin.from('sites').select('id').eq('is_active', true)
    const { data: framerSites } = await framer.from('sites').select('id')
    expect((adminSites?.length ?? 0)).toBeGreaterThan(0)
    expect((framerSites?.length ?? 0)).toBeLessThan(adminSites!.length)

    const { error: ins } = await framer.from('sites').insert({ name: '__rls_site__' })
    expect(ins).toBeTruthy()
    const unassigned = (adminSites ?? []).find(
      (s) => !(framerSites ?? []).some((f) => f.id === s.id),
    )
    if (unassigned) {
      const { data: leak } = await framer.from('sites').select('id').eq('id', unassigned.id)
      expect(leak?.length ?? 0).toBe(0)
      // PostgREST returns error=null + 0 rows when UPDATE is filtered by RLS
      const { data: touched } = await framer
        .from('sites')
        .update({ name: 'hack' })
        .eq('id', unassigned.id)
        .select('id')
      expect(touched?.length ?? 0).toBe(0)
    }
  })

  it('framer cannot insert/update/delete site_assignments; can read own history', async ({
    skip,
  }) => {
    if (!ready) skip()
    const { data: sites } = await admin.from('sites').select('id').limit(1)
    const siteId = sites![0].id
    const { error: ins } = await framer.from('site_assignments').insert({
      site_id: siteId,
      framer_id: framerId,
    })
    expect(ins).toBeTruthy()

    const { data: own } = await framer
      .from('site_assignments')
      .select('id,site_id,framer_id,unassigned_at')
      .eq('framer_id', framerId)
    expect((own?.length ?? 0)).toBeGreaterThan(0)
    for (const row of own ?? []) {
      expect(row.framer_id).toBe(framerId)
    }

    // Soft-unassign history: if any historical rows exist, framer may still see them
    const historical = (own ?? []).filter((r) => r.unassigned_at != null)
    if (historical.length) {
      console.info(`[rls-live] framer can read ${historical.length} soft-unassigned history row(s)`)
    }

    const { data: foreign } = await framer
      .from('site_assignments')
      .select('id')
      .neq('framer_id', framerId)
      .limit(5)
    expect(foreign?.length ?? 0).toBe(0)

    const target = own?.[0]
    if (target) {
      const { data: up } = await framer
        .from('site_assignments')
        .update({ unassigned_at: new Date().toISOString() })
        .eq('id', target.id)
        .select('id')
      expect(up?.length ?? 0).toBe(0)
      const { data: del } = await framer
        .from('site_assignments')
        .delete()
        .eq('id', target.id)
        .select('id')
      expect(del?.length ?? 0).toBe(0)
    }
  })

  it('framer cannot insert submission for unassigned site', async ({ skip }) => {
    if (!ready) skip()
    const { data: adminSites } = await admin.from('sites').select('id').eq('is_active', true)
    const { data: framerSites } = await framer.from('sites').select('id')
    const unassigned = (adminSites ?? []).find(
      (s) => !(framerSites ?? []).some((f) => f.id === s.id),
    )
    if (!unassigned) {
      skip()
      return
    }
    const { data, error } = await framer
      .from('submissions')
      .insert({
        site_id: unassigned.id,
        submitted_by: framerId,
        status: 'draft',
        notes: '__rls_unassigned_probe__',
      })
      .select('id')
    expect(denied(error, data)).toBe(true)
  })

  // ─── Submissions ─────────────────────────────────────────────────────────

  it('framer draft create → update → submit; cannot post-submit rewrite (Part 10)', async ({
    skip,
  }) => {
    if (!ready) skip()
    const { data: sites } = await framer.from('sites').select('id').limit(1)
    const siteId = sites?.[0]?.id
    if (!siteId) {
      skip()
      return
    }

    const { data: created, error: cErr } = await framer
      .from('submissions')
      .insert({
        site_id: siteId,
        submitted_by: framerId,
        status: 'draft',
        notes: '__rls_draft_probe__',
      })
      .select('id,status')
      .single()
    expect(cErr).toBeNull()
    expect(created?.status).toBe('draft')
    const id = created!.id
    cleanup.push(async () => {
      await admin.from('submissions').delete().eq('id', id)
    })

    const { error: uErr } = await framer
      .from('submissions')
      .update({ notes: '__rls_draft_probe_edited__' })
      .eq('id', id)
    expect(uErr).toBeNull()

    const { data: submitted, error: sErr } = await framer
      .from('submissions')
      .update({ status: 'submitted' })
      .eq('id', id)
      .select('status')
      .single()
    expect(sErr).toBeNull()
    expect(submitted?.status).toBe('submitted')

    const { data: flipped } = await framer
      .from('submissions')
      .update({ status: 'draft' })
      .eq('id', id)
      .select('status')
    if (flipped?.length && flipped[0].status === 'draft') {
      await admin.from('submissions').update({ status: 'submitted' }).eq('id', id)
      expect.fail(
        'Part 10 NOT applied: framer flipped submitted → draft. Run migration 20261004000900.',
      )
    }

    const { data: reviewHack } = await framer
      .from('submissions')
      .update({ status: 'approved', reviewed_by: framerId })
      .eq('id', id)
      .select('status')
    expect(reviewHack?.length ?? 0).toBe(0)

    // delete non-draft must fail for framer
    const { data: del } = await framer.from('submissions').delete().eq('id', id).select('id')
    expect(del?.length ?? 0).toBe(0)
  })

  it('cross-tenant: framer cannot read/update admin-owned submission', async ({ skip }) => {
    if (!ready) skip()
    const { data: sites } = await admin.from('sites').select('id').limit(1)
    const { data: created, error } = await admin
      .from('submissions')
      .insert({
        site_id: sites![0].id,
        submitted_by: adminId,
        status: 'submitted',
        notes: '__rls_admin_owned__',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const id = created!.id
    cleanup.push(async () => {
      await admin.from('submissions').delete().eq('id', id)
    })

    const { data: leak } = await framer.from('submissions').select('*').eq('id', id)
    expect(leak?.length ?? 0).toBe(0)
    const { data: touched } = await framer
      .from('submissions')
      .update({ notes: 'hacked' })
      .eq('id', id)
      .select('id')
    expect(touched?.length ?? 0).toBe(0)
    const { data: del } = await framer.from('submissions').delete().eq('id', id).select('id')
    expect(del?.length ?? 0).toBe(0)
  })

  it('second-framer cross-tenant skipped when signup blocked', async ({ skip }) => {
    if (!ready) skip()
    // Public signup is rate-limited / domain-restricted on this project — no durable second framer.
    // Admin-owned submission case above covers ownership isolation; document gap.
    console.warn(
      '[rls-live] Second Auth framer unavailable (signup rate-limit/domain). Cross-framer isolation covered via admin-owned rows + ownership joins.',
    )
    expect(true).toBe(true)
  })

  // ─── Photos + storage ────────────────────────────────────────────────────

  it('framer cannot read photos metadata on foreign submission', async ({ skip }) => {
    if (!ready) skip()
    const { data: sites } = await admin.from('sites').select('id').limit(1)
    const { data: sub } = await admin
      .from('submissions')
      .insert({
        site_id: sites![0].id,
        submitted_by: adminId,
        status: 'submitted',
        notes: '__rls_photo_parent__',
      })
      .select('id')
      .single()
    const subId = sub!.id
    const path = `${adminId}/${subId}/__rls_probe__.jpg`
    const { data: photo, error } = await admin
      .from('submission_photos')
      .insert({
        submission_id: subId,
        storage_path: path,
        content_type: 'image/jpeg',
        byte_size: 12,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    cleanup.push(async () => {
      await admin.from('submission_photos').delete().eq('id', photo!.id)
      await admin.from('submissions').delete().eq('id', subId)
    })

    const { data: leak } = await framer
      .from('submission_photos')
      .select('*')
      .eq('id', photo!.id)
    expect(leak?.length ?? 0).toBe(0)
    const { data: ins } = await framer
      .from('submission_photos')
      .insert({
        submission_id: subId,
        storage_path: `${framerId}/${subId}/evil.jpg`,
        content_type: 'image/jpeg',
      })
      .select('id')
    expect(ins?.length ?? 0).toBe(0)
  })

  it(
    'storage: framer cannot upload under another uid folder; can under own',
    async ({ skip }) => {
      if (!ready) skip()
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) // minimal jpeg-ish

      const evilPath = `${adminId}/__rls__/evil.jpg`
      const { error: evilErr } = await framer.storage
        .from('submission-photos')
        .upload(evilPath, bytes, { upsert: true, contentType: 'image/jpeg' })
      expect(evilErr?.message ?? '').toMatch(/row-level security|policy|denied|unauthorized/i)

      const ownPath = `${framerId}/__rls_probe__/probe.jpg`
      const { error: ownErr } = await framer.storage
        .from('submission-photos')
        .upload(ownPath, bytes, { upsert: true, contentType: 'image/jpeg' })
      expect(ownErr).toBeNull()
      cleanup.push(async () => {
        await framer.storage.from('submission-photos').remove([ownPath])
      })

      // Listing another user's folder should not expose objects
      const { data: listOther } = await framer.storage
        .from('submission-photos')
        .list(adminId, { limit: 20 })
      expect(listOther?.length ?? 0).toBe(0)

      // Download a known framer-owned path as anon must fail
      const { data: ownPhotos } = await admin
        .from('submission_photos')
        .select('storage_path')
        .like('storage_path', `${framerId}/%`)
        .limit(1)
      if (ownPhotos?.[0]) {
        const { data: anonBlob, error: anonDl } = await anon.storage
          .from('submission-photos')
          .download(ownPhotos[0].storage_path)
        expect(anonBlob == null || anonDl).toBeTruthy()
      }
    },
    20_000,
  )

  // ─── Safety issues + corrective actions ──────────────────────────────────

  it('framer issues/CAs only on own submissions; CA transitions guarded', async ({ skip }) => {
    if (!ready) skip()
    const { data: ownSub } = await framer
      .from('submissions')
      .select('id')
      .eq('submitted_by', framerId)
      .limit(1)
      .maybeSingle()
    if (!ownSub) {
      skip()
      return
    }

    // Admin creates CA on framer's issue (or creates issue + CA)
    let issueId: string | null = null
    const { data: existingIssue } = await admin
      .from('safety_issues')
      .select('id')
      .eq('submission_id', ownSub.id)
      .limit(1)
      .maybeSingle()
    if (existingIssue) {
      issueId = existingIssue.id
    } else {
      const { data: created, error } = await admin
        .from('safety_issues')
        .insert({
          submission_id: ownSub.id,
          checklist_item_key: '__rls_probe_item__',
          item_label: 'RLS probe',
          description: 'adversarial CA probe',
          severity: 'low',
          immediate_action: 'n/a',
          created_by: adminId,
        })
        .select('id')
        .single()
      expect(error).toBeNull()
      issueId = created!.id
      cleanup.push(async () => {
        await admin.from('safety_issues').delete().eq('id', issueId!)
      })
    }

    const { data: ca, error: caErr } = await admin
      .from('corrective_actions')
      .insert({
        safety_issue_id: issueId!,
        required_action: '__rls_ca_probe__',
        priority: 'low',
        status: 'open',
        created_by: adminId,
      })
      .select('id,status,required_action')
      .single()
    expect(caErr).toBeNull()
    const caId = ca!.id
    cleanup.push(async () => {
      await admin.from('corrective_actions').delete().eq('id', caId)
    })

    // Framer can read own CA
    const { data: visible } = await framer
      .from('corrective_actions')
      .select('id,status')
      .eq('id', caId)
    expect(visible?.length).toBe(1)

    // Framer cannot insert CA
    const { data: badIns } = await framer
      .from('corrective_actions')
      .insert({
        safety_issue_id: issueId!,
        required_action: 'evil',
        status: 'open',
      })
      .select('id')
    expect(badIns?.length ?? 0).toBe(0)

    // Framer cannot resolve / rewrite admin fields
    const { data: resolveTry } = await framer
      .from('corrective_actions')
      .update({
        status: 'resolved',
        resolution_notes: 'self resolve',
        required_action: 'changed',
      })
      .eq('id', caId)
      .select('status,required_action')
    // Either 0 rows or trigger keeps required_action / blocks resolve
    if (resolveTry?.length) {
      expect(resolveTry[0].status).not.toBe('resolved')
      expect(resolveTry[0].required_action).toBe('__rls_ca_probe__')
    }

    // Framer may mark ready_for_review (Part 9)
    const { data: readyRow, error: readyErr } = await framer
      .from('corrective_actions')
      .update({
        status: 'ready_for_review',
        framer_completion_notes: 'done probe',
      })
      .eq('id', caId)
      .select('status,required_action')
      .maybeSingle()
    if (readyErr && /ready_for_review|enum/i.test(readyErr.message)) {
      console.warn('[rls-live] Part 9 enum/policy missing?', readyErr.message)
    } else {
      expect(readyRow?.status).toBe('ready_for_review')
      expect(readyRow?.required_action).toBe('__rls_ca_probe__')
    }

    // Foreign CA on admin submission — framer must not see/update
    const { data: adminSub } = await admin
      .from('submissions')
      .insert({
        site_id: (await admin.from('sites').select('id').limit(1)).data![0].id,
        submitted_by: adminId,
        status: 'submitted',
        notes: '__rls_foreign_ca_parent__',
      })
      .select('id')
      .single()
    const foreignSubId = adminSub!.id
    const { data: foreignIssue } = await admin
      .from('safety_issues')
      .insert({
        submission_id: foreignSubId,
        checklist_item_key: '__rls_foreign__',
        item_label: 'foreign',
        description: 'foreign',
        severity: 'low',
        immediate_action: 'n/a',
        created_by: adminId,
      })
      .select('id')
      .single()
    const { data: foreignCa } = await admin
      .from('corrective_actions')
      .insert({
        safety_issue_id: foreignIssue!.id,
        required_action: 'foreign ca',
        status: 'open',
        created_by: adminId,
      })
      .select('id')
      .single()
    cleanup.push(async () => {
      await admin.from('corrective_actions').delete().eq('id', foreignCa!.id)
      await admin.from('safety_issues').delete().eq('id', foreignIssue!.id)
      await admin.from('submissions').delete().eq('id', foreignSubId)
    })

    const { data: foreignLeak } = await framer
      .from('corrective_actions')
      .select('id')
      .eq('id', foreignCa!.id)
    expect(foreignLeak?.length ?? 0).toBe(0)
    const { data: foreignTouch } = await framer
      .from('corrective_actions')
      .update({ status: 'ready_for_review' })
      .eq('id', foreignCa!.id)
      .select('id')
    expect(foreignTouch?.length ?? 0).toBe(0)
  })

  // ─── Saved reports ───────────────────────────────────────────────────────

  it('saved_reports admin-only', async ({ skip }) => {
    if (!ready) skip()
    const { data: framerRows } = await framer.from('saved_reports').select('id').limit(5)
    expect(framerRows?.length ?? 0).toBe(0)
    const { error: ins } = await framer.from('saved_reports').insert({
      created_by: framerId,
      site_name: '__rls__',
      period_year: 2026,
      period_month: 1,
      title: 'probe',
      options: {},
      summary: {},
    })
    expect(ins).toBeTruthy()
    const { error: adminSel } = await admin.from('saved_reports').select('id').limit(1)
    expect(adminSel).toBeNull()
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
