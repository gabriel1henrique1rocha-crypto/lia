import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { ReviewTags } from '../ReviewTags'

const TAGS = ['romance histórico', 'medievo', 'metaficção']

describe('ReviewTags — presente', () => {
  it('é uma LISTA semântica, não spans soltos', () => {
    render(<ReviewTags tags={TAGS} />)

    const lista = screen.getByRole('list')
    const itens = within(lista).getAllByRole('listitem')
    // "lista de 3 itens": quem não vê a tela sabe quantas tags existem e onde
    // elas terminam. Com spans, viraria um borrão colado ao texto vizinho.
    expect(itens.map((i) => i.textContent)).toEqual(TAGS)
  })

  it('a seção é nomeada pelo próprio heading', () => {
    const { container } = render(<ReviewTags tags={TAGS} />)
    const secao = container.querySelector('section')

    expect(secao).toHaveAccessibleName('Tags')
    expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument()
  })

  it('o heading é h2 — irmão dos demais da página, não quebra a ordem', () => {
    render(<ReviewTags tags={TAGS} />)
    expect(screen.getByRole('heading', { name: 'Tags' }).tagName).toBe('H2')
  })

  it('NÃO PROMETE NAVEGAÇÃO: sem link, sem botão, sem role interativo (D-12)', () => {
    const { container } = render(<ReviewTags tags={TAGS} />)

    // A filtragem por tag está adiada por completo e a taxonomia (D-12) virá
    // como entidade própria. Link que não leva a lugar nenhum é promessa
    // quebrada — e apareceria na lista de links do leitor de tela.
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('[role="button"], [role="link"]')).toBeNull()
    expect(container.querySelector('[href]')).toBeNull()
  })

  it('permite id de heading próprio, para não colidir quando houver mais de um', () => {
    const { container } = render(<ReviewTags tags={TAGS} headingId="tags-alternativo" />)

    expect(container.querySelector('h2')).toHaveAttribute('id', 'tags-alternativo')
    expect(container.querySelector('section')).toHaveAttribute(
      'aria-labelledby',
      'tags-alternativo'
    )
  })

  it('conteúdo de editor é TEXTO, não markup', () => {
    const { container } = render(<ReviewTags tags={['<b>negrito</b>']} />)

    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('<b>negrito</b>')).toBeInTheDocument()
  })

  it('descarta entradas em branco sem deixar item vazio na lista', () => {
    render(<ReviewTags tags={['romance', '   ', '', 'medievo']} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('axe: sem violação', async () => {
    const { container } = render(
      <main>
        <ReviewTags tags={TAGS} />
      </main>
    )
    const { violations } = await axe.run(container)
    expect(violations).toEqual([])
  })
})

describe('ReviewTags — ausente: nada na tela', () => {
  it.each([
    ['array vazio (o DEFAULT da coluna)', []],
    ['null', null],
    ['undefined', undefined],
    ['só entradas em branco', ['  ', '']],
  ])('%s → não renderiza NADA — sem título "Tags" sobre lista vazia', (_rotulo, valor) => {
    const { container } = render(<ReviewTags tags={valor} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('heading', { name: 'Tags' })).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
