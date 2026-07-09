import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocka o client autenticado: não tocamos no Supabase real nem em next/headers.
const signInWithOtp = vi.fn()
vi.mock('@/lib/supabase/authenticated', () => ({
  createAuthenticatedClient: vi.fn(async () => ({ auth: { signInWithOtp } })),
}))

import { requestMagicLink, type LoginState } from '../actions'

const IDLE: LoginState = { status: 'idle', message: '' }
function form(email: unknown): FormData {
  const fd = new FormData()
  if (email !== undefined) fd.set('email', String(email))
  return fd
}

describe('requestMagicLink (SEC-07 / A-3 / anti-enumeração)', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    signInWithOtp.mockResolvedValue({ data: {}, error: null })
  })

  it('chama signInWithOtp com shouldCreateUser:false (conjunto FECHADO — A-3)', async () => {
    await requestMagicLink(IDLE, form('editor@lia.test'))
    expect(signInWithOtp).toHaveBeenCalledTimes(1)
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'editor@lia.test',
      options: { shouldCreateUser: false },
    })
  })

  it('e-mail inválido → erro e NÃO chama signInWithOtp', async () => {
    const state = await requestMagicLink(IDLE, form('não-é-email'))
    expect(state.status).toBe('error')
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('e-mail VÁLIDO desconhecido → MESMA mensagem genérica (anti-enumeração, F-9)', async () => {
    // Supabase recusa (usuário inexistente, shouldCreateUser:false).
    signInWithOtp.mockResolvedValue({ data: {}, error: { message: 'User not found' } })
    const known = await requestMagicLink(IDLE, form('editor@lia.test'))
    signInWithOtp.mockResolvedValue({ data: {}, error: null })
    const unknown = await requestMagicLink(IDLE, form('estranho@lia.test'))
    expect(known.status).toBe('sent')
    expect(unknown.status).toBe('sent')
    expect(known.message).toBe(unknown.message) // idêntica: não revela quem é editor
  })

  it('normaliza espaços do e-mail (trim)', async () => {
    await requestMagicLink(IDLE, form('  editor@lia.test  '))
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'editor@lia.test',
      options: { shouldCreateUser: false },
    })
  })
})
