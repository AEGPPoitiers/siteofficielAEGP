// Parsing + validation d'un CSV d'étudiants côté navigateur.
// Sert d'aperçu/dry-run instantané AVANT tout envoi réseau : on montre à l'admin
// ce qui sera importé (valides), rejeté (invalides), en doublon, ou exclu (promo
// hors L3/M1/M2 : diplômés déjà sortis, L1/L2…).
//
// Format réel (export du formulaire de la fac), colonnes repérées par leur intitulé :
//   Horodateur, Adresse e-mail, Promotion d'appartenance, Nom, Prénom, Adresse email
// - email retenu  = la DERNIÈRE colonne contenant « mail » (ignore l'adresse du
//   formulaire en 2e colonne) ;
// - promotion     = colonne contenant « promotion », exprimée en ANNÉE DE DIPLÔME
//   (ex. « GPhy-2026 ») dont on extrait l'année à 4 chiffres ;
// - nom / prénom  = colonnes « nom » / « prenom ».
// Séparateur `,` ou `;` déduit de l'en-tête.

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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function splitLine(line: string, sep: string): string[] {
  return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
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

  // Séparateur déduit de l'en-tête (`;` fréquent sur les exports Excel FR).
  const headerLine = lines[0]
  const sep = headerLine.includes(';') ? ';' : ','
  const header = splitLine(headerLine, sep).map((h) =>
    stripAccents(h.toLowerCase()),
  )

  // email = dernière colonne « …mail… » (ignore l'adresse du formulaire) ;
  // repli sur la dernière colonne si aucun intitulé ne contient « mail ».
  let idxEmail = -1
  header.forEach((h, i) => {
    if (h.includes('mail')) idxEmail = i
  })
  if (idxEmail === -1) idxEmail = header.length - 1

  const idxPromotion = header.findIndex((h) => h.includes('promotion'))
  const idxNom = header.findIndex((h) => h === 'nom')
  const idxPrenom = header.findIndex((h) => h === 'prenom')

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    const cols = splitLine(raw, sep)
    const email = (cols[idxEmail] ?? '').toLowerCase()

    if (!EMAIL_RE.test(email)) {
      invalid.push({ line: i + 1, raw, reason: 'Email invalide ou manquant' })
      continue
    }

    // Promotion = année de diplôme → niveau, selon l'année de rentrée.
    const promoCell = idxPromotion >= 0 ? (cols[idxPromotion] ?? '') : ''
    const match = promoCell.match(/(20\d{2})/)
    if (!match) {
      excluded.push({
        line: i + 1,
        raw,
        reason: `Promotion illisible : « ${promoCell} »`,
      })
      continue
    }
    const gradYear = Number(match[1])
    const promotion = gradYearToPromotion(gradYear, rentreeYear)
    if (!promotion) {
      excluded.push({
        line: i + 1,
        raw,
        reason: `Promo ${gradYear} hors L3/M1/M2 (diplômé ou hors périmètre)`,
      })
      continue
    }

    if (seen.has(email)) {
      duplicates.push({ line: i + 1, raw, reason: `Doublon de « ${email} »` })
      continue
    }
    seen.add(email)

    const nom = idxNom >= 0 ? (cols[idxNom] ?? '') : ''
    const prenom = idxPrenom >= 0 ? (cols[idxPrenom] ?? '') : ''
    const full_name = `${prenom} ${nom}`.trim()

    valid.push({ email, full_name, promotion })
  }

  return { valid, invalid, duplicates, excluded }
}
