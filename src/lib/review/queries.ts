import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createPublicClient } from '@/lib/supabase/public'
import type { Database, Tables } from '@/lib/database.types'
import type { BookView } from '@/lib/book/queries'
import { excerpt } from '@/lib/review/excerpt'
import { disabilitiesOf, type DisabilityTag } from '@/lib/review/disabilities'
import { escapeLike, PAGE_SIZE, type ListingParams } from '@/lib/review/listingParams'

/** Cliente de leitura. Default = ANON em produção (TD-04 — sem service_role no
 * caminho público). Parâmetro opcional só para injetar o client LOCAL no teste
 * de integração (TD-02); os chamadores usam a assinatura sem cliente. */
type ReadClient = SupabaseClient<Database>

/**
 * Leitura tipada de uma resenha publicada, com a ficha do livro (book + genre)
 * embutida no mesmo select. Consumida pela rota `/resenha/[slug]` (page + metadata).
 * A cobertura de contrato (RLS, dados reais) está no teste de integração T-31.
 */
export type ReviewView = Tables<'review'> & {
  book: BookView
  /**
   * Vínculos de deficiência. `term` vem `null` quando o termo está DESATIVADO
   * (RLS de `disability_term` só mostra ativos ao público) — filtrar antes de
   * exibir (`disabilitiesOf`).
   */
  review_disability?: { term: DisabilityTag | null }[]
}

const REVIEW_SELECT =
  '*, book(*, genre(name, slug)), review_disability(term:disability_term(name, slug, sort_order))'

/**
 * Busca a resenha publicada pelo `slug`, ou `null` quando inexistente OU em
 * rascunho (sem lançar). O filtro `status='published'` é EXPLÍCITO na query —
 * não delegado ao RLS — porque o server client pode usar service_role (que
 * ignora RLS); assim RVW-03/RVW-13 valem mesmo nesse caminho.
 *
 * Envolvida em `cache()` do React: `generateMetadata` e a `page` chamam esta
 * função na mesma requisição; o cache deduplica para uma única viagem ao banco.
 */
export const getPublishedReviewBySlug = cache(async (slug: string): Promise<ReviewView | null> => {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('review')
    .select(REVIEW_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  return (data as ReviewView | null) ?? null
})

/**
 * Item da LISTAGEM (home `/`): subset tipado do que o ReviewCard/slides usam,
 * com o `excerpt` já cortado no servidor — o `body` inteiro NÃO trafega ao
 * cliente do card (DD-8). Mesmo padrão de tipo derivado do schema que ReviewView.
 */
export type ReviewListItem = {
  id: string
  title: string
  slug: string
  published_at: string | null
  excerpt: string
  book: {
    title: string
    author: string
    genre: { name: string; slug: string } | null
    /** Ano da obra (kicker/linha de apoio do card — home-redesign C-9). */
    year: number | null
    /** Ilustração do card (HOME-19). `null` → fallback tipográfico. */
    cover_url: string | null
  }
  /** Termos ATIVOS, em `sort_order` (sinopse do card — HOME-21). */
  disabilities: { name: string; slug: string }[]
}

// Select da listagem: traz `body` só para derivar o excerpt no servidor.
// book!inner/genre!inner são obrigatórios para filtrar por campos aninhados
// (book.author, book.genre.slug) — sem o hint o PostgREST não restringe a linha
// pai. Toda review tem book (FK) e todo book tem genre, então o inner não perde
// linhas (design §3).
//
// `disabilities:` é um embed COM ALIAS só para exibição (home-redesign): quando o
// filtro por deficiência está ativo, o embed de FILTRO (`!inner`, abaixo) volta
// só o termo filtrado; este traz todos os termos da resenha para o card.
const LIST_SELECT =
  'id, title, slug, body, published_at, book!inner(title, author, year, cover_url, genre!inner(name, slug)), disabilities:review_disability(term:disability_term(name, slug, sort_order))'

type RawListRow = {
  id: string
  title: string
  slug: string
  body: string | null
  published_at: string | null
  book: {
    title: string
    author: string
    year: number | null
    cover_url: string | null
    genre: { name: string; slug: string } | null
  }
  disabilities?: { term: DisabilityTag | null }[] | null
}

function toListItem(row: RawListRow): ReviewListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    published_at: row.published_at,
    excerpt: excerpt(row.body),
    book: {
      title: row.book.title,
      author: row.book.author,
      genre: row.book.genre ?? null,
      year: row.book.year ?? null,
      cover_url: row.book.cover_url ?? null,
    },
    disabilities: disabilitiesOf({ review_disability: row.disabilities }).map(({ name, slug }) => ({
      name,
      slug,
    })),
  }
}

/**
 * Busca por título OU autor (home-redesign C-6). O autor mora em `book`, e o
 * `or` do PostgREST não mistura coluna da tabela-pai com coluna embutida — por
 * isso a busca resolve antes os `book_id` cujo autor casa e os soma ao `or`.
 * Duas viagens só quando há `q`; o curinga do usuário continua escapado.
 */
