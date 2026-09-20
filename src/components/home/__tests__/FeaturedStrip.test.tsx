import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { FeaturedStrip } from '../FeaturedStrip'
import { resenha } from './fixtures'

/**
 * D-13a — faixa "Em destaque" (HOME-10..18).
 *
 * O jsdom não faz layout: larguras são simuladas por getters no protótipo
 * (grupo "largo" = transborda) e os observers/matchMedia são stubs. O
 * comportamento de rolagem real (foco trazendo o card, máscara) é conferido no
 * Playwright; aqui fica o CONTRATO: o que existe no DOM em cada estado.
 */

const REVIEWS = Array.from({ length: 10 }, (_, i) => resenha(i + 1))

let larguraGrupo = 3000
let larguraViewport = 1200
let reduzido = false

beforeEach(() => {
  larguraGrupo = 3000
  larguraViewport = 1200
  reduzido = false
  try {
    window.sessionStorage.clear()
  } catch {
    /* noop */
  }

  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: () => void) {}
      observe() {
        this.cb()
      }
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
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? reduzido : false,
    addEventListener() {},
    removeEventListener() {},
  }))
  window.matchMedia = globalThis.matchMedia as typeof window.matchMedia
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('lia-strip__group') ? larguraGrupo : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('lia-strip__viewport') ? larguraViewport : 0
    },
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const pausar = () => screen.queryByRole('button', { name: /carrossel/ })

describe('HTML do servidor / sem JS (HOME-11)', () => {
  it('lista única, sem cópias, sem setas e sem pausa', () => {
    const html = renderToString(<FeaturedStrip reviews={REVIEWS} />)
    expect(html).not.toContain('data-clone')
    expect(html).not.toContain('<button')
    expect((html.match(/href="\/resenha\//g) ?? []).length).toBe(10)
    expect(html).toContain('Em destaque')
  })

  it('acervo vazio: não renderiza nada', () => {
    expect(renderToString(<FeaturedStrip reviews={[]} />)).toBe('')
  })
})

describe('com JS e faixa que transborda (HOME-12/13/16)', () => {
  it('monta as cópias aria-hidden, com links fora do Tab e sem ids', () => {
    const { container } = render(<FeaturedStrip reviews={REVIEWS} />)
    const copia = container.querySelector('[data-clone]')!
    expect(copia).toHaveAttribute('aria-hidden', 'true')
    for (const link of copia.querySelectorAll('a')) expect(link).toHaveAttribute('tabindex', '-1')
    expect(copia.querySelector('[id]')).toBeNull()
    // Todos os ids da faixa continuam únicos.
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('botão Pausar/Retomar: nome acessível contém o texto visível (2.5.3)', () => {
    render(<FeaturedStrip reviews={REVIEWS} />)
    const botao = pausar()!
    expect(botao).toHaveAccessibleName('Pausar carrossel')
    expect(botao).toHaveTextContent('Pausar')
    fireEvent.click(botao)
    expect(pausar()).toHaveAccessibleName('Retomar carrossel')
    expect(pausar()).toHaveTextContent('Retomar')
  })

  it('a pausa vale para a sessão (C-10)', () => {
    const { unmount } = render(<FeaturedStrip reviews={REVIEWS} />)
    fireEvent.click(pausar()!)
    unmount()
    render(<FeaturedStrip reviews={REVIEWS} />)
    expect(pausar()).toHaveAccessibleName('Retomar carrossel')
  })

  it('setas nomeadas, alvo ≥ 44px garantido pela classe .lia-ctl--icon', () => {
    render(<FeaturedStrip reviews={REVIEWS} />)
    expect(screen.getByRole('button', { name: 'Destaques anteriores' })).toHaveClass(
      'lia-ctl--icon'
    )
    expect(screen.getByRole('button', { name: 'Próximos destaques' })).toHaveClass('lia-ctl--icon')
  })

  it('sem "Destaque n de N" nem dots (HOME-18)', () => {
    const { container } = render(<FeaturedStrip reviews={REVIEWS} />)
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(screen.queryByText(/Destaque \d+ de \d+/)).toBeNull()
  })
})

describe('prefers-reduced-motion (HOME-14)', () => {
  it('sem pausa e sem cópias; setas continuam', () => {
    reduzido = true
    const { container } = render(<FeaturedStrip reviews={REVIEWS} />)
    expect(pausar()).toBeNull()
    expect(container.querySelector('[data-clone]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Próximos destaques' })).toBeInTheDocument()
  })
})

describe('faixa que não enche a viewport (HOME-15)', () => {
  it('estática: sem cópias, sem pausa, sem setas, sem máscara', () => {
    larguraGrupo = 600
    const { container } = render(<FeaturedStrip reviews={REVIEWS.slice(0, 2)} />)
    expect(container.querySelector('[data-clone]')).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelector('.lia-strip__viewport')).not.toHaveAttribute('data-masked')
  })
})

describe('estrutura', () => {
  it('seção nomeada pelo h2; títulos dos cards em h3; "Ver todas" aponta para #resenhas', () => {
    render(<FeaturedStrip reviews={REVIEWS} />)
    expect(screen.getByRole('region', { name: 'Em destaque' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(10) // cópias ocultas
    expect(screen.getByRole('link', { name: 'Ver todas as resenhas' })).toHaveAttribute(
      'href',
      '#resenhas'
    )
  })

  it('setas movem a faixa (scrollBy chamado) sem erro', () => {
    const scrollBy = vi.fn()
    HTMLElement.prototype.scrollBy = scrollBy as unknown as typeof HTMLElement.prototype.scrollBy
    render(<FeaturedStrip reviews={REVIEWS} />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Próximos destaques' }))
    })
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })
})
