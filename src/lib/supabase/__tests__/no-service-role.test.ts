// TRIPWIRE estático (design §5.3, T-b) — SEC-02/SEC-14.
//
// Lê o FONTE dos módulos do caminho público e afirma que a string SERVICE_ROLE
// não ocorre. É a rede vermelha barata da TD-04 que roda NO CI SEM BANCO (o
// teste de bypass real, T14, é local-only e o CI pula): se alguém reintroduzir
// o fallback `?? service_role` ou fizer o env público conhecer a chave secreta,
// este teste fica vermelho no pipeline imediatamente.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PUBLIC_PATH_MODULES = ['src/lib/env.ts', 'src/lib/supabase/public.ts']

describe('tripwire: caminho público sem service_role (SEC-02, TD-04)', () => {
  it.each(PUBLIC_PATH_MODULES)('%s não referencia SERVICE_ROLE', (relPath) => {
    const source = readFileSync(resolve(process.cwd(), relPath), 'utf8')
    expect(source).not.toMatch(/SERVICE_ROLE/)
  })
})
