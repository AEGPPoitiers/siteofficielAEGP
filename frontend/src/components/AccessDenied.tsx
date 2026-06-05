import { Link } from 'react-router'

/** Affiché quand un utilisateur connecté n'a pas le rôle requis pour une page. */
export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
      <p className="text-gray-600 mb-6">
        {message ?? "Tu n'as pas les droits pour accéder à cette page."}
      </p>
      <Link to="/" className="text-black underline">
        Retour à l'accueil
      </Link>
    </div>
  )
}
