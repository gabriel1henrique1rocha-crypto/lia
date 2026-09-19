import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/authenticated'
import { getAuthenticatedEditor } from '@/lib/auth/requireEditor'
import type { Database, Tables } from '@/lib/database.types'
import type { BookView } from '@/lib/book/queries'

/**
 * Leitura do painel do editor (T7): a lista de `/admin/resenhas`. Client
 * AUTENTICADO (mesmo padrão de `queries.ts`, cliente diferente) — sob a RLS
 * own-or-admin da 0008.
 *
 * ⚠️ RLS SOZINHA NÃO BASTA AQUI — desvio deliberado do princípio "a policy já
 * resolve quem vê o quê" que vale para `create/publish/unpublish` (T6).
 *
 * `review` tem DUAS policies de SELECT que se somam por OR (permissivas):
 *   · `review_editor_read_own` (0008): próprias linhas (qualquer status) OU
 *     `is_admin()`;
 *   · `review_public_read` (0005): QUALQUER linha `status='published'`,
 *     concedida a `anon` **e também a `authenticated`**.
 *
 * Consequência PROVADA (não hipotética — já é o "confounder" exercitado em
 * `rbac-matrix.integration.test.ts:192`, "editor A vê review PÚBLICA"): um
 * editor não-admin, sem filtro nenhum, recebe as PRÓPRIAS resenhas unidas a
 * TODAS as publicadas de QUALQUER outro editor. Para o painel "minhas
 * resenhas" isso vaza trabalho alheio na lista de quem não é admin — por isso
 * o `.eq('editor_id', …)` abaixo NÃO é a redundância "por segurança" que T6
 * evita (lá a RLS já filtra sozinha); aqui ele é o único jeito de obter "só as
 * minhas", porque a RLS confessadamente une um conjunto maior.
 */
type AuthenticatedClient = Awaited<ReturnType<typeof createAuthenticatedClient>>

export type EditorReviewListItem = {
  id: string
  title: string
  slug: string
  status: Database['public']['Enums']['review_status']
  published_at: string | null
  updated_at: string
  book: { title: string }
}

// Campos mínimos da lista (título, slug, status, datas, título do livro via
// join) — sem `body`: a listagem não precisa do corpo da resenha (payload
// desnecessário numa tela que só lista).
//
// `updated_at` entrou na T10 (acréscimo, não redesenho): a função JÁ ORDENAVA
// por ele, mas não o trazia, então a tela não tinha como mostrar "atualizado em"
// — a coluna que EXPLICA a ordem em que as linhas aparecem. Uma lista ordenada
// por um critério invisível parece desordenada.
const LIST_SELECT = 'id, title, slug, status, published_at, updated_at, book(title)'

/**
 * `listEditorReviews()`: resenhas visíveis ao editor autenticado (admin vê
 * todas; editor comum vê só as próprias — draft e publicada).
 *
 * Ordenação: `updated_at` desc. Rascunho recém-criado ou recém-editado sobe ao
 * topo — é o item que o editor mais provavelmente veio ver (o trigger
 * `review_set_updated_at`, 0001, toca a coluna em toda UPDATE, publish/unpublish
 * inclusive).
 */
