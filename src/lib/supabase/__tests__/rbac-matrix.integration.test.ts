// LOCAL-ONLY — ver TD-02 em STATE.md. CI PULA (describe.skipIf).
//
// PROVA CENTRAL DA FEATURE (SEC-10/11/12/19): a matriz RLS exercitada em RUNTIME
// via API (PostgREST), com usuários de teste REAIS (sessão autenticada de
// verdade), não só o catálogo pg_policies. Foco na fronteira ENTRE EDITORES
// (editor A × recurso do editor B) e no WITH CHECK (reatribuição de ownership).
//
// Setup: usuários criados via Auth admin API (GoTrue/service_role); linhas
// `editor`, books e reviews criados por psql como POSTGRES (superuser) — porque
// o service_role NÃO tem GRANT de tabela em editor/book (dormência C-2 / TD-03:
// pós-2026-05-30 nem o service_role recebe grant automático). Isso ESPELHA o
// bootstrap real (C-4: 1º admin criado por SQL privilegiado no dashboard). As
// ASSERÇÕES rodam via API (PostgREST) com as sessões autenticadas reais de A/B/
// admin — que TÊM os grants (0007/0008). Reviews de teste são NÃO-PÚBLICAS
// (draft): a review pública é confounder (review_public_read), então a fronteira
// entre editores precisa de drafts.
//
// Credenciais locais só de env (.env.local) — NUNCA hardcoded.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const RUN = process.env.RUN_RLS_INTEGRATION === '1'
const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321'
const LOCAL_ANON = process.env.SUPABASE_LOCAL_ANON_KEY
const LOCAL_SECRET = process.env.SUPABASE_LOCAL_SECRET_KEY
const DB_CONTAINER = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? 'supabase_db_lia'

