import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type FormEvent,
  type ChangeEvent,
} from 'react'
import { format } from 'date-fns'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { FieldError } from './ui/FieldError'

export type EventFormValues = {
  title: string
  description: string
  start_date: string
  location: string
  external_link: string
}

export type EventFormSubmitPayload = {
  values: EventFormValues
  imageFile: File | null
  removeImage: boolean
}

type EventFormProps = {
  initialValues?: Partial<EventFormValues>
  currentImageUrl?: string | null
  onSubmit: (payload: EventFormSubmitPayload) => Promise<{ error?: string }>
  submitLabel: string
}

const TITLE_MAX = 200
const DESCRIPTION_MAX = 5000
const IMAGE_MAX_BYTES = 5 * 1024 * 1024

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, '0'),
)
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  (i * 5).toString().padStart(2, '0'),
)

function isoToDateInput(iso: string): string {
  if (!iso) return ''
  try {
    return format(new Date(iso), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

function isoToHour(iso: string): string {
  if (!iso) return ''
  try {
    return format(new Date(iso), 'HH')
  } catch {
    return ''
  }
}

function isoToMinute(iso: string): string {
  if (!iso) return ''
  try {
    return format(new Date(iso), 'mm')
  } catch {
    return ''
  }
}

function dateTimeInputsToIso(
  dateStr: string,
  hourStr: string,
  minuteStr: string,
): string {
  return new Date(`${dateStr}T${hourStr}:${minuteStr}`).toISOString()
}

export function EventForm({
  initialValues = {},
  currentImageUrl = null,
  onSubmit,
  submitLabel,
}: EventFormProps) {
  const [title, setTitle] = useState(initialValues.title ?? '')
  const [description, setDescription] = useState(
    initialValues.description ?? '',
  )
  const [dateValue, setDateValue] = useState(
    isoToDateInput(initialValues.start_date ?? ''),
  )
  const [hourValue, setHourValue] = useState(
    isoToHour(initialValues.start_date ?? ''),
  )
  const [minuteValue, setMinuteValue] = useState(
    isoToMinute(initialValues.start_date ?? ''),
  )
  const [location, setLocation] = useState(initialValues.location ?? '')
  const [externalLink, setExternalLink] = useState(
    initialValues.external_link ?? '',
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const objectUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  )

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const displayedImageUrl =
    objectUrl ?? (!removeImage ? currentImageUrl : null)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image.')
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError('L’image ne doit pas dépasser 5 Mo.')
      return
    }

    setError(null)
    setImageFile(file)
    setRemoveImage(false)
  }

  function handleRemoveImage() {
    setImageFile(null)
    setRemoveImage(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const t = title.trim()
    const d = description.trim()
    const loc = location.trim()
    const ext = externalLink.trim()

    if (t.length === 0) {
      setError('Le titre est obligatoire.')
      return
    }
    if (t.length > TITLE_MAX) {
      setError(`Le titre ne doit pas dépasser ${TITLE_MAX} caractères.`)
      return
    }
    if (!dateValue) {
      setError('La date est obligatoire.')
      return
    }
    if (!hourValue || !minuteValue) {
      setError("L'heure est obligatoire.")
      return
    }
    if (d.length > DESCRIPTION_MAX) {
      setError(
        `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`,
      )
      return
    }

    setSubmitting(true)
    const result = await onSubmit({
      values: {
        title: t,
        description: d,
        start_date: dateTimeInputsToIso(dateValue, hourValue, minuteValue),
        location: loc,
        external_link: ext,
      },
      imageFile,
      removeImage,
    })
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldError>{error}</FieldError>

      <Input
        id="event-title"
        label="Titre"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={TITLE_MAX}
        disabled={submitting}
        required
      />

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="event-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Date
          </label>
          <input
            id="event-date"
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            disabled={submitting}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
          />
        </div>
        <div>
          <label
            htmlFor="event-hour"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Heure
          </label>
          <div className="flex items-center gap-2">
            <select
              id="event-hour"
              value={hourValue}
              onChange={(e) => setHourValue(e.target.value)}
              disabled={submitting}
              required
              aria-label="Heures"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white"
            >
              <option value="">HH</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-gray-500">:</span>
            <select
              id="event-minute"
              value={minuteValue}
              onChange={(e) => setMinuteValue(e.target.value)}
              disabled={submitting}
              required
              aria-label="Minutes"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white"
            >
              <option value="">MM</option>
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Image (optionnel)
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Format image, 5 Mo max. Ratio paysage recommandé.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={submitting}
          className="hidden"
          aria-hidden="true"
        />
        {displayedImageUrl ? (
          <div className="space-y-2">
            <img
              src={displayedImageUrl}
              alt=""
              className="w-full max-h-64 object-cover rounded-md border border-gray-200"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                Changer l'image
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRemoveImage}
                disabled={submitting}
              >
                Supprimer l'image
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
          >
            Ajouter une image
          </Button>
        )}
      </div>

      <Input
        id="event-location"
        label="Lieu (optionnel)"
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        disabled={submitting}
        placeholder="Ex : Foyer étudiant"
      />

      <Input
        id="event-external-link"
        label="Lien externe / billetterie (optionnel)"
        type="url"
        value={externalLink}
        onChange={(e) => setExternalLink(e.target.value)}
        disabled={submitting}
        placeholder="https://…"
      />

      <Textarea
        id="event-description"
        label="Description (optionnel)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={DESCRIPTION_MAX}
        disabled={submitting}
        rows={6}
        placeholder="Détails de l’événement…"
      />

      <Button
        type="submit"
        variant="primary"
        loading={submitting}
        className="w-full"
      >
        {submitting ? 'Enregistrement…' : submitLabel}
      </Button>
    </form>
  )
}
