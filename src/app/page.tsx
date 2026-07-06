import type { Metadata } from 'next'
import { listFeaturedReviews, listPublishedReviews, listFilterOptions } from '@/lib/review/queries'
import { parseListingParams, PAGE_SIZE, type RawSearchParams } from '@/lib/review/listingParams'
import { FeaturedCarousel } from '@/components/review/FeaturedCarousel'
import { ReviewCard } from '@/components/review/ReviewCard'
import { ListingControls } from '@/components/listing/ListingControls'
import { Pagination } from '@/components/listing/Pagination'
import { EmptyState } from '@/components/listing/EmptyState'
import { ResultsCount } from '@/components/listing/ResultsCount'

type SearchParams = Promise<RawSearchParams>

const PARAM_KEYS = ['q', 'genero', 'autor', 'nota', 'ordem', 'pagina'] as const

/** Há busca/filtro/paginação ativos? → decide o noindex (SEO §5). */
function hasActiveParams(raw: RawSearchParams): boolean {
  return PARAM_KEYS.some((key) => {
    const value = raw[key]
    return Array.isArray(value) ? value.length > 0 : value != null && value !== ''
  })
}

/**
 * SEO da home (§5): canonical SEMPRE `/` (qualquer combinação de filtros aponta
 * para a home limpa → zero conteúdo duplicado indexável); `noindex` quando há
 * qualquer searchParam ativo (a home limpa segue indexável); o crawler ainda
 * SEGUE os links dos cards. O título reflete a busca (DD-9 — anúncio na troca de
 * página via <title>).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const raw = await searchParams
  const params = parseListingParams(raw)
  const active = hasActiveParams(raw)
  return {
    title: params.q ? `Busca: “${params.q}” · LIA` : 'LIA — Leituras e impressões anotadas',
    alternates: { canonical: '/' },
    robots: { index: !active, follow: true },
  }
}

/**
 * Home pública `/` (App Router, SSR). Lê `searchParams` (Promise no Next 16),
 * consulta a listagem/destaque/opções via ANON e monta a estrutura semântica
 * (único <h1>; sections com aria-labelledby; resultados em <ol>). Todo o estado
 * vive na URL — compartilhável e operável SEM JS (form GET + links).
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams
  const params = parseListingParams(raw)

  const [featured, options, initialListing] = await Promise.all([
    listFeaturedReviews(),
    listFilterOptions(),
    listPublishedReviews(params),
  ])

  // Página além do total → normaliza para a última válida (DD-2), após o count.
  const lastPage = Math.max(1, Math.ceil(initialListing.total / PAGE_SIZE))
  const clampedParams = params.pagina > lastPage ? { ...params, pagina: lastPage } : params
  const listing =
    clampedParams === params ? initialListing : await listPublishedReviews(clampedParams)
  const { rows, total } = listing

  // Acervo vazio (nenhuma publicada) ≠ busca sem resultados.
  const catalogEmpty = total === 0 && featured.length === 0

  return (
    <div className="lia-home">
      <h1 className="lia-home__title">Resenhas</h1>

      <FeaturedCarousel reviews={featured} />

      <ListingControls params={params} options={options} />

      <section aria-labelledby="resultados-titulo">
        <div className="lia-section__head">
          <h2 id="resultados-titulo" className="lia-section__title">
            Resultados
          </h2>
          <ResultsCount total={total} />
        </div>

        {rows.length > 0 ? (
          <>
            <ol className="lia-grid">
              {rows.map((review) => (
                <ReviewCard
                  key={review.id}
                  slug={review.slug}
                  title={review.title}
                  author={review.book.author}
                  rating={review.rating}
                  excerpt={review.excerpt}
                />
              ))}
            </ol>
            <Pagination params={clampedParams} total={total} />
          </>
        ) : catalogEmpty ? (
          <EmptyState variant="empty-catalog" />
        ) : (
          <EmptyState variant="no-results" params={params} />
        )}
      </section>
    </div>
  )
}
