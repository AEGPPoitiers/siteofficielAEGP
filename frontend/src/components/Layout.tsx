import { NavLink, Outlet } from 'react-router'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-600 text-white'
      : 'text-gray-700 hover:bg-gray-100'
  }`

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold text-indigo-600">
            AEGP
          </NavLink>
          <nav className="flex gap-2">
            <NavLink to="/agenda" className={linkClass}>
              Agenda
            </NavLink>
            <NavLink to="/tutorat" className={linkClass}>
              Tutorat
            </NavLink>
            <NavLink to="/login" className={linkClass}>
              Connexion
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} AEGP — BDE
        </div>
      </footer>
    </div>
  )
}
