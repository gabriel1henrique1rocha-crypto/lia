// LOCAL-ONLY — ver TD-02 em STATE.md. CI PULA (describe.skipIf).
//
// T3 — MATRIZ COMPORTAMENTAL DAS POLICIES DE `book` (REV-07-schema, DD-4).
//
// POR QUE ESTA SUÍTE EXISTE: as três policies da 0009 — `book_editor_insert`,
// `book_editor_update`, `book_admin_delete` — foram verificadas até aqui por
// EXISTÊNCIA (`pg_policies` mostra as linhas), NUNCA por COMPORTAMENTO. Existir
// no catálogo não prova que negam o que devem negar. O T2 (RPCs INVOKER) DELEGA
// a essas policies todo o isolamento entre editores: se `book_editor_update`
// estiver frouxa, o RPC não protege nada. Esta é a prova que faltava.
//
// A posse de `book` é TRANSITIVA (DD-4): `review.book_id` é UNIQUE, então o
// editor é dono do book porque é dono da review 1—1 daquele book. Quem faz a
// travessia é `owns_book_via_review` (definer, 0009), chamada pela policy.
//
// ORÁCULO — regra não negociável (Lesson Learned do M2): toda verificação de
// ESTADO usa `psql` como POSTGRES (superuser), jamais o papel sob teste.
// Perguntar "o editor B vê a linha?" usando o próprio B confunde "não existe"
// com "a RLS escondeu", e um teste de negação passa por falso-verde. O papel sob
// teste só EXECUTA a operação; quem LÊ a verdade é o superuser.
//
// As operações rodam via API (PostgREST) com sessões autenticadas REAIS — é o
// caminho de produção, não `set role` em psql. Setup espelha o bootstrap real
// (C-4): usuários por GoTrue admin, linhas `editor`/`book`/`review` por psql
// privilegiado, porque nem o `service_role` tem GRANT nessas tabelas (TD-03).
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

