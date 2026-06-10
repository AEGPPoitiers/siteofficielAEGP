import { apiGet, apiPatch, apiDelete, apiPost } from './api'
import type { Promotion } from './studentsImport'

export type AdminUser = {
  id: string
  email: string | null
  full_name: string | null
  promotion: Promotion | null
  is_admin: boolean
  is_tutor: boolean
  is_com: boolean
}

/** Flags modifiables via l'UI admin (is_admin reste géré en SQL). */
export type EditableRoles = {
  is_tutor?: boolean
  is_com?: boolean
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

/** Identité modifiable via l'UI admin (full_name, promotion, email). */
export type EditableUserInfo = {
  full_name?: string
  promotion?: Promotion | null
  email?: string
}

/** Modifie l'identité d'un compte (nom, promotion, email). N'envoie que les
 *  champs fournis ; `promotion: null` efface la promotion. */
export function updateUserInfo(
  id: string,
  info: EditableUserInfo,
): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/admin/users/${id}/info`, info)
}

/** Supprime définitivement un compte (le profil part en cascade). */
export function deleteUser(id: string): Promise<unknown> {
  return apiDelete(`/admin/users/${id}`)
}

export type ImportStudent = {
  email: string
  full_name: string
  promotion: Promotion | null
}

export type ImportResult = {
  invited: string[]
  updated: string[] // déjà inscrits, promotion mise à jour (montée de niveau)
  skipped: string[] // déjà inscrits, rien à mettre à jour
  errors: { email: string; message: string }[]
}

/**
 * Invite un lot d'étudiants (envoie un vrai email d'invitation à chacun).
 * À appeler par lots côté UI : le backend borne la taille d'un lot.
 */
export function importStudents(
  students: ImportStudent[],
): Promise<ImportResult> {
  return apiPost<ImportResult>('/admin/users/import', { students })
}

export type DeletePromotionResult = {
  deleted: number
  errors: { id: string; message: string }[]
}

/** Supprime en masse tous les comptes d'une promotion (diplômés en fin d'année). */
export function deletePromotion(
  promotion: Promotion,
): Promise<DeletePromotionResult> {
  return apiDelete<DeletePromotionResult>(
    `/admin/users/by-promotion/${promotion}`,
  )
}
