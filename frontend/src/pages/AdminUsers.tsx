import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import {
  Search,
  Shield,
  Trash2,
  Pencil,
  UserPlus,
  Upload,
  GraduationCap,
} from 'lucide-react'
import {
  listUsers,
  updateUserRoles,
  updateUserInfo,
  deleteUser,
  deletePromotion,
  importStudents,
  type AdminUser,
  type EditableRoles,
  type EditableUserInfo,
} from '../lib/adminUsers'
import { PROMOTIONS, EMAIL_RE, type Promotion } from '../lib/studentsImport'
import { useConfirm } from '../contexts/ConfirmContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

type PromoFilter = 'all' | Promotion | 'none'

export default function AdminUsers() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [promoFilter, setPromoFilter] = useState<PromoFilter>('all')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error
              ? e.message
              : 'Impossible de charger les utilisateurs.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Recharge la liste après une invitation manuelle (le nouveau compte apparaît
  // aussitôt, prêt à se voir attribuer un rôle).
  async function reloadUsers() {
    try {
      setUsers(await listUsers())
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Impossible de recharger la liste.',
      )
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (promoFilter === 'none' && u.promotion) return false
      if (
        promoFilter !== 'all' &&
        promoFilter !== 'none' &&
        u.promotion !== promoFilter
      )
        return false
      if (!q) return true
      return (
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, search, promoFilter])

  // Décompte par promotion (pour les pastilles de filtre).
  const promoCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of users) {
      const key = u.promotion ?? 'none'
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [users])

  async function toggle(user: AdminUser, field: keyof EditableRoles) {
    const next = !user[field]
    setActionError(null)
    setSavingId(user.id)
    // Optimiste : on reflète immédiatement le changement.
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, [field]: next } : u)),
    )
    try {
      const updated = await updateUserRoles(user.id, { [field]: next })
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                is_tutor: updated.is_tutor,
                is_com: updated.is_com,
                is_admin: updated.is_admin,
              }
            : u,
        ),
      )
    } catch (e) {
      // Revert en cas d'échec.
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, [field]: !next } : u)),
      )
      setActionError(
        e instanceof Error ? e.message : 'Échec de la mise à jour.',
      )
    } finally {
      setSavingId(null)
    }
  }

  function handleSaved(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    setEditingId(null)
  }

  async function handleDelete(user: AdminUser) {
    const label = user.full_name || user.email || 'ce compte'
    const ok = await confirm({
      title: 'Supprimer le compte',
      message: `Supprimer définitivement le compte « ${label} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    setDeletingId(user.id)
    try {
      await deleteUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Échec de la suppression du compte.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeletePromotion(promo: Promotion) {
    // On ne supprime que les non-admins (le backend l'impose aussi).
    const count = users.filter(
      (u) => u.promotion === promo && !u.is_admin,
    ).length
    if (count === 0) return
    const ok = await confirm({
      title: `Supprimer la promotion ${promo}`,
      message: `Supprimer définitivement ${count} compte(s) de la promotion ${promo} ? À faire pour les diplômés en fin d'année. Cette action est irréversible.`,
      confirmLabel: `Supprimer ${count} compte(s)`,
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    setBulkDeleting(true)
    try {
      const res = await deletePromotion(promo)
      // Recharge la liste pour refléter l'état réel (succès partiels possibles).
      const data = await listUsers()
      setUsers(data)
      if (res.errors.length > 0) {
        setActionError(
          `${res.deleted} compte(s) supprimé(s), ${res.errors.length} échec(s).`,
        )
      }
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : 'Échec de la suppression de la promotion.',
      )
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Administration — membres
          </h1>
          <p className="text-gray-600 mt-1">
            Gère les rôles tutorat et communication des comptes et supprime les
            comptes obsolètes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2"
          >
            <UserPlus size={16} aria-hidden />
            Ajouter un étudiant
          </Button>
          <Link
            to="/admin/import"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 font-medium rounded-md px-4 py-2 hover:bg-gray-50"
          >
            <Upload size={16} aria-hidden />
            Importer un CSV
          </Link>
        </div>
      </div>

      {showAdd && (
        <AddStudentForm
          onInvited={reloadUsers}
          onClose={() => setShowAdd(false)}
        />
      )}

      {loadError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {loadError}
        </div>
      )}
      {actionError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {actionError}
        </div>
      )}

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black"
          aria-label="Rechercher un utilisateur"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill
          label="Toutes"
          active={promoFilter === 'all'}
          onClick={() => setPromoFilter('all')}
        />
        {PROMOTIONS.map((p) => (
          <FilterPill
            key={p}
            label={`${p} (${promoCounts[p] ?? 0})`}
            active={promoFilter === p}
            onClick={() => setPromoFilter(p)}
          />
        ))}
        <FilterPill
          label={`Sans promo (${promoCounts['none'] ?? 0})`}
          active={promoFilter === 'none'}
          onClick={() => setPromoFilter('none')}
        />
        {promoFilter !== 'all' && promoFilter !== 'none' && (
          <button
            type="button"
            onClick={() => handleDeletePromotion(promoFilter)}
            disabled={bulkDeleting || (promoCounts[promoFilter] ?? 0) === 0}
            className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-red-700 border border-red-300 rounded-md px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
          >
            <GraduationCap size={16} aria-hidden />
            {bulkDeleting
              ? 'Suppression…'
              : `Supprimer la promotion ${promoFilter}`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {users.length === 0
            ? 'Aucun utilisateur.'
            : 'Aucun utilisateur ne correspond.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200"
            >
              <div className="flex items-center gap-3 flex-wrap p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {u.full_name || u.email || '(sans nom)'}
                    </span>
                    {u.promotion && (
                      <span className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {u.promotion}
                      </span>
                    )}
                    {u.is_admin && (
                      <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-900 text-white">
                        <Shield size={12} aria-hidden />
                        Admin
                      </span>
                    )}
                  </div>
                  {u.full_name && u.email && (
                    <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  )}
                </div>
                {u.is_admin ? null : (
                  <div className="flex items-center gap-2 shrink-0">
                    <RolePill
                      label="Tutorat"
                      active={u.is_tutor}
                      disabled={savingId === u.id}
                      onClick={() => toggle(u, 'is_tutor')}
                    />
                    <RolePill
                      label="Communication"
                      active={u.is_com}
                      disabled={savingId === u.id}
                      onClick={() => toggle(u, 'is_com')}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId((id) => (id === u.id ? null : u.id))
                      }
                      aria-label={`Modifier les informations de ${u.full_name || u.email || ''}`}
                      aria-expanded={editingId === u.id}
                      className={`p-1.5 rounded-md ${
                        editingId === u.id
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                      aria-label={`Supprimer le compte ${u.full_name || u.email || ''}`}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
              {editingId === u.id && (
                <EditUserForm
                  user={u}
                  onSaved={handleSaved}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Ajout manuel d'un seul étudiant : réutilise le flux d'invitation de l'import
 *  CSV (importStudents avec un tableau d'un élément). Un vrai email part aussitôt. */
function AddStudentForm({
  onInvited,
  onClose,
}: {
  onInvited: () => void
  onClose: () => void
}) {
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [promotion, setPromotion] = useState<Promotion | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) {
      setError('Adresse email invalide.')
      return
    }
    const full_name = `${prenom.trim()} ${nom.trim()}`.trim()
    setSubmitting(true)
    try {
      const r = await importStudents([
        { email: mail, full_name, promotion: promotion || null },
      ])
      if (r.errors.length > 0) {
        setError(r.errors[0].message)
      } else if (r.invited.length > 0) {
        setNotice(`Invitation envoyée à ${mail}.`)
        setPrenom('')
        setNom('')
        setEmail('')
        setPromotion('')
        onInvited()
      } else if (r.updated.length > 0) {
        setNotice(`${mail} était déjà inscrit·e — promotion mise à jour.`)
        onInvited()
      } else {
        setNotice(`${mail} est déjà inscrit·e — aucune invitation renvoyée.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'invitation.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Input
          id="add-prenom"
          label="Prénom"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          disabled={submitting}
          placeholder="Jean"
        />
        <Input
          id="add-nom"
          label="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          disabled={submitting}
          placeholder="Dupont"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Input
          id="add-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          placeholder="jean.dupont@etu.fr"
          required
        />
        <div className="mb-4">
          <label
            htmlFor="add-promo"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Promotion
          </label>
          <select
            id="add-promo"
            value={promotion}
            onChange={(e) => setPromotion(e.target.value as Promotion | '')}
            disabled={submitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
          >
            <option value="">Sans promotion</option>
            {PROMOTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {notice}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="submit" loading={submitting}>
          {submitting ? 'Invitation…' : 'Inviter'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Fermer
        </Button>
        <span className="text-xs text-gray-500">
          Un email d'invitation est envoyé immédiatement à l'adresse.
        </span>
      </div>
    </form>
  )
}

/** Sépare un nom complet « Prénom Nom » : premier mot = prénom, reste = nom.
 *  Convention de l'import (full_name = `${prenom} ${nom}`). */
function splitName(full: string): { prenom: string; nom: string } {
  const t = full.trim()
  const i = t.indexOf(' ')
  if (i === -1) return { prenom: t, nom: '' }
  return { prenom: t.slice(0, i), nom: t.slice(i + 1).trim() }
}

/** Édition de l'identité d'un compte (non-admin) : nom, prénom, promotion, email.
 *  N'envoie au backend que les champs réellement modifiés. */
function EditUserForm({
  user,
  onSaved,
  onCancel,
}: {
  user: AdminUser
  onSaved: (u: AdminUser) => void
  onCancel: () => void
}) {
  const initial = splitName(user.full_name ?? '')
  const [prenom, setPrenom] = useState(initial.prenom)
  const [nom, setNom] = useState(initial.nom)
  const [email, setEmail] = useState(user.email ?? '')
  const [promotion, setPromotion] = useState<Promotion | ''>(
    user.promotion ?? '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) {
      setError('Adresse email invalide.')
      return
    }
    const full_name = `${prenom.trim()} ${nom.trim()}`.trim()
    if (!full_name) {
      setError('Le nom ne peut pas être vide.')
      return
    }

    // On ne transmet que ce qui change (évite une réécriture d'email inutile).
    const patch: EditableUserInfo = {}
    if (full_name !== (user.full_name ?? '')) patch.full_name = full_name
    if (mail !== (user.email ?? '').toLowerCase()) patch.email = mail
    const nextPromo = promotion || null
    if (nextPromo !== (user.promotion ?? null)) patch.promotion = nextPromo

    if (Object.keys(patch).length === 0) {
      onCancel()
      return
    }

    setSubmitting(true)
    try {
      const updated = await updateUserInfo(user.id, patch)
      onSaved(updated)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Échec de la mise à jour.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-gray-50 p-4 rounded-b-lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Input
          id={`edit-prenom-${user.id}`}
          label="Prénom"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          disabled={submitting}
          placeholder="Jean"
        />
        <Input
          id={`edit-nom-${user.id}`}
          label="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          disabled={submitting}
          placeholder="Dupont"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Input
          id={`edit-email-${user.id}`}
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          placeholder="jean.dupont@etu.fr"
          required
        />
        <div className="mb-4">
          <label
            htmlFor={`edit-promo-${user.id}`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Promotion
          </label>
          <select
            id={`edit-promo-${user.id}`}
            value={promotion}
            onChange={(e) => setPromotion(e.target.value as Promotion | '')}
            disabled={submitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
          >
            <option value="">Sans promotion</option>
            {PROMOTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="submit" loading={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Annuler
        </Button>
        <span className="text-xs text-gray-500">
          Changer l'email modifie l'adresse de connexion et déconnecte le
          compte (reconnexion requise avec la nouvelle adresse).
        </span>
      </div>
    </form>
  )
}

function RolePill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 ${
        active
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
        active
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}
