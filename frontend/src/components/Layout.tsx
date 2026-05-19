import { NavLink, Outlet, useLocation } from 'react-router'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import logo from '../assets/logo_aegp.svg'

const pageBg: Record<string, string> = {
  '/': 'bg-white',
  '/agenda': 'bg-red-50',
  '/boiteaidee': 'bg-yellow-50',
  '/tutorat': 'bg-blue-50',
  '/login': 'bg-white',
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
  }`

const mobileLinkClass = (props: { isActive: boolean }) =>
  `block w-full ${linkClass(props)}`

export default function Layout() {
  const [isOpen, setIsOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])
  const bgClass = pageBg[pathname] ?? 'bg-gray-50'
  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${bgClass}`}
    >
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <NavLink
              to="/"
              className="flex items-center text-xl font-bold text-black"
            >
              <img src={logo} className="max-h-24 max-w-24" />
              AEGP Site officiel
            </NavLink>
          </div>
          <nav className="hidden md:flex gap-2">
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
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Fermer' : 'Ouvrir le menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
        {isOpen && (
          <nav
            id="mobile-menu"
            className="md:hidden flex flex-col gap-1 px-4 pb-4 pt-4 border-t border-gray-200"
          >
            <NavLink to="/" className={mobileLinkClass}>
              Accueil
            </NavLink>
            <NavLink to="/agenda" className={mobileLinkClass}>
              Agenda
            </NavLink>
            <NavLink to="/boiteaidee" className={mobileLinkClass}>
              Boîte à idée
            </NavLink>
            <NavLink to="/tutorat" className={mobileLinkClass}>
              Tutorat
            </NavLink>
            <NavLink to="/login" className={mobileLinkClass}>
              Connexion
            </NavLink>
          </nav>
        )}
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