async function bookIdsByAuthor(client: ReadClient, q: string): Promise<string[]> {
  const { data, error } = await client
    .from('book')
    .select('id')
    .ilike('author', `%${escapeLike(q)}%`)
    .limit(500)
  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

/** Valor de filtro `or` do PostgREST entre aspas (vírgula/parêntese no termo). */
function orValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Listagem pública paginada: busca (`ilike` no title), filtros combináveis
 * (gênero/autor), ordenação e fatia por `range` — tudo numa ÚNICA
 * viagem (`count:'exact'` + `range`). Leitura via ANON; `status='published'`
 * EXPLÍCITO como defesa em profundidade além da RLS (mesmo racional de
 * getPublishedReviewBySlug; TD-04). Leitura reusa policies/GRANTs 0003–0006 —
 * a 0006 abriu o SELECT de `genre` (lacuna da 0003 achada nesta feature;
 * exceção pontual, aprovada, ao "sem migration" do LST-19).
 *
 * Perf/D-04: `ilike '%…%'` não usa índice B-tree (full scan) — aceito no MVP;
 * gatilho de evolução: milhares de linhas → pg_trgm (GIN)/tsvector, migration
 * ADITIVA sem mudar este contrato.
 *
 * Escape de curinga: `escapeLike` (\ % _) apoia-se no ESCAPE default `\` do
 * ILIKE do PostgreSQL. VERIFICAÇÃO (Knowledge Chain): o operador `ilike` do
 * PostgREST envia `title=ilike.*<padrão>*` e o Postgres aplica `\` como escape
 * default — confirmado no teste de integração (q='%'/'_' retornam 0, provando
 * que o curinga do usuário virou literal). Não emitimos `ESCAPE ''`.
 */
/**
 * Aplica `status='published'` + os filtros combináveis ao select da listagem.
 * Reusado pela fatia e pela contagem-fallback; `head:true` conta sem transferir
 * linhas. O `let query = …; query = query.eq(…)` preserva o tipo do builder.
 */
/**
 * Com filtro de deficiência (D-12, DIS-07), o select ganha a junção `!inner`:
 * só sobram resenhas com ao menos um vínculo cujo termo tem o slug pedido. O
 * PostgREST não duplica a linha-pai por vínculo, então a contagem segue certa.
 * Sem filtro, a junção NÃO entra — incluí-la como `!inner` sumiria com as
 * resenhas sem deficiência marcada.
 */
const LIST_SELECT_WITH_DISABILITY = `${LIST_SELECT}, filtro:review_disability!inner(disability_term!inner(slug))`

function buildFilteredSelect(
  client: ReadClient,
  params: ListingParams,
  { head, authorBookIds = [] }: { head?: boolean; authorBookIds?: string[] } = {}
) {
  let query = client
    .from('review')
    .select(params.deficiencia ? LIST_SELECT_WITH_DISABILITY : LIST_SELECT, {
      count: 'exact',
      head,
    })
    .eq('status', 'published')
  if (params.q) {
    const pattern = orValue(`%${escapeLike(params.q)}%`)
    query =
      authorBookIds.length > 0
        ? query.or(`title.ilike.${pattern},book_id.in.(${authorBookIds.join(',')})`)
        : query.or(`title.ilike.${pattern}`)
  }
  if (params.genero) query = query.eq('book.genre.slug', params.genero)
  if (params.autor) query = query.eq('book.author', params.autor)
  if (params.deficiencia) query = query.eq('filtro.disability_term.slug', params.deficiencia)
  return query
}

export async function listPublishedReviews(
  params: ListingParams,
  client: ReadClient = createPublicClient()
): Promise<{ rows: ReviewListItem[]; total: number }> {
  const from = (params.pagina - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const authorBookIds = params.q ? await bookIdsByAuthor(client, params.q) : []
  const filtered = buildFilteredSelect(client, params, { authorBookIds })
  // Mapa de ordenação (design §3): `recentes` (default) por published_at desc
  // com nulls last — rascunho sem data não "vence"; `titulo` asc pela collation
  // do banco (suficiente no MVP). A opção `nota` saiu com D-11 (a coluna foi
  // dropada pela 0010); o default nunca foi ela, então não houve troca de default.
  const ordered =
    params.ordem === 'titulo'
      ? filtered.order('title', { ascending: true })
      : filtered.order('published_at', { ascending: false, nullsFirst: false })

  const { data, error, count } = await ordered.range(from, to)
  if (error) {
    // Página além do total (offset fora do alcance) → PostgREST PGRST103 (HTTP
    // 416). Não há fatia, mas o total é válido: devolve vazio com a contagem
    // (head, sem transferir linhas); a página normaliza para a última válida na
    // camada acima (DD-2), sem 500.
    const rangeError =
      error.code === 'PGRST103' || /range not satisfiable/i.test(error.message ?? '')
    if (rangeError) {
      const { count: total, error: countError } = await buildFilteredSelect(client, params, {
        head: true,
        authorBookIds,
      })
      if (countError) throw countError
      return { rows: [], total: total ?? 0 }
    }
    throw error
  }
  // `unknown` no meio: com o select escolhido em runtime (com/sem a junção de
  // deficiência), o parser de tipos do supabase-js não infere a forma — mas as
  // DUAS variantes devolvem as mesmas colunas de `LIST_SELECT` (a junção só
  // filtra; o campo extra é ignorado por `toListItem`).
  const rows = ((data as unknown as RawListRow[] | null) ?? []).map(toListItem)
  return { rows, total: count ?? 0 }
}

/** Quantos destaques a faixa da home mostra (home-redesign C-3, HOME-10). */
export const FEATURED_LIMIT = 10

/** Destaque derivado: N mais recentes publicadas, sem filtros (LST-18, HOME-10). */
export async function listFeaturedReviews(
  client: ReadClient = createPublicClient()
): Promise<ReviewListItem[]> {
  const { data, error } = await client
    .from('review')
    .select(LIST_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(FEATURED_LIMIT)
  if (error) throw error
  return ((data as unknown as RawListRow[] | null) ?? []).map(toListItem)
}

/** Itens por fileira da home (home-redesign C-12, HOME-25). */
export const ROW_LIMIT = 12

/** Teto de leitura para montar as fileiras numa só viagem (A-12). */
const ROWS_SCAN_LIMIT = 500

export type DisabilityRow = {
  /** `null` = fileira "Outras resenhas" (sem termo ativo — HOME-28). */
  term: { name: string; slug: string } | null
  reviews: ReviewListItem[]
}

/**
 * Fileiras da home por deficiência representada (HOME-25/28, A-12).
 *
 * UMA consulta (publicadas, mais recentes primeiro, com os termos) e o
 * agrupamento no servidor: com o acervo atual isto é mais barato que uma
 * consulta por termo, e a ordem das fileiras sai da mesma regra de
 * `listFilterOptions` (termo ativo com ≥ 1 publicada, em `sort_order`).
 * Resenha com vários termos aparece em várias fileiras (A-13). As sem termo
 * vão para a fileira final "Outras resenhas".
 */
export async function listDisabilityRows(
  client: ReadClient = createPublicClient()
): Promise<DisabilityRow[]> {
  const { data, error } = await client
    .from('review')
    .select(LIST_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(ROWS_SCAN_LIMIT)
  if (error) throw error
  const raws = (data as unknown as RawListRow[] | null) ?? []

  const bySlug = new Map<string, { term: DisabilityTag; reviews: ReviewListItem[] }>()
  const semTermo: ReviewListItem[] = []
  for (const raw of raws) {
    const item = toListItem(raw)
    const termos = disabilitiesOf({ review_disability: raw.disabilities })
    if (termos.length === 0) {
      if (semTermo.length < ROW_LIMIT) semTermo.push(item)
      continue
    }
    for (const term of termos) {
      const row = bySlug.get(term.slug) ?? { term, reviews: [] }
      if (row.reviews.length < ROW_LIMIT) row.reviews.push(item)
      bySlug.set(term.slug, row)
    }
  }

  const rows: DisabilityRow[] = [...bySlug.values()]
    .sort(
      (a, b) =>
        a.term.sort_order - b.term.sort_order || a.term.name.localeCompare(b.term.name, 'pt-BR')
    )
    .map(({ term, reviews }) => ({ term: { name: term.name, slug: term.slug }, reviews }))
  if (semTermo.length > 0) rows.push({ term: null, reviews: semTermo })
  return rows
}

/**
 * Opções dos selects de filtro, derivadas do acervo PUBLICADO (DD-4) — nenhum
 * valor de filtro sem resultado possível. Query leve + dedupe/sort em JS.
 */
export type FilterOptions = {
  genres: { name: string; slug: string }[]
  authors: string[]
  /** Só termos ATIVOS com ao menos uma resenha publicada, em `sort_order` (DIS-07). */
  disabilities: { name: string; slug: string }[]
}

export async function listFilterOptions(
  client: ReadClient = createPublicClient()
): Promise<FilterOptions> {
  const { data, error } = await client
    .from('review')
    .select(
      'book!inner(author, genre!inner(name, slug)), review_disability(term:disability_term(name, slug, sort_order))'
    )
    .eq('status', 'published')
  if (error) throw error
  const rows =
    (data as
      | {
          book: { author: string; genre: { name: string; slug: string } | null }
          review_disability?: { term: DisabilityTag | null }[]
        }[]
      | null) ?? []
  const disabilityBySlug = new Map<string, DisabilityTag>()
  for (const row of rows) {
    for (const term of disabilitiesOf(row)) disabilityBySlug.set(term.slug, term)
  }
  const disabilities = [...disabilityBySlug.values()]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR'))
    .map(({ name, slug }) => ({ name, slug }))
  const genreBySlug = new Map<string, string>()
  const authors = new Set<string>()
  for (const row of rows) {
    if (row.book.author) authors.add(row.book.author)
    if (row.book.genre) genreBySlug.set(row.book.genre.slug, row.book.genre.name)
  }
  const genres = [...genreBySlug.entries()]
    .map(([slug, name]) => ({ name, slug }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return {
    genres,
    authors: [...authors].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    disabilities,
  }
}
