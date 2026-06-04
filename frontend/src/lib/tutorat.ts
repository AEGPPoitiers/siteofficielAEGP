/** Types et constantes partagés du module tutorat (taxonomie + documents). */

export type NodeKind = 'promo' | 'option' | 'matiere'

export type TutoratNode = {
  id: string
  parent_id: string | null
  name: string
  kind: NodeKind
  position: number
  created_at: string
}

/**
 * Types de sous-dossiers autorisés selon le parent (profondeur variable L3 vs
 * M1/M2). Une matière est une feuille : elle ne peut pas contenir de sous-dossier
 * (mais peut contenir des fichiers). Utilisé côté UI pour décider si on propose
 * la création d'un dossier à un niveau donné.
 */
export function allowedChildKinds(parent: TutoratNode | null): NodeKind[] {
  if (parent === null) return ['promo']
  if (parent.kind === 'promo') return ['option', 'matiere']
  if (parent.kind === 'option') return ['matiere']
  return []
}

export type DocType = 'cm' | 'td' | 'tp' | 'examen'

export type TutoratDocument = {
  id: string
  node_id: string
  title: string
  description: string | null
  doc_type: DocType
  file_key: string
  file_name: string
  file_size: number | null
  content_type: string | null
  uploaded_by: string | null
  created_at: string
}

export const DOC_TYPES: DocType[] = ['cm', 'td', 'tp', 'examen']

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  cm: 'CM',
  td: 'TD',
  tp: 'TP',
  examen: 'Examen',
}

export const DOC_TYPE_COLORS: Record<DocType, string> = {
  cm: 'bg-blue-100 text-blue-800',
  td: 'bg-green-100 text-green-800',
  tp: 'bg-amber-100 text-amber-800',
  examen: 'bg-purple-100 text-purple-800',
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['o', 'Ko', 'Mo', 'Go']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}
