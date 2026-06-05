import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { FieldError } from '../components/ui/FieldError'
import { FormCard } from '../components/ui/FormCard'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 5000

export function BoiteaideeSubmit() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function validate(): string | null {
    const t = title.trim()
    const d = description.trim()
    if (t.length === 0) return 'Le titre est obligatoire.'
    if (t.length > TITLE_MAX)
      return `Le titre ne doit pas dépasser ${TITLE_MAX} caractères.`
    if (d.length === 0) return 'La description est obligatoire.'
    if (d.length > DESCRIPTION_MAX)
      return `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!user) {
      setError('Vous devez être connecté pour envoyer une idée.')
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('ideas').insert({
      title: title.trim(),
      description: description.trim(),
      created_by: user.id,
    })
    setSubmitting(false)

    if (insertError) {
      setError(`Impossible d'envoyer l'idée : ${insertError.message}`)
      return
    }

    setSuccess(true)
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setError(null)
    setSuccess(false)
  }

  if (success) {
    return (
      <FormCard
        title="Merci !"
        subtitle="Votre idée a bien été transmise au BDE."
      >
        <Button
          type="button"
          variant="primary"
          onClick={resetForm}
          className="w-full"
        >
          Envoyer une autre idée
        </Button>
      </FormCard>
    )
  }

  return (
    <FormCard
      title="Boîte à idées"
      subtitle="Proposez un événement, une amélioration, ou toute idée pour l'AEGP."
    >
      <form onSubmit={handleSubmit} noValidate>
        <FieldError>{error}</FieldError>
        <Input
          id="idea-title"
          label="Titre"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          disabled={submitting}
          placeholder="Ex : soirée jeux de société"
          required
        />
        <Textarea
          id="idea-description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          disabled={submitting}
          rows={6}
          placeholder="Détaillez votre idée…"
          required
        />
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          className="w-full"
        >
          {submitting ? 'Envoi en cours…' : 'Envoyer mon idée'}
        </Button>
      </form>
    </FormCard>
  )
}
