// LOCAL-ONLY — ver TD-02 em STATE.md. CI PULA (describe.skipIf).
//
// T4 — ATOMICIDADE DE `create_review_with_book` / `update_review_with_book`
// (REV-04, A-9). Task PRÓPRIA de propósito: é a prova central da feature, não um
// item embutido em outra suíte.
//
// O QUE ESTÁ EM JOGO: o RPC insere em DUAS tabelas. Se a `review` falhar depois
// de o `book` já ter entrado, e a transação não for única, sobra um LIVRO ÓRFÃO
// no catálogo — visível publicamente (`book_public_read`), sem resenha, e
// IMUTÁVEL para o próprio autor (achado do T3: `owns_book_via_review` não acha
// dono de book sem review). A alternativa rejeitada no design era compensar com
// DELETE no server action; a compensação também pode falhar, deixando exatamente
// o órfão que se queria evitar. A transação do RPC é a única garantia dura.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  DEPENDÊNCIA FRÁGIL — LEIA ANTES DE MEXER NO SCHEMA DE `further_reading`.
//
// O injetor de falha desta suíte é o CHECK `review_further_reading_is_array`
// (0009): passar um `p_further_reading` que não seja array faz o INSERT de
// `review` falhar DEPOIS do INSERT de `book`, que é exatamente a janela em que o
// órfão apareceria. Hoje ele é a ÚNICA coisa que produz essa falha na ordem
// certa dentro do RPC.
//
// SE ESSE CHECK FOR REMOVIDO, ESTA SUÍTE PASSA SEM PROVAR NADA: nada falha, o
// rollback nunca é exercitado, e o verde vira decorativo. Não é hipótese — já
// aconteceu uma vez: o injetor anterior era `p_rating` fora de 0–5 contra o
// CHECK `review_rating_integer`, e D-11 matou os dois. Este aviso existe para
// que a próxima pessoa veja o problema ONDE está mexendo, não só no tasks.md.
//
// Quem mexer no CHECK troca o injetor NO MESMO COMMIT. Candidatos remanescentes:
// FK de `book.genre_id`, UNIQUE de `review.book_id`, UNIQUE de `review.slug`.
// (O UNIQUE de `review.book_id` NÃO serve para o create: o RPC sempre insere um
// book inédito, então nunca colide — verificado no T2.)
// ─────────────────────────────────────────────────────────────────────────────
//
// ORÁCULO: todo estado é lido por `psql -U postgres` (superuser). Ler pelo papel
// sob teste confundiria "a linha não existe" com "a RLS escondeu" e faria um
// teste de rollback passar por falso-verde.
//
// CONCORRÊNCIA ENTRE SUÍTES: TODA asserção é ESCOPADA POR MARCA (um prefixo
// único no título). O Vitest roda arquivos de teste em PARALELO, e as outras
// suítes integration criam/apagam books e reviews ao mesmo tempo — uma asserção
// sobre `count(*) from book` reprova por ruído, não por regressão. Isso não é
// hipótese: a primeira versão desta suíte usava contagens globais e reprovava com
// `expected 18 to be 5` ao rodar junto com a matriz de `book` (T3), passando
// sozinha. O invariante que importa é local de qualquer forma — nada que ESTA
// chamada criou pode sobreviver a uma falha.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const RUN = process.env.RUN_RLS_INTEGRATION === '1'
const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321'
const LOCAL_ANON = process.env.SUPABASE_LOCAL_ANON_KEY
const LOCAL_SECRET = process.env.SUPABASE_LOCAL_SECRET_KEY
const DB_CONTAINER = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? 'supabase_db_lia'

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

const PW = 'Atomicity-Test-Pw-123!'
const EMAIL_A = 'atomicity-a@lia.test'
const GENRE = '11111111-1111-4111-8111-111111111111' // romance (seed)

/** Marca única desta corrida — torna as asserções imunes a suítes paralelas. */
const MARCA = 'T4ATOM'
const TITULO_FALHA = `${MARCA} livro que NAO deve sobreviver`
const TITULO_OK = `${MARCA} livro valido`
const TITULO_UPDATE = `${MARCA} livro do update`

/** `further_reading` que viola o CHECK: objeto, não array. */
const FURTHER_READING_INVALIDO = { nao: 'e-um-array' }

