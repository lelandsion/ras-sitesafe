import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'admin-tabs__link admin-tabs__link--active touch-target'
    : 'admin-tabs__link touch-target'

export function AdminNav() {
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      <NavLink to="/admin" end className={linkClass}>
        Dashboard
      </NavLink>
      <NavLink to="/admin/reports" className={linkClass}>
        Reports
      </NavLink>
      <NavLink to="/admin/sites" className={linkClass}>
        Sites
      </NavLink>
    </nav>
  )
}
