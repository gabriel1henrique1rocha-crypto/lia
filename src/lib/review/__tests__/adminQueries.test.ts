import { describe, it, expect, vi, beforeEach } from 'vitest'

// `getReviewForEdit` chama `notFound()` (Next lança de verdade em produção;
// aqui simulamos o lançamento para poder afirmar "foi chamado" sem derrubar o
// runner de teste). Mesmo padrão de `resenha/[slug]/__tests__/page.test.tsx`.
const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({ notFound: () => notFoundMock() }))

// Mesmo padrão de `actions.test.ts` (T6): client e gate mockados — o efeito da
// RLS é responsabilidade do banco (merge-forward para a matriz de `review`,
// 0008/rbac-matrix.integration.test.ts). Aqui o alvo é o CONTRATO: quais
// campos a query pede, e quando o `.eq('editor_id', …)` — que compensa o
// confounder de `review_public_read` documentado em `adminQueries.ts` — é
// aplicado.
const getAuthenticatedEditorMock = vi.fn()
vi.mock('@/lib/auth/requireEditor', () => ({
  getAuthenticatedEditor: () => getAuthenticatedEditorMock(),
}))

const from = vi.fn()
vi.mock('@/lib/supabase/authenticated', () => ({
  createAuthenticatedClient: vi.fn(async () => ({ from })),
}))

import { listEditorReviews, getReviewForEdit } from '../adminQueries'

const REVIEW_DRAFT = {
  id: 'r1',
  title: 'Rascunho recente',
  slug: 'rascunho-recente',
  status: 'draft',
  published_at: null,
  book: { title: 'Livro A' },
}

const REVIEW_PUBLISHED = {
  id: 'r2',
  title: 'Já publicada',
  slug: 'ja-publicada',
  status: 'published',
  published_at: '2026-08-20T00:00:00Z',
  book: { title: 'Livro B' },
}

/**
 * Encadeamento de `.from('review').select(campos).order(...)[.eq(...)]`.
 * O objeto terminal é uma Promise de verdade (com `.eq` anexado) — `await`
 * funciona nela diretamente, como no client real.
 */
type Resultado = { data: unknown; error: unknown }
type QueryPromise = Promise<Resultado> & { eq: (...args: unknown[]) => QueryPromise }

function mockQueryChain(
  resultado: Resultado,
  opts: { capturarEq?: unknown[][]; capturarSelect?: string[] } = {}
) {
  function finalPromise(): QueryPromise {
    const p = Promise.resolve(resultado) as QueryPromise
    p.eq = (...args: unknown[]) => {
      opts.capturarEq?.push(args)
      return finalPromise()
    }
    return p
  }
  return {
    select: (campos: string) => {
      opts.capturarSelect?.push(campos)
      return { order: () => finalPromise() }
    },
  }
}

beforeEach(() => {
  getAuthenticatedEditorMock.mockReset()
  from.mockReset()
  notFoundMock.mockClear()
})

describe('listEditorReviews', () => {
  it('editor comum: filtra por editor_id — compensa o confounder de review_public_read', async () => {
    // Sem o filtro, a RLS sozinha uniria as PRÓPRIAS resenhas a QUALQUER
    // publicada de outro editor (0005 concede SELECT de published a
    // `authenticated` também, não só `anon`). É o motivo do `.eq` existir.
    getAuthenticatedEditorMock.mockResolvedValue({ id: 'ed-1', role: 'editor' })
    const chamadasEq: unknown[][] = []
    from.mockReturnValue(
      mockQueryChain(
        { data: [REVIEW_DRAFT, REVIEW_PUBLISHED], error: null },
        { capturarEq: chamadasEq }
      )
    )

    const rows = await listEditorReviews()

    expect(chamadasEq).toEqual([['editor_id', 'ed-1']])
    // Rascunho e publicada, as duas, aparecem — o filtro é por DONO, não por status.
    expect(rows).toEqual([REVIEW_DRAFT, REVIEW_PUBLISHED])
  })

  it('admin: SEM filtro de editor_id — a RLS (is_admin()) já mostra todas', async () => {
    getAuthenticatedEditorMock.mockResolvedValue({ id: 'ed-admin', role: 'admin' })
    const chamadasEq: unknown[][] = []
    from.mockReturnValue(
      mockQueryChain({ data: [REVIEW_DRAFT], error: null }, { capturarEq: chamadasEq })
    )

    await listEditorReviews()

    expect(chamadasEq).toHaveLength(0)
  })

  it('lista vazia devolve array vazio, não erro', async () => {
    getAuthenticatedEditorMock.mockResolvedValue({ id: 'ed-1', role: 'editor' })
    from.mockReturnValue(mockQueryChain({ data: [], error: null }))

    const rows = await listEditorReviews()

    expect(rows).toEqual([])
  })

  it('data null (o client pode devolver isso mesmo sem erro) → array vazio', async () => {
    getAuthenticatedEditorMock.mockResolvedValue({ id: 'ed-1', role: 'editor' })
    from.mockReturnValue(mockQueryChain({ data: null, error: null }))

    const rows = await listEditorReviews()

    expect(rows).toEqual([])
  })

  it('erro do banco propaga — não é engolido em silêncio', async () => {
    getAuthenticatedEditorMock.mockResolvedValue({ id: 'ed-1', role: 'editor' })
    from.mockReturnValue(mockQueryChain({ data: null, error: { code: '42501', message: 'x' } }))

    await expect(listEditorReviews()).rejects.toBeTruthy()
  })

  it('`updated_at` VEM no payload — é a coluna que explica a ordem da lista', async () => {
    // A query já ordenava por `updated_at` sem trazê-lo, então a tela ordenava
    // por um critério invisível (T10). Ordenar por algo que não se mostra faz a
    // lista parecer embaralhada.
    getAuthenticatedEditorMock.mockResolvedValue({ id: 'ed-1', role: 'editor' })
    const camposSelecionados: string[] = []
    from.mockReturnValue(
      mockQueryChain({ data: [], error: null }, { capturarSelect: camposSelecionados })
    )

    await listEditorReviews()

    expect(camposSelecionados[0]).toMatch(/\bupdated_at\b/)
  })

  it('o corpo da resenha (body) NÃO vem no payload da lista', async () => {
    getAuthenticatedEditorMock.mockResolvedValue({ id: 'ed-1', role: 'editor' })
    const camposSelecionados: string[] = []
    from.mockReturnValue(
      mockQueryChain({ data: [], error: null }, { capturarSelect: camposSelecionados })
    )

    await listEditorReviews()

    expect(camposSelecionados).toHaveLength(1)
    expect(camposSelecionados[0]).not.toMatch(/\bbody\b/)
  })
})

