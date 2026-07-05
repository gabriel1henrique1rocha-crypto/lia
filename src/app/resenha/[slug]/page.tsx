import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedReviewBySlug } from '@/lib/review/queries'
import { BookDetails } from '@/components/book/BookDetails'
import { BookCover } from '@/components/book/BookCover'
import { Rating } from '@/components/review/Rating'

type Params = { slug: string }

/** Resumo do corpo para meta description (corte em palavra, ~160 chars). */
function excerpt(body: string | null, max = 160): string {
  if (!body) return ''
  const text = body.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Quebra o corpo (texto puro no M1) em parágrafos por linha em branco. */
function splitParagraphs(body: string | null): string[] {
  if (!body) return []
  return body
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// SEO por requisição (RVW-19/20/21). Em 404 retorna metadata genérico — NÃO
// vaza dados de resenha inexistente. og:url é resolvida absoluta via metadataBase
// do layout (T-29). Dedupe da query com generateMetadata via cache() (T-25).
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const review = await getPublishedReviewBySlug(slug)
  if (!review) {
    return { title: 'Resenha não encontrada · LIA' }
  }
  const description = excerpt(review.body)
  const url = `/resenha/${slug}`
  return {
    title: `${review.title} · LIA`,
    description,
    openGraph: { title: review.title, description, type: 'article', url },
  }
}

/**
 * Rota `/resenha/[slug]` (App Router, SSR). Server Component async: resolve o
 * slug via getPublishedReviewBySlug (filtro status='published' explícito), e se
 * nada volta chama notFound() → 404 acessível (not-found.tsx). O conteúdo é um
 * <article> semântico com um único <h1>, reusando BookDetails para a ficha.
 * Nenhum componente de cliente no caminho factual — 100% SSR (RVW-26).
 */
export default async function ReviewPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const review = await getPublishedReviewBySlug(slug)
  if (!review) notFound()

  const { book } = review
  const paragraphs = splitParagraphs(review.body)

  return (
    <article className="lia-review">
      <header>
        <h1>{review.title}</h1>
        <p>
          {book.title} — {book.author}
        </p>
        {review.rating != null && <Rating rating={review.rating} />}
      </header>

      <BookCover title={book.title} />

      <section aria-labelledby="ficha">
        <h2 id="ficha">Ficha técnica</h2>
        <BookDetails book={book} headingLevel={3} />
      </section>

      <section aria-labelledby="resenha-texto">
        <h2 id="resenha-texto">Resenha</h2>
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </section>

      <section aria-labelledby="comentarios">
        <h2 id="comentarios">Comentários</h2>
        <p>Os comentários chegam em breve.</p>
      </section>

      <footer>
        <button
          type="button"
          className="lia-btn lia-btn--secondary lia-btn--md"
          disabled
          aria-describedby="rec-soon"
        >
          Recomendar
        </button>
        <span id="rec-soon">Disponível em breve</span>
      </footer>
    </article>
  )
}
