import 'server-only'
import { cache } from 'react'
import { createAuthenticatedClient } from '@/lib/supabase/authenticated'
import { resolveEditor, type AuthenticatedEditor, type EditorSession } from './resolveEditor'

// Gate AUTORITATIVO de servidor (SEC-08/09). Envolto em cache() do React →
// 1 resolução por request (getUser + 1 SELECT), deduplicada entre layout e
// caminhos que chamem o guard na mesma requisição.
//
// Todo caminho admin (server action / route handler que use o client admin ou
// faça escrita editorial) chama requireEditor()/requireAdmin() ANTES de qualquer
// operação — o layout (protected) protege páginas, não substitui o gate por
// operação.

/** Resolve o editor autenticado atual (uid + papel). Ver EditorSession. */
export const requireEditor = cache(async (): Promise<EditorSession> => {
  const client = await createAuthenticatedClient()
  return resolveEditor(client)
})

/** Como requireEditor, mas exige papel `admin`: editor comum vira `forbidden`. */
export const requireAdmin = cache(async (): Promise<EditorSession> => {
  const session = await requireEditor()
  if (session.status === 'ok' && session.editor.role !== 'admin') {
    return { status: 'forbidden' }
  }
  return session
})

/**
 * Acessor ESTREITADO para contextos JÁ protegidos pelo layout (protected), onde
 * a sessão 'ok' é garantida antes da renderização. Devolve `AuthenticatedEditor`
 * direto — SEM união, SEM `| null` —, então o caller não carrega fallback
 * defensivo (ex.: `role ?? null`).
 *
 * Dívida silenciosa → barulhenta: se um dia a garantia do layout mudar e este
 * acessor for alcançado sem sessão 'ok', ele LANÇA (falha barulhenta) em vez de
 * um caller renderizar `null` em silêncio. E se o contrato deste retorno
 * afrouxar no futuro (voltar a `| null`), o TS passa a gritar nos callers.
 *
 * NÃO altera o caminho feliz: sob o layout, `requireEditor()` já é sempre 'ok'.
 * `requireEditor()`/`requireAdmin()` seguem retornando a UNIÃO (SEC-09: o gate
 * "retorna" o status; o layout ramifica entre redirect/negado/ok).
 */
export const getAuthenticatedEditor = cache(async (): Promise<AuthenticatedEditor> => {
  const session = await requireEditor()
  if (session.status !== 'ok') {
    throw new Error(
      'getAuthenticatedEditor: sessão não-ok fora do contrato — use apenas dentro do route group (protected), que garante o gate antes de renderizar.'
    )
  }
  return session.editor
})
