import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FieldError } from '../components/ui/FieldError'
import { FormCard } from '../components/ui/FormCard'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Page protégée d'où l'on a été redirigé (cf. ProtectedRoute & co).
  const from = (location.state as { from?: string } | null)?.from ?? null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    const { error } = await signIn(email, password)

    if (error) {
      setErrorMessage('Email ou mot de passe invalide')
    } else {
      // Retour à la page initialement demandée si on y a été redirigé.
      navigate(from ?? '/')
    }

    setSubmitting(false)
  }

  return (
    <FormCard title="Connexion">
      {from && (
        <div className="mb-4 text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          Connecte-toi pour accéder à cette page.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          id="password"
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <FieldError>{errorMessage}</FieldError>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Connexion...' : 'Se connecter'}
        </Button>
        <Link
          to="/reset-password"
          className="block mt-4 text-sm text-gray-600 hover:text-black text-center"
        >
          Mot de passe oublié ?
        </Link>
      </form>
    </FormCard>
  )
}
