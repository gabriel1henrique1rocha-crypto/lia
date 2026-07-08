// LOCAL-ONLY — ver TD-02 em STATE.md. CI PULA (describe.skipIf).
//
// PROVA CENTRAL DA TD-04 / SEC-14: mesmo com SUPABASE_SERVICE_ROLE_KEY PRESENTE
// no ambiente, o caminho público (createPublicClient, via review/queries) NÃO
// vira bypass — lê só `published`, idêntico ao anon puro. Se alguém reintroduzir
// um fallback `?? service_role` em public.ts, o rascunho do seed apareceria e
// estes testes ficariam VERMELHOS.
//
// Complementa o tripwire estático (no-service-role.test.ts, roda no CI): aquele
// prova que o FONTE do caminho público não menciona a chave; este prova o
// COMPORTAMENTO em runtime contra o Postgres real.
//
// ⚠️ IMPORT DINÂMICO obrigatório (lição STATE.md): review/queries → public.ts →
// env.ts valida no load. A env é apontada ao stack LOCAL e a service_role é
// INJETADA ANTES do import — a prova é que o caminho público a ignora.
//
// Credenciais locais só de env (.env.local, gitignored) — NUNCA hardcoded.
import { describe, it, expect, beforeAll } from 'vitest'

const RUN = process.env.RUN_RLS_INTEGRATION === '1'
const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321'
const LOCAL_ANON = process.env.SUPABASE_LOCAL_ANON_KEY
const LOCAL_SECRET = process.env.SUPABASE_LOCAL_SECRET_KEY

// Seed (supabase/seed.sql): 4 published + 1 draft invisível ao público.
const DRAFT_SLUG = 'memorias-postumas-rascunho'
const PUBLISHED_SLUG = 'dom-casmurro'

describe.skipIf(!RUN)('SEC-14 — anon ≠ bypass com service_role no ambiente (TD-04)', () => {
  let queries: typeof import('@/lib/review/queries')

  beforeAll(async () => {
    if (!LOCAL_ANON || !LOCAL_SECRET) {
      throw new Error(
        'Defina SUPABASE_LOCAL_ANON_KEY e SUPABASE_LOCAL_SECRET_KEY no .env.local ' +
          '(valores de `npx supabase status`).'
      )
    }
    // Aponta o env PÚBLICO ao stack local…
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL_ANON
    // …e INJETA a service_role no ambiente. Se o caminho público a herdasse,
    // veria o rascunho — é exatamente o que provamos NÃO acontecer.
    process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SECRET
    queries = await import('@/lib/review/queries')
  })

  it('rascunho INVISÍVEL pelo caminho público, mesmo com service_role na env', async () => {
    const review = await queries.getPublishedReviewBySlug(DRAFT_SLUG)
    expect(review).toBeNull()
  })

  it('published segue visível (sanidade — o caminho anon funciona)', async () => {
    const review = await queries.getPublishedReviewBySlug(PUBLISHED_SLUG)
    expect(review).not.toBeNull()
    expect(review?.slug).toBe(PUBLISHED_SLUG)
  })

  it('listagem pública vê só published (4+), rascunho ausente', async () => {
    const { rows, total } = await queries.listPublishedReviews({
      q: '',
      genero: '',
      autor: '',
      nota: null,
      ordem: 'recentes',
      pagina: 1,
    })
    expect(total).toBeGreaterThanOrEqual(4)
    expect(rows.some((r) => r.slug === DRAFT_SLUG)).toBe(false)
  })
})
