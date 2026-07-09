import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export type EditorRole = 'admin' | 'editor'

/** Editor autenticado e autorizado — o payload do estado 'ok'. Sem dado sensível. */
export type AuthenticatedEditor = { id: string; role: EditorRole }

// Resultado do gate de sessão+papel (SEC-09). Só o enum + id/role — NUNCA vaza
// dado sensível (e-mail, etc.).
export type EditorSession =
  | { status: 'unauthenticated' } // sem sessão válida
  | { status: 'forbidden' } // sessão ok, mas SEM linha editor ativa (SEC-07)
  | { status: 'ok'; editor: AuthenticatedEditor }

/**
 * Núcleo do gate — PURO em relação ao ambiente (recebe o client já pronto), por
 * isso testável sem tocar env/server-only/next-headers (lição de env do CI).
 *
 * Usa getUser() (não getSession()): valida o JWT no Auth server, base para
 * decisão de autorização. O papel é lido VIVO do banco (não de claim do JWT), sob
 * a RLS do próprio editor (policy editor_self_read) — desativar um editor tem
 * efeito na requisição seguinte, sem esperar o token expirar (F-7).
 */
export async function resolveEditor(client: SupabaseClient<Database>): Promise<EditorSession> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) return { status: 'unauthenticated' }

  const { data: editor } = await client
    .from('editor')
    .select('id, role, active')
    .eq('id', user.id)
    .maybeSingle()

  // Sem linha (auth.users órfão) OU inativo → não autorizado (SEC-07/F-8).
  if (!editor || !editor.active) return { status: 'forbidden' }
  return { status: 'ok', editor: { id: editor.id, role: editor.role } }
}

/** True só quando há sessão ok E papel admin. */
export function isAdmin(session: EditorSession): boolean {
  return session.status === 'ok' && session.editor.role === 'admin'
}
