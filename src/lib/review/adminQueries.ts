import { createAuthenticatedClient } from '@/lib/supabase/authenticated'
import { getAuthenticatedEditor } from '@/lib/auth/requireEditor'
import type { Database } from '@/lib/database.types'

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
  book: { title: string }
}

// Campos mínimos da lista (título, slug, status, data, título do livro via
// join) — sem `body`: a listagem não precisa do corpo da resenha (payload
// desnecessário numa tela que só lista).
const LIST_SELECT = 'id, title, slug, status, published_at, book(title)'

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
