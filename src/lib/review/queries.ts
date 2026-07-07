import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import type { Database, Tables } from '@/lib/database.types'
import type { BookView } from '@/lib/book/queries'
import { excerpt } from '@/lib/review/excerpt'
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
}

const REVIEW_SELECT = '*, book(*, genre(name, slug))'

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
  const supabase = createServerClient()
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
  rating: number | null
  published_at: string | null
  excerpt: string
  book: {
    title: string
    author: string
    genre: { name: string; slug: string } | null
  }
}

// Select da listagem: traz `body` só para derivar o excerpt no servidor.
// book!inner/genre!inner são obrigatórios para filtrar por campos aninhados
// (book.author, book.genre.slug) — sem o hint o PostgREST não restringe a linha
// pai. Toda review tem book (FK) e todo book tem genre, então o inner não perde
// linhas (design §3).
const LIST_SELECT =
  'id, title, slug, rating, body, published_at, book!inner(title, author, genre!inner(name, slug))'

type RawListRow = {
  id: string
  title: string
  slug: string
  rating: number | null
  body: string | null
  published_at: string | null
  book: { title: string; author: string; genre: { name: string; slug: string } | null }
}

function toListItem(row: RawListRow): ReviewListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    rating: row.rating,
    published_at: row.published_at,
    excerpt: excerpt(row.body),
    book: { title: row.book.title, author: row.book.author, genre: row.book.genre ?? null },
  }
}

/**
 * Listagem pública paginada: busca (`ilike` no title), filtros combináveis
 * (gênero/autor/nota mín.), ordenação e fatia por `range` — tudo numa ÚNICA
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
function buildFilteredSelect(
  client: ReadClient,
  params: ListingParams,
  { head }: { head?: boolean } = {}
) {
  let query = client
    .from('review')
    .select(LIST_SELECT, { count: 'exact', head })
    .eq('status', 'published')
  if (params.q) query = query.ilike('title', `%${escapeLike(params.q)}%`)
  if (params.genero) query = query.eq('book.genre.slug', params.genero)
  if (params.autor) query = query.eq('book.author', params.autor)
  if (params.nota != null) query = query.gte('rating', params.nota)
  return query
}

export async function listPublishedReviews(
  params: ListingParams,
  client: ReadClient = createServerClient()
): Promise<{ rows: ReviewListItem[]; total: number }> {
  const from = (params.pagina - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const filtered = buildFilteredSelect(client, params)
  // Mapa de ordenação (design §3): nota/recentes com nulls last (sem nota não
  // "vence"); título asc pela collation do banco (suficiente no MVP).
  const ordered =
    params.ordem === 'nota'
      ? filtered.order('rating', { ascending: false, nullsFirst: false })
      : params.ordem === 'titulo'
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
      })
      if (countError) throw countError
      return { rows: [], total: total ?? 0 }
    }
    throw error
  }
  const rows = ((data as RawListRow[] | null) ?? []).map(toListItem)
  return { rows, total: count ?? 0 }
}

/** Destaque derivado: 4 mais recentes publicadas, sem filtros (C-5/DD-5). */
export async function listFeaturedReviews(
  client: ReadClient = createServerClient()
): Promise<ReviewListItem[]> {
  const { data, error } = await client
    .from('review')
    .select(LIST_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(4)
  if (error) throw error
  return ((data as RawListRow[] | null) ?? []).map(toListItem)
}

/**
 * Opções dos selects de filtro, derivadas do acervo PUBLICADO (DD-4) — nenhum
 * valor de filtro sem resultado possível. Query leve + dedupe/sort em JS.
 */
export async function listFilterOptions(
  client: ReadClient = createServerClient()
): Promise<{ genres: { name: string; slug: string }[]; authors: string[] }> {
  const { data, error } = await client
    .from('review')
    .select('book!inner(author, genre!inner(name, slug))')
    .eq('status', 'published')
  if (error) throw error
  const rows =
    (data as { book: { author: string; genre: { name: string; slug: string } | null } }[] | null) ??
    []
  const genreBySlug = new Map<string, string>()
  const authors = new Set<string>()
  for (const row of rows) {
    if (row.book.author) authors.add(row.book.author)
    if (row.book.genre) genreBySlug.set(row.book.genre.slug, row.book.genre.name)
  }
  const genres = [...genreBySlug.entries()]
    .map(([slug, name]) => ({ name, slug }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return { genres, authors: [...authors].sort((a, b) => a.localeCompare(b, 'pt-BR')) }
}
