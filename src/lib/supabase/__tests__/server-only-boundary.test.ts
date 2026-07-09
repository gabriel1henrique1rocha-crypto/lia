// Guard PERMANENTE da fronteira server-only (SEC-03/SEC-15b). Roda no CI, barato.
//
// `import 'server-only'` como PRIMEIRA importação faz o build do Next QUEBRAR se o
// módulo entrar em bundle de cliente — a fronteira estrutural da C-3. Este teste
// falha se alguém remover o marcador ou o deslocar para depois de outro import
// (o que deixaria um import com efeito colateral rodar antes do guard). É a rede
// que trava a regressão no CI; a prova de que o BUILD realmente quebra é a
// demonstração one-time registrada no PR (fixture client → next build falha).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SERVER_ONLY_MODULES = [
  'src/lib/supabase/admin.ts',
  'src/lib/supabase/authenticated.ts',
  'src/lib/env.admin.ts',
  'src/lib/auth/requireEditor.ts',
]

describe('fronteira server-only (SEC-03/SEC-15b)', () => {
  it.each(SERVER_ONLY_MODULES)('%s importa server-only como PRIMEIRA importação', (rel) => {
    const src = readFileSync(resolve(process.cwd(), rel), 'utf8')
    const firstImport = src.split('\n').find((line) => line.trim().startsWith('import'))
    expect(firstImport?.trim()).toBe("import 'server-only'")
  })
})