/**
 * `getReviewForEdit` (T3). Diferente de `listEditorReviews`: não chama
 * `getAuthenticatedEditor()` (não há ramo por papel — a RLS decide sozinha, de
 * propósito, ver o cabeçalho do arquivo-fonte), e a cadeia é
 * `.select(campos).eq('id', id).maybeSingle()`, não `.select().order()`.
 *
 * IDs distintos por teste, de propósito: a função é `cache()` do React, que
 * memoiza por argumento. Reusar o mesmo id entre dois testes com mocks
 * diferentes faria o segundo ler o resultado memoizado do primeiro — um falso
 * verde (ou falso vermelho) que nada tem a ver com a lógica sob teste.
 */
type ResultadoSingle = { data: unknown; error: unknown }

function mockGetChain(
  resultado: ResultadoSingle,
  opts: { capturarEq?: unknown[][]; capturarSelect?: string[] } = {}
) {
  return {
    select: (campos: string) => {
      opts.capturarSelect?.push(campos)
      return {
        eq: (...args: unknown[]) => {
          opts.capturarEq?.push(args)
          return { maybeSingle: () => Promise.resolve(resultado) }
        },
      }
    },
  }
}

const REVIEW_ROW = {
  id: 'rev-edit-1',
  book_id: 'book-1',
  title: 'Resenha em edição',
  slug: 'resenha-em-edicao',
  status: 'draft',
  editor_id: 'ed-1',
  updated_at: '2026-08-26T19:06:39.251574+00:00', // microssegundos — ver nota abaixo
  published_at: null,
  book: { id: 'book-1', title: 'Livro X', genre: { name: 'Romance', slug: 'romance' } },
}

describe('getReviewForEdit', () => {
  it('devolve a linha quando a RLS permite — book junto por join 1:1', async () => {
    const camposSelecionados: string[] = []
    from.mockReturnValue(
      mockGetChain({ data: REVIEW_ROW, error: null }, { capturarSelect: camposSelecionados })
    )

    const resultado = await getReviewForEdit('rev-edit-1')

    expect(resultado).toEqual(REVIEW_ROW)
    expect(camposSelecionados[0]).toMatch(/\bbook\(/)
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('`updated_at` chega EXATO — sem tocar em Date, microssegundos intactos', async () => {
    from.mockReturnValue(mockGetChain({ data: REVIEW_ROW, error: null }))

    const resultado = await getReviewForEdit('rev-edit-2')

    // Comparação de STRING, não de Date — um new Date(...) no meio do caminho
    // arredondaria ".251574" para ".251" (milissegundos) e este teste pegaria.
    expect(resultado.updated_at).toBe('2026-08-26T19:06:39.251574+00:00')
    expect(typeof resultado.updated_at).toBe('string')
  })

  it('RLS esconde a linha (data null, sem erro) → notFound(), não devolve undefined em silêncio', async () => {
    from.mockReturnValue(mockGetChain({ data: null, error: null }))

    await expect(getReviewForEdit('rev-edit-3')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('id malformado (22P02, não-UUID) → notFound(), NUNCA erro cru de 500', async () => {
    from.mockReturnValue(
      mockGetChain({
        data: null,
        error: { code: '22P02', message: 'invalid input syntax for type uuid: "x"' },
      })
    )

    await expect(getReviewForEdit('nao-e-um-uuid')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('outro erro do banco propaga CRU — não vira notFound() por engano', async () => {
    from.mockReturnValue(
      mockGetChain({ data: null, error: { code: '42501', message: 'permission denied' } })
    )

    await expect(getReviewForEdit('rev-edit-4')).rejects.toMatchObject({ code: '42501' })
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('NÃO filtra por editor_id — só por id (a posse é decidida na escrita, não aqui)', async () => {
    const chamadasEq: unknown[][] = []
    from.mockReturnValue(
      mockGetChain({ data: REVIEW_ROW, error: null }, { capturarEq: chamadasEq })
    )

    await getReviewForEdit('rev-edit-5')

    expect(chamadasEq).toEqual([['id', 'rev-edit-5']])
  })

  it('aceita um client injetado — não usa o client do módulo quando um é passado', async () => {
    const fromInjetado = vi.fn().mockReturnValue(mockGetChain({ data: REVIEW_ROW, error: null }))
    from.mockReturnValue(mockGetChain({ data: null, error: null })) // o do módulo: se for usado, cai em notFound()

    const resultado = await getReviewForEdit('rev-edit-6', { from: fromInjetado } as never)

    expect(resultado).toEqual(REVIEW_ROW)
    expect(fromInjetado).toHaveBeenCalledWith('review')
    expect(from).not.toHaveBeenCalled()
  })
})
