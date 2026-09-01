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

/**
 * Confirmações do retorno da EDIÇÃO (T5) — mapa À PARTE de `CONFIRMACOES`, não
 * o mesmo reaproveitado. `criada=publicada` faz sentido para quem acabou de
 * criar; para quem editou uma resenha publicada há meses, "Resenha publicada"
 * soaria como se a publicação tivesse acabado de acontecer agora. O texto aqui
 * descreve o que de fato ocorreu: uma edição foi salva.
 */
const CONFIRMACOES_EDICAO = {
  rascunho: 'Alterações salvas como rascunho. Continua invisível para o público.',
  publicada: 'Alterações salvas. A resenha está publicada.',
} as const

type SearchParams = Promise<{ criada?: string | string[]; editada?: string | string[] }>

function primeiro(bruto: string | string[] | undefined): string | undefined {
  return Array.isArray(bruto) ? bruto[0] : bruto
}

/**
 * O valor do parâmetro é usado só para ESCOLHER uma mensagem fixa, nunca
 * renderizado. Um `?criada=<qualquer coisa>` (ou `?editada=`) cai fora dos
 * mapas e não exibe nada — a URL não consegue pôr texto na tela.
 *
 * `criada` tem precedência sobre `editada` só porque nenhum redirect real
 * envia os dois ao mesmo tempo (`createReviewAndGoToList` e
 * `updateReviewAndGoToList` nunca disparam juntos) — a ordem aqui não decide
 * nada que aconteça de fato.
 */
function confirmacaoDe(params: { criada?: string | string[]; editada?: string | string[] }) {
  const criada = primeiro(params.criada)
  if (criada === 'rascunho' || criada === 'publicada') return CONFIRMACOES[criada]

  const editada = primeiro(params.editada)
  if (editada === 'rascunho' || editada === 'publicada') return CONFIRMACOES_EDICAO[editada]

  return null
}

export default async function EditorReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const confirmacao = confirmacaoDe(params)
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
