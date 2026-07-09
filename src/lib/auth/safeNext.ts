// safeNext — protege o parâmetro `next` do callback contra OPEN REDIRECT (F-10).
//
// Aceita SOMENTE um caminho relativo interno começando por uma única '/'. Toda
// outra forma (URL absoluta, protocol-relative '//', backslash, esquema como
// `javascript:`, byte nulo) cai no default seguro '/admin'. Função PURA →
// testável isoladamente (T8 unit); usada pelo /auth/confirm.
export function safeNext(raw: string | null | undefined): string {
  const DEFAULT = '/admin'
  if (!raw) return DEFAULT
  if (!raw.startsWith('/')) return DEFAULT // absoluto ou esquema (https:, javascript:)
  if (raw.startsWith('//')) return DEFAULT // protocol-relative → aponta para host externo
  if (raw.includes('\\')) return DEFAULT // '\' pode ser normalizado para '/' por browsers
  if (raw.includes('\0')) return DEFAULT // byte nulo
  return raw
}
