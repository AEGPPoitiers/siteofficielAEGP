import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { importStudents, type ImportResult } from '../lib/adminUsers'
import { parseStudentsCsv, type ParseResult } from '../lib/studentsImport'
import { useConfirm } from '../contexts/ConfirmContext'

// On envoie les invitations par petits lots séquentiels : feedback de progression,
// et on évite un appel unique très long (cold start Render, timeouts proxy).
const BATCH_SIZE = 20

export default function AdminImport() {
  const confirm = useConfirm()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleText(value: string) {
    setText(value)
    setResult(null)
    setError(null)
    setDone(0)
    setParsed(value.trim() ? parseStudentsCsv(value) : null)
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    handleText(await file.text())
  }

  async function run() {
    if (!parsed || parsed.valid.length === 0) return
    const total = parsed.valid.length
    const ok = await confirm({
      title: 'Lancer les invitations',
      message: `Inviter ${total} étudiant·e·s ? Un email d'invitation sera envoyé immédiatement à chaque adresse. Les comptes déjà inscrits sont ignorés.`,
      confirmLabel: `Inviter ${total} étudiant·e·s`,
    })
    if (!ok) return

    setRunning(true)
    setError(null)
    setDone(0)
    const agg: ImportResult = {
      invited: [],
      updated: [],
      skipped: [],
      errors: [],
    }
    try {
      for (let i = 0; i < parsed.valid.length; i += BATCH_SIZE) {
        const batch = parsed.valid.slice(i, i + BATCH_SIZE)
        const r = await importStudents(batch)
        agg.invited.push(...r.invited)
        agg.updated.push(...r.updated)
        agg.skipped.push(...r.skipped)
        agg.errors.push(...r.errors)
        setDone(Math.min(i + batch.length, parsed.valid.length))
        setResult({ ...agg })
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Échec de l'import. Une partie a pu être traitée.",
      )
    } finally {
      setRunning(false)
    }
  }

  const total = parsed?.valid.length ?? 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const noPromo = parsed?.valid.filter((s) => !s.promotion).length ?? 0

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} aria-hidden />
          Membres
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          Importer des étudiants
        </h1>
        <p className="text-gray-600 mt-1">
          Colle un CSV (ou choisis un fichier) avec une colonne{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">email</code> et, si
          possible,{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">prenom</code> /{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">nom</code> /{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">promotion</code>{' '}
          (L3, M1 ou M2). Chaque adresse reçoit une invitation à définir son mot
          de passe ; un compte déjà inscrit voit sa promotion mise à jour.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2 text-sm flex gap-2">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden />
        <span>
          L'import envoie de <strong>vrais emails</strong>. Vérifie l'aperçu
          ci-dessous avant de lancer. L'opération est ré-exécutable : les comptes
          déjà inscrits sont ignorés.
        </span>
      </div>

      <div className="space-y-2">
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 border border-gray-300 rounded-md px-3 py-2 hover:bg-gray-50 w-fit">
          <Upload size={16} aria-hidden />
          Choisir un fichier CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={handleFile}
            className="hidden"
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => handleText(e.target.value)}
          rows={8}
          placeholder={
            'email,prenom,nom,promotion\njean.dupont@etu.fr,Jean,Dupont,L3'
          }
          className="w-full font-mono text-sm border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {parsed && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Stat label="à inviter" value={parsed.valid.length} tone="ok" />
            <Stat label="ignorés (doublons)" value={parsed.duplicates.length} />
            <Stat label="invalides" value={parsed.invalid.length} tone="warn" />
            {noPromo > 0 && (
              <Stat label="sans promotion" value={noPromo} tone="warn" />
            )}
          </div>

          {(parsed.invalid.length > 0 || parsed.duplicates.length > 0) && (
            <details className="text-sm bg-gray-50 border border-gray-200 rounded-md p-3">
              <summary className="cursor-pointer font-medium text-gray-700">
                Voir les lignes non importées
              </summary>
              <ul className="mt-2 space-y-1 text-gray-600">
                {[...parsed.invalid, ...parsed.duplicates].map((issue, i) => (
                  <li key={i}>
                    <span className="text-gray-400">L.{issue.line}</span>{' '}
                    {issue.reason} —{' '}
                    <span className="font-mono text-xs">{issue.raw}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            type="button"
            onClick={run}
            disabled={running || parsed.valid.length === 0}
            className="inline-flex items-center gap-2 bg-black text-white font-medium rounded-md px-4 py-2 disabled:opacity-50 hover:bg-gray-800"
          >
            {running
              ? `Envoi… ${done}/${total}`
              : `Inviter ${parsed.valid.length} étudiant·e·s`}
          </button>
        </div>
      )}

      {running && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-black h-2 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {result && !running && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 size={18} aria-hidden />
            <span className="font-medium">Import terminé</span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Stat label="invités" value={result.invited.length} tone="ok" />
            <Stat label="promotions à jour" value={result.updated.length} tone="ok" />
            <Stat label="déjà inscrits" value={result.skipped.length} />
            <Stat label="échecs" value={result.errors.length} tone="warn" />
          </div>
          {result.errors.length > 0 && (
            <details className="text-sm bg-gray-50 border border-gray-200 rounded-md p-3">
              <summary className="cursor-pointer font-medium text-gray-700">
                Voir les échecs
              </summary>
              <ul className="mt-2 space-y-1 text-gray-600">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{e.email}</span> —{' '}
                    {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'ok' | 'warn'
}) {
  const color =
    tone === 'ok'
      ? 'bg-green-100 text-green-800'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-700'
  return (
    <span className={`px-2.5 py-1 rounded-full font-medium ${color}`}>
      {value} {label}
    </span>
  )
}
