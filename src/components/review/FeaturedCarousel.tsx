import { ReviewCard } from '@/components/review/ReviewCard'
import type { ReviewListItem } from '@/lib/review/queries'
import { FeaturedCarouselControls } from './FeaturedCarouselControls'

/**
 * Seção "Em destaque" (DD-5/DD-7) — Server Component. Renderiza a região de
 * marca (fundo sálvia) com os slides completos no HTML (capa+título+autor+nota
 * via ReviewCard, reusado — não recria). O comportamento de carrossel (setas +
 * indicadores, sem giro automático) fica no wrapper cliente fino, recebendo os
 * slides como children. Não renderiza nada quando não há destaque.
 */
export function FeaturedCarousel({ reviews }: { reviews: ReviewListItem[] }) {
  if (reviews.length === 0) return null
  return (
    <section className="lia-featured" aria-labelledby="destaque-titulo">
      <p className="lia-featured__eyebrow">Curadoria</p>
      <h2 id="destaque-titulo" className="lia-featured__title">
        Em destaque
      </h2>
      <FeaturedCarouselControls count={reviews.length}>
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            slug={review.slug}
            title={review.title}
            author={review.book.author}
            rating={review.rating}
            excerpt={review.excerpt}
          />
        ))}
      </FeaturedCarouselControls>
    </section>
  )
}
