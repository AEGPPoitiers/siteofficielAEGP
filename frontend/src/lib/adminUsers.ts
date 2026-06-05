import { apiGet, apiPatch, apiDelete } from './api'

export type AdminUser = {
  id: string
  email: string | null
  full_name: string | null
  is_bde_member: boolean
  is_admin: boolean
  is_tutor: boolean
}

/** Flags modifiables via l'UI admin (is_admin reste géré en SQL). */
export type EditableRoles = {
  is_bde_member?: boolean
  is_tutor?: boolean
}

export function listUsers(): Promise<AdminUser[]> {
  return apiGet<AdminUser[]>('/admin/users')
}

export function updateUserRoles(
  id: string,
  roles: EditableRoles,
): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/admin/users/${id}`, roles)
}

/** Supprime définitivement un compte (le profil part en cascade). */
export function deleteUser(id: string): Promise<unknown> {
  return apiDelete(`/admin/users/${id}`)
}
