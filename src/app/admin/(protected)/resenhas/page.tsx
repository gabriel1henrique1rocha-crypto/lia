import type { Metadata } from 'next'
import Link from 'next/link'
import { listEditorReviews } from '@/lib/review/adminQueries'
import { EditorReviewsTable } from './EditorReviewsTable'
import { CreatedNotice } from './CreatedNotice'

/**
 * `/admin/resenhas` — lista do editor (T10).
 *
 * SEM GATE PRÓPRIO, e isso é a decisão, não um esquecimento: a rota está dentro
 * do route group `(protected)`, cujo `layout.tsx` chama `requireEditor()` antes
 * de renderizar qualquer filho. Route group não acrescenta segmento de URL, mas
 * acrescenta layout — então `/admin/resenhas` e `/admin/resenhas/nova` herdam o
 * gate por estarem sob a pasta, sem que a URL mostre isso. Repetir o guard aqui
 * criaria uma segunda cópia da regra para divergir da primeira.
 *
 * Isso NÃO vale para as server actions do T6: action é endpoint próprio,
 * alcançável sem passar por página nenhuma, e por isso cada uma chama
 * `requireEditor()` por conta. Não é redundância — é outro ponto de entrada.
 *
 * A cobertura do route group está fixada por teste (`admin-reviews.spec.ts`:
 * sem sessão, as duas rotas terminam em `/admin/login`).
 */

export const metadata: Metadata = {
  title: 'Resenhas — LIA',
  robots: { index: false, follow: false },
}

/** Confirmações aceitas no retorno da criação. Fechada de propósito. */
const CONFIRMACOES = {
  rascunho: 'Rascunho salvo. Ele aparece na lista abaixo e continua invisível para o público.',
  publicada: 'Resenha publicada. Ela já aparece no catálogo público.',
} as const

type SearchParams = Promise<{ criada?: string | string[] }>

/**
 * O valor do parâmetro é usado só para ESCOLHER uma mensagem fixa, nunca
 * renderizado. Um `?criada=<qualquer coisa>` cai fora do mapa e não exibe nada —
 * a URL não consegue pôr texto na tela.
 */
function confirmacaoDe(bruto: string | string[] | undefined): string | null {
  const chave = Array.isArray(bruto) ? bruto[0] : bruto
  if (chave === 'rascunho' || chave === 'publicada') return CONFIRMACOES[chave]
  return null
}

export default async function EditorReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const { criada } = await searchParams
  const confirmacao = confirmacaoDe(criada)
  const reviews = await listEditorReviews()

  return (
    <section className="lia-admin" aria-labelledby="resenhas-heading">
      <div className="lia-admin__head">
        <h1 id="resenhas-heading" className="lia-admin__title">
          Suas resenhas
        </h1>
        <Link className="lia-btn lia-btn--primary lia-btn--md" href="/admin/resenhas/nova">
          Nova resenha
        </Link>
      </div>

      {confirmacao && <CreatedNotice>{confirmacao}</CreatedNotice>}

      <EditorReviewsTable reviews={reviews} />
    </section>
  )
}
