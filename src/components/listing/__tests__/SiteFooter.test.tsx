import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { SiteFooter } from '../SiteFooter'

describe('SiteFooter', () => {
  it('é Server Component (sem diretiva use client)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/listing/SiteFooter.tsx'),
      'utf8'
    )
    expect(src).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m)
  })

  it('é um landmark contentinfo com o nome do site', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('LIA')
  })

  it('não tem links mortos (nenhum link até as rotas existirem)', () => {
    render(<SiteFooter />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('axe: sem violação crítica', async () => {
    const { container } = render(<SiteFooter />)
    const results = await axe.run(container)
    expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([])
  })
})