export async function listEditorReviews(
  client?: AuthenticatedClient
): Promise<EditorReviewListItem[]> {
  const editor = await getAuthenticatedEditor()
  const supabase = client ?? (await createAuthenticatedClient())

  let query = supabase.from('review').select(LIST_SELECT).order('updated_at', { ascending: false })

  // Ausente para admin — de propósito: a RLS (is_admin()) já mostra todas, e
  // aplicar o filtro aqui também esconderia o próprio confounder que o
  // admin precisa poder ver por inteiro.
  if (editor.role !== 'admin') {
    query = query.eq('editor_id', editor.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * `getReviewForEdit(id)` — T3 (REV-19): carrega UMA resenha + a ficha do seu
 * livro (join 1:1 por `book_id`, garantido por `review_book_id_key` UNIQUE)
 * para a tela de edição. Client AUTENTICADO do editor — NUNCA `service_role`,
 * que permanece dormente (C-2/D-09) e nada nesta feature o acorda.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `updated_at` — STRING OPAQUA, A MESMA REGRA DO T2a, AGORA NA ORIGEM
 *
 * `Tables<'review'>['updated_at']` já é `string` no gerado (conferido:
 * `database.types.ts` NUNCA tipa timestamp como `Date`), e este arquivo não
 * toca o valor em lugar nenhum — sem `new Date(...)`, sem formatação. `data`
 * vem direto da resposta JSON do PostgREST e SEGUE STRING até quem chamar
 * `getReviewForEdit`. `timestamptz` do Postgres guarda MICROSSEGUNDOS; `Date`
 * do JavaScript só tem MILISSEGUNDOS — um parse+reserialização em QUALQUER
 * ponto do trajeto (aqui, no componente de página, no `defaultValues` do
 * `ReviewForm`) faz a comparação `is distinct from` da 0012 NUNCA bater, e
 * TODO save reporta conflito falso (40001) — com cara de bug de permissão,
 * não de perda de precisão numérica. Se um dia um tipo do TypeScript forçar
 * `Date` neste caminho, o conserto é mudar o TIPO, nunca o valor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RLS NÃO DEVOLVE LINHA → `notFound()`. 404, NÃO 403.
 *
 * Mesmo tratamento indistinto do RPC (42501 único para "não existe" e "não é
 * seu", 0011/0012 — ver DR-5): diferenciar aqui vazaria a EXISTÊNCIA de
 * rascunho alheio (responder 403 só quando a linha existe, mas está fora de
 * alcance, entrega essa informação a quem não deveria tê-la). `.maybeSingle()`
 * devolve `data: null` sem lançar quando a RLS esconde a linha ou ela
 * simplesmente não existe — os dois casos chegam aqui INDISTINGUÍVEIS, e
 * saem daqui INDISTINGUÍVEIS.
 *
 * ID malformado (não-UUID) também vira `notFound()`, não 500: `id` chega da
 * rota como segmento dinâmico de URL, texto livre. Postgres rejeita com
 * `22P02` (invalid_text_representation) ANTES de qualquer policy rodar —
 * verificado contra o Postgres local (`curl` direto no PostgREST,
 * `id=eq.not-a-uuid` → `{"code":"22P02", ...}`). Um 500 aqui distinguiria "URL
 * mal formada" de "UUID válido mas não visível" — a MESMA fuga de informação
 * que o parágrafo acima existe para fechar, só que por outra porta. Qualquer
 * OUTRO código de erro sobe cru (não é RLS nem formato — é falha real).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NÃO FILTRA POR POSSE NA QUERY — REJEITADO DE PROPÓSITO, NÃO ESQUECIDO
 *
 * Ao contrário de `listEditorReviews()` (acima nesta função, `.eq('editor_id',
 * …)`), esta função NÃO restringe a linhas do próprio editor. As duas
 * situações parecem iguais e não são: `listEditorReviews` filtra para CURAR
 * uma LISTA (a RLS já autoriza ler o conjunto maior; o filtro só evita
 * misturar "minhas resenhas" com publicadas de outros numa mesma tela — é
 * apresentação, não autorização). Aqui, filtrar por posse DUPLICARIA a regra
 * de autorização FORA da RLS — exatamente o que o M2 recusou (D-09: a RLS é o
 * PORTÃO, uma vez só). Duas cópias da mesma regra podem divergir; a policy já
 * decide isto sozinha, na hora do SAVE.
 *
 * CONSEQUÊNCIA DIRETA — a tela pode abrir e o save pode falhar: a policy de
 * SELECT (`review_public_read`, 0005) deixa QUALQUER `authenticated` LER uma
 * resenha PUBLICADA alheia. `getReviewForEdit` devolve a linha normalmente
 * nesse caso — não é bug, é a RLS fazendo exatamente o que a 0005 autoriza.
 * Quem nega a ESCRITA é a policy de UPDATE (`review_editor_update`, own-or-
 * admin, 0008), avaliada só quando o formulário for salvo — T4.
 *
 * ACHADO DO T1 QUE MUDA A MENSAGEM QUE T4 VAI TRADUZIR: o `select ... for
 * update` de `update_review_with_book` (0012) exige que a linha passe TAMBÉM
 * pela policy de UPDATE, não só pela de SELECT (comprovado empiricamente no
 * T1 — não é o mesmo comportamento de um SELECT simples como o desta função).
 * Logo uma resenha publicada alheia, que ESTA função abre sem erro, falha no
 * PASSO 1 do RPC com "Resenha inexistente ou fora do seu alcance" — a MESMA
 * mensagem de "nunca existiu", nunca "Sem permissão para editar esta
 * resenha". As 5 linhas de seed (`editor_id` nulo, T0) caem no mesmo caminho:
 * abrem para leitura (se publicadas) ou 404 (se não), e o save de qualquer
 * uma nega no passo 1. Nada disto é implementado aqui — é o contexto que T4
 * precisa para traduzir o erro certo, e T8 para o roteiro de leitor de tela.
 */
export type ReviewForEdit = Tables<'review'> & {
  book: BookView
  /** Vínculos de deficiência (D-12). RLS: próprias resenhas, ou todas se admin. */
  review_disability: { term_id: string }[]
}

const REVIEW_FOR_EDIT_SELECT = '*, book(*, genre(name, slug)), review_disability(term_id)'

export const getReviewForEdit = cache(
  async (id: string, client?: AuthenticatedClient): Promise<ReviewForEdit> => {
    const supabase = client ?? (await createAuthenticatedClient())
    const { data, error } = await supabase
      .from('review')
      .select(REVIEW_FOR_EDIT_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      if (error.code === '22P02') notFound() // id não é um UUID — ver nota acima
      throw error
    }
    if (!data) notFound() // RLS escondeu OU não existe — indistinguível, de propósito

    return data as ReviewForEdit
  }
)

/** Opção do grupo de deficiências no formulário do admin (D-12, DIS-05). */
export type DisabilityOption = { id: string; name: string; active: boolean }

/**
 * Termos de deficiência para o formulário do admin, em `sort_order`.
 *
 * Client AUTENTICADO: admin enxerga também os DESATIVADOS (policy
 * `disability_term_admin_read`, 0013) — necessário para manter marcado um
 * termo desativado numa resenha antiga. Editor comum recebe só os ativos; o
 * formulário preserva como oculto qualquer vínculo que ele não enxergue.
 */
export async function listDisabilityOptions(
  client?: AuthenticatedClient
): Promise<DisabilityOption[]> {
  const supabase = client ?? (await createAuthenticatedClient())
  const { data, error } = await supabase
    .from('disability_term')
    .select('id, name, active')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data ?? []
}
