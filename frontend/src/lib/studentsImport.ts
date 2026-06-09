// Parsing + validation d'un CSV d'étudiants côté navigateur.
// Sert d'aperçu/dry-run instantané AVANT tout envoi réseau : on montre à l'admin
// ce qui sera importé (valides), rejeté (invalides) ou ignoré (doublons internes).
//
// Format attendu : en-tête obligatoire avec au minimum une colonne `email`,
// colonnes `prenom`/`nom` optionnelles (ordre libre). Séparateur `,` ou `;`.

export type ParsedStudent = { email: string; full_name: string }
export type ParseIssue = { line: number; raw: string; reason: string }

export type ParseResult = {
  valid: ParsedStudent[]
  invalid: ParseIssue[]
  duplicates: ParseIssue[]
}

// Validation volontairement permissive : le vrai juge reste Supabase à l'envoi.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function splitLine(line: string, sep: string): string[] {
  return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
}

export function parseStudentsCsv(text: string): ParseResult {
  const valid: ParsedStudent[] = []
  const invalid: ParseIssue[] = []
  const duplicates: ParseIssue[] = []
  const seen = new Set<string>()

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return { valid, invalid, duplicates }

  // Séparateur déduit de l'en-tête (`;` fréquent sur les exports Excel FR).
  const headerLine = lines[0]
  const sep = headerLine.includes(';') ? ';' : ','
  const header = splitLine(headerLine, sep).map((h) =>
    stripAccents(h.toLowerCase()),
  )
  const idxEmail = header.indexOf('email')
  const idxPrenom = header.indexOf('prenom')
  const idxNom = header.indexOf('nom')

  if (idxEmail === -1) {
    invalid.push({
      line: 1,
      raw: headerLine,
      reason: "En-tête invalide : colonne « email » introuvable",
    })
    return { valid, invalid, duplicates }
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    const cols = splitLine(raw, sep)
    const email = (cols[idxEmail] ?? '').toLowerCase()

    if (!EMAIL_RE.test(email)) {
      invalid.push({ line: i + 1, raw, reason: 'Email invalide ou manquant' })
      continue
    }
    if (seen.has(email)) {
      duplicates.push({ line: i + 1, raw, reason: `Doublon de « ${email} »` })
      continue
    }
    seen.add(email)

    const prenom = idxPrenom >= 0 ? (cols[idxPrenom] ?? '') : ''
    const nom = idxNom >= 0 ? (cols[idxNom] ?? '') : ''
    const full_name = `${prenom} ${nom}`.trim()
    valid.push({ email, full_name })
  }

  return { valid, invalid, duplicates }
}
