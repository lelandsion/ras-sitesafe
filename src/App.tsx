import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { RedirectIfAuthed, RequireAuth } from './components/auth/RequireAuth'
import { AuthProvider } from './hooks/useAuth'
import { AccountPage } from './pages/account/AccountPage'
import { AdminDailyCompliancePage } from './pages/admin/AdminDailyCompliancePage'
import { AdminHomePage } from './pages/admin/AdminHomePage'
import { AdminReportsPage } from './pages/admin/AdminReportsPage'
import { AdminSafetyIssuesPage } from './pages/admin/AdminSafetyIssuesPage'
import { AdminSitesPage } from './pages/admin/AdminSitesPage'
import { AdminWorkersPage } from './pages/admin/AdminWorkersPage'
import { SavedReportViewPage } from './pages/admin/SavedReportViewPage'
import { FramerHomePage } from './pages/framer/FramerHomePage'
import { SafetyFormPage } from './pages/framer/SafetyFormPage'
import { SubmissionPreviewPage } from './pages/shared/SubmissionPreviewPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route element={<RedirectIfAuthed />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/account" element={<AccountPage />} />
          </Route>
          <Route element={<RequireAuth role="admin" />}>
            <Route path="/admin" element={<AdminHomePage />} />
            <Route path="/admin/issues" element={<AdminSafetyIssuesPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/reports/:id" element={<SavedReportViewPage />} />
            <Route path="/admin/sites" element={<AdminSitesPage />} />
            <Route path="/admin/workers" element={<AdminWorkersPage />} />
            <Route
              path="/admin/sites/:siteId/compliance"
              element={<AdminDailyCompliancePage />}
            />
            <Route
              path="/admin/submissions/new"
              element={<SafetyFormPage mode="new" audience="admin" />}
            />
            <Route
              path="/admin/submissions/:id/preview"
              element={<SubmissionPreviewPage audience="admin" />}
            />
            <Route
              path="/admin/submissions/:id"
              element={<SafetyFormPage mode="edit" audience="admin" />}
            />
          </Route>
          <Route element={<RequireAuth role="framer" />}>
            <Route path="/framer" element={<FramerHomePage />} />
            <Route path="/framer/new" element={<SafetyFormPage mode="new" />} />
            <Route
              path="/framer/submissions/:id/preview"
              element={<SubmissionPreviewPage audience="framer" />}
            />
            <Route
              path="/framer/submissions/:id"
              element={<SafetyFormPage mode="edit" />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