/** SQL privilegiado (postgres). Fixtures — bypassa grants e RLS, como a C-4. */
function psql(sql: string) {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

/** ORÁCULO. Lê o estado real como postgres — nunca pelo papel sob teste. */
function psqlScalar(sql: string): string {
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -tA -q`, {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

const PW = 'Book-Rls-Matrix-Pw-123!'
const EMAIL_A = 'book-rls-a@lia.test'
const EMAIL_B = 'book-rls-b@lia.test'
const EMAIL_ADMIN = 'book-rls-admin@lia.test'

const GENRE = '11111111-1111-4111-8111-111111111111' // romance (seed)

const BOOK_OWN = 'eeee0001-0000-4000-8000-000000000001' // review de A
const BOOK_OTHER = 'eeee0001-0000-4000-8000-000000000002' // review de B
const BOOK_ORPHAN = 'eeee0001-0000-4000-8000-000000000003' // SEM review
const BOOK_DEL_ADMIN = 'eeee0001-0000-4000-8000-000000000004' // admin deleta
const BOOK_DEL_EDITOR = 'eeee0001-0000-4000-8000-000000000005' // A tenta deletar (própria)
const BOOK_ANON = 'eeee0001-0000-4000-8000-000000000006' // alvo das tentativas anon

const REVIEW_OWN = 'ffff0001-0000-4000-8000-000000000001'
const REVIEW_OTHER = 'ffff0001-0000-4000-8000-000000000002'
const REVIEW_DEL_ADMIN = 'ffff0001-0000-4000-8000-000000000004'
const REVIEW_DEL_EDITOR = 'ffff0001-0000-4000-8000-000000000005'

/** Marcas usadas para provar que um UPDATE negado NÃO tocou a linha. */
const TITULO_ORIGINAL = 'RLS book original'
const TITULO_HACK = 'RLS book SEQUESTRADO'

describe.skipIf(!RUN)('Matriz RLS comportamental de `book` (REV-07-schema, DD-4)', () => {
  let service: SupabaseClient<Database>
  let a: SupabaseClient<Database>
  let admin: SupabaseClient<Database>
  let idA = ''
  let idB = ''
  let idAdmin = ''
  /** Ids criados via RPC — limpos no afterAll. */
  const rpcBookIds: string[] = []

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
    const rpcList = rpcBookIds.length
      ? `delete from public.book where id in (${rpcBookIds.map((i) => `'${i}'`).join(',')});`
      : ''
    // review antes de book só por clareza — a FK é ON DELETE CASCADE de qualquer forma.
    psql(
      `delete from public.review where id in ('${REVIEW_OWN}','${REVIEW_OTHER}','${REVIEW_DEL_ADMIN}','${REVIEW_DEL_EDITOR}');
       delete from public.book where id in ('${BOOK_OWN}','${BOOK_OTHER}','${BOOK_ORPHAN}','${BOOK_DEL_ADMIN}','${BOOK_DEL_EDITOR}','${BOOK_ANON}');
       ${rpcList}
       delete from public.book where title like 'RPC RLS %';`
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
    ;({ id: idB } = await makeUser(EMAIL_B)) // B só precisa existir como dono
    ;({ id: idAdmin, client: admin } = await makeUser(EMAIL_ADMIN))

    // Reviews em DRAFT de propósito: uma review publicada é confounder
    // (`review_public_read` deixaria A enxergá-la), e a fronteira entre editores
    // só fica visível com rascunho.
    psql(`
      insert into public.editor (id, email, name, role, active) values
        ('${idA}', '${EMAIL_A}', 'A', 'editor', true),
        ('${idB}', '${EMAIL_B}', 'B', 'editor', true),
        ('${idAdmin}', '${EMAIL_ADMIN}', 'Admin', 'admin', true);
      insert into public.book (id, title, author, genre_id) values
        ('${BOOK_OWN}','${TITULO_ORIGINAL}','A','${GENRE}'),
        ('${BOOK_OTHER}','${TITULO_ORIGINAL}','B','${GENRE}'),
        ('${BOOK_ORPHAN}','${TITULO_ORIGINAL}','Orfao','${GENRE}'),
        ('${BOOK_DEL_ADMIN}','${TITULO_ORIGINAL}','D1','${GENRE}'),
        ('${BOOK_DEL_EDITOR}','${TITULO_ORIGINAL}','D2','${GENRE}'),
        ('${BOOK_ANON}','${TITULO_ORIGINAL}','Anon','${GENRE}');
      insert into public.review (id, book_id, title, slug, status, editor_id) values
        ('${REVIEW_OWN}','${BOOK_OWN}','rev own','book-rls-own','draft','${idA}'),
        ('${REVIEW_OTHER}','${BOOK_OTHER}','rev other','book-rls-other','draft','${idB}'),
        ('${REVIEW_DEL_ADMIN}','${BOOK_DEL_ADMIN}','rev d1','book-rls-d1','draft','${idA}'),
        ('${REVIEW_DEL_EDITOR}','${BOOK_DEL_EDITOR}','rev d2','book-rls-d2','draft','${idA}');
    `)
  }, 30_000)

  afterAll(cleanup)

  // ── INSERT ────────────────────────────────────────────────────────────────

  it('INSERT: editor ativo PODE inserir book (book_editor_insert)', async () => {
    const id = 'eeee0001-0000-4000-8000-0000000000a1'
    rpcBookIds.push(id)
    const { error } = await a
      .from('book')
      .insert({ id, title: 'RPC RLS insert direto', author: 'A', genre_id: GENRE })
    expect(error).toBeNull()
    // ORÁCULO: a linha existe de fato, não só "sem erro".
    expect(psqlScalar(`select count(*) from public.book where id = '${id}';`)).toBe('1')
  })

  it('INSERT: anon NEGADO — falta de GRANT, antes mesmo da policy', async () => {
    const anon = anonClient()
    const id = 'eeee0001-0000-4000-8000-0000000000a2'
    const { error } = await anon
      .from('book')
      .insert({ id, title: 'anon nao deveria', author: 'X', genre_id: GENRE })
    expect(error).not.toBeNull()
    // ORÁCULO: nada foi criado.
    expect(psqlScalar(`select count(*) from public.book where id = '${id}';`)).toBe('0')
  })

  // ── UPDATE ────────────────────────────────────────────────────────────────

  it('UPDATE: editor A PODE editar book da PRÓPRIA review (owns_book_via_review)', async () => {
    const { error } = await a
      .from('book')
      .update({ title: 'RLS book editado por A' })
      .eq('id', BOOK_OWN)
    expect(error).toBeNull()
    expect(psqlScalar(`select title from public.book where id = '${BOOK_OWN}';`)).toBe(
      'RLS book editado por A'
    )
  })

  it('UPDATE: editor A NÃO edita book da review de B (0 linhas, sem erro)', async () => {
    const { data, error } = await a
      .from('book')
      .update({ title: TITULO_HACK })
      .eq('id', BOOK_OTHER)
      .select()
    // A policy nega pelo USING: o PostgREST não vê linha alcançável → 0 linhas,
    // não erro. É por isso que a asserção de estado abaixo é obrigatória.
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    // ORÁCULO: o book de B ficou INTACTO.
    expect(psqlScalar(`select title from public.book where id = '${BOOK_OTHER}';`)).toBe(
      TITULO_ORIGINAL
    )
  })

  it('UPDATE: editor A NÃO edita book ÓRFÃO (sem review vinculada)', async () => {
    // `owns_book_via_review` não acha dono para um book sem review → USING falso
    // para qualquer não-admin. Consequência: um book criado e ainda não vinculado
    // fica IMUTÁVEL até a review existir — inclusive para quem o criou.
    const { data, error } = await a
      .from('book')
      .update({ title: TITULO_HACK })
      .eq('id', BOOK_ORPHAN)
      .select()
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    expect(psqlScalar(`select title from public.book where id = '${BOOK_ORPHAN}';`)).toBe(
      TITULO_ORIGINAL
    )
    // E o helper confirma o porquê, lido pelo oráculo.
    expect(
      psqlScalar(
        `select exists (select 1 from public.review where book_id = '${BOOK_ORPHAN}')::text;`
      )
    ).toBe('false')
  })

  it('UPDATE: admin PODE editar book de qualquer editor (is_admin)', async () => {
    const { error } = await admin
      .from('book')
      .update({ title: 'RLS book editado por admin' })
      .eq('id', BOOK_OTHER)
    expect(error).toBeNull()
    expect(psqlScalar(`select title from public.book where id = '${BOOK_OTHER}';`)).toBe(
      'RLS book editado por admin'
    )
  })

  it('UPDATE: anon NEGADO', async () => {
    const anon = anonClient()
    const { data, error } = await anon
      .from('book')
      .update({ title: TITULO_HACK })
      .eq('id', BOOK_ANON)
      .select()
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true)
    expect(psqlScalar(`select title from public.book where id = '${BOOK_ANON}';`)).toBe(
      TITULO_ORIGINAL
    )
  })

  // ── DELETE ────────────────────────────────────────────────────────────────

  it('DELETE: admin PODE deletar book (book_admin_delete)', async () => {
    const { error } = await admin.from('book').delete().eq('id', BOOK_DEL_ADMIN)
    expect(error).toBeNull()
    expect(psqlScalar(`select count(*) from public.book where id = '${BOOK_DEL_ADMIN}';`)).toBe('0')
    // FK review→book é ON DELETE CASCADE: a review some junto.
    expect(psqlScalar(`select count(*) from public.review where id = '${REVIEW_DEL_ADMIN}';`)).toBe(
      '0'
    )
  })

  it('DELETE: editor não-admin NEGADO mesmo sobre book PRÓPRIO (admin-only)', async () => {
    const { data, error } = await a.from('book').delete().eq('id', BOOK_DEL_EDITOR).select()
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    // ORÁCULO: book E review continuam lá.
    expect(psqlScalar(`select count(*) from public.book where id = '${BOOK_DEL_EDITOR}';`)).toBe(
      '1'
    )
    expect(
      psqlScalar(`select count(*) from public.review where id = '${REVIEW_DEL_EDITOR}';`)
    ).toBe('1')
  })

  it('DELETE: anon NEGADO', async () => {
    const anon = anonClient()
    const { data, error } = await anon.from('book').delete().eq('id', BOOK_ANON).select()
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true)
    expect(psqlScalar(`select count(*) from public.book where id = '${BOOK_ANON}';`)).toBe('1')
  })

  // ── SELECT (não-regressão da 0003) ────────────────────────────────────────

  it('SELECT: anon PODE ler book — `book_public_read` (0003) intacta ao lado das novas', async () => {
    const anon = anonClient()
    const { data, error } = await anon.from('book').select('id,title').eq('id', BOOK_ANON).single()
    expect(error).toBeNull()
    expect(data?.id).toBe(BOOK_ANON)
  })

  // ── Caminho real de produção: pelo RPC, não por INSERT direto ─────────────

  it('RPC: create_review_with_book cria book que o AUTOR edita e outro editor NÃO', async () => {
    // NOTA DE TIPOS: a função aceita NULL em todos os parâmetros opcionais, mas o
    // gerador do Supabase emite os Args como NÃO-NULOS — o Postgres não expressa
    // nullability de parâmetro no catálogo, então não há o que inferir. Passamos
    // valores concretos: o conteúdo é irrelevante para o que esta suíte prova
    // (isolamento), e evita `as never` mascarando o contrato. Registrado para o T6.
    const created = await a.rpc('create_review_with_book', {
      p_book_title: 'RPC RLS livro do A',
      p_author: 'Autor A',
      p_genre_id: GENRE,
      p_publisher: 'Editora Teste',
      p_isbn: '',
      p_cover_url: '',
      p_year: 2020,
      p_publication_city: 'Sao Paulo',
      p_review_title: 'RPC RLS resenha do A',
      p_body: 'corpo',
      p_tags: [],
      p_keywords: [],
      p_highlight_quote: '',
      p_further_reading: [],
      p_status: 'draft',
      p_slug_base: 'rpc-rls-livro-do-a',
    })
    expect(created.error).toBeNull()
    const bookId = created.data?.book_id as string
    expect(bookId).toBeTruthy()
    rpcBookIds.push(bookId)

    // ORÁCULO: a review nasceu ligada ao book e pertencendo a A.
    expect(psqlScalar(`select editor_id from public.review where book_id = '${bookId}';`)).toBe(idA)

    // O AUTOR edita o book criado pelo RPC — a posse transitiva funciona pelo
    // caminho real, não só com fixtures montadas à mão.
    const own = await a
      .from('book')
      .update({ title: 'RPC RLS editado pelo autor' })
      .eq('id', bookId)
    expect(own.error).toBeNull()
    expect(psqlScalar(`select title from public.book where id = '${bookId}';`)).toBe(
      'RPC RLS editado pelo autor'
    )

    // OUTRO EDITOR (B) NÃO edita. Sessão real de B, não `set role`.
    const bClient = anonClient()
    const signB = await bClient.auth.signInWithPassword({ email: EMAIL_B, password: PW })
    expect(signB.error).toBeNull()
    const hack = await bClient.from('book').update({ title: TITULO_HACK }).eq('id', bookId).select()
    expect(hack.error).toBeNull()
    expect(hack.data ?? []).toHaveLength(0)
    // ORÁCULO: continua com o título que o AUTOR escreveu.
    expect(psqlScalar(`select title from public.book where id = '${bookId}';`)).toBe(
      'RPC RLS editado pelo autor'
    )
  }, 20_000)
})
