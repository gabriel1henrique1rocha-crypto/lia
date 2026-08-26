import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedReviewBySlug } from '@/lib/review/queries'
import { excerpt } from '@/lib/review/excerpt'
import { BookDetails } from '@/components/book/BookDetails'
import { BookCover } from '@/components/book/BookCover'
import { HighlightQuote } from '@/components/review/HighlightQuote'
import { ReviewTags } from '@/components/review/ReviewTags'

type Params = { slug: string }

/** Quebra o corpo (texto puro no M1) em parágrafos por linha em branco. */
function splitParagraphs(body: string | null): string[] {
  if (!body) return []
  return body
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * CONTEÚDO VINDO DE EDITOR — o padrão da página, aplicado também aos campos
 * novos (T11/T12).
 *
 * Todo campo digitado por editor (`body`, `highlight_quote`, `tags`,
 * `reviewer_name`, `publication_city`) é renderizado como **filho de texto** do
 * JSX. O React escapa filhos de texto por construção: `<script>` digitado no
 * formulário chega à tela como os caracteres `<script>`, nunca como elemento.
 * Não há `dangerouslySetInnerHTML` em `src/` inteiro — conferido —, e os campos
 * novos NÃO abrem exceção.
 *
 * Onde o padrão MUDA de forma, e por quê: `cover_url` não é texto, é URL, e URL
 * vira `href`/`src`, onde escapar não basta (`javascript:` é uma URL válida e
 * executável). Por isso ela tem gate próprio na validação — só `http`/`https`
 * (A-4, `bookInputSchema`) — e hoje sequer é renderizada como imagem
 * (`BookCover` é tipográfico; o `<img>` está adiado para `storage-covers`).
 * Nenhum campo desta task é URL, então nenhum precisa desse tratamento.
 */

/** Só o que tem conteúdo depois de aparado; `[]`/`null` viram `undefined`. */
function limparLista(valores: string[] | null | undefined): string[] | undefined {
  const lista = (valores ?? []).map((v) => v.trim()).filter(Boolean)
  return lista.length > 0 ? lista : undefined
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
    /**
     * PALAVRAS-CHAVE VIVEM AQUI, E SÓ AQUI (REV-09 / design §7).
     *
     * `keywords` é campo de SEO, não de leitura: nunca aparece na tela. É essa
     * a diferença entre `keywords` e `tags` — não é uma distinção de RÓTULO a
     * explicar ao leitor, é uma distinção de SUPERFÍCIE. Tags o leitor vê;
     * palavras-chave só o rastreador.
     *
     * `undefined` quando a lista está vazia: `keywords: []` emitiria um
     * `<meta name="keywords" content="">`, uma promessa vazia no `<head>`.
     */
    keywords: limparLista(review.keywords),
    openGraph: { title: review.title, description, type: 'article', url },
  }
}

/**
 * Rota `/resenha/[slug]` (App Router, SSR). Server Component async: resolve o
 * slug via getPublishedReviewBySlug (filtro status='published' explícito), e se
 * nada volta chama notFound() → 404 acessível (not-found.tsx). O conteúdo é um
 * <article> semântico com um único <h1>, reusando BookDetails para a ficha.
 * Nenhum componente de cliente no caminho factual — 100% SSR (RVW-26).
 *
 * DEGRADAÇÃO É O CASO NORMAL, NÃO A EXCEÇÃO (T11/T12): as 5 resenhas em
 * produção não têm NENHUM dos campos novos preenchidos. Cada bloco novo some
 * por inteiro quando o campo falta — sem rótulo órfão, sem separador solto, sem
 * moldura vazia. É por isso que a omissão mora DENTRO de cada componente
 * (`HighlightQuote`, `ReviewTags`) e não num `&&` espalhado aqui: um `&&`
 * esquecido reaparece como caixa vazia na tela.
 */
export default async function ReviewPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const review = await getPublishedReviewBySlug(slug)
  if (!review) notFound()

  const { book } = review
  const paragraphs = splitParagraphs(review.body)
  const assinatura = review.reviewer_name?.trim()

  return (
    <article className="lia-review">
      <header className="lia-review__header">
        <h1>{review.title}</h1>

        {/* A obra resenhada. `<cite>` marca TÍTULO DE OBRA — é o uso correto do
            elemento, e ele deixa a frase legível sem depender do itálico. O
            "de" antes do autor existe para desambiguar da linha de baixo: sem
            ele, "Título — Nome" e "Resenha por Nome" ficariam a um travessão de
            distância de parecerem a mesma relação. */}
        <p className="lia-review__subject">
          Sobre <cite>{book.title}</cite>, de {book.author}
        </p>

        {/* QUEM ASSINA A RESENHA — não o autor do livro.
            "Resenha por" é explícito de propósito: o campo vizinho já traz um
            nome de pessoa (o autor da obra), e um byline solto ("Ana Ribeiro")
            logo abaixo de "de Umberto Eco" seria lido como mais um autor. O
            rótulo carrega a relação, não a posição na página.
            Congelado no create a partir de `editor.name` (DD-6): é o resenhista
            DAQUELA resenha, e não muda se a conta mudar de nome depois. */}
        {assinatura && <p className="lia-review__byline">Resenha por {assinatura}</p>}
      </header>

      <BookCover title={book.title} />

      <section aria-labelledby="ficha">
        <h2 id="ficha">Ficha técnica</h2>
        <BookDetails book={book} headingLevel={3} />
      </section>

      <section aria-labelledby="resenha-texto">
        <h2 id="resenha-texto">Resenha</h2>

        {/* O destaque abre a SEÇÃO da resenha, não a página.
            Editorialmente ele "abre" o texto; estruturalmente, pô-lo antes da
            ficha técnica deixaria um bloco citado flutuando entre o título e os
            dados do livro — o lugar exato onde ele seria lido como uma passagem
            DO LIVRO. Dentro da seção, chega já enquadrado como parte da resenha. */}
        <HighlightQuote quote={review.highlight_quote} />

        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </section>

      <ReviewTags tags={review.tags} />

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
