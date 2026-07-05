// LOCAL-ONLY — ver TD-02 em STATE.md
//
// Teste de integração de RLS de `review` contra o Supabase LOCAL (não roda no
// CI atual — o pipeline não sobe Postgres/Supabase; mover para o CI é avaliado
// no M4). Prova a leitura pública filtrada (RVW-13/14) e a escrita fechada
// (RVW-15) abertas pela migration 0005.
//
// Usa SOMENTE o cliente `anon` (que passou a ter GRANT SELECT em `review` via
// 0005). NÃO usa service_role em `review` — assim NÃO esbarra na TD-03, que
// mantém os GRANTs de service_role/demais tabelas em aberto.
//
// Credenciais locais vêm SOMENTE de variáveis de ambiente — NUNCA hardcoded.
// Coloque-as no `.env.local` (gitignored); o vitest.config carrega via loadEnv.
// Valores da stack local (`npx supabase status`), não segredos de produção:
//   SUPABASE_LOCAL_URL=http://127.0.0.1:54321
//   SUPABASE_LOCAL_ANON_KEY=<sua chave publishable local>
//
// Como rodar (PowerShell):
//   npx supabase start                       # sobe a stack local
//   npx supabase db reset                    # aplica migrations 0001-0005 + seed.sql
//   $env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/review/__tests__/rls.integration.test.ts
//
// Sem RUN_RLS_INTEGRATION=1 a suíte é PULADA (skip) — o `npm test` do CI fica
// verde sem tocar no banco.

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const RUN = process.env.RUN_RLS_INTEGRATION === '1'

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY

// Slugs fixos do seed (supabase/seed.sql)
const PUBLISHED_SLUGS = ['dom-casmurro', 'o-crime-do-padre-amaro', 'iracema', 'o-cortico']
const DRAFT_SLUG = 'memorias-postumas-rascunho'
const BOOK_DOM_CASMURRO = 'aaaaaaaa-0000-4000-8000-000000000001'

describe.skipIf(!RUN)('RLS integration — review (local-only, TD-02)', () => {
  let anon: SupabaseClient<Database>

  beforeAll(() => {
    if (!LOCAL_ANON_KEY) {
      throw new Error(
        'Defina SUPABASE_LOCAL_ANON_KEY no .env.local (valor de `npx supabase status`). ' +
          'A chave não é hardcoded.'
      )
    }
    anon = createClient<Database>(LOCAL_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  })

  it('(1) anon LÊ apenas as 4 resenhas publicadas do seed (RVW-13)', async () => {
    const { data, error } = await anon.from('review').select('slug, status')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(4)
    const slugs = data!.map((r) => r.slug).sort()
    expect(slugs).toEqual([...PUBLISHED_SLUGS].sort())
  })

  it('(2) a resenha draft do seed NÃO aparece para anon (filtrada, sem erro)', async () => {
    const { data, error } = await anon
      .from('review')
      .select('slug')
      .eq('slug', DRAFT_SLUG)
      .maybeSingle()
    expect(error).toBeNull() // filtrada pela policy, NÃO um 42501
    expect(data).toBeNull()
  })

  it('(3) INSERT/UPDATE/DELETE anônimo em review é barrado — 42501 (RVW-15)', async () => {
    const insert = await anon
      .from('review')
      .insert({ book_id: BOOK_DOM_CASMURRO, title: 'x', slug: 'rls-anon-insert' })
    expect(insert.error?.code).toBe('42501')

    const update = await anon.from('review').update({ title: 'hack' }).eq('slug', 'dom-casmurro')
    expect(update.error?.code).toBe('42501')

    const del = await anon.from('review').delete().eq('slug', 'dom-casmurro')
    expect(del.error?.code).toBe('42501')
  })

  it('(4) RLS habilitado: toda linha lida por anon é published (draft oculto apesar de existir)', async () => {
    const { data, error } = await anon.from('review').select('status')
    expect(error).toBeNull()
    expect(data!.length).toBe(4) // 5 no banco (1 draft), mas anon só vê 4 → RLS ativo
    expect(data!.every((r) => r.status === 'published')).toBe(true)
  })
})
