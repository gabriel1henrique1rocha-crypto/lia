// LOCAL-ONLY — ver TD-02 em STATE.md
//
// Teste de integração de RLS contra o Supabase LOCAL (não roda no CI atual —
// o pipeline não sobe Postgres/Supabase; mover para o CI é avaliado no M4).
//
// Por que NÃO reaproveita o singleton de src/lib/supabase/client.ts:
// aquele client lê .env.local, que aponta para o projeto REMOTO. Este teste
// precisa falar com a stack LOCAL (seed + policies aplicados localmente), então
// cria clients próprios apontando para 127.0.0.1.
//
// As credenciais locais vêm SOMENTE de variáveis de ambiente — NUNCA hardcoded.
// Coloque-as no `.env.local` (gitignored); o vitest.config carrega o `.env.local`
// em process.env via loadEnv. Valores são da stack local (`npx supabase status`),
// não segredos de produção:
//   SUPABASE_LOCAL_URL=http://127.0.0.1:54321
//   SUPABASE_LOCAL_ANON_KEY=<sua chave publishable local>
//   SUPABASE_LOCAL_SECRET_KEY=<sua chave secret local>
//
// Como rodar (PowerShell):
//   npx supabase start                       # sobe a stack local
//   npx supabase db reset                    # aplica migrations 0001-0003 + seed.sql
//   $env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/book/__tests__/rls.integration.test.ts
//
// Sem RUN_RLS_INTEGRATION=1 a suíte é PULADA (skip) — por isso o `npm test` do
// CI fica verde sem tocar no banco.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const RUN = process.env.RUN_RLS_INTEGRATION === '1'

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY
const LOCAL_SECRET_KEY = process.env.SUPABASE_LOCAL_SECRET_KEY

// IDs fixos do seed (supabase/seed.sql)
const BOOK_DOM_CASMURRO = 'aaaaaaaa-0000-4000-8000-000000000001'
const BOOK_IRACEMA = 'aaaaaaaa-0000-4000-8000-000000000003'
const GENRE_ROMANCE = '11111111-1111-4111-8111-111111111111'

// Marcadores dos dados criados pelo teste (para limpeza idempotente)
const TEST_REVIEW_SLUG_1 = 'rls-integration-review-1'
const TEST_REVIEW_SLUG_2 = 'rls-integration-review-2'
const TEST_BOOK_TITLE = 'RLS Integration — anon insert (não deve persistir)'

describe.skipIf(!RUN)('RLS integration (local-only, TD-02)', () => {
  let anon: SupabaseClient<Database>
  let service: SupabaseClient<Database>

  // Limpa qualquer resíduo de execuções anteriores (service_role contorna RLS).
  async function cleanup() {
    await service.from('review').delete().in('slug', [TEST_REVIEW_SLUG_1, TEST_REVIEW_SLUG_2])
    await service.from('book').delete().eq('title', TEST_BOOK_TITLE)
  }

  beforeAll(async () => {
    if (!LOCAL_ANON_KEY || !LOCAL_SECRET_KEY) {
      throw new Error(
        'Defina SUPABASE_LOCAL_ANON_KEY e SUPABASE_LOCAL_SECRET_KEY no .env.local ' +
          '(valores de `npx supabase status`). As chaves não são hardcoded.'
      )
    }
    anon = createClient<Database>(LOCAL_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
    service = createClient<Database>(LOCAL_URL, LOCAL_SECRET_KEY, {
      auth: { persistSession: false },
    })
    await cleanup()
  })
  afterAll(cleanup)

  it('(1) anon LÊ book do seed com sucesso (BOOK-17 AC#2)', async () => {
    const { data, error } = await anon.from('book').select('*, genre(name, slug)')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(4)
    expect(data!.some((b) => b.id === BOOK_DOM_CASMURRO)).toBe(true)
  })

  it('(2) INSERT anônimo em book é barrado por RLS — 42501 (BOOK-17 AC#3)', async () => {
    const { error } = await anon
      .from('book')
      .insert({ title: TEST_BOOK_TITLE, author: 'Ninguém', genre_id: GENRE_ROMANCE })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('(3) segunda review no mesmo book_id é barrada pela unique — 23505 (BOOK-11 AC#2)', async () => {
    // service_role contorna RLS para exercitar a constraint do banco.
    const first = await service.from('review').insert({
      book_id: BOOK_DOM_CASMURRO,
      title: 'Resenha 1',
      slug: TEST_REVIEW_SLUG_1,
    })
    expect(first.error).toBeNull()

    const second = await service.from('review').insert({
      book_id: BOOK_DOM_CASMURRO,
      title: 'Resenha 2',
      slug: TEST_REVIEW_SLUG_2,
    })
    expect(second.error).not.toBeNull()
    expect(second.error!.code).toBe('23505')
  })

  it('(4) book sem review é válido e legível — 1—0..1 (BOOK-11 AC#3)', async () => {
    // Iracema não tem review (o teste 3 só cria/limpa em Dom Casmurro).
    const reviews = await service.from('review').select('id').eq('book_id', BOOK_IRACEMA)
    expect(reviews.error).toBeNull()
    expect(reviews.data!.length).toBe(0)

    // ...e ainda assim aparece na leitura pública (anon) — book sem review existe sem erro.
    const books = await anon.from('book').select('id').eq('id', BOOK_IRACEMA).maybeSingle()
    expect(books.error).toBeNull()
    expect(books.data?.id).toBe(BOOK_IRACEMA)
  })
})
