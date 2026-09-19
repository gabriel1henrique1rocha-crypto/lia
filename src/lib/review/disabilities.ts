/**
 * Deficiência representada (D-12) — utilidades PURAS, sem I/O.
 *
 * Módulo à parte de `queries.ts` pelo mesmo motivo de `excerpt.ts`: a página e
 * os testes importam a regra de exibição sem arrastar o client do Supabase (e
 * sem que um `vi.mock('@/lib/review/queries')` a apague junto).
 */

/** Termo como lido pela página pública (DIS-06). */
export type DisabilityTag = { name: string; slug: string; sort_order: number }

/**
 * Deficiências ATIVAS de uma resenha, na ordem editorial (`sort_order`, depois
 * nome). `term` chega `null` quando o termo está DESATIVADO — a RLS de
 * `disability_term` só mostra ativos ao público — e é descartado aqui.
 */
export function disabilitiesOf(review: {
  review_disability?: { term: DisabilityTag | null }[] | null
}): DisabilityTag[] {
  return (review.review_disability ?? [])
    .map((vinculo) => vinculo.term)
    .filter((term): term is DisabilityTag => term !== null)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR'))
}
