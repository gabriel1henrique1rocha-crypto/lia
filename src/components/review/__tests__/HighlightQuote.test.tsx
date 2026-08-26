import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { HighlightQuote } from '../HighlightQuote'

const FRASE = 'A biblioteca é um labirinto que se lê com os pés.'

describe('HighlightQuote — presente', () => {
  it('renderiza a frase dentro de um <blockquote>', () => {
    render(<HighlightQuote quote={FRASE} />)
    const citacao = screen.getByText(FRASE)
    expect(citacao.closest('blockquote')).not.toBeNull()
  })

  it('a legenda que nomeia a figura está presente', () => {
    const { container } = render(<HighlightQuote quote={FRASE} />)
    const figura = container.querySelector('figure')

    // `figcaption` nomeia a `figure` (HTML-AAM): o leitor de tela anuncia a
    // legenda ANTES da frase, em vez de largar um bloco citado sem contexto.
    //
    // O NOME ACESSÍVEL em si é conferido no NAVEGADOR (`review-public.spec.ts`),
    // não aqui: o `dom-accessibility-api` que o jest-dom usa no jsdom não
    // implementa `figcaption` como fonte de nome e devolve string vazia, o que
    // reprovaria uma marcação correta. O Chromium expõe o nome — verificado, e
    // é lá que a asserção mora.
    expect(figura?.querySelector('figcaption')).toHaveTextContent('Trecho em destaque')
    expect(figura?.querySelector('blockquote')).not.toBeNull()
  })

  it('NÃO inventa atribuição — não há `cite` nem autor, porque não há coluna para isso', () => {
    const { container } = render(<HighlightQuote quote={FRASE} />)

    expect(container.querySelector('cite')).toBeNull()
    // Nem afirma origem que o dado não sustenta.
    expect(screen.queryByText(/do livro/i)).toBeNull()
    expect(screen.queryByText(/segundo/i)).toBeNull()
  })

  it('NÃO se esconde do leitor de tela: pode ser conteúdo único, não só eco do corpo', () => {
    const { container } = render(<HighlightQuote quote={FRASE} />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('conteúdo de editor é TEXTO, não markup — o React escapa', () => {
    const { container } = render(<HighlightQuote quote='<img src=x onerror="alert(1)">' />)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument()
  })

  it('axe: sem violação', async () => {
    const { container } = render(
      <main>
        <HighlightQuote quote={FRASE} />
      </main>
    )
    const { violations } = await axe.run(container)
    expect(violations).toEqual([])
  })
})

describe('HighlightQuote — ausente: nada na tela, nada na árvore', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
    ['só espaço em branco', '   \n  '],
  ])('%s → não renderiza NADA (sem moldura, sem legenda órfã)', (_rotulo, valor) => {
    const { container } = render(<HighlightQuote quote={valor} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Trecho em destaque')).toBeNull()
  })

  it('a frase é aparada antes de exibir', () => {
    render(<HighlightQuote quote={`  ${FRASE}  `} />)
    expect(screen.getByText(FRASE)).toBeInTheDocument()
  })
})
