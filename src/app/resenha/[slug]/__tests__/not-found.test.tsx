import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import ReviewNotFound from '../not-found'

describe('ReviewNotFound', () => {
  it('tem um único h1 com mensagem de não encontrada', () => {
    render(<ReviewNotFound />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(/não encontrada/i)
  })

  it('não vaza que existe um rascunho (indistinguível de inexistente)', () => {
    const { container } = render(<ReviewNotFound />)
    expect(container.textContent?.toLowerCase()).not.toContain('rascunho')
    expect(container.textContent?.toLowerCase()).not.toContain('draft')
  })

  it('oferece link de retorno navegável por teclado (âncora com href)', () => {
    render(<ReviewNotFound />)
    const link = screen.getByRole('link', { name: /início|inicial|home/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('axe não retorna violação crítica no jsdom', async () => {
    const { container } = render(<ReviewNotFound />)
    const results = await axe.run(container)
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toEqual([])
  })
})
