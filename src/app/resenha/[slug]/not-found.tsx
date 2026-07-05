import Link from 'next/link'

/**
 * Página 404 acessível da rota `/resenha/[slug]`. Renderizada pelo App Router
 * quando `page.tsx` chama `notFound()` — seja por slug inexistente, seja por
 * resenha em rascunho (RVW-02/03). A cópia NÃO revela que um rascunho existe:
 * rascunho é indistinguível de inexistente para o público.
 *
 * Server Component (sem `'use client'`); usa `next/link` (renderizado no
 * servidor) para o retorno navegável por teclado com foco visível.
 */
export default function ReviewNotFound() {
  return (
    <section className="lia-prose" aria-labelledby="nf-title">
      <h1 id="nf-title">Resenha não encontrada</h1>
      <p>A resenha que você procura não existe ou não está disponível.</p>
      <p>
        <Link href="/" className="lia-link">
          Voltar para a página inicial
        </Link>
      </p>
    </section>
  )
}
