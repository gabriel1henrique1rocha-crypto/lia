/**
 * Normalização, validação (checksum) e formatação de ISBN.
 *
 * Funções puras, sem dependências. A hifenização de `formatIsbn` é
 * deliberadamente *pragmática* (agrupamento determinístico legível), não
 * registration-group-accurate — ver DD-5 no design da feature book-data.
 */

/**
 * Remove separadores (hífens, espaços, etc.), mantendo apenas dígitos e o
 * `X` final do ISBN-10, sempre em maiúsculo. Idempotente.
 */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

/**
 * Valida um ISBN-10 pelo checksum mód-11 (pesos 10..1; `X` = 10).
 * Normaliza a entrada antes de validar.
 */
export function isValidIsbn10(value: string): boolean {
  const v = normalizeIsbn(value)
  if (!/^[0-9]{9}[0-9X]$/.test(v)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const ch = v[i]
    const digit = ch === 'X' ? 10 : Number(ch)
    sum += digit * (10 - i)
  }
  return sum % 11 === 0
}

/**
 * Valida um ISBN-13 pelo checksum mód-10 (pesos alternados 1/3).
 * Normaliza a entrada antes de validar.
 */
export function isValidIsbn13(value: string): boolean {
  const v = normalizeIsbn(value)
  if (!/^[0-9]{13}$/.test(v)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) {
    sum += Number(v[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return sum % 10 === 0
}

/**
 * Valida um ISBN de 10 ou 13 dígitos. Aceita entrada hifenizada e campo
 * vazio (retorna `false` sem lançar).
 */
export function isValidIsbn(value: string): boolean {
  const v = normalizeIsbn(value)
  if (v.length === 10) return isValidIsbn10(v)
  if (v.length === 13) return isValidIsbn13(v)
  return false
}

/** Agrupa uma string em segmentos de tamanhos fixos, unidos por hífen. */
function group(value: string, sizes: number[]): string {
  const parts: string[] = []
  let i = 0
  for (const size of sizes) {
    parts.push(value.slice(i, i + size))
    i += size
  }
  if (i < value.length) parts.push(value.slice(i))
  return parts.filter(Boolean).join('-')
}

/**
 * Hifeniza um ISBN de forma legível (DD-5). Comprimento desconhecido →
 * retorna o valor normalizado sem hífens.
 *   ISBN-13: 978-85-3590-277-5  (grupos 3-2-4-3-1)
 *   ISBN-10: 8-535-90277-0      (grupos 1-3-5-1)
 */
export function formatIsbn(value: string): string {
  const v = normalizeIsbn(value)
  if (v.length === 13) return group(v, [3, 2, 4, 3, 1])
  if (v.length === 10) return group(v, [1, 3, 5, 1])
  return v
}
