import Link from 'next/link'
import type { EditorReviewListItem } from '@/lib/review/adminQueries'

/**
 * Apresentação da lista de resenhas do editor (T10). Sem I/O: recebe as linhas
 * já lidas por `listEditorReviews()` (T7).
 *
 * SEPARADO DA PÁGINA de propósito. A rota vive sob `(protected)` e só existe com
 * sessão de editor — o que a torna inauditável pelo axe em CI, que não tem como
 * autenticar (TD-02: o CI não sobe Supabase). Como componente puro, esta mesma
 * árvore é montada no `/styleguide` e auditada em navegador real, cheia e vazia.
 * O que a rota acrescenta por cima é `<h1>` e um link — coberto por unit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE `<table>` E NÃO UMA LISTA SEMÂNTICA
 *
 * Porque o dado É tabular: quatro atributos do MESMO tipo repetidos linha a
 * linha (resenha, livro, situação, atualização), que se comparam na vertical —
 * "quais estão em rascunho?", "qual mexi por último?". Numa `<ul>`, cada item
 * vira um bloco de texto solto e quem usa leitor de tela perde exatamente o que
 * a tela oferece: a associação célula↔cabeçalho. Com `<table>` + `<th scope>`,
 * o leitor anuncia "Situação: Rascunho" ao navegar por células, e o usuário pode
 * percorrer coluna por coluna.
 *
 * `<caption>` (e não um `<h2>` solto acima) porque o nome pertence À TABELA: é
 * assim que ele entra no anúncio de entrada na tabela, junto com a contagem de
 * linhas e colunas. E o `<th scope="row">` é o TÍTULO DA RESENHA — é ele que
 * identifica a linha; sem isso, "Publicada" seria anunciado sem dizer de quê.
 *
 * Lista semântica seria a escolha certa se cada item fosse uma unidade de leitura
 * (como os cards da home, que são `<li>` com um link cada). Não é o caso aqui.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CAPTION_ID = 'lista-resenhas-caption'

/**
 * Fuso FIXO, não o do servidor.
 *
 * A data é formatada uma vez no servidor e vai pronta no HTML. Sem `timeZone`
 * explícito, o Node usa o fuso da máquina — que em produção é UTC e no
 * desenvolvimento é o local, então a MESMA linha exibiria horas diferentes
 * conforme onde renderizou. Fixar o fuso do público do site torna a saída
 * determinística (e o teste, estável).
 */
const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

/** Rótulos de `review_status`. O TEXTO é o que comunica — nunca só a cor. */
const SITUACAO = {
  draft: 'Rascunho',
  published: 'Publicada',
} as const

export function EditorReviewsTable({ reviews }: { reviews: EditorReviewListItem[] }) {
  if (reviews.length === 0) return <EmptyReviews />

  return (
    /* Contêiner rolável em telas estreitas. `tabIndex` + `role="region"` com
       nome: sem eles, quem navega só por teclado não consegue rolar a tabela
       (não há link nenhum dentro das linhas — a rota de edição não existe nesta
       sprint), e o axe reprova com `scrollable-region-focusable`. */
    <div
      className="lia-admin-table__scroll"
      role="region"
      aria-labelledby={CAPTION_ID}
      tabIndex={0}
    >
      <table className="lia-admin-table">
        <caption id={CAPTION_ID} className="lia-admin-table__caption">
          Suas resenhas — {reviews.length} {reviews.length === 1 ? 'item' : 'itens'}, da atualizada
          mais recentemente para a mais antiga.
        </caption>
        <thead>
          <tr>
            <th scope="col">Resenha</th>
            <th scope="col">Livro</th>
            <th scope="col">Situação</th>
            <th scope="col">Atualizada em</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id}>
              {/* Cabeçalho DA LINHA: é o título que identifica de qual resenha
                  as outras células estão falando. */}
              <th scope="row" className="lia-admin-table__row-header">
                {review.title}
              </th>
              <td>{review.book?.title ?? '—'}</td>
              <td>
                {/* Situação em TEXTO, com borda sólida × tracejada além da cor
                    (WCAG 1.4.1: nada depende só de cor). */}
                <span className="lia-status" data-status={review.status}>
                  {SITUACAO[review.status]}
                </span>
              </td>
              <td>
                <time dateTime={review.updated_at}>
                  {FORMATO_DATA.format(new Date(review.updated_at))}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Editor sem nenhuma resenha.
 *
 * Convite, não tabela vazia com cabeçalhos: uma tabela de zero linhas anuncia
 * "tabela, 4 colunas, 1 linha" e obriga a percorrer cabeçalhos para descobrir
 * que não há nada — o oposto de informar.
 *
 * SEM `role="status"`, ao contrário do `EmptyState` público: lá o vazio é
 * RESULTADO de uma busca (mudou depois do carregamento, então precisa ser
 * anunciado); aqui é o estado inicial da página, já presente no HTML, e uma live
 * region no carregamento não anuncia nada — só adiciona ruído na árvore.
 */
export function EmptyReviews() {
  return (
    <div className="lia-admin-empty">
      <p className="lia-admin-empty__title">Você ainda não tem resenhas</p>
      <p className="lia-admin-empty__text">
        Comece pela ficha do livro. Dá para salvar como rascunho e voltar para publicar depois.
      </p>
      <Link className="lia-btn lia-btn--primary lia-btn--md" href="/admin/resenhas/nova">
        Escrever a primeira resenha
      </Link>
    </div>
  )
}
