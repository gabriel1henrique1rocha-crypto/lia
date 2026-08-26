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

/**
 * ONDE A CULPA NÃO ESTÁ (polish de UI, 2026-08-26).
 *
 * Em produção as tags de `/resenha/o-projeto-rosie` aparecem como UMA pílula
 * só, com ponto e vírgula dentro: "neurodiversidade; autismo; amor; …".
 * O reflexo é culpar este componente. Ele NÃO é o culpado, e estes testes
 * prendem essa conclusão para que a correção seja feita no lugar certo:
 *
 *   `listaPorVirgula` (src/lib/review/schema.ts) faz `split(',')` — só vírgula.
 *   Um `tagsInput` com ponto e vírgula sai da validação como array de UM
 *   elemento, e o banco guarda literalmente uma tag chamada
 *   "neurodiversidade; autismo; amor; saúde mental".
 *
 * Renderizar uma pílula por elemento do array é, portanto, o comportamento
 * CORRETO — quebrar a string aqui esconderia o defeito de gravação e estragaria
 * qualquer tag que legitimamente contenha ponto e vírgula.
 */
describe('ReviewTags — um item por elemento do array (o separador NÃO é problema daqui)', () => {
  it('N tags → N itens, cada um na sua caixa', () => {
    render(<ReviewTags tags={['neurodiversidade', 'autismo', 'amor', 'saúde mental']} />)

    const itens = screen.getAllByRole('listitem')
    expect(itens).toHaveLength(4)
    expect(itens.map((i) => i.textContent)).toEqual([
      'neurodiversidade',
      'autismo',
      'amor',
      'saúde mental',
    ])
  })

  it('array de UM elemento com ponto e vírgula → UMA pílula (o sintoma de produção)', () => {
    // Reproduz o dado tal como está gravado hoje. Se este teste um dia falhar
    // com 4 itens, alguém pôs um split no componente: o dado errado passou a
    // ser MASCARADO em vez de corrigido na gravação.
    render(<ReviewTags tags={['neurodiversidade; autismo; amor; saúde mental']} />)

    const itens = screen.getAllByRole('listitem')
    expect(itens).toHaveLength(1)
    expect(itens[0].textContent).toBe('neurodiversidade; autismo; amor; saúde mental')
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
