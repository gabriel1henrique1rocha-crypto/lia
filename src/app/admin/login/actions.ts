'use server'

import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/supabase/authenticated'

export type LoginState = { status: 'idle' | 'sent' | 'error'; message: string }

// Mensagem GENÉRICA de sucesso — a MESMA para e-mail conhecido e desconhecido
// (anti-enumeração, F-9): a página de login nunca revela quem é editor.
const GENERIC_SENT =
  'Se este e-mail estiver cadastrado, você receberá um link de acesso em instantes.'

const emailSchema = z.string().trim().email()

/**
 * Solicita o magic link. Server action consumida por useActionState.
 *
 * SEC-07/A-3: `shouldCreateUser: false` mantém o conjunto de editores FECHADO —
 * sem essa flag, o default do Supabase CRIA o usuário e o magic link vira
 * auto-cadastro público. É o coração da autorização deste fluxo.
 */
export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) {
    return { status: 'error', message: 'Informe um e-mail válido.' }
  }

  const supabase = await createAuthenticatedClient()
  // O resultado é deliberadamente IGNORADO para a resposta (anti-enumeração):
  // erro de "usuário inexistente" ou rate-limit não muda a mensagem ao usuário.
  await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false },
  })

  return { status: 'sent', message: GENERIC_SENT }
}
