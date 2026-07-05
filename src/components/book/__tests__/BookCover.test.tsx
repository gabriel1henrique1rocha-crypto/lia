import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { BookCover } from '../BookCover'

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
})
