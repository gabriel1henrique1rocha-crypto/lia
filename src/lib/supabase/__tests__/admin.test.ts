// Testes do client ADMIN (SEC-03/04/15a, design §5.3 T-d).
//
// IMPORT DINÂMICO obrigatório: admin.ts faz `import 'server-only'` (resolvido
// pelo stub do runner — vitest alias, T1) e importa env.ts (parse eager). Cada
// caso injeta a env via vi.stubEnv e reseta módulos → hermético.
//
// A env pública (URL + publishable) é stubada em todos os casos só para o parse
// do env.ts passar; o foco é a service_role.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function stubPublicEnv() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_abc123')
}

describe('createAdminClient (server-only, dormente)', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('importar admin.ts NÃO valida a service_role (lazy): o import não lança', async () => {
    stubPublicEnv()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(import('../admin')).resolves.toBeDefined()
  })

  it('sem SUPABASE_SERVICE_ROLE_KEY → createAdminClient() lança erro nomeado (SEC-04, sem degradar)', async () => {
    stubPublicEnv()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { createAdminClient } = await import('../admin')
    expect(() => createAdminClient()).toThrow(/INDISPONÍVEL/)
    expect(() => createAdminClient()).toThrow(/SEC-04/)
  })

  it('com uma publishable key colada → lança (F-3, não degrada a anon)', async () => {
    stubPublicEnv()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_publishable_wrong')
    const { createAdminClient } = await import('../admin')
    expect(() => createAdminClient()).toThrow(/PUBLISHABLE key/i)
  })

  it('com uma service_role key válida → retorna um client utilizável', async () => {
    stubPublicEnv()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_real_service_key')
    const { createAdminClient } = await import('../admin')
    const client = createAdminClient()
    expect(client).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
