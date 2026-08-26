import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import axe from 'axe-core'
import type { ReviewView } from '@/lib/review/queries'

// A leitura tem teste próprio (contrato + integração RLS). Aqui o alvo é a
// EXIBIÇÃO: o que a página faz com os campos novos quando eles existem — e,
// sobretudo, o que ela faz quando NÃO existem, que é o estado das 5 resenhas
// em produção.
const getPublishedReviewBySlugMock = vi.fn()
vi.mock('@/lib/review/queries', () => ({
  getPublishedReviewBySlug: (slug: string) => getPublishedReviewBySlugMock(slug),
}))

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({ notFound: () => notFoundMock() }))

import ReviewPage, { generateMetadata } from '../page'

/** Resenha COMO ESTÁ EM PRODUÇÃO: nenhum campo da 0009 preenchido. */
const SEM_CAMPOS_NOVOS = {
  id: 'rev-1',
  book_id: 'liv-1',
  title: 'A biblioteca como labirinto',
  slug: 'a-biblioteca-como-labirinto',
  body: 'Primeiro parágrafo da resenha.\n\nSegundo parágrafo.',
  status: 'published',
  published_at: '2026-08-20T12:00:00Z',
  created_at: '2026-08-20T12:00:00Z',
  updated_at: '2026-08-20T12:00:00Z',
  editor_id: 'ed-1',
  reviewer_name: null,
  highlight_quote: null,
  tags: [],
  keywords: [],
  further_reading: [],
  book: {
    id: 'liv-1',
    title: 'O Nome da Rosa',
    author: 'Eco, Umberto',
    genre_id: 'g1',
    publisher: null,
    isbn: null,
    cover_url: null,
    year: null,
    pages: null,
    original_language: null,
    translator: null,
    translated_from: null,
    publication_city: null,
    created_at: '2024-01-01T00:00:00Z',
    genre: { name: 'Romance', slug: 'romance' },
  },
} as unknown as ReviewView

/** A mesma resenha com TODOS os campos novos preenchidos. */
const COM_CAMPOS_NOVOS = {
  ...SEM_CAMPOS_NOVOS,
  reviewer_name: 'Ana Ribeiro',
  highlight_quote: 'A biblioteca é um labirinto que se lê com os pés.',
  tags: ['romance histórico', 'medievo'],
  keywords: ['umberto eco', 'semiótica'],
  book: { ...SEM_CAMPOS_NOVOS.book, publication_city: 'Rio de Janeiro', publisher: 'Record' },
} as unknown as ReviewView

async function renderizar(review: ReviewView) {
  getPublishedReviewBySlugMock.mockResolvedValue(review)
  return render(
    <main>
      {await ReviewPage({ params: Promise.resolve({ slug: 'a-biblioteca-como-labirinto' }) })}
    </main>
  )
}

beforeEach(() => {
  getPublishedReviewBySlugMock.mockReset()
  notFoundMock.mockClear()
  cleanup()
})

/* ── 1. Campos presentes ─────────────────────────────────────────────────── */

