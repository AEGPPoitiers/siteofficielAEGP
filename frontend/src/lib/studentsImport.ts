// Parsing + validation d'un CSV d'étudiants côté navigateur.
// Sert d'aperçu/dry-run instantané AVANT tout envoi réseau : on montre à l'admin
// ce qui sera importé (valides), rejeté (invalides), en doublon, ou exclu (promo
// hors L3/M1/M2 : diplômés déjà sortis, L1/L2…).
//
// Formats reconnus automatiquement par l'en-tête (séparateur `,` ou `;`) :
// - Nouveau format : Horodateur, Nom, Prénom, Adresse mail, Promo d'appartenance
// - Ancien format  : Horodateur, Adresse e-mail, Promotion d'appartenance, Nom, Prénom, Adresse email
//
// Détection automatique :
// - email     = dernière colonne contenant « mail » ou « courriel » (ignore l'adresse auto du formulaire si doublon) ;
// - promo     = colonne contenant « promo » (ex. « Promo d'appartenance » ou « Promotion d'appartenance ») ;
//               reconnue directement par son niveau (ex. « GPHY2027 (L3) ») ou calculée par l'année de diplôme ;
// - nom       = colonne « nom » ou commençant par « nom » ;
// - prénom    = colonne « prenom » ou commençant par « prenom » ;
// - nom compl = si une colonne unique regroupe nom et prénom (« nom complet », « nom et prenom »).

export type Promotion = 'L3' | 'M1' | 'M2'
export const PROMOTIONS: readonly Promotion[] = ['L3', 'M1', 'M2']

export type ParsedStudent = {
  email: string
  full_name: string
  promotion: Promotion
}
export type ParseIssue = { line: number; raw: string; reason: string }

export type ParseResult = {
  valid: ParsedStudent[]
  invalid: ParseIssue[]
  duplicates: ParseIssue[]
  excluded: ParseIssue[] // promo hors L3/M1/M2 (diplômés, L1/L2…)
}

// Validation volontairement permissive : le vrai juge reste Supabase à l'envoi.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Convertit une année de diplôme en niveau, pour une année de rentrée donnée.
 * Rentrée R : les M2 sortent en R+1, les M1 en R+2, les L3 en R+3.
 * (ex. rentrée 2026 → M2 = 2027, M1 = 2028, L3 = 2029).
 */
export function gradYearToPromotion(
  gradYear: number,
  rentreeYear: number,
): Promotion | null {
  switch (gradYear - rentreeYear) {
    case 1:
      return 'M2'
    case 2:
      return 'M1'
    case 3:
      return 'L3'
    default:
      return null
  }
}

/**
 * Année de rentrée par défaut : de juin à décembre, la rentrée à venir est cette
 * année ; de janvier à mai, l'année universitaire en cours a commencé l'an passé.
 */
export function defaultRentreeYear(now: Date = new Date()): number {
  const y = now.getFullYear()
  return now.getMonth() + 1 >= 6 ? y : y - 1
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function splitLine(line: string, sep: string): string[] {
  if (!line.includes('"')) {
    return line.split(sep).map((c) => c.trim())
  }
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === sep && !inQuotes) {
      result.push(cur.trim().replace(/^"|"$/g, ''))
      cur = ''
    } else {
      cur += char
    }
  }
  result.push(cur.trim().replace(/^"|"$/g, ''))
  return result
}

export type PromoExtractResult =
  | { status: 'ok'; promotion: Promotion }
  | { status: 'excluded'; reason: string }
  | { status: 'invalid'; reason: string }

/**
 * Déduit la promotion à partir du contenu d'une cellule :
 * 1. Priorité au niveau explicite : « GPHY2027 (L3) », « (M1) », « L3 », etc.
 * 2. Repli sur l'année de diplôme à 4 chiffres (ex. « GPhy-2026 ») + rentrée.
 */
