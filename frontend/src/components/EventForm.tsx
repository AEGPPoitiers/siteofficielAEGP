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
import { EVENT_COLORS } from '../lib/eventColors'

export type EventFormValues = {
  title: string
  description: string
  start_date: string
  /** ISO de fin, ou chaîne vide si pas d'heure de fin définie. */
  end_date: string
  /** Couleur hex (#RRGGBB), ou chaîne vide si aucune. */
  color: string
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

/**
 * ISO de fin, calculée sur la date de début. Si l'heure de fin est ≤ l'heure de
 * début, l'événement est réputé se terminer le lendemain (cas soirée 22h→02h).
 */
function endInputsToIso(
  dateStr: string,
  startIso: string,
  hourStr: string,
  minuteStr: string,
): string {
  const end = new Date(`${dateStr}T${hourStr}:${minuteStr}`)
  if (end.getTime() <= new Date(startIso).getTime()) {
    end.setDate(end.getDate() + 1)
  }
  return end.toISOString()
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
  const [endHourValue, setEndHourValue] = useState(
    isoToHour(initialValues.end_date ?? ''),
  )
  const [endMinuteValue, setEndMinuteValue] = useState(
    isoToMinute(initialValues.end_date ?? ''),
  )
  const [color, setColor] = useState(initialValues.color ?? '')
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
    // Heure de fin optionnelle : les deux champs ensemble, ou aucun.
    const hasEnd = !!endHourValue && !!endMinuteValue
    if ((endHourValue || endMinuteValue) && !hasEnd) {
      setError("L'heure de fin est incomplète (heures et minutes).")
      return
    }
    if (d.length > DESCRIPTION_MAX) {
      setError(
        `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`,
      )
      return
    }

    const startIso = dateTimeInputsToIso(dateValue, hourValue, minuteValue)

    setSubmitting(true)
    const result = await onSubmit({
      values: {
        title: t,
        description: d,
        start_date: startIso,
        end_date: hasEnd
          ? endInputsToIso(dateValue, startIso, endHourValue, endMinuteValue)
          : '',
        color,
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
        <label
          htmlFor="event-end-hour"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Heure de fin (optionnel)
        </label>
        <div className="flex items-center gap-2 max-w-xs">
          <select
            id="event-end-hour"
            value={endHourValue}
            onChange={(e) => setEndHourValue(e.target.value)}
            disabled={submitting}
            aria-label="Heures de fin"
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
            id="event-end-minute"
            value={endMinuteValue}
            onChange={(e) => setEndMinuteValue(e.target.value)}
            disabled={submitting}
            aria-label="Minutes de fin"
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
        <p className="text-xs text-gray-500 mt-1">
          Laisse vide si pas d'heure de fin. Si la fin est avant le début,
          l'événement se termine le lendemain (soirée).
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Couleur (optionnel)
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {EVENT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() =>
                setColor((prev) => (prev === c.value ? '' : c.value))
              }
              disabled={submitting}
              aria-label={c.label}
              aria-pressed={color === c.value}
              title={c.label}
              className={`w-7 h-7 rounded-full border-2 transition ${
                color === c.value
                  ? 'border-black ring-2 ring-offset-1 ring-black'
                  : 'border-transparent hover:border-gray-300'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          {color && (
            <button
              type="button"
              onClick={() => setColor('')}
              disabled={submitting}
              className="text-xs text-gray-500 underline ml-1"
            >
              Aucune
            </button>
          )}
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
