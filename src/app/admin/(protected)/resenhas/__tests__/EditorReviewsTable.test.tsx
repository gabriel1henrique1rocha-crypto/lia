import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { EditorReviewsTable, EmptyReviews } from '../EditorReviewsTable'
import type { EditorReviewListItem } from '@/lib/review/adminQueries'

/**
 * A lista do painel (T10) como ESTRUTURA. O contraste e as regras que dependem
 * de layout ficam no navegador (`tests/admin-reviews.spec.ts`) — o axe em jsdom
 * não calcula cor nem geometria.
 */

const LINHAS: EditorReviewListItem[] = [
  {
    id: 'r1',
    title: 'A biblioteca como labirinto',
    slug: 'a-biblioteca-como-labirinto',
    status: 'draft',
    published_at: null,
    updated_at: '2026-08-24T18:30:00Z',
    book: { title: 'O Nome da Rosa' },
  },
  {
    id: 'r2',
    title: 'Iracema, entre a lenda e a língua',
    slug: 'iracema-entre-a-lenda-e-a-lingua',
    status: 'published',
    published_at: '2026-08-20T12:00:00Z',
    updated_at: '2026-08-20T12:00:00Z',
    book: { title: 'Iracema' },
  },
]

describe('EditorReviewsTable — tabela de verdade, não div com cara de tabela', () => {
  it('é uma <table> com <caption> e cabeçalhos de COLUNA com scope', () => {
    render(<EditorReviewsTable reviews={LINHAS} />)

    const tabela = screen.getByRole('table')
    // O nome acessível da tabela vem do <caption> — é o que o leitor anuncia
    // ao entrar nela, junto com a contagem de linhas/colunas.
    expect(tabela).toHaveAccessibleName(/Suas resenhas/)

    const cabecalhos = within(tabela).getAllByRole('columnheader')
    expect(cabecalhos.map((c) => c.textContent)).toEqual([
      'Resenha',
      'Livro',
      'Situação',
      'Atualizada em',
    ])
    for (const cabecalho of cabecalhos) expect(cabecalho).toHaveAttribute('scope', 'col')
  })

  it('o título da resenha é o cabeçalho DA LINHA (scope="row")', () => {
    render(<EditorReviewsTable reviews={LINHAS} />)

    const deLinha = screen.getAllByRole('rowheader')
    expect(deLinha.map((c) => c.textContent)).toEqual([
      'A biblioteca como labirinto',
      'Iracema, entre a lenda e a língua',
    ])
    for (const cabecalho of deLinha) expect(cabecalho).toHaveAttribute('scope', 'row')
  })

  it('mostra título da resenha, título do livro, situação e atualizado em', () => {
    render(<EditorReviewsTable reviews={LINHAS} />)

    const linha = screen.getByRole('row', { name: /A biblioteca como labirinto/ })
    expect(within(linha).getByText('O Nome da Rosa')).toBeInTheDocument()
    expect(within(linha).getByText('Rascunho')).toBeInTheDocument()
    // Data legível para humano + `datetime` legível para máquina.
    const data = within(linha).getByText(/24\/08\/2026/)
    expect(data.tagName).toBe('TIME')
    expect(data).toHaveAttribute('datetime', '2026-08-24T18:30:00Z')
  })

  it('a data usa fuso FIXO — o mesmo texto independentemente de onde renderizou', () => {
    render(<EditorReviewsTable reviews={LINHAS} />)
    // 2026-08-24T18:30Z em America/Sao_Paulo (UTC-3) = 15:30 do dia 24.
    expect(screen.getByText('24/08/2026, 15:30')).toBeInTheDocument()
  })

  it('a SITUAÇÃO é comunicada por TEXTO — nunca só por cor', () => {
    render(<EditorReviewsTable reviews={LINHAS} />)
    // Se a cor sumisse, os dois estados continuariam distinguíveis.
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.getByText('Publicada')).toBeInTheDocument()
  })

  it('NÃO oferece link de editar — a rota não existe nesta sprint', () => {
    const { container } = render(<EditorReviewsTable reviews={LINHAS} />)
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs.some((href) => href?.includes('/editar'))).toBe(false)
  })

  it('o contêiner rolável é alcançável por teclado e tem nome', () => {
    const { container } = render(<EditorReviewsTable reviews={LINHAS} />)
    const regiao = container.querySelector('[role="region"]')
    // Sem `tabindex`, quem navega só por teclado não rola a tabela em tela
    // estreita — não há link nenhum dentro das linhas para servir de âncora.
    expect(regiao).toHaveAttribute('tabindex', '0')
    expect(regiao).toHaveAccessibleName(/Suas resenhas/)
  })

  it('axe: sem violação', async () => {
    const { container } = render(
      <main>
        <EditorReviewsTable reviews={LINHAS} />
      </main>
    )
    const { violations } = await axe.run(container)
    expect(violations).toEqual([])
  })
})

describe('estado vazio — convite, não tabela sem linhas', () => {
  it('não renderiza tabela nenhuma', () => {
    render(<EditorReviewsTable reviews={[]} />)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('convida a criar, com link para /admin/resenhas/nova', () => {
    render(<EditorReviewsTable reviews={[]} />)
    expect(screen.getByText(/ainda não tem resenhas/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Escrever a primeira resenha/ })).toHaveAttribute(
      'href',
      '/admin/resenhas/nova'
    )
  })

  it('axe: sem violação', async () => {
    const { container } = render(
      <main>
        <EmptyReviews />
      </main>
    )
    const { violations } = await axe.run(container)
    expect(violations).toEqual([])
  })
})
