import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import type { ReviewFormState } from '../../actions'

const listGenresMock = vi.fn()
vi.mock('@/lib/book/queries', () => ({ listGenres: () => listGenresMock() }))

// A action de verdade arrasta `next/cache` e o client do Supabase para o jsdom.
// O que interessa aqui é que a PÁGINA a entrega ao formulário — não o que ela faz.
const acaoInjetada = vi.fn(async (): Promise<ReviewFormState> => ({ status: 'idle', message: '' }))
vi.mock('../actions', () => ({
  createReviewAndGoToList: (...args: unknown[]) => acaoInjetada(...(args as [])),
}))

import NovaResenhaPage, { metadata } from '../page'

const GENEROS = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Romance' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Ensaio' },
]

async function renderizar() {
  return render(await NovaResenhaPage())
}

beforeEach(() => {
  listGenresMock.mockReset()
  listGenresMock.mockResolvedValue(GENEROS)
  cleanup()
})

describe('/admin/resenhas/nova', () => {
  it('tem UM <h1> descritivo', async () => {
    const { container } = await renderizar()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nova resenha')
  })

  it('renderiza o formulário do T8 — os dois fieldsets e os dois botões', async () => {
    await renderizar()

    expect(screen.getByRole('group', { name: 'Dados do livro' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'A resenha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
  })

  it('CARREGA os gêneros no select — sem eles, genre_id (NOT NULL) não teria valor', async () => {
    await renderizar()

    const select = screen.getByRole('combobox', { name: 'Gênero' })
    const opcoes = within(select).getAllByRole('option')

    // Placeholder + um por gênero, com o UUID como value (é o que o RPC recebe).
    expect(opcoes.map((o) => o.textContent)).toEqual(['Selecione…', 'Romance', 'Ensaio'])
    expect(opcoes[1]).toHaveValue(GENEROS[0].id)
    expect(opcoes[2]).toHaveValue(GENEROS[1].id)
  })

  it('sem gênero cadastrado, o select existe com o placeholder — não quebra a página', async () => {
    listGenresMock.mockResolvedValue([])
    await renderizar()

    const select = screen.getByRole('combobox', { name: 'Gênero' })
    expect(within(select).getAllByRole('option')).toHaveLength(1)
  })

  it('oferece a volta para a lista', async () => {
    await renderizar()
    expect(screen.getByRole('link', { name: /Voltar para a lista/ })).toHaveAttribute(
      'href',
      '/admin/resenhas'
    )
  })

  it('não é indexável', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('NÃO reimplementa gate nem validação — a página só entrega action e gêneros', async () => {
    const { container } = await renderizar()

    // Um único `form`, o do T8, e nenhum campo de status escondido: a escolha
    // entre rascunho e publicação continua viajando nos dois submits.
    expect(container.querySelectorAll('form')).toHaveLength(1)
    expect(container.querySelector('input[type="hidden"]')).toBeNull()
    expect(container.querySelectorAll('[name="status"]')).toHaveLength(2)
  })
})
