import type { Metadata } from 'next'
import Link from 'next/link'
import { listGenres } from '@/lib/book/queries'
import { getReviewForEdit } from '@/lib/review/adminQueries'
import { ReviewForm, type ReviewFormValues } from '../../ReviewForm'
import { updateReviewAndGoToList } from './actions'

type Params = { id: string }

/**
 * `/admin/resenhas/[id]/editar` — edição (T5, REV-19).
 *
 * Server Component fino, MESMO padrão de `nova/page.tsx`: lê o que o
 * `ReviewForm` precisa e entrega por prop — banco e rota só encostam AQUI, em
 * nenhum lugar dentro do formulário (ver o cabeçalho de `ReviewForm.tsx`).
 *
 * Gate herdado do `(protected)/layout.tsx`; nenhum guard local, mesma nota de
 * `nova/page.tsx`. `getReviewForEdit` (T3) é o gate DE VERDADE aqui: a RLS é a
 * única autorização de LEITURA — sem sessão de dono nem admin, a linha some
 * (`notFound()`, 404) antes de qualquer código deste arquivo rodar. A ESCRITA
 * é autorizada de novo, à parte, pela policy de UPDATE dentro de `updateReview`
 * (T4) — abrir esta tela não garante que salvar vá funcionar (ver a nota sobre
 * "publicada alheia" no cabeçalho de `getReviewForEdit`).
 */

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params
  const review = await getReviewForEdit(id)
  return {
    title: `Editar ${review.title} — LIA`,
    robots: { index: false, follow: false },
  }
}

/**
 * Coluna nullable do banco (`string | number | null`) → string, o tipo que
 * `ReviewFormValues` (T2a) exige para todo campo controlado. `''` para
 * ausente — o MESMO vazio de `VALORES_VAZIOS` em `create`, então um campo sem
 * valor aparece exatamente como numa ficha nova, não como "null" na tela.
 */
function paraTexto(valor: string | number | null): string {
  return valor === null ? '' : String(valor)
}

export default async function EditarResenhaPage({ params }: { params: Promise<Params> }) {
  const { id } = await params
  // `getReviewForEdit` é `cache()` (T3): já foi chamada em `generateMetadata`
  // acima com o MESMO `id` — o React memoiza pelo argumento dentro do mesmo
  // request, então isto não dispara uma segunda consulta. Mesmo padrão de
  // `/resenha/[slug]/page.tsx`.
  const [review, genres] = await Promise.all([getReviewForEdit(id), listGenres()])
  const { book } = review

  /**
   * `isPublished` (prop do `ReviewForm`, P-2) é `published_at !== null`, NÃO
   * `status === 'published'`.
   *
   * A 0012 trava o slug por `v_published_at is null` — "nunca publicou",
   * não "não está publicada agora". Uma resenha DESPUBLICADA continua com o
   * endereço travado, porque o carimbo da primeira publicação nunca é limpo
   * (mesma regra de `unpublishReview`, T4/T6). Usar `status === 'published'`
   * aqui reabriria o campo de slug bem na janela — despublicada — em que o
   * RPC o mantém preso: a tela ofereceria um campo editável cujo valor o
   * banco vai ignorar (`p_slug_base` só se aplica quando `v_published_at is
   * null`), e o editor digitaria um novo endereço que nunca é gravado, sem
   * nenhum erro que explique por quê.
   */
  const isPublished = review.published_at !== null

  /**
   * `tagsInput`/`keywordsInput` NÃO entram aqui, de propósito: em `mode:
   * 'edit'` o `ReviewForm` não lê `defaultValues.tagsInput`/`.keywordsInput`
   * para essas duas — os hidden inputs usam `preservedTags`/`preservedKeywords`
   * diretamente (ver o cabeçalho de `ReviewForm.tsx`, seção "CAMPOS OCULTOS").
   * Preencher aqui seria estado morto, nunca lido.
   */
  const defaultValues: ReviewFormValues = {
    title: book.title,
    author: book.author,
    genreId: book.genre_id,
    publisher: paraTexto(book.publisher),
    year: paraTexto(book.year),
    pages: paraTexto(book.pages),
    isbn: paraTexto(book.isbn),
    originalLanguage: paraTexto(book.original_language),
    translator: paraTexto(book.translator),
    translatedFrom: paraTexto(book.translated_from),
    publicationCity: paraTexto(book.publication_city),
    coverUrl: paraTexto(book.cover_url),
    reviewTitle: review.title,
    body: paraTexto(review.body),
    highlightQuote: paraTexto(review.highlight_quote),
    // Prefill do slug EDITÁVEL (rascunho nunca publicado) e também do slug
    // ESTÁTICO (já publicada) — o `ReviewForm` lê o mesmo `valores.slugBase`
    // nos dois ramos (ver "SLUG (P-2)" no cabeçalho daquele arquivo).
    slugBase: review.slug,
  }

  return (
    <section className="lia-admin" aria-labelledby="editar-resenha-heading">
      <div className="lia-admin__head">
        <h1 id="editar-resenha-heading" className="lia-admin__title">
          Editar resenha
        </h1>
      </div>

      <p className="lia-admin__back">
        <Link className="lia-link" href="/admin/resenhas">
          Voltar para a lista de resenhas
        </Link>
      </p>

      <ReviewForm
        mode="edit"
        action={updateReviewAndGoToList}
        genres={genres}
        // `reviewer_name` já vem no SELECT de `getReviewForEdit` (`*`) — ao
        // contrário de `nova/page.tsx`, que não tem de onde ler um nome
        // (a resenha ainda não existe), aqui o dado já está na mão, sem
        // consulta extra.
        signedBy={review.reviewer_name}
        defaultValues={defaultValues}
        reviewId={review.id}
        // STRING OPACA — ver a nota completa onde este valor é consumido, no
        // cabeçalho de `ReviewForm.tsx` ("expectedUpdatedAt") e de
        // `updateReview` (T4). Não toque.
        expectedUpdatedAt={review.updated_at}
        isPublished={isPublished}
        preservedTags={review.tags}
        preservedKeywords={review.keywords}
        // `further_reading` é `Json` no tipo gerado (o Postgres não expõe a
        // forma exata de uma coluna jsonb); o CHECK do banco
        // (`review_further_reading_is_array`) garante que É sempre um array
        // em runtime, mas o TIPO não sabe disso. `Array.isArray` é a checagem,
        // não uma suposição — sem ela, um `as unknown[]` esconderia a
        // divergência se o CHECK algum dia mudasse.
        preservedFurtherReading={
          Array.isArray(review.further_reading) ? review.further_reading : []
        }
      />
    </section>
  )
}
