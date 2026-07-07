/**
 * Resumo de texto para EXIBIÇÃO (trecho do card, meta description): normaliza
 * espaços, corta no limite SEM quebrar palavra e acrescenta reticências.
 *
 * Extraído da /resenha/[slug] (DD-8) para reuso pelo ReviewCard sem duplicação
 * divergente — mesma técnica, limite parametrizável por chamador (`max`).
 */
export function excerpt(body: string | null, max = 160): string {
  if (!body) return ''
  const text = body.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
