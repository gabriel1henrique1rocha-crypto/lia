import { BookCover } from '@/components/book/BookCover'
import { Rating } from '@/components/review/Rating'

export type ReviewCardProps = {
  slug: string
  title: string
  author: string
  rating: number | null
  excerpt: string
}

/**
 * Cartão de resenha compartilhado (LST-26) — Server Component. O cartão INTEIRO
 * é clicável (LST-02): o link do título se expande a todo o `<article>` via
 * overlay (`.lia-card__link::after`, @layer components), o que mantém o nome
 * acessível do link enxuto (só o título) e o restante do conteúdo na ordem de
 * leitura. Consome `BookCover` e `Rating` já existentes (não recria); a nota é
 * OMITIDA quando nula (C-1 — responsabilidade do chamador). Só tokens/classes.
 */
export function ReviewCard({ slug, title, author, rating, excerpt }: ReviewCardProps) {
  return (
    <li>
      <article className="lia-card lia-review-card">
        <BookCover title={title} />
        <div className="lia-card__body">
          <h3 className="lia-card__title">
            <a className="lia-card__link" href={`/resenha/${slug}`}>
              {title}
            </a>
          </h3>
          <p className="lia-card__author">{author}</p>
          {rating != null && <Rating rating={rating} />}
          <p className="lia-card__excerpt">{excerpt}</p>
        </div>
      </article>
    </li>
  )
}
