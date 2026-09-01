import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReviewFormState } from '../../../actions'
import type { ReviewForEdit } from '@/lib/review/adminQueries'

/**
 * `/admin/resenhas/[id]/editar` (T5). MESMO padrão de
 * `nova/__tests__/page.test.tsx`: o alvo é o WIRING — o que a página faz com o
 * que `getReviewForEdit` (T3, já testada à parte) devolve —, não a validação
 * do formulário (T2a/T2b/T6/T8, já testada à parte) nem a leitura em si.
 */

const listGenresMock = vi.fn()
vi.mock('@/lib/book/queries', () => ({ listGenres: () => listGenresMock() }))

const getReviewForEditMock = vi.fn()
vi.mock('@/lib/review/adminQueries', () => ({
  getReviewForEdit: (id: string) => getReviewForEditMock(id),
}))

const acaoInjetada = vi.fn(async (): Promise<ReviewFormState> => ({ status: 'idle', message: '' }))
vi.mock('../actions', () => ({
  updateReviewAndGoToList: (...args: unknown[]) => acaoInjetada(...(args as [])),
}))

import EditarResenhaPage, { generateMetadata } from '../page'

const GENEROS = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Romance' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Ensaio' },
]

/** Rascunho nunca publicado — o caso em que o slug é EDITÁVEL (P-2). */
const REVIEW_RASCUNHO: ReviewForEdit = {
  id: 'rev-1',
  book_id: 'book-1',
  title: 'Resenha em edição',
  slug: 'resenha-em-edicao',
  status: 'draft',
  editor_id: 'ed-1',
  reviewer_name: 'Ana Ribeiro',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-26T19:06:39.251574+00:00', // microssegundos — string opaca, ver o teste dedicado
  published_at: null,
  body: 'Corpo real.',
  highlight_quote: null,
  tags: ['ficção', 'clássico'],
  keywords: ['machado'],
  further_reading: [],
  book: {
    id: 'book-1',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    genre_id: GENEROS[0].id,
    publisher: null,
    isbn: null,
    cover_url: null,
    year: null,
    pages: null,
    original_language: null,
    translator: null,
    translated_from: null,
    publication_city: null,
    created_at: '2020-01-01T00:00:00Z',
    genre: { name: 'Romance', slug: 'romance' },
  },
}

async function renderizar(id = 'rev-1') {
  return render(await EditarResenhaPage({ params: Promise.resolve({ id }) }))
}

beforeEach(() => {
  listGenresMock.mockReset()
  listGenresMock.mockResolvedValue(GENEROS)
  getReviewForEditMock.mockReset()
  getReviewForEditMock.mockResolvedValue(REVIEW_RASCUNHO)
  cleanup()
})

describe('/admin/resenhas/[id]/editar', () => {
  it('tem UM <h1> descritivo', async () => {
    const { container } = await renderizar()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Editar resenha')
  })

  it('pré-preenche a ficha do livro e da resenha a partir de getReviewForEdit', async () => {
    await renderizar()
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Dom Casmurro')
    expect(screen.getByRole('textbox', { name: 'Autor' })).toHaveValue('Machado de Assis')
    expect(screen.getByRole('textbox', { name: /^Título da resenha/ })).toHaveValue(
      'Resenha em edição'
    )
    expect(screen.getByRole('textbox', { name: 'Corpo da resenha' })).toHaveValue('Corpo real.')
  })

  it('CARREGA os gêneros no select, com o gênero ATUAL do livro pré-selecionado', async () => {
    await renderizar()
    const select = screen.getByRole('combobox', { name: 'Gênero' })
    expect(select).toHaveValue(GENEROS[0].id)
  })

  it('mostra quem assina a partir de reviewer_name — sem consulta extra (diferente de nova/page.tsx)', async () => {
    await renderizar()
    expect(screen.getByText('Ana Ribeiro')).toBeInTheDocument()
  })

  it('rascunho NUNCA publicado: slug EDITÁVEL, pré-preenchido com o endereço atual', async () => {
    await renderizar()
    expect(screen.getByRole('textbox', { name: /^Endereço da resenha/ })).toHaveValue(
      'resenha-em-edicao'
    )
  })

  it('published_at PREENCHIDO: slug ESTÁTICO — mesmo com status atual = draft (despublicada)', async () => {
    // O caso que prova `isPublished = published_at !== null`, não
    // `status === 'published'`: uma resenha despublicada tem status='draft' e
    // AINDA ASSIM não pode reabrir o slug (0012 trava por `v_published_at`).
    getReviewForEditMock.mockResolvedValue({
      ...REVIEW_RASCUNHO,
      status: 'draft',
      published_at: '2020-01-01T00:00:00Z',
    })
    await renderizar()

    expect(screen.queryByRole('textbox', { name: /^Endereço da resenha/ })).toBeNull()
    expect(screen.getByText(/resenha-em-edicao/)).toBeInTheDocument()
  })

  it('tags e keywords atuais viajam como campo oculto — não editáveis nesta tela (D-12)', async () => {
    const { container } = await renderizar()
    expect(container.querySelector('input[name="tagsInput"]')).toHaveValue('ficção, clássico')
    expect(container.querySelector('input[name="keywordsInput"]')).toHaveValue('machado')
  })

  it('reviewId e expectedUpdatedAt viajam ocultos, com o valor EXATO do banco (P-1)', async () => {
    const { container } = await renderizar()
    expect(container.querySelector('input[name="reviewId"]')).toHaveValue('rev-1')
    // Comparação de STRING: um `new Date(...)` no meio do caminho arredondaria
    // os microssegundos e este teste pegaria.
    expect(container.querySelector('input[name="expectedUpdatedAt"]')).toHaveValue(
      '2026-08-26T19:06:39.251574+00:00'
    )
  })

  it('oferece a volta para a lista', async () => {
    await renderizar()
    expect(screen.getByRole('link', { name: /Voltar para a lista/ })).toHaveAttribute(
      'href',
      '/admin/resenhas'
    )
  })

  it('lê a resenha pelo id do segmento de rota', async () => {
    await renderizar('outro-id')
    expect(getReviewForEditMock).toHaveBeenCalledWith('outro-id')
  })

  it('notFound() de getReviewForEdit NÃO é engolido — propaga para o boundary do Next', async () => {
    getReviewForEditMock.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(
      EditarResenhaPage({ params: Promise.resolve({ id: 'inexistente' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('não é indexável, e o título usa o título DA RESENHA (não do livro)', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'rev-1' }) })
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.title).toContain('Resenha em edição')
  })
})
