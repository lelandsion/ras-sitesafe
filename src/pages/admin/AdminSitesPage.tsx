import { useCallback, useEffect, useState } from 'react'
import {
  FileWarning,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
import { AdminNav } from '../../components/admin/AdminNav'
import { AssignWorkersModal } from '../../components/admin/AssignWorkersModal'
import { SiteFormModal } from '../../components/admin/SiteFormModal'
import { AppHeader } from '../../components/layout/AppHeader'
import { useAuth } from '../../hooks/auth-context'
import {
  createSite,
  listAdminSites,
  updateSite,
  type SiteUpsertInput,
} from '../../services/sitesService'
import type { Site, SiteWithAssignmentCount } from '../../types/database'

export function AdminSitesPage() {
  const { profile, signOut } = useAuth()
  const [sites, setSites] = useState<SiteWithAssignmentCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [assignSite, setAssignSite] = useState<SiteWithAssignmentCount | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: listError } = await listAdminSites()
    if (listError) {
      setError(listError)
      setSites([])
    } else {
      setSites(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditingSite(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(site: SiteWithAssignmentCount) {
    setEditingSite(site)
    setFormError(null)
    setFormOpen(true)
  }

  async function onSaveSite(input: SiteUpsertInput) {
    setSaving(true)
    setFormError(null)
    const result = editingSite
      ? await updateSite(editingSite.id, input)
      : await createSite(input)
    if (result.error || !result.data) {
      setFormError(result.error ?? 'Could not save site.')
      setSaving(false)
      return
    }
    setSaving(false)
    setFormOpen(false)
    setEditingSite(null)
    await load()
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <section className="admin-dash" aria-labelledby="admin-sites-title">
          <div className="admin-dash__head">
            <div>
              <p className="admin-dash__kicker">Admin</p>
              <h2 id="admin-sites-title" className="admin-dash__title">
                Jobsites
                <span>Manage test sites &amp; crew assignments</span>
              </h2>
              <p className="admin-dash__lead">
                Signed in as{' '}
                <strong>{profile?.display_name ?? 'Admin'}</strong>. Create
                jobsites for demos, toggle active status, and assign framers who
                can submit safety reports.
              </p>
              <AdminNav />
            </div>
            <div className="admin-dash__actions">
              <button
                type="button"
                className="btn btn--primary touch-target"
                onClick={openCreate}
              >
                <Plus size={20} strokeWidth={2.5} aria-hidden />
                Add site
              </button>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={20} strokeWidth={2.5} aria-hidden />
                Refresh
              </button>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void signOut()}
              >
                <LogOut size={20} strokeWidth={2.5} aria-hidden />
                Sign out
              </button>
            </div>
          </div>

          {loading && (
            <div className="panel-state" role="status">
              Loading jobsites…
            </div>
          )}

          {!loading && error && (
            <div className="panel-state panel-state--error" role="alert">
              <FileWarning size={28} strokeWidth={2.25} aria-hidden />
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--ghost touch-target"
                onClick={() => void load()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && sites.length === 0 && (
            <div className="panel-state" role="status">
              <p>No jobsites yet. Add a test site or run the RAS seed SQL.</p>
              <button
                type="button"
                className="btn btn--primary touch-target"
                onClick={openCreate}
              >
                Add first site
              </button>
            </div>
          )}

          {!loading && !error && sites.length > 0 && (
            <ul className="admin-list admin-list--sites" aria-label="Jobsites">
              {sites.map((site) => (
                <li key={site.id} className="admin-row admin-row--site">
                  <div className="admin-row__main">
                    <div className="admin-row__top">
                      <span className="admin-row__site">{site.name}</span>
                      <span
                        className={
                          site.is_active
                            ? 'site-pill site-pill--active'
                            : 'site-pill site-pill--inactive'
                        }
                      >
                        {site.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {site.address && (
                      <p className="admin-row__addr">
                        <MapPin size={16} strokeWidth={2.25} aria-hidden />
                        {site.address}
                      </p>
                    )}
                    <p className="admin-row__meta">
                      <Users size={16} strokeWidth={2.25} aria-hidden />
                      {site.assignment_count}{' '}
                      {site.assignment_count === 1 ? 'framer' : 'framers'}{' '}
                      assigned
                    </p>
                  </div>
                  <div className="admin-row__actions admin-row__actions--site">
                    <button
                      type="button"
                      className="btn btn--ghost touch-target"
                      onClick={() => openEdit(site)}
                    >
                      <Pencil size={20} strokeWidth={2.25} aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary touch-target"
                      onClick={() => setAssignSite(site)}
                    >
                      <Users size={20} strokeWidth={2.25} aria-hidden />
                      Assign workers
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <strong>RAS</strong> · SiteSafe · Admin · Sites
      </footer>

      <SiteFormModal
        open={formOpen}
        site={editingSite}
        saving={saving}
        error={formError}
        onClose={() => {
          if (saving) return
          setFormOpen(false)
          setEditingSite(null)
          setFormError(null)
        }}
        onSubmit={(input) => void onSaveSite(input)}
      />

      <AssignWorkersModal
        open={assignSite !== null}
        siteId={assignSite?.id ?? null}
        siteName={assignSite?.name ?? ''}
        onClose={() => setAssignSite(null)}
        onAssignmentsChanged={() => void load()}
      />
    </div>
  )
}
