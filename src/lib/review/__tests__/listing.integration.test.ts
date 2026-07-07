// LOCAL-ONLY — ver TD-02 em STATE.md
//
// Integração da camada de query da LISTAGEM (T4) contra o Supabase LOCAL. Não
// roda no CI (o pipeline não sobe Postgres). Exercita listPublishedReviews /
// listFeaturedReviews / listFilterOptions com o cliente ANON local injetado —
// prova busca (ilike), escape de curinga, filtros combináveis, ordenação,
// paginação por range e que DRAFT nunca aparece (LST-06/08/09/10/12/14/20).
//
// ⚠️ IMPORT DINÂMICO obrigatório: `../queries` → supabase/server → env.ts, e
// env.ts valida process.env com Zod NO LOAD do módulo. Um import estático aqui
// detona essa validação no job vitest do CI (sem vars do Supabase) ANTES de o
// describe.skipIf pular a suíte — o arquivo falha inteiro. Por isso `queries` é
// importado dentro do beforeAll (só roda quando RUN=1). Mesmo cuidado do
// rls.integration.test.ts, que importa apenas createClient + tipos.
// `listingParams` pode ser estático: módulo puro, sem env.
//
// Credenciais locais só de env (.env.local, gitignored) — NUNCA hardcoded:
//   SUPABASE_LOCAL_URL=http://127.0.0.1:54321
//   SUPABASE_LOCAL_ANON_KEY=<chave publishable local de `npx supabase status`>
//
// Como rodar (PowerShell):
//   npx supabase start && npx supabase db reset
//   $env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/review/__tests__/listing.integration.test.ts
//
// Sem RUN_RLS_INTEGRATION=1 a suíte é PULADA (o `npm test` do CI fica verde).

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { parseListingParams, type RawSearchParams } from '../listingParams'

const RUN = process.env.RUN_RLS_INTEGRATION === '1'
const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY

const P = (overrides: RawSearchParams = {}) => parseListingParams(overrides)

describe.skipIf(!RUN)('listing queries — integration (local-only, TD-02)', () => {
  let anon: SupabaseClient<Database>
  let queries: typeof import('../queries')

  beforeAll(async () => {
    if (!LOCAL_ANON_KEY) {
      throw new Error(
        'Defina SUPABASE_LOCAL_ANON_KEY no .env.local (valor de `npx supabase status`). Não é hardcoded.'
      )
    }
    // Import adiado de propósito — ver o aviso no cabeçalho do arquivo.
    queries = await import('../queries')
    anon = createClient<Database>(LOCAL_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  })

  it('sem params: 4 publicadas, draft ausente, excerpt derivado no servidor', async () => {
    const { rows, total } = await queries.listPublishedReviews(P(), anon)
    expect(total).toBe(4)
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.excerpt.length > 0)).toBe(true)
    expect(rows.every((r) => Boolean(r.book.author && r.book.genre))).toBe(true)
    expect(rows.some((r) => r.slug === 'memorias-postumas-rascunho')).toBe(false)
  })

  it('busca ilike no title (case-insensitive/parcial)', async () => {
    const { rows, total } = await queries.listPublishedReviews(P({ q: 'dom' }), anon)
    expect(total).toBe(1)
    expect(rows[0].slug).toBe('dom-casmurro')
  })

  it('escapeLike: % e _ do usuário viram LITERAL (sem curinga injetado)', async () => {
    // Sem escape, '%' casaria tudo (4); '_' casaria qualquer título (4).
    expect((await queries.listPublishedReviews(P({ q: '%' }), anon)).total).toBe(0)
    expect((await queries.listPublishedReviews(P({ q: '_' }), anon)).total).toBe(0)
  })

  it('filtros combináveis: gênero, autor, nota mín. (draft nunca entra)', async () => {
    expect((await queries.listPublishedReviews(P({ genero: 'realismo' }), anon)).total).toBe(1)
    expect((await queries.listPublishedReviews(P({ autor: 'Machado de Assis' }), anon)).total).toBe(
      1
    )
    expect((await queries.listPublishedReviews(P({ nota: '5' }), anon)).total).toBe(1) // só O Cortiço (5.0)
    expect((await queries.listPublishedReviews(P({ nota: '4' }), anon)).total).toBe(4)
  })

  it('ordenação: nota desc e título A–Z', async () => {
    const porNota = await queries.listPublishedReviews(P({ ordem: 'nota' }), anon)
    expect(porNota.rows[0].slug).toBe('o-cortico') // 5.0 no topo
    const porTitulo = await queries.listPublishedReviews(P({ ordem: 'titulo' }), anon)
    expect(porTitulo.rows[0].slug).toBe('dom-casmurro') // "Dom..." vem antes
  })

  it('paginação: página além do total volta vazia com total intacto', async () => {
    const p2 = await queries.listPublishedReviews(P({ pagina: '2' }), anon)
    expect(p2.rows).toHaveLength(0)
    expect(p2.total).toBe(4)
  })

  it('destaque: 4 publicadas derivadas', async () => {
    expect(await queries.listFeaturedReviews(anon)).toHaveLength(4)
  })

  it('opções de filtro derivadas do acervo publicado', async () => {
    const { genres, authors } = await queries.listFilterOptions(anon)
    expect(genres.map((g) => g.slug)).toContain('realismo')
    expect(authors).toContain('Machado de Assis')
    expect(genres).toHaveLength(4)
    expect(authors).toHaveLength(4)
  })
})
