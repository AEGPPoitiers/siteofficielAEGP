import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FieldError } from '../components/ui/FieldError'
import { FormCard } from '../components/ui/FormCard'

export default function ResetPassword() {
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    const { error } = await requestPasswordReset(email)

    if (error) {
      setErrorMessage('Une erreur est survenue. Veuillez réessayer plus tard.')
    } else {
      setSent(true)
    }

    setSubmitting(false)
  }

  if (sent) {
    return (
      <FormCard title="Email envoyé">
        <p className="text-sm text-gray-700">
          Si un compte existe pour <strong>{email}</strong>, vous allez recevoir
          un email avec un lien pour réinitialiser votre mot de passe.
        </p>
      </FormCard>
    )
  }

  return (
    <FormCard
      title="Mot de passe oublié"
      subtitle="Saisis ton email, on t'envoie un lien pour le réinitialiser."
    >
      <form onSubmit={handleSubmit}>
        <Input
          id="email"
          label="Adresse email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <FieldError>{errorMessage}</FieldError>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
        </Button>
      </form>
    </FormCard>
  )
}
