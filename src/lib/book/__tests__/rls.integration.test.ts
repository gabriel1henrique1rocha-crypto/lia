// LOCAL-ONLY — ver TD-02 em STATE.md
//
// Teste de integração de RLS contra o Supabase LOCAL (não roda no CI atual —
// o pipeline não sobe Postgres/Supabase; mover para o CI é avaliado no M4).
//
// Por que cria clients próprios em vez de reaproveitar uma fábrica do app:
// as fábricas do app leem .env.local, que aponta para o projeto REMOTO. Este teste
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
//
// Cobertura atual: (1)(2)(4) ativos — leitura pública de `book` (BOOK-17, via
// GRANT da migration 0004) e escrita anônima barrada. O caso (3) (unique de
// `review` via service_role) está `it.skip` aguardando TD-03 (GRANTs de
// `review`/service_role numa frente de infra) — ver STATE.md.

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

  // BLOQUEADO por TD-03: o service_role não tem GRANT em `review` no estado
  // atual (pós-2026-05-30, auto_expose_new_tables=false; a migration desta
  // feature concede só `book` — BOOK-17). A constraint unique(book_id) já existe
  // desde o M0; este teste de integração será reativado quando a frente de infra
  // (TD-03) conceder os grants de `review`/service_role.
  it.skip('(3) segunda review no mesmo book_id é barrada pela unique — 23505 (BOOK-11 AC#2)', async () => {
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

  it('(4) book sem review é válido e legível por anon — 1—0..1 (BOOK-11 AC#3)', async () => {
    // O seed não cria reviews; Iracema é um book sem review. Deve existir e ser
    // legível na leitura pública (anon) — prova que a cardinalidade 1—0..1 é
    // válida do lado do book. (A contagem de reviews via service_role depende de
    // TD-03; a parte verificável agora é a legibilidade pública do book.)
    const { data, error } = await anon
      .from('book')
      .select('id, title')
      .eq('id', BOOK_IRACEMA)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data?.id).toBe(BOOK_IRACEMA)
  })
})
