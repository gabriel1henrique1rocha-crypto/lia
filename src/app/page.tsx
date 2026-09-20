import type { Metadata } from 'next'
import {
  listDisabilityRows,
  listFeaturedReviews,
  listPublishedReviews,
  listFilterOptions,
  type DisabilityRow as Row,
  type FilterOptions,
  type ReviewListItem,
} from '@/lib/review/queries'
import {
  parseListingParams,
  PAGE_SIZE,
  type ListingParams,
  type RawSearchParams,
} from '@/lib/review/listingParams'
import { FeaturedStrip } from '@/components/home/FeaturedStrip'
import { DisabilityRow } from '@/components/home/DisabilityRow'
import { DiscoveryCard } from '@/components/home/DiscoveryCard'
import { SynopsisEscape } from '@/components/home/SynopsisEscape'
import { ListingControls } from '@/components/listing/ListingControls'
import { Pagination } from '@/components/listing/Pagination'
import { EmptyState } from '@/components/listing/EmptyState'
import { ResultsCount } from '@/components/listing/ResultsCount'

type SearchParams = Promise<RawSearchParams>

/**
 * Dois modos (HOME-30), decididos pelo MESMO predicado do `noindex`:
 *  · navegação (sem param ativo) → faixa de destaques + fileiras por deficiência;
 *  · busca (com param ativo) → grade "Resultados" + contagem + paginação. A faixa
 *    em movimento some neste modo (C-5): depois do submit a página recarrega no
 *    topo e o resultado não deve ficar abaixo de uma animação.
 */
type HomeData =
  | {
      mode: 'browse'
      featured: ReviewListItem[]
      rows: Row[]
      options: FilterOptions
    }
  | {
      mode: 'search'
      options: FilterOptions
      listing: { rows: ReviewListItem[]; total: number }
      clampedParams: ListingParams
    }

const PARAM_KEYS = ['q', 'genero', 'autor', 'deficiencia', 'ordem', 'pagina'] as const

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
    title: params.q
      ? `Busca: “${params.q}” · OLDA`
      : 'OLDA — Observatório Anticapacitista de Literatura e Deficiência',
    alternates: { canonical: '/' },
    robots: { index: !active, follow: true },
  }
}

/** Leitura da home (ANON). Normaliza a página além do total (DD-2) após o count. */
async function loadHome(params: ListingParams, active: boolean): Promise<HomeData> {
  if (!active) {
    const [featured, rows, options] = await Promise.all([
      listFeaturedReviews(),
      listDisabilityRows(),
      listFilterOptions(),
    ])
    return { mode: 'browse', featured, rows, options }
  }
  const [options, initialListing] = await Promise.all([
    listFilterOptions(),
    listPublishedReviews(params),
  ])
  const lastPage = Math.max(1, Math.ceil(initialListing.total / PAGE_SIZE))
  const clampedParams = params.pagina > lastPage ? { ...params, pagina: lastPage } : params
  const listing =
    clampedParams === params ? initialListing : await listPublishedReviews(clampedParams)
  return { mode: 'search', options, listing, clampedParams }
}

/** Hero (HOME-09, C-1 a): o nome institucional pedido pela coordenação. */
function Hero() {
  return (
    <header className="lia-home__hero">
      <h1 className="lia-home__title">Observatório Anticapacitista de Literatura e Deficiência</h1>
      <p className="lia-home__subtitle">
        Mapeamento crítico das representações da deficiência na literatura ocidental
      </p>
    </header>
  )
}

/**
 * Home pública `/` (App Router, SSR). Todo o estado vive na URL — compartilhável
 * e operável SEM JS (form GET + links). Único `<h1>` no hero; `h2` "Em destaque"
 * e `h2` "Resenhas"; `h3` por fileira ou "Resultados"; título do card abaixo.
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams
  const params = parseListingParams(raw)
  const active = hasActiveParams(raw)

  let data: HomeData | null = null
  try {
    data = await loadHome(params, active)
  } catch {
    // Leitura indisponível (ex.: banco inacessível) → degrada SEM 500: a rota
    // segue 200 e acessível (HOME-34; não vaza o erro).
    data = null
  }

  if (!data) {
    return (
      <div className="lia-home">
        <Hero />
        <div className="lia-home__section">
          <div className="lia-empty" role="status">
            <p className="lia-empty__title">Não foi possível carregar as resenhas</p>
            <p className="lia-empty__text">
              Houve um problema ao buscar as resenhas agora. Tente recarregar a página em instantes.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const acervoVazio = data.mode === 'browse' && data.featured.length === 0 && data.rows.length === 0

  return (
    <div className="lia-home">
      <SynopsisEscape />
      <Hero />

      {data.mode === 'browse' && <FeaturedStrip reviews={data.featured} />}

      <section id="resenhas" className="lia-home__section" aria-labelledby="resenhas-titulo">
        <div className="lia-home__section-head">
          <h2 id="resenhas-titulo" className="lia-home__section-title">
            Resenhas
          </h2>
          <p className="lia-home__section-lead">Livros resenhados pelo observatório.</p>
        </div>

        <ListingControls params={params} options={data.options} />

        {data.mode === 'browse' ? (
          acervoVazio ? (
            <EmptyState variant="empty-catalog" />
          ) : (
            <div className="lia-home__rows">
              {data.rows.map((row, i) => (
                <DisabilityRow key={row.term?.slug ?? 'outras'} row={row} index={i} />
              ))}
            </div>
          )
        ) : (
          <section className="lia-results" aria-labelledby="resultados-titulo">
            <div className="lia-section__head">
              <h3 id="resultados-titulo" className="lia-section__title">
                Resultados
              </h3>
              <ResultsCount total={data.listing.total} />
            </div>

            {data.listing.rows.length > 0 ? (
              <>
                <ol className="lia-results__grid">
                  {data.listing.rows.map((review) => (
                    <li key={review.id} className="lia-results__item">
                      <DiscoveryCard
                        review={review}
                        size="sm"
                        headingLevel={4}
                        instanceId={`resultado-${review.id}`}
                        withByline
                      />
                    </li>
                  ))}
                </ol>
                <Pagination params={data.clampedParams} total={data.listing.total} />
              </>
            ) : (
              <EmptyState variant="no-results" params={params} />
            )}
          </section>
        )}
      </section>
    </div>
  )
}