type CreateArgs = Database['public']['Functions']['create_review_with_book']['Args']

/** Args do create com defaults válidos; o teste sobrescreve só o que interessa. */
function createArgs(over: Partial<CreateArgs>): CreateArgs {
  return {
    p_book_title: TITULO_OK,
    p_author: 'Autor T4',
    p_genre_id: GENRE,
    p_publisher: 'Editora T4',
    p_isbn: '',
    p_cover_url: '',
    p_year: 2020,
    p_publication_city: 'Sao Paulo',
    p_review_title: `${MARCA} resenha`,
    p_body: 'corpo original',
    p_tags: [],
    p_keywords: [],
    p_highlight_quote: '',
    p_further_reading: [],
    p_status: 'draft',
    p_slug_base: `${MARCA.toLowerCase()}-slug`,
    ...over,
  }
}

describe.skipIf(!RUN)('Atomicidade dos RPCs de escrita (REV-04, A-9)', () => {
  let service: SupabaseClient<Database>
  let a: SupabaseClient<Database>
  let idA = ''

  function anonClient() {
    return createClient<Database>(LOCAL_URL, LOCAL_ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async function deleteUserByEmail(email: string) {
    const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = data.users.find((u) => u.email === email)
    if (found) await service.auth.admin.deleteUser(found.id)
  }

  async function cleanup() {
    // review sai por cascata da FK ao apagar o book; o delete explícito cobre
    // review cujo book já tenha sumido.
    psql(
      `delete from public.review where title like '${MARCA}%';
       delete from public.book where title like '${MARCA}%';`
    )
    await deleteUserByEmail(EMAIL_A)
  }

  /**
   * Contagens ESCOPADAS PELA MARCA desta corrida. Contagem GLOBAL não serve como
   * asserção: as suítes integration rodam em paralelo no Vitest, então
   * `count(*) from book` oscila com o que a matriz de `book` (T3) está criando
   * ao lado, e o delta global vira ruído — verificado na prática, com a suíte
   * reprovando por `expected 18 to be 5` só por rodar junto. O que precisa ser
   * provado é local de qualquer forma: NADA que ESTA chamada criou sobreviveu.
   */
  function contagens() {
    return {
      books: Number(psqlScalar(`select count(*) from public.book where title like '${MARCA}%';`)),
      reviews: Number(
        psqlScalar(`select count(*) from public.review where title like '${MARCA}%';`)
      ),
      /** Órfão DESTA corrida — o invariante que o rollback precisa preservar. */
      orfaos: Number(
        psqlScalar(
          `select count(*) from public.book b
           where b.title like '${MARCA}%'
             and not exists (select 1 from public.review r where r.book_id = b.id);`
        )
      ),
    }
  }

  beforeAll(async () => {
    if (!LOCAL_ANON || !LOCAL_SECRET) {
      throw new Error('Defina SUPABASE_LOCAL_ANON_KEY e SUPABASE_LOCAL_SECRET_KEY no .env.local')
    }
    service = createClient<Database>(LOCAL_URL, LOCAL_SECRET, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await cleanup()

    const { data, error } = await service.auth.admin.createUser({
      email: EMAIL_A,
      password: PW,
      email_confirm: true,
    })
    if (error || !data.user) throw error ?? new Error('createUser falhou')
    idA = data.user.id
    a = anonClient()
    const sign = await a.auth.signInWithPassword({ email: EMAIL_A, password: PW })
    if (sign.error) throw sign.error

    psql(
      `insert into public.editor (id, email, name, role, active)
       values ('${idA}', '${EMAIL_A}', 'Atomicity A', 'editor', true);`
    )
  }, 30_000)

  afterAll(cleanup)

  // ── Caso 1: create FALHA → rollback total, zero órfão ──────────────────────

  it('create: falha no INSERT de review NÃO deixa book órfão (rollback total)', async () => {
    const antes = contagens()

    const { error } = await a.rpc(
      'create_review_with_book',
      createArgs({
        p_book_title: TITULO_FALHA,
        p_slug_base: `${MARCA.toLowerCase()}-falha`,
        // Viola review_further_reading_is_array — dispara no INSERT de `review`,
        // DEPOIS de o `book` já ter entrado. É a janela do órfão.
        p_further_reading: FURTHER_READING_INVALIDO,
      })
    )

    // A chamada precisa FALHAR. Se um dia isto passar a retornar null sem erro,
    // é sinal de que alguém engoliu a exceção dentro do RPC — e o órfão volta.
    expect(error).not.toBeNull()
    expect(error?.message ?? '').toMatch(/further_reading|check constraint/i)

    const depois = contagens()

    // LOAD-BEARING (escopado por marca, imune a suíte paralela):
    // nenhum book e nenhuma review com o título da tentativa.
    expect(psqlScalar(`select count(*) from public.book where title = '${TITULO_FALHA}';`)).toBe(
      '0'
    )
    expect(psqlScalar(`select count(*) from public.review where title like '${MARCA}%';`)).toBe('0')

    // Contagens da marca inalteradas, e — o invariante central — nenhum book
    // desta corrida ficou sem review vinculada.
    expect(depois.books).toBe(antes.books)
    expect(depois.reviews).toBe(antes.reviews)
    expect(depois.orfaos).toBe(antes.orfaos)
    expect(depois.orfaos).toBe(0)
    // Timeout explícito: cada leitura do oráculo é um `docker exec` (~centenas de
    // ms) e este caso faz várias; com as outras suítes integration rodando em
    // paralelo, os 5s de default do Vitest estouram por lentidão, não por falha.
  }, 20_000)

  // ── Caso 2: create OK → prova que o caso 1 não passa por inércia ──────────

  it('create: caso positivo — book E review persistem, ligados por book_id', async () => {
    // Sem este caso, o teste negativo acima passaria mesmo que o RPC nunca
    // inserisse nada (uma função quebrada que só levanta erro daria verde).
    const antes = contagens()

    const { data, error } = await a.rpc(
      'create_review_with_book',
      createArgs({ p_book_title: TITULO_OK, p_slug_base: `${MARCA.toLowerCase()}-ok` })
    )
    expect(error).toBeNull()

    const bookId = data?.book_id as string
    const reviewId = data?.id as string
    expect(bookId).toBeTruthy()

    // ORÁCULO: as DUAS linhas existem e estão ligadas.
    expect(psqlScalar(`select count(*) from public.book where id = '${bookId}';`)).toBe('1')
    expect(psqlScalar(`select book_id from public.review where id = '${reviewId}';`)).toBe(bookId)
    expect(psqlScalar(`select title from public.book where id = '${bookId}';`)).toBe(TITULO_OK)

    // `auth.uid()` DENTRO do RPC resolve o editor chamador — não nulo, não outro.
    // A função é INVOKER: se isto falhasse, ou a sessão não estaria propagando ou
    // a função teria virado DEFINER, e o dono da resenha deixaria de ser quem a
    // escreveu. Lido pelo oráculo, não pelo client sob teste.
    expect(psqlScalar(`select editor_id from public.review where id = '${reviewId}';`)).toBe(idA)
    expect(psqlScalar(`select reviewer_name from public.review where id = '${reviewId}';`)).toBe(
      'Atomicity A'
    )

    const depois = contagens()
    // Delta da marca: exatamente um book e uma review a mais, e o book nasceu
    // JÁ VINCULADO — zero órfão desta corrida em nenhum momento.
    expect(depois.books).toBe(antes.books + 1)
    expect(depois.reviews).toBe(antes.reviews + 1)
    expect(depois.orfaos).toBe(0)
  }, 20_000)

  // ── Caso 3: update FALHA → book E review intactos, campo a campo ──────────

  it('update: falha após o UPDATE de book NÃO deixa a ficha alterada (rollback total)', async () => {
    // Cria o alvo por caminho real.
    const criado = await a.rpc(
      'create_review_with_book',
      createArgs({
        p_book_title: TITULO_UPDATE,
        p_review_title: `${MARCA} resenha do update`,
        p_slug_base: `${MARCA.toLowerCase()}-update`,
      })
    )
    expect(criado.error).toBeNull()
    const reviewId = criado.data?.id as string
    const bookId = criado.data?.book_id as string

    // SNAPSHOT campo a campo pelo oráculo — contagem não bastaria aqui: o risco
    // do update não é linha a mais, é a ficha do livro ficar alterada enquanto a
    // resenha não mudou. O RPC atualiza `book` PRIMEIRO; sem transação única,
    // essa alteração persistiria.
    const snapBook = psqlScalar(
      `select title||'|'||author||'|'||coalesce(publisher,'')||'|'||coalesce(publication_city,'')||'|'||coalesce(year::text,'')
       from public.book where id = '${bookId}';`
    )
    const snapReview = psqlScalar(
      `select title||'|'||coalesce(body,'')||'|'||status::text||'|'||coalesce(published_at::text,'NULL')
       from public.review where id = '${reviewId}';`
    )

    const { error } = await a.rpc('update_review_with_book', {
      p_review_id: reviewId,
      p_book_title: `${MARCA} TITULO ALTERADO`,
      p_author: 'AUTOR ALTERADO',
      p_genre_id: GENRE,
      p_publisher: 'EDITORA ALTERADA',
      p_isbn: '',
      p_cover_url: '',
      p_year: 1999,
      p_publication_city: 'CIDADE ALTERADA',
      p_review_title: `${MARCA} RESENHA ALTERADA`,
      p_body: 'corpo alterado',
      p_tags: [],
      p_keywords: [],
      p_highlight_quote: '',
      // Mesmo injetor: falha no UPDATE de `review`, depois do de `book`.
      p_further_reading: FURTHER_READING_INVALIDO,
      p_status: 'published',
    })

    expect(error).not.toBeNull()
    expect(error?.message ?? '').toMatch(/further_reading|check constraint/i)

    // ORÁCULO, campo a campo: NADA mudou — nem no book, nem na review.
    expect(
      psqlScalar(
        `select title||'|'||author||'|'||coalesce(publisher,'')||'|'||coalesce(publication_city,'')||'|'||coalesce(year::text,'')
         from public.book where id = '${bookId}';`
      )
    ).toBe(snapBook)
    expect(
      psqlScalar(
        `select title||'|'||coalesce(body,'')||'|'||status::text||'|'||coalesce(published_at::text,'NULL')
         from public.review where id = '${reviewId}';`
      )
    ).toBe(snapReview)

    // E o status NÃO virou published — o carimbo de publicação não vazou.
    expect(psqlScalar(`select status from public.review where id = '${reviewId}';`)).toBe('draft')
    expect(
      psqlScalar(`select published_at is null from public.review where id = '${reviewId}';`)
    ).toBe('t')
  }, 20_000)

  // ── Caso 4: update OK → contraprova do caso 3 ─────────────────────────────

  it('update: caso positivo — book E review mudam juntos', async () => {
    const criado = await a.rpc(
      'create_review_with_book',
      createArgs({
        p_book_title: `${MARCA} alvo do update ok`,
        p_review_title: `${MARCA} resenha update ok`,
        p_slug_base: `${MARCA.toLowerCase()}-update-ok`,
      })
    )
    expect(criado.error).toBeNull()
    const reviewId = criado.data?.id as string
    const bookId = criado.data?.book_id as string

    const { error } = await a.rpc('update_review_with_book', {
      p_review_id: reviewId,
      p_book_title: `${MARCA} ficha atualizada`,
      p_author: 'Autor atualizado',
      p_genre_id: GENRE,
      p_publisher: 'Editora atualizada',
      p_isbn: '',
      p_cover_url: '',
      p_year: 2021,
      p_publication_city: 'Cidade atualizada',
      p_review_title: `${MARCA} resenha atualizada`,
      p_body: 'corpo atualizado',
      p_tags: [],
      p_keywords: [],
      p_highlight_quote: '',
      p_further_reading: [],
      p_status: 'published',
    })
    expect(error).toBeNull()

    // ORÁCULO: as duas tabelas refletem a mudança.
    expect(psqlScalar(`select title from public.book where id = '${bookId}';`)).toBe(
      `${MARCA} ficha atualizada`
    )
    expect(psqlScalar(`select title from public.review where id = '${reviewId}';`)).toBe(
      `${MARCA} resenha atualizada`
    )
    expect(psqlScalar(`select status from public.review where id = '${reviewId}';`)).toBe(
      'published'
    )
    // published_at carimbado na PRIMEIRA publicação (coalesce da 0011).
    expect(
      psqlScalar(`select published_at is not null from public.review where id = '${reviewId}';`)
    ).toBe('t')
  }, 20_000)
})
