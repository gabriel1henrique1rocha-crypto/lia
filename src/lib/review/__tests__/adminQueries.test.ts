import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { listEditorReviews } from '../adminQueries'

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
