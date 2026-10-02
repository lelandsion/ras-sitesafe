import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { RedirectIfAuthed, RequireAuth } from './components/auth/RequireAuth'
import { AuthProvider } from './hooks/useAuth'
import { AdminHomePage } from './pages/admin/AdminHomePage'
import { FramerHomePage } from './pages/framer/FramerHomePage'
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
          <Route element={<RequireAuth role="admin" />}>
            <Route path="/admin" element={<AdminHomePage />} />
          </Route>
          <Route element={<RequireAuth role="framer" />}>
            <Route path="/framer" element={<FramerHomePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
