import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, cleanup } from '@testing-library/react'
import axe from 'axe-core'
import { BookCover } from '../BookCover'

beforeEach(cleanup)

describe('BookCover', () => {
  it('é um Server Component (sem diretiva use client)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/book/BookCover.tsx'), 'utf8')
    expect(src).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m)
  })

  it('expõe alternativa textual acessível via role=img + aria-label', () => {
    render(<BookCover title="Dom Casmurro" />)
    const cover = screen.getByRole('img', { name: 'Capa de Dom Casmurro' })
    expect(cover).toBeInTheDocument()
  })

  it('renderiza o título como texto visível (não só imagem)', () => {
    const { container } = render(<BookCover title="Iracema" />)
    expect(container.textContent).toContain('Iracema')
  })

  it('usa as classes da capa tipográfica do design system', () => {
    const { container } = render(<BookCover title="O Cortiço" />)
    const cover = container.firstElementChild as HTMLElement
    expect(cover.classList.contains('lia-card__media')).toBe(true)
    expect(cover.classList.contains('lia-card__media--type')).toBe(true)
  })

  it('axe não retorna violação crítica no jsdom', async () => {
    const { container } = render(<BookCover title="Dom Casmurro" />)
    const results = await axe.run(container)
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toEqual([])
  })

  // Sem container, `.lia-card__media` (width:100% + aspect-ratio) não tem
  // medida — foi assim que a capa virou 853px de vinho na rota. O componente
  // continua SEM largura própria de propósito: quem a define é o contexto.
  it('não impõe largura nem altura próprias — o tamanho é do contexto', () => {
    const { container } = render(<BookCover title="Iracema" />)
    const cover = container.firstElementChild as HTMLElement
    expect(cover.getAttribute('style')).toBeNull()
    expect(cover.className).not.toMatch(/w-|h-|width|height/)
  })
})

describe('BookCover — COM cover_url', () => {
  const URL_CAPA = 'https://exemplo.test/capas/dom-casmurro.jpg'

  it('renderiza a imagem de verdade quando há URL', () => {
    const { container } = render(<BookCover title="Dom Casmurro" coverUrl={URL_CAPA} />)
    const img = container.querySelector('img')

    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', URL_CAPA)
    // Sem o fallback tipográfico junto: uma capa, não duas.
    expect(container.querySelector('.lia-card__media--type')).toBeNull()
  })

  it('expõe a MESMA alternativa textual das duas variantes', () => {
    const comCapa = render(<BookCover title="Dom Casmurro" coverUrl={URL_CAPA} />)
    expect(screen.getByRole('img', { name: 'Capa de Dom Casmurro' })).toBeInTheDocument()
    comCapa.unmount()

    render(<BookCover title="Dom Casmurro" />)
    expect(screen.getByRole('img', { name: 'Capa de Dom Casmurro' })).toBeInTheDocument()
  })

  it('herda a mesma classe de mídia — as duas variantes ocupam a MESMA caixa', () => {
    const { container } = render(<BookCover title="Dom Casmurro" coverUrl={URL_CAPA} />)
    expect(container.querySelector('img')!.classList.contains('lia-card__media')).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
    ['só espaço', '   '],
  ])('%s → cai no fallback tipográfico, sem <img> quebrada', (_rotulo, valor) => {
    const { container } = render(<BookCover title="Iracema" coverUrl={valor} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.lia-card__media--type')).not.toBeNull()
  })

  it('axe: a variante com imagem não tem violação (alt presente)', async () => {
    const { container } = render(<BookCover title="Dom Casmurro" coverUrl={URL_CAPA} />)
    const { violations } = await axe.run(container)
    expect(violations).toEqual([])
  })
})
