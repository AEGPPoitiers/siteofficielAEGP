import { NavLink, Outlet } from 'react-router'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
  }`

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <NavLink to="/">
              <img
                src="../../img/logo_aegp.jpg"
                className="max-h-24 max-w-24"
              />
            </NavLink>
            <NavLink to="/" className="text-xl font-bold text-black">
              AEGP Site officiel
            </NavLink>
          </div>
          <nav className="flex gap-2">
            <NavLink to="/" className={linkClass}>
              Accueil
            </NavLink>
            <NavLink to="/agenda" className={linkClass}>
              Agenda
            </NavLink>
            <NavLink to="/boiteaidee" className={linkClass}>
              Boîte à idée
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
          © {new Date().getFullYear()} AEGP
        </div>
      </footer>
    </div>
  )
}
