import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { Rating } from '../Rating'

describe('Rating', () => {
  it('é um Server Component (sem diretiva use client)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/review/Rating.tsx'), 'utf8')
    expect(src).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m)
  })

  it('exibe a nota numérica visível (pt-BR) sobre 5', () => {
    render(<Rating rating={4.5} />)
    expect(screen.getByText('4,5 / 5')).toBeInTheDocument()
  })

  it('fornece alternativa textual acessível (sr-only), não só visual', () => {
    const { container } = render(<Rating rating={4.5} />)
    const srText = container.querySelector('.sr-only')
    expect(srText?.textContent).toBe('Nota: 4,5 de 5')
  })

  it('não renderiza componente de estrelas/medidor (C-1)', () => {
    const { container } = render(<Rating rating={4.5} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('axe não retorna violação crítica no jsdom', async () => {
    const { container } = render(<Rating rating={4} />)
    const results = await axe.run(container)
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toEqual([])
  })
})
