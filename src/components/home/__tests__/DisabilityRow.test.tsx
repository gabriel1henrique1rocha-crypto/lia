import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import axe from 'axe-core'
import { DisabilityRow, OTHER_ROW_TITLE } from '../DisabilityRow'
import { resenha } from './fixtures'

/** HOME-25..28 — fileiras por deficiência. */

let transborda = true

beforeEach(() => {
  transborda = true
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
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return transborda ? 2000 : 500
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 800
    },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const FILEIRA = {
  term: { name: 'Deficiência visual', slug: 'deficiencia-visual' },
  reviews: [resenha(1), resenha(2), resenha(3)],
}

it('h3 com o termo; região rolável nomeada e focável; <ul> preservado (A-7)', () => {
  render(<DisabilityRow row={FILEIRA} index={0} />)
  expect(screen.getByRole('heading', { level: 3, name: 'Deficiência visual' })).toBeInTheDocument()
  const regiao = screen.getByRole('region', { name: 'Deficiência visual' })
  expect(regiao).toHaveAttribute('tabindex', '0')
  const lista = regiao.querySelector('ul.lia-row__list') as HTMLElement
  expect(lista).not.toBeNull()
  expect(
    within(lista)
      .getAllByRole('listitem')
      .filter((li) => li.parentElement === lista)
  ).toHaveLength(3)
})

it('"Ver todos" leva ao filtro e tem nome único por fileira (HOME-26, 2.5.3)', () => {
  render(<DisabilityRow row={FILEIRA} index={0} />)
  const link = screen.getByRole('link', { name: /^Ver todos/ })
  expect(link).toHaveAttribute('href', '/?deficiencia=deficiencia-visual')
  expect(link).toHaveAccessibleName('Ver todos — Deficiência visual')
})

it('setas com nome "Rolar <termo> para trás/frente" quando transborda', () => {
  render(<DisabilityRow row={FILEIRA} index={0} />)
  expect(
    screen.getByRole('button', { name: 'Rolar Deficiência visual para trás' })
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Rolar Deficiência visual para frente' })
  ).toBeInTheDocument()
})

it('sem overflow: sem setas e a região sai do Tab', () => {
  transborda = false
  render(<DisabilityRow row={FILEIRA} index={0} />)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.getByRole('region', { name: 'Deficiência visual' })).not.toHaveAttribute('tabindex')
})

it('sem JS (HTML do servidor): região focável e nenhuma seta', () => {
  const html = renderToString(<DisabilityRow row={FILEIRA} index={0} />)
  expect(html).toContain('tabindex="0"')
  expect(html).not.toContain('<button')
})

it('"Outras resenhas" (HOME-28): sem "Ver todos"', () => {
  render(<DisabilityRow row={{ term: null, reviews: [resenha(9)] }} index={3} />)
  expect(screen.getByRole('heading', { level: 3, name: OTHER_ROW_TITLE })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Ver todos/ })).toBeNull()
})

it('cards em h4, com linha "autor · ano" abaixo', () => {
  render(<DisabilityRow row={FILEIRA} index={0} />)
  expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3)
  expect(document.querySelectorAll('.lia-dcard__byline')[0]).toHaveTextContent('Autora 1 · 1991')
})

it('axe: sem violações', async () => {
  const { container } = render(
    <main>
      <DisabilityRow row={FILEIRA} index={0} />
    </main>
  )
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  expect(r.violations).toEqual([])
})
