import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FieldError } from '../components/ui/FieldError'
import { FormCard } from '../components/ui/FormCard'

export default function SetPassword() {
  const { setPassword } = useAuth()
  const navigate = useNavigate()

  const [password, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    if (password !== confirm) {
      setErrorMessage('Les mots de passes doivent être identiques')
      return
    }

    setSubmitting(true)

    const { error } = await setPassword(password)

    if (error) {
      setErrorMessage(error.message)
    } else {
      navigate('/')
    }

    setSubmitting(false)
  }

  return (
    <FormCard
      title="Définir mon mot de passe"
      subtitle="Choisis un mot de passe d'au moins 8 caractères."
    >
      <form onSubmit={handleSubmit}>
        <Input
          id="new-password"
          label="Nouveau mot de passe"
          type="password"
          value={password}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <Input
          id="confirm-password"
          label="Confirmer le mot de passe"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <FieldError>{errorMessage}</FieldError>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Enregistrement...' : 'Définir mon mot de passe'}
        </Button>
      </form>
    </FormCard>
  )
}
