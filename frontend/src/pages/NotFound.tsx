import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <p className="text-5xl font-bold text-gray-900 mb-2">404</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Page introuvable</h1>
      <p className="text-gray-600 mb-6">
        La page que tu cherches n'existe pas ou a été déplacée.
      </p>
      <Link to="/" className="text-black underline">
        Retour à l'accueil
      </Link>
    </div>
  )
}