// SQL privilegiado (postgres/superuser) para as fixtures — bypassa grants e RLS,
// como o bootstrap manual da C-4. ON_ERROR_STOP=1 → lança se o SQL falhar.
function psql(sql: string) {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// Leitura de verificação como POSTGRES. Necessária porque o service_role NÃO tem
// SELECT em review (dormência C-2) — ler pela Data API do service devolveria null
// e mascararia se a linha ficou intacta. -tA = escalar cru.
function psqlScalar(sql: string): string {
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -tA -q`, {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

const PW = 'Rls-Matrix-Test-Pw-123!'
const EMAIL_A = 'rls-matrix-a@lia.test'
const EMAIL_B = 'rls-matrix-b@lia.test'
const EMAIL_ADMIN = 'rls-matrix-admin@lia.test'

const GENRE = '11111111-1111-4111-8111-111111111111' // romance (seed)
const PUBLISHED_SEED = 'bbbbbbbb-0000-4000-8000-000000000001' // dom-casmurro (confounder)
const BOOK_A = 'cccccccc-0000-4000-8000-00000000000a'
const BOOK_B = 'cccccccc-0000-4000-8000-00000000000b'
const BOOK_C = 'cccccccc-0000-4000-8000-00000000000c'
const BOOK_D = 'cccccccc-0000-4000-8000-00000000000d'
const BOOK_E = 'cccccccc-0000-4000-8000-00000000000e' // livre p/ editor A inserir a própria
const BOOK_F = 'cccccccc-0000-4000-8000-00000000000f' // livre p/ a tentativa forjada (editor_id=B)
const REVIEW_A = 'dddddddd-0000-4000-8000-00000000000a' // editor A, draft
const REVIEW_B = 'dddddddd-0000-4000-8000-00000000000b' // editor B, draft
const REVIEW_C = 'dddddddd-0000-4000-8000-00000000000c' // editor A, draft (admin deleta)
const REVIEW_D = 'dddddddd-0000-4000-8000-00000000000d' // admin insere (em nome de B)

describe.skipIf(!RUN)('Matriz RLS comportamental via API (SEC-10/11/12/19)', () => {
  let service: SupabaseClient<Database>
  let a: SupabaseClient<Database>
  let admin: SupabaseClient<Database>
  let idA = ''
  let idB = ''
  let idAdmin = ''

  function anonClient() {
    return createClient<Database>(LOCAL_URL, LOCAL_ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async function deleteUserByEmail(email: string) {
    const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = data.users.find((u) => u.email === email)
    if (found) await service.auth.admin.deleteUser(found.id) // cascata remove `editor`
  }

  // Só cria o usuário (GoTrue) e a sessão; a linha `editor` é inserida por psql
  // (o service_role não tem grant em editor — dormência C-2).
  async function makeUser(email: string) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
    })
    if (error || !data.user) throw error ?? new Error('createUser falhou')
    const client = anonClient()
    const sign = await client.auth.signInWithPassword({ email, password: PW })
    if (sign.error) throw sign.error
    return { id: data.user.id, client }
  }

  async function cleanup() {
    // Tabelas por psql (postgres); usuários por GoTrue (cascata remove editor).
    psql(
      `delete from public.review where id in ('${REVIEW_A}','${REVIEW_B}','${REVIEW_C}','${REVIEW_D}');
       delete from public.book where id in ('${BOOK_A}','${BOOK_B}','${BOOK_C}','${BOOK_D}','${BOOK_E}','${BOOK_F}');`
    )
    await Promise.all([EMAIL_A, EMAIL_B, EMAIL_ADMIN].map(deleteUserByEmail))
  }

  beforeAll(async () => {
    if (!LOCAL_ANON || !LOCAL_SECRET) {
      throw new Error('Defina SUPABASE_LOCAL_ANON_KEY e SUPABASE_LOCAL_SECRET_KEY no .env.local')
    }
    service = createClient<Database>(LOCAL_URL, LOCAL_SECRET, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await cleanup()
    ;({ id: idA, client: a } = await makeUser(EMAIL_A))
    // B só precisa existir como editor (uid); a fronteira é exercitada pelo client de A.
    ;({ id: idB } = await makeUser(EMAIL_B))
    ;({ id: idAdmin, client: admin } = await makeUser(EMAIL_ADMIN))

    // Fixtures privilegiadas (postgres): editor rows + books + reviews draft.
    // A dona de REVIEW_A e REVIEW_C; B dona de REVIEW_B. BOOK_E fica livre.
    psql(`
      insert into public.editor (id, email, name, role, active) values
        ('${idA}', '${EMAIL_A}', 'A', 'editor', true),
        ('${idB}', '${EMAIL_B}', 'B', 'editor', true),
        ('${idAdmin}', '${EMAIL_ADMIN}', 'Admin', 'admin', true);
      insert into public.book (id, title, author, genre_id) values
        ('${BOOK_A}','RLS A','A','${GENRE}'),
        ('${BOOK_B}','RLS B','B','${GENRE}'),
        ('${BOOK_C}','RLS C','C','${GENRE}'),
        ('${BOOK_D}','RLS D','D','${GENRE}'),
        ('${BOOK_E}','RLS E','E','${GENRE}'),
        ('${BOOK_F}','RLS F','F','${GENRE}');
      insert into public.review (id, book_id, title, slug, status, editor_id) values
        ('${REVIEW_A}','${BOOK_A}','rev A','rls-rev-a','draft','${idA}'),
        ('${REVIEW_B}','${BOOK_B}','rev B','rls-rev-b','draft','${idB}'),
        ('${REVIEW_C}','${BOOK_C}','rev C','rls-rev-c','draft','${idA}');
    `)
  }, 30_000)

  afterAll(cleanup)

  // ── SEC-19: comment / recommendation deny-by-default (anon E authenticated) ──

  it('comment: anon negado (SELECT e INSERT)', async () => {
    const anon = anonClient()
    const sel = await anon.from('comment').select('id')
    expect(sel.error !== null || (sel.data?.length ?? 0) === 0).toBe(true)
    const ins = await anon.from('comment').insert({ review_id: REVIEW_A, body: 'x' })
    expect(ins.error).not.toBeNull()
  })

  it('comment: authenticated (editor A) negado (SELECT e INSERT)', async () => {
    const sel = await a.from('comment').select('id')
    expect(sel.error !== null || (sel.data?.length ?? 0) === 0).toBe(true)
    const ins = await a.from('comment').insert({ review_id: REVIEW_A, body: 'x' })
    expect(ins.error).not.toBeNull()
  })

  it('recommendation: anon negado (SELECT e INSERT)', async () => {
    const anon = anonClient()
    const sel = await anon.from('recommendation').select('id')
    expect(sel.error !== null || (sel.data?.length ?? 0) === 0).toBe(true)
    const ins = await anon.from('recommendation').insert({ review_id: REVIEW_A, voter_hash: 'h' })
    expect(ins.error).not.toBeNull()
  })

  it('recommendation: authenticated (editor A) negado (SELECT e INSERT)', async () => {
    const sel = await a.from('recommendation').select('id')
    expect(sel.error !== null || (sel.data?.length ?? 0) === 0).toBe(true)
    const ins = await a.from('recommendation').insert({ review_id: REVIEW_A, voter_hash: 'h' })
    expect(ins.error).not.toBeNull()
  })

  // ── review: own-or-admin + fronteira A × B ──────────────────────────────────

  it('review SELECT: editor A vê a PRÓPRIA review draft', async () => {
    const { data } = await a.from('review').select('id').eq('id', REVIEW_A).maybeSingle()
    expect(data?.id).toBe(REVIEW_A)
  })

  it('review SELECT: editor A NÃO vê review NÃO-PÚBLICA de B', async () => {
    const { data } = await a.from('review').select('id').eq('id', REVIEW_B).maybeSingle()
    expect(data).toBeNull()
  })

  it('review SELECT: editor A vê review PÚBLICA (confounder review_public_read)', async () => {
    const { data } = await a.from('review').select('id').eq('id', PUBLISHED_SEED).maybeSingle()
    expect(data?.id).toBe(PUBLISHED_SEED)
  })

  it('review UPDATE: editor A NÃO edita review de B (negado por USING → 0 linhas)', async () => {
    const { data } = await a.from('review').update({ title: 'hack' }).eq('id', REVIEW_B).select()
    expect(data ?? []).toHaveLength(0)
    // Confirma como postgres que a review de B ficou intacta.
    expect(psqlScalar(`select title from public.review where id='${REVIEW_B}'`)).toBe('rev B')
  })

  it('review WITH CHECK: editor A não reatribui ownership da PRÓPRIA para B (NEGADO)', async () => {
    // USING passa (A é dona de REVIEW_A); WITH CHECK rejeita a nova linha (editor_id=B).
    // É o ÚNICO assert que exercita o WITH CHECK — sem ele, isto passaria.
    const { error } = await a.from('review').update({ editor_id: idB }).eq('id', REVIEW_A).select()
    expect(error).not.toBeNull()
    expect(psqlScalar(`select editor_id from public.review where id='${REVIEW_A}'`)).toBe(idA) // ownership intacto
  })

  it('review DELETE: editor A NÃO deleta review de B (0 linhas; B intacta)', async () => {
    await a.from('review').delete().eq('id', REVIEW_B)
    expect(psqlScalar(`select id from public.review where id='${REVIEW_B}'`)).toBe(REVIEW_B)
  })

  it('review DELETE: editor A NÃO deleta a PRÓPRIA (DELETE = admin-only; A intacta)', async () => {
    await a.from('review').delete().eq('id', REVIEW_A)
    expect(psqlScalar(`select id from public.review where id='${REVIEW_A}'`)).toBe(REVIEW_A)
  })

  // ── admin: acesso pleno sob RLS ─────────────────────────────────────────────

  it('review admin: SELECT e UPDATE de QUALQUER review (a de B)', async () => {
    const sel = await admin.from('review').select('id').eq('id', REVIEW_B).maybeSingle()
    expect(sel.data?.id).toBe(REVIEW_B)
    const upd = await admin
      .from('review')
      .update({ title: 'rev B (admin)' })
      .eq('id', REVIEW_B)
      .select()
    expect(upd.error).toBeNull()
    expect(upd.data ?? []).toHaveLength(1)
  })

  it('review admin: INSERT livre (em nome de B) e DELETE de qualquer (REVIEW_C)', async () => {
    const ins = await admin
      .from('review')
      .insert({
        id: REVIEW_D,
        book_id: BOOK_D,
        title: 'rev D',
        slug: 'rls-rev-d',
        status: 'draft',
        editor_id: idB,
      })
      .select()
    expect(ins.error).toBeNull()
    expect(ins.data ?? []).toHaveLength(1)
    await admin.from('review').delete().eq('id', REVIEW_C)
    expect(
      psqlScalar(
        `select coalesce((select id::text from public.review where id='${REVIEW_C}'), 'GONE')`
      )
    ).toBe('GONE') // admin deletou de fato
  })

  // ── anon: só leitura pública ────────────────────────────────────────────────

  it('review anon: vê PÚBLICA, não vê draft, INSERT negado', async () => {
    const anon = anonClient()
    const pub = await anon.from('review').select('id').eq('id', PUBLISHED_SEED).maybeSingle()
    expect(pub.data?.id).toBe(PUBLISHED_SEED)
    const draft = await anon.from('review').select('id').eq('id', REVIEW_A).maybeSingle()
    expect(draft.data).toBeNull()
    const ins = await anon
      .from('review')
      .insert({ book_id: BOOK_A, title: 'x', slug: 'anon-x', status: 'published', editor_id: null })
    expect(ins.error).not.toBeNull()
  })

  // ── editor: permit da própria escrita (SEC-11) ─────────────────────────────

  it('review INSERT: editor A cria a PRÓPRIA (editor_id = seu uid) — permitido', async () => {
    const { data, error } = await a
      .from('review')
      .insert({
        book_id: BOOK_E,
        title: 'rev E (A)',
        slug: 'rls-rev-e',
        status: 'draft',
        editor_id: idA,
      })
      .select('id, editor_id')
    expect(error).toBeNull()
    expect(data?.[0]?.editor_id).toBe(idA)
  })

  it('review INSERT: editor A NÃO cria em nome de B (editor_id = B) — negado por WITH CHECK', async () => {
    const { error } = await a
      .from('review')
      .insert({
        book_id: BOOK_F,
        title: 'forjada',
        slug: 'rls-forjada',
        status: 'draft',
        editor_id: idB,
      })
      .select()
    expect(error).not.toBeNull()
  })

  // ── editor: pode PUBLICAR a própria (A-4) ──────────────────────────────────

  it('review UPDATE: editor A PUBLICA a própria (draft → published, A-4)', async () => {
    const { data, error } = await a
      .from('review')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', REVIEW_A)
      .select('status')
    expect(error).toBeNull()
    expect(data?.[0]?.status).toBe('published')
  })
})
