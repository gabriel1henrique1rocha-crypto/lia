// Testes das envs por client (SEC-02/SEC-04, design §1.5, F-3/F-4).
//
// IMPORT DINÂMICO obrigatório (lição STATE.md): env.ts valida no LOAD do módulo;
// um import estático detonaria a validação antes do stub. Cada caso reseta os
// módulos e injeta a env via vi.stubEnv, ficando HERMÉTICO (não depende do
// .env.local). env.admin.ts importa 'server-only' → resolvido pelo stub do
// runner (vitest.config alias, T1).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env.ts (caminho público)', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('aceita uma publishable key válida', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_abc123')
    const mod = await import('../env')
    expect(mod.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_abc123')
    expect(mod.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://proj.supabase.co')
  })

  it('REJEITA uma secret key colada na variável publishable (F-3, não vaza ao browser)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_leaked_key')
    await expect(import('../env')).rejects.toThrow(/SECRET key/i)
  })

  // NOTA (T2→T3): a asserção de que env.ts NÃO expõe SUPABASE_SERVICE_ROLE_KEY
  // (SEC-02) fica no TRIPWIRE da T3 — aqui o campo ainda é transitório porque o
  // server.ts legado o consome até ser removido na T3. Ver nota em env.ts.
})

describe('env.admin.ts (lazy, server-only)', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('importar o módulo NÃO valida (lazy): sem a chave, o import não lança', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(import('../env.admin')).resolves.toBeDefined()
  })

  it('getAdminEnv() sem a chave lança erro EXPLÍCITO e nomeado (SEC-04, sem degradar)', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { getAdminEnv } = await import('../env.admin')
    expect(() => getAdminEnv()).toThrow(/INDISPONÍVEL/)
    expect(() => getAdminEnv()).toThrow(/SEC-04/)
  })

  it('getAdminEnv() com uma publishable key colada lança (F-3)', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_publishable_wrong_key')
    const { getAdminEnv } = await import('../env.admin')
    expect(() => getAdminEnv()).toThrow(/PUBLISHABLE key/i)
  })

  it('getAdminEnv() com uma service_role key válida retorna a env', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_real_service_key')
    const { getAdminEnv } = await import('../env.admin')
    expect(getAdminEnv().SUPABASE_SERVICE_ROLE_KEY).toBe('sb_secret_real_service_key')
  })
})
