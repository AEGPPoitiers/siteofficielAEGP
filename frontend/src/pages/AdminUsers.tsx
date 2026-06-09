import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Search, Shield, Trash2, UserPlus } from 'lucide-react'
import {
  listUsers,
  updateUserRoles,
  deleteUser,
  type AdminUser,
  type EditableRoles,
} from '../lib/adminUsers'
import { useConfirm } from '../contexts/ConfirmContext'

export default function AdminUsers() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q),
    )
  }, [users, search])

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
                is_bde_member: updated.is_bde_member,
                is_tutor: updated.is_tutor,
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

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Administration — membres
          </h1>
          <p className="text-gray-600 mt-1">
            Gère le rôle tuteur des comptes et supprime les comptes obsolètes.
          </p>
        </div>
        <Link
          to="/admin/import"
          className="inline-flex items-center gap-2 shrink-0 bg-black text-white font-medium rounded-md px-4 py-2 hover:bg-gray-800"
        >
          <UserPlus size={16} aria-hidden />
          Importer des étudiants
        </Link>
      </div>

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
              className="flex items-center gap-3 flex-wrap bg-white rounded-lg shadow-sm border border-gray-200 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {u.full_name || u.email || '(sans nom)'}
                  </span>
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
                    label="Tuteur"
                    active={u.is_tutor}
                    disabled={savingId === u.id}
                    onClick={() => toggle(u, 'is_tutor')}
                  />
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
          ))}
        </div>
      )}
    </div>
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