describe('campos novos PRESENTES', () => {
  it('a assinatura diz que é da RESENHA — não se confunde com o autor do livro', async () => {
    await renderizar(COM_CAMPOS_NOVOS)

    expect(screen.getByText(/Resenha por Ana Ribeiro/)).toBeInTheDocument()
    // A linha vizinha atribui a OBRA, com relação explícita ("de"), para os
    // dois nomes de pessoa na mesma vizinhança não se lerem como o mesmo papel.
    expect(screen.getByText(/de Eco, Umberto/)).toBeInTheDocument()
  })

  it('a frase de destaque vem em blockquote dentro de figure com legenda', async () => {
    const { container } = await renderizar(COM_CAMPOS_NOVOS)

    const figura = container.querySelector('figure')
    // O nome acessível derivado do `figcaption` é conferido no navegador
    // (`review-public.spec.ts`) — o shim do jsdom não o computa.
    expect(figura?.querySelector('figcaption')).toHaveTextContent('Trecho em destaque')
    expect(within(figura as HTMLElement).getByText(/labirinto que se lê/)).toBeInTheDocument()
    expect(figura?.querySelector('blockquote')).not.toBeNull()
  })

  it('o destaque abre a SEÇÃO da resenha, antes do corpo', async () => {
    const { container } = await renderizar(COM_CAMPOS_NOVOS)

    const secao = container.querySelector('section[aria-labelledby="resenha-texto"]')!
    // Dentro da seção (não solto entre o título e a ficha, onde seria lido
    // como passagem do livro) e antes do primeiro parágrafo.
    const figura = secao.querySelector('figure')!
    const primeiroParagrafo = secao.querySelector('p')!

    expect(
      figura.compareDocumentPosition(primeiroParagrafo) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('a cidade de publicação entra na ficha, na ordem ABNT (antes da editora)', async () => {
    const { container } = await renderizar(COM_CAMPOS_NOVOS)

    const rotulos = [...container.querySelectorAll('.lia-book-details dt')].map(
      (dt) => dt.textContent
    )
    expect(rotulos).toContain('Cidade de publicação')
    expect(rotulos.indexOf('Cidade de publicação')).toBeLessThan(rotulos.indexOf('Editora'))
    expect(screen.getByText('Rio de Janeiro')).toBeInTheDocument()
  })

  it('as tags aparecem como lista, sem link', async () => {
    const { container } = await renderizar(COM_CAMPOS_NOVOS)

    const secaoTags = container.querySelector('.lia-review-tags')
    expect(within(secaoTags as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
    expect(secaoTags?.querySelectorAll('a')).toHaveLength(0)
  })

  it('as PALAVRAS-CHAVE não aparecem na tela — são só metadado (REV-09)', async () => {
    await renderizar(COM_CAMPOS_NOVOS)

    // É esta a diferença entre tags e palavras-chave: não é rótulo, é
    // superfície. Se aparecessem juntas, o leitor teria duas listas de palavras
    // sem nada que explicasse por que são duas.
    expect(screen.queryByText('umberto eco')).toBeNull()
    expect(screen.queryByText('semiótica')).toBeNull()
    expect(screen.queryByText(/palavras-chave/i)).toBeNull()
  })

  it('a ordem dos headings continua h1 → h2 (sem nível pulado)', async () => {
    const { container } = await renderizar(COM_CAMPOS_NOVOS)

    const niveis = [...container.querySelectorAll('h1, h2, h3')].map((h) => Number(h.tagName[1]))
    expect(niveis[0]).toBe(1)
    for (let i = 1; i < niveis.length; i++) {
      expect(niveis[i] - niveis[i - 1]).toBeLessThanOrEqual(1)
    }
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  it('conteúdo de editor é escapado em TODOS os campos novos', async () => {
    const { container } = await renderizar({
      ...COM_CAMPOS_NOVOS,
      reviewer_name: '<script>alert(1)</script>',
      highlight_quote: '<img src=x onerror=alert(1)>',
      tags: ['<b>tag</b>'],
    } as unknown as ReviewView)

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument()
  })

  it('axe: sem violação COM os campos preenchidos', async () => {
    const { container } = await renderizar(COM_CAMPOS_NOVOS)
    const { violations } = await axe.run(container)
    expect(violations).toEqual([])
  })
})

/* ── 2. Campos ausentes — o caso de produção ─────────────────────────────── */

describe('campos novos AUSENTES — degradação sem sobra', () => {
  it('não sobra rótulo, moldura nem separador órfão', async () => {
    const { container } = await renderizar(SEM_CAMPOS_NOVOS)

    expect(container.querySelector('figure')).toBeNull()
    expect(screen.queryByText('Trecho em destaque')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Tags' })).toBeNull()
    expect(container.querySelector('.lia-review-tags')).toBeNull()
    expect(screen.queryByText(/Resenha por/)).toBeNull()
    expect(container.querySelector('.lia-review__byline')).toBeNull()
    expect(
      [...container.querySelectorAll('.lia-book-details dt')].map((dt) => dt.textContent)
    ).not.toContain('Cidade de publicação')
  })

  it('a página continua inteira: título, obra, ficha, corpo e comentários', async () => {
    const { container } = await renderizar(SEM_CAMPOS_NOVOS)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A biblioteca como labirinto'
    )
    // Pelo `<cite>` — o título também aparece na capa tipográfica (BookCover).
    expect(container.querySelector('cite')).toHaveTextContent('O Nome da Rosa')
    expect(screen.getByRole('heading', { name: 'Ficha técnica' })).toBeInTheDocument()
    expect(screen.getByText('Primeiro parágrafo da resenha.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comentários' })).toBeInTheDocument()
  })

  it('nenhuma lista vazia fica na árvore para o leitor de tela tropeçar', async () => {
    const { container } = await renderizar(SEM_CAMPOS_NOVOS)

    for (const lista of container.querySelectorAll('ul, ol')) {
      expect(lista.querySelectorAll('li').length).toBeGreaterThan(0)
    }
  })

  it('a ordem dos headings continua íntegra sem os campos', async () => {
    const { container } = await renderizar(SEM_CAMPOS_NOVOS)

    const niveis = [...container.querySelectorAll('h1, h2, h3')].map((h) => Number(h.tagName[1]))
    expect(niveis[0]).toBe(1)
    for (let i = 1; i < niveis.length; i++) {
      expect(niveis[i] - niveis[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  it('axe: sem violação SEM os campos preenchidos', async () => {
    const { container } = await renderizar(SEM_CAMPOS_NOVOS)
    const { violations } = await axe.run(container)
    expect(violations).toEqual([])
  })
})

/* ── 3. Metadados ────────────────────────────────────────────────────────── */

describe('generateMetadata — palavras-chave', () => {
  it('emite `keywords` quando há palavras-chave', async () => {
    getPublishedReviewBySlugMock.mockResolvedValue(COM_CAMPOS_NOVOS)
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'x' }) })

    expect(meta.keywords).toEqual(['umberto eco', 'semiótica'])
  })

  it('lista vazia → `undefined`, não um <meta keywords> vazio', async () => {
    getPublishedReviewBySlugMock.mockResolvedValue(SEM_CAMPOS_NOVOS)
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'x' }) })

    expect(meta.keywords).toBeUndefined()
  })

  it('entradas em branco são descartadas', async () => {
    getPublishedReviewBySlugMock.mockResolvedValue({
      ...COM_CAMPOS_NOVOS,
      keywords: ['  ', 'eco', ''],
    } as unknown as ReviewView)
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'x' }) })

    expect(meta.keywords).toEqual(['eco'])
  })

  it('404 não vaza nada — nem palavras-chave de resenha inexistente', async () => {
    getPublishedReviewBySlugMock.mockResolvedValue(null)
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'nao-existe' }) })

    expect(meta.title).toBe('Resenha não encontrada · LIA')
    expect(meta.keywords).toBeUndefined()
  })
})
