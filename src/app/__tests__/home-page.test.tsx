import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { DisabilityRow, FilterOptions, ReviewListItem } from '@/lib/review/queries'
import { resenha } from '@/components/home/__tests__/fixtures'

/**
 * home-redesign — a página `/` nos dois modos (HOME-30) e nos estados de §5.
 * As leituras são mockadas: o que se fixa aqui é qual consulta roda em cada
 * modo e o que a página monta com o resultado.
 */

const featured = vi.fn<() => Promise<ReviewListItem[]>>()
const rows = vi.fn<() => Promise<DisabilityRow[]>>()
const options = vi.fn<() => Promise<FilterOptions>>()
const listing = vi.fn<() => Promise<{ rows: ReviewListItem[]; total: number }>>()

vi.mock('@/lib/review/queries', () => ({
  listFeaturedReviews: () => featured(),
  listDisabilityRows: () => rows(),
  listFilterOptions: () => options(),
  listPublishedReviews: () => listing(),
}))

import HomePage, { generateMetadata } from '../page'

const OPCOES: FilterOptions = {
  genres: [{ name: 'Romance', slug: 'romance' }],
  authors: ['Autora 1'],
  disabilities: [{ name: 'Deficiência visual', slug: 'deficiencia-visual' }],
}

beforeEach(() => {
  cleanup()
  featured.mockReset().mockResolvedValue([resenha(1), resenha(2)])
  rows.mockReset().mockResolvedValue([
    { term: { name: 'Deficiência visual', slug: 'deficiencia-visual' }, reviews: [resenha(1)] },
    { term: null, reviews: [resenha(2, { disabilities: [] })] },
  ])
  options.mockReset().mockResolvedValue(OPCOES)
  listing.mockReset().mockResolvedValue({ rows: [resenha(1)], total: 1 })
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})

async function renderizar(sp: Record<string, string> = {}) {
  return render(await HomePage({ searchParams: Promise.resolve(sp) }))
}

describe('modo navegação (sem params)', () => {
  it('um único h1; faixa "Em destaque"; seção "Resenhas" com fileiras', async () => {
    await renderizar()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Em destaque' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Resenhas' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Deficiência visual' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Outras resenhas' })).toBeInTheDocument()
    expect(listing).not.toHaveBeenCalled()
  })

  it('busca presente com landmark search', async () => {
    await renderizar()
    expect(screen.getByRole('search', { name: 'Buscar resenhas' })).toBeInTheDocument()
  })

  it('acervo vazio (0 publicadas): estado de acervo vazio, sem faixa nem fileiras', async () => {
    featured.mockResolvedValue([])
    rows.mockResolvedValue([])
    await renderizar()
    expect(screen.queryByRole('heading', { name: 'Em destaque' })).toBeNull()
    expect(screen.getByText(/ainda não há resenhas/i)).toBeInTheDocument()
  })
})

describe('modo busca (com params)', () => {
  it('grade "Resultados" + contagem; sem faixa (C-5); sem fileiras', async () => {
    await renderizar({ q: 'livro' })
    expect(screen.getByRole('heading', { level: 3, name: 'Resultados' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Resenhas · 1')
    expect(screen.queryByRole('heading', { name: 'Em destaque' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Outras resenhas' })).toBeNull()
    expect(featured).not.toHaveBeenCalled()
    expect(rows).not.toHaveBeenCalled()
  })

  it('sem resultados: estado "nenhuma resenha encontrada" (≠ acervo vazio)', async () => {
    listing.mockResolvedValue({ rows: [], total: 0 })
    await renderizar({ q: 'zzz' })
    expect(screen.getByText(/nenhuma resenha encontrada/i)).toBeInTheDocument()
  })

  it('metadata: canonical / e noindex com param (inalterado)', async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ q: 'x' }) })
    expect(meta.alternates?.canonical).toBe('/')
    expect(meta.robots).toMatchObject({ index: false, follow: true })
  })
})

describe('banco indisponível (HOME-34)', () => {
  it('rota renderiza com h1 e mensagem; sem 500', async () => {
    featured.mockRejectedValue(new Error('down'))
    await renderizar()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent(/Não foi possível carregar/)
  })
})
