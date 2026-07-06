import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ResultsCount } from '../ResultsCount'

describe('ResultsCount', () => {
  it('é Server Component (sem diretiva use client)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/listing/ResultsCount.tsx'),
      'utf8'
    )
    expect(src).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m)
  })

  it('anuncia a contagem via role="status"', () => {
    render(<ResultsCount total={4} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Resenhas · 4')
  })

  it('formata o número em pt-BR (separador de milhar)', () => {
    render(<ResultsCount total={1234} />)
    expect(screen.getByRole('status')).toHaveTextContent('Resenhas · 1.234')
  })

  it('funciona com zero resultados', () => {
    render(<ResultsCount total={0} />)
    expect(screen.getByRole('status')).toHaveTextContent('Resenhas · 0')
  })
})
