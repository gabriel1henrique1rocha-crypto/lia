import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { BookDetails } from '../BookDetails'
import { formatIsbn } from '@/lib/book/isbn'
import type { BookView } from '@/lib/book/queries'

const VALID_ISBN13 = '9783161484100'

function makeBook(overrides: Partial<BookView> = {}): BookView {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    genre_id: '111e8400-e29b-41d4-a716-446655440000',
    publisher: null,
    isbn: null,
    cover_url: null,
    year: null,
    pages: null,
    original_language: null,
    translator: null,
    translated_from: null,
    created_at: '2024-01-01T00:00:00Z',
    genre: { name: 'Romance', slug: 'romance' },
    ...overrides,
  }
}

describe('BookDetails', () => {
  it('é um Server Component (sem diretiva use client)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/book/BookDetails.tsx'), 'utf8')
    // Procura a diretiva como statement isolado (não menções em comentários).
    expect(src).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m)
  })

  it('ficha mínima: renderiza só Autor + Gênero, sem dt para campos ausentes', () => {
    render(<BookDetails book={makeBook()} />)
    expect(screen.getByText('Autor')).toBeInTheDocument()
    expect(screen.getByText('Machado de Assis')).toBeInTheDocument()
    expect(screen.getByText('Gênero')).toBeInTheDocument()
    expect(screen.getByText('Romance')).toBeInTheDocument()
    // campos opcionais ausentes não geram rótulo órfão
    expect(screen.queryByText('Editora')).not.toBeInTheDocument()
    expect(screen.queryByText('Ano')).not.toBeInTheDocument()
    expect(screen.queryByText('Páginas')).not.toBeInTheDocument()
    expect(screen.queryByText('ISBN')).not.toBeInTheDocument()
  })

  it('omite Gênero quando não há gênero associado', () => {
    render(<BookDetails book={makeBook({ genre: null })} />)
    expect(screen.queryByText('Gênero')).not.toBeInTheDocument()
    expect(screen.getByText('Autor')).toBeInTheDocument()
  })

  it('ficha completa: todos os campos presentes renderizam', () => {
    render(
      <BookDetails
        book={makeBook({
          publisher: 'Editora Garnier',
          year: 1899,
          pages: 256,
          original_language: 'pt',
          isbn: VALID_ISBN13,
        })}
      />
    )
    expect(screen.getByText('Editora')).toBeInTheDocument()
    expect(screen.getByText('Editora Garnier')).toBeInTheDocument()
    expect(screen.getByText('Ano')).toBeInTheDocument()
    expect(screen.getByText('1899')).toBeInTheDocument()
    expect(screen.getByText('Páginas')).toBeInTheDocument()
    expect(screen.getByText('256')).toBeInTheDocument()
  })

  it('exibe o ISBN formatado por formatIsbn', () => {
    render(<BookDetails book={makeBook({ isbn: VALID_ISBN13 })} />)
    expect(screen.getByText('ISBN')).toBeInTheDocument()
    expect(screen.getByText(formatIsbn(VALID_ISBN13))).toBeInTheDocument()
  })

  it('exibe o idioma original com rótulo PT (languageLabel)', () => {
    render(<BookDetails book={makeBook({ original_language: 'pt' })} />)
    expect(screen.getByText('Idioma original')).toBeInTheDocument()
    expect(screen.getByText('Português')).toBeInTheDocument()
  })

  it('não renderiza o bloco Tradução quando não há tradutor', () => {
    render(<BookDetails book={makeBook()} />)
    expect(screen.queryByText('Tradução')).not.toBeInTheDocument()
  })

  it('renderiza o bloco Tradução quando há tradutor (heading + tradutor + idioma de origem)', () => {
    render(<BookDetails book={makeBook({ translator: 'Fulano de Tal', translated_from: 'fr' })} />)
    const heading = screen.getByRole('heading', { name: 'Tradução' })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText('Tradutor')).toBeInTheDocument()
    expect(screen.getByText('Fulano de Tal')).toBeInTheDocument()
    expect(screen.getByText('Idioma de origem')).toBeInTheDocument()
    expect(screen.getByText('Francês')).toBeInTheDocument()
  })

  it('headingLevel controla a tag do heading do bloco de tradução', () => {
    const { rerender } = render(
      <BookDetails book={makeBook({ translator: 'X', translated_from: 'en' })} />
    )
    // padrão = h3
    expect(screen.getByRole('heading', { level: 3, name: 'Tradução' })).toBeInTheDocument()

    rerender(
      <BookDetails book={makeBook({ translator: 'X', translated_from: 'en' })} headingLevel={2} />
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Tradução' })).toBeInTheDocument()
  })

  it('associa cada dt ao seu dd (pares na ordem correta)', () => {
    const { container } = render(<BookDetails book={makeBook({ year: 1899 })} />)
    const dl = container.querySelector('dl.lia-book-details') as HTMLElement
    const terms = within(dl)
      .getAllByRole('term')
      .map((el) => el.textContent)
    expect(terms).toEqual(['Autor', 'Gênero', 'Ano'])
  })

  it('axe não retorna violação crítica no jsdom', async () => {
    const { container } = render(
      <BookDetails
        book={makeBook({
          publisher: 'Editora Garnier',
          year: 1899,
          pages: 256,
          original_language: 'pt',
          isbn: VALID_ISBN13,
          translator: 'Fulano',
          translated_from: 'fr',
        })}
      />
    )
    const results = await axe.run(container)
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toEqual([])
  })
})
