import 'server-only'
import { cache } from 'react'
import { createAuthenticatedClient } from '@/lib/supabase/authenticated'
import { resolveEditor, type EditorSession } from './resolveEditor'

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
