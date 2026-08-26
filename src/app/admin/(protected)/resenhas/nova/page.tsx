import type { Metadata } from 'next'
import Link from 'next/link'
import { listGenres } from '@/lib/book/queries'
import { ReviewForm } from '../ReviewForm'
import { createReviewAndGoToList } from './actions'

/**
 * `/admin/resenhas/nova` — criação (T10).
 *
 * A rota é **`nova`**, não `novo`: o wireframe dizia `novo` e o sitemap dizia
 * `nova`, e a divergência estava aberta desde o M1. Resolvida por concordância
 * com o substantivo — cria-se uma resenh**a**. Registrada no STATE.md.
 *
 * Server Component fino: lê os gêneros e entrega ao `ReviewForm`. As duas props
 * que o T8 deixou injetáveis (`action` e `genres`) existem exatamente para este
 * ponto — é aqui que o componente encosta em banco e em rota, e em nenhum lugar
 * dentro dele.
 *
 * Gate herdado do `(protected)/layout.tsx`; nenhum guard local (ver a nota em
 * `../page.tsx`).
 *
 * `signedBy` NÃO é passado: `getAuthenticatedEditor()` resolve `{ id, role }` e
 * não carrega `editor.name`, e ler o nome exigiria uma consulta que esta task
 * não pede. O `ReviewForm` já trata a ausência com texto correto ("A conta que
 * criar a resenha") — e o valor gravado não muda em nada: quem congela
 * `reviewer_name` é o RPC, a partir de `editor.name`, não a tela (DD-6).
 */

export const metadata: Metadata = {
  title: 'Nova resenha — LIA',
  robots: { index: false, follow: false },
}

export default async function NovaResenhaPage() {
  const genres = await listGenres()

  return (
    <section className="lia-admin" aria-labelledby="nova-resenha-heading">
      <div className="lia-admin__head">
        <h1 id="nova-resenha-heading" className="lia-admin__title">
          Nova resenha
        </h1>
      </div>

      {/* Link simples, não um segundo landmark de navegação: um `<nav>` aqui
          concorreria com o "Principal" do site e exigiria nome próprio para o
          leitor de tela distinguir os dois — custo sem ganho para um link só. */}
      <p className="lia-admin__back">
        <Link className="lia-link" href="/admin/resenhas">
          Voltar para a lista de resenhas
        </Link>
      </p>

      <ReviewForm action={createReviewAndGoToList} genres={genres} />
    </section>
  )
}
