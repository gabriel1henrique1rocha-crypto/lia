import { describe, it, expect, vi } from 'vitest'

// O client real exige env; todo teste aqui injeta o cliente falso.
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => {
    throw new Error('use o cliente falso')
  },
}))
import {
  FEATURED_LIMIT,
  ROW_LIMIT,
  listDisabilityRows,
  listFeaturedReviews,
  listPublishedReviews,
} from '../queries'
import { parseListingParams } from '../listingParams'

/**
 * home-redesign — camada de query (HOME-10, HOME-25/28, C-6). Cliente falso que
 * grava a cadeia de chamadas do builder do supabase-js e devolve linhas fixas.
 * O comportamento real do PostgREST (embed com alias, `or`) é conferido em
 * integração; aqui fica a MONTAGEM da consulta e o agrupamento no servidor.
 */

type Chamada = [string, ...unknown[]]

function clienteFalso(respostas: Record<string, { data: unknown; count?: number }>) {
  const log: { tabela: string; chamadas: Chamada[] }[] = []
  const client = {
    from(tabela: string) {
      const entrada = { tabela, chamadas: [] as Chamada[] }
      log.push(entrada)
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'ilike', 'or', 'order', 'limit', 'range', 'in']) {
        builder[m] = (...args: unknown[]) => {
          entrada.chamadas.push([m, ...args])
          return builder
        }
      }
      builder.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve({ ...(respostas[tabela] ?? { data: [] }), error: null }).then(ok)
      return builder
    },
  }
  return { client: client as never, log }
}

const termo = (name: string, slug: string, sort_order: number) => ({
  term: { name, slug, sort_order },
})

function linha(i: number, termos: ReturnType<typeof termo>[] | { term: null }[]) {
  return {
    id: `id-${i}`,
    title: `R${i}`,
    slug: `r-${i}`,
    body: 'corpo',
    published_at: null,
    book: { title: `L${i}`, author: `A${i}`, year: null, cover_url: null, genre: null },
    disabilities: termos,
  }
}

describe('listFeaturedReviews', () => {
  it(`pede ${FEATURED_LIMIT} publicadas, status explícito (LST-20)`, async () => {
    const { client, log } = clienteFalso({ review: { data: [] } })
    await listFeaturedReviews(client)
    const c = log[0].chamadas
    expect(c).toContainEqual(['eq', 'status', 'published'])
    expect(c).toContainEqual(['limit', FEATURED_LIMIT])
  })
})

describe('listDisabilityRows (HOME-25/28)', () => {
  it('agrupa por termo em sort_order; resenha com 2 termos em 2 fileiras; sem termo → "Outras" no fim', async () => {
    const { client, log } = clienteFalso({
      review: {
        data: [
          linha(1, [termo('TEA', 'tea', 60), termo('Física', 'fisica', 10)]),
          linha(2, [termo('TEA', 'tea', 60)]),
          linha(3, []),
          linha(4, [{ term: null }]), // só termo desativado → conta como sem termo
        ],
      },
    })
    const rows = await listDisabilityRows(client)
    expect(log[0].chamadas).toContainEqual(['eq', 'status', 'published'])
    expect(rows.map((r) => r.term?.slug ?? null)).toEqual(['fisica', 'tea', null])
    expect(rows[1].reviews.map((r) => r.id)).toEqual(['id-1', 'id-2'])
    expect(rows[2].reviews.map((r) => r.id)).toEqual(['id-3', 'id-4'])
  })

  it(`limita cada fileira a ${ROW_LIMIT}`, async () => {
    const muitas = Array.from({ length: ROW_LIMIT + 5 }, (_, i) =>
      linha(i, [termo('TEA', 'tea', 60)])
    )
    const { client } = clienteFalso({ review: { data: muitas } })
    const rows = await listDisabilityRows(client)
    expect(rows[0].reviews).toHaveLength(ROW_LIMIT)
  })

  it('sem nenhuma resenha: nenhuma fileira (nem "Outras")', async () => {
    const { client } = clienteFalso({ review: { data: [] } })
    expect(await listDisabilityRows(client)).toEqual([])
  })
})

describe('busca por título OU autor (C-6)', () => {
  it('resolve os livros do autor e soma ao `or`, com o termo entre aspas', async () => {
    const { client, log } = clienteFalso({
      book: { data: [{ id: 'b1' }, { id: 'b2' }] },
      review: { data: [], count: 0 },
    })
    await listPublishedReviews(parseListingParams({ q: 'Saramago, J' }), client)
    const book = log.find((l) => l.tabela === 'book')!
    expect(book.chamadas).toContainEqual(['ilike', 'author', '%Saramago, J%'])
    const review = log.find((l) => l.tabela === 'review')!
    expect(review.chamadas).toContainEqual(['or', 'title.ilike."%Saramago, J%",book_id.in.(b1,b2)'])
  })

  it('nenhum autor casa: só o título', async () => {
    const { client, log } = clienteFalso({ book: { data: [] }, review: { data: [], count: 0 } })
    await listPublishedReviews(parseListingParams({ q: 'dom' }), client)
    const review = log.find((l) => l.tabela === 'review')!
    expect(review.chamadas).toContainEqual(['or', 'title.ilike."%dom%"'])
  })

  it('curinga e aspas do usuário ficam literais', async () => {
    const { client, log } = clienteFalso({ book: { data: [] }, review: { data: [], count: 0 } })
    await listPublishedReviews(parseListingParams({ q: '50%"x' }), client)
    const review = log.find((l) => l.tabela === 'review')!
    expect(review.chamadas).toContainEqual(['or', 'title.ilike."%50\\\\%\\"x%"'])
  })

  it('sem q: nenhuma consulta a `book`', async () => {
    const { client, log } = clienteFalso({ review: { data: [], count: 0 } })
    await listPublishedReviews(parseListingParams({ genero: 'romance' }), client)
    expect(log.some((l) => l.tabela === 'book')).toBe(false)
  })
})