export function extractPromotion(
  raw: string,
  rentreeYear: number,
): PromoExtractResult {
  const cell = (raw ?? '').trim()
  if (!cell) {
    return { status: 'invalid', reason: 'Promotion manquante' }
  }

  // 1. Niveau explicite dans la cellule (ex: "GPHY2027 (L3)", "(M1)", "L3")
  const levelMatch = cell.match(/\b(L3|M1|M2)\b/i)
  if (levelMatch) {
    return {
      status: 'ok',
      promotion: levelMatch[1].toUpperCase() as Promotion,
    }
  }

  // 2. Année de diplôme à 4 chiffres (ex: "GPhy-2026")
  const yearMatch = cell.match(/(20\d{2})/)
  if (yearMatch) {
    const gradYear = Number(yearMatch[1])
    const promo = gradYearToPromotion(gradYear, rentreeYear)
    if (promo) {
      return { status: 'ok', promotion: promo }
    }
    return {
      status: 'excluded',
      reason: `Promo ${gradYear} hors L3/M1/M2 (diplômé ou hors périmètre)`,
    }
  }

  return {
    status: 'excluded',
    reason: `Promotion illisible ou hors L3/M1/M2 : « ${cell} »`,
  }
}

export type DetectedColumns = {
  idxEmail: number
  idxPromotion: number
  idxNom: number
  idxPrenom: number
  idxFullName: number
  sep: string
}

/**
 * Détecte automatiquement les colonnes d'après la ligne d'en-tête.
 */
export function detectColumns(headerLine: string): DetectedColumns {
  const sep = headerLine.includes(';') ? ';' : ','
  const header = splitLine(headerLine, sep).map((h) =>
    stripAccents(h.toLowerCase()).trim(),
  )

  // Email : dernière colonne contenant 'mail' ou 'courriel'
  let idxEmail = -1
  header.forEach((h, i) => {
    if (h.includes('mail') || h.includes('courriel')) {
      idxEmail = i
    }
  })
  if (idxEmail === -1) {
    idxEmail = header.length - 1
  }

  // Promotion : colonne contenant 'promo' (ex. 'promo d\'appartenance', 'promotion d\'appartenance')
  // ou 'filiere'
  const idxPromotion = header.findIndex(
    (h) => h.includes('promo') || h.includes('filiere'),
  )

  // Prénom
  const idxPrenom = header.findIndex(
    (h) => h === 'prenom' || h.startsWith('prenom'),
  )

  // Nom : colonne 'nom' ou commençant par 'nom' (hors 'nom complet', 'nom et prenom')
  const idxNom = header.findIndex(
    (h) =>
      (h === 'nom' || h.startsWith('nom')) &&
      !h.includes('complet') &&
      !h.includes('prenom'),
  )

  // Nom complet regroupé (si une seule colonne regroupe nom et prénom)
  const idxFullName = header.findIndex(
    (h) =>
      h.includes('nom complet') ||
      h.includes('nom et prenom') ||
      h.includes('nom prenom'),
  )

  return { idxEmail, idxPromotion, idxNom, idxPrenom, idxFullName, sep }
}

export function parseStudentsCsv(
  text: string,
  rentreeYear: number,
): ParseResult {
  const valid: ParsedStudent[] = []
  const invalid: ParseIssue[] = []
  const duplicates: ParseIssue[] = []
  const excluded: ParseIssue[] = []
  const seen = new Set<string>()
  const empty: ParseResult = { valid, invalid, duplicates, excluded }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return empty

  const { idxEmail, idxPromotion, idxNom, idxPrenom, idxFullName, sep } =
    detectColumns(lines[0])

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    const cols = splitLine(raw, sep)
    const email = (cols[idxEmail] ?? '').toLowerCase()

    if (!EMAIL_RE.test(email)) {
      invalid.push({ line: i + 1, raw, reason: 'Email invalide ou manquant' })
      continue
    }

    const promoCell = idxPromotion >= 0 ? (cols[idxPromotion] ?? '') : ''
    const promoRes = extractPromotion(promoCell, rentreeYear)

    if (promoRes.status === 'invalid') {
      invalid.push({ line: i + 1, raw, reason: promoRes.reason })
      continue
    }
    if (promoRes.status === 'excluded') {
      excluded.push({ line: i + 1, raw, reason: promoRes.reason })
      continue
    }

    if (seen.has(email)) {
      duplicates.push({ line: i + 1, raw, reason: `Doublon de « ${email} »` })
      continue
    }
    seen.add(email)

    const nom = idxNom >= 0 ? (cols[idxNom] ?? '') : ''
    const prenom = idxPrenom >= 0 ? (cols[idxPrenom] ?? '') : ''
    const full_name =
      idxFullName >= 0 && cols[idxFullName]
        ? cols[idxFullName].trim()
        : `${prenom} ${nom}`.trim()

    valid.push({ email, full_name, promotion: promoRes.promotion })
  }

  return { valid, invalid, duplicates, excluded }
}
