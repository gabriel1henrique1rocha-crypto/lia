/**
 * Lógica pura de estado da listagem (home `/`). Fonte única do contrato de
 * parâmetros: alimenta a query, os links de paginação/filtro e o eco do estado
 * vazio. Sem I/O, sem React — testável isolada (DD-1/DD-2).
 */

export type SortOrder = 'recentes' | 'nota' | 'titulo'

export type ListingParams = {
  q: string
  genero: string
  autor: string
  nota: number | null
  ordem: SortOrder
  pagina: number
}

/** Tamanho de página fixo (DD-6): divisível por 2/3/4 colunas do grid. */
export const PAGE_SIZE = 12

const MAX_Q = 100
const SORT_ORDERS: readonly SortOrder[] = ['recentes', 'nota', 'titulo']

/**
 * Formato que `searchParams` assume após `await` no App Router (Next 16):
 * cada chave é `string | string[] | undefined`.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/**
 * Valida e normaliza os `searchParams` da home. Valor inválido → default
 * silencioso; NUNCA lança (edge cases do spec: `?nota=abc`, `?ordem=xyz`,
 * `?pagina=999`). `pagina` só garante ≥ 1 aqui; o clamp ao total real acontece
 * na página, após o `count`.
 */
export function parseListingParams(raw: RawSearchParams): ListingParams {
  const q = first(raw.q).trim().slice(0, MAX_Q)
  const genero = first(raw.genero).trim()
  const autor = first(raw.autor).trim()

  const notaParsed = Number.parseInt(first(raw.nota), 10)
  const nota =
    Number.isInteger(notaParsed) && notaParsed >= 1 && notaParsed <= 5 ? notaParsed : null

  const ordemRaw = first(raw.ordem)
  const ordem: SortOrder = (SORT_ORDERS as readonly string[]).includes(ordemRaw)
    ? (ordemRaw as SortOrder)
    : 'recentes'

  const paginaParsed = Number.parseInt(first(raw.pagina), 10)
  const pagina = Number.isInteger(paginaParsed) && paginaParsed >= 1 ? paginaParsed : 1

  return { q, genero, autor, nota, ordem, pagina }
}

/**
 * Monta o href da listagem preservando o estado atual, aplicando `overrides`
 * (ex.: `{ pagina: 2 }`). Omite chaves em default (q vazio, ordem `recentes`,
 * pagina 1) para URLs limpas e canônicas.
 */
export function buildListingHref(
  params: ListingParams,
  overrides: Partial<ListingParams> = {}
): string {
  const merged = { ...params, ...overrides }
  const sp = new URLSearchParams()
  if (merged.q) sp.set('q', merged.q)
  if (merged.genero) sp.set('genero', merged.genero)
  if (merged.autor) sp.set('autor', merged.autor)
  if (merged.nota != null) sp.set('nota', String(merged.nota))
  if (merged.ordem !== 'recentes') sp.set('ordem', merged.ordem)
  if (merged.pagina > 1) sp.set('pagina', String(merged.pagina))
  const qs = sp.toString()
  return qs ? `/?${qs}` : '/'
}

/**
 * Escapa os curingas do LIKE/ILIKE no termo do usuário, para busca por LITERAL.
 * A ORDEM importa: barra invertida PRIMEIRO (senão os escapes seguintes se
 * auto-escapam), depois `%` e `_`. Assim "50%" casa o literal "50%" e "a_b" o
 * "_" literal — sem padrão injetado. Baseia-se no ESCAPE padrão `\` do LIKE/
 * ILIKE do PostgreSQL (design §3).
 *
 * NB de segurança: a proteção contra SQL injection vem da parametrização do
 * supabase-js; este escape trata SÓ a semântica de curinga do LIKE. A verificação
 * de que o `ilike` do PostgREST preserva `\` como escape default é responsabilidade
 * de quem monta a query (ver queries.ts / §3).
 */
export function escapeLike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
