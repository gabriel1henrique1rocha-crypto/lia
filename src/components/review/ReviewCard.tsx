import { BookCover } from '@/components/book/BookCover'

export type ReviewCardProps = {
  slug: string
  title: string
  author: string
  excerpt: string
}

/**
 * Cartão de resenha compartilhado (LST-26) — Server Component. O cartão INTEIRO
 * é clicável (LST-02): o link do título se expande a todo o `<article>` via
 * overlay (`.lia-card__link::after`, @layer components), o que mantém o nome
 * acessível do link enxuto (só o título) e o restante do conteúdo na ordem de
 * leitura. Consome `BookCover` já existente (não recria). A nota saiu do cartão
 * com D-11 (removida do produto; coluna dropada pela 0010). Só tokens/classes.
 */
export function ReviewCard({ slug, title, author, excerpt }: ReviewCardProps) {
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
          <p className="lia-card__excerpt">{excerpt}</p>
        </div>
      </article>
    </li>
  )
}
