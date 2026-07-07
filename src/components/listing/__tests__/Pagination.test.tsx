import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { Pagination } from '../Pagination'
import type { ListingParams } from '@/lib/review/listingParams'

const base: ListingParams = {
  q: 'dom',
  genero: '',
  autor: '',
  nota: null,
  ordem: 'recentes',
  pagina: 2,
}

describe('Pagination', () => {
  it('não renderiza nada quando há uma única página', () => {
    const { container } = render(<Pagination params={{ ...base, pagina: 1 }} total={5} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marca a página atual com aria-current="page"', () => {
    render(<Pagination params={base} total={40} />) // 4 páginas
    const current = screen.getByRole('link', { name: 'Página 2', current: 'page' })
    expect(current).toBeInTheDocument()
  })

  it('os links preservam os demais params (q)', () => {
    render(<Pagination params={base} total={40} />)
    const p3 = screen.getByRole('link', { name: 'Página 3' })
    expect(p3.getAttribute('href')).toContain('q=dom')
    expect(p3.getAttribute('href')).toContain('pagina=3')
  })

  it('‹ anterior fica desabilitada na primeira página', () => {
    render(<Pagination params={{ ...base, pagina: 1 }} total={40} />)
    expect(screen.queryByRole('link', { name: 'Página anterior' })).toBeNull()
  })

  it('› próxima fica desabilitada na última página', () => {
    render(<Pagination params={{ ...base, pagina: 4 }} total={40} />)
    expect(screen.queryByRole('link', { name: 'Próxima página' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Página anterior' })).toBeInTheDocument()
  })

  it('usa reticências para muitos números de página', () => {
    render(<Pagination params={{ ...base, pagina: 5 }} total={120} />) // 10 páginas
    expect(screen.getAllByText('…').length).toBeGreaterThan(0)
  })

  it('é um landmark de navegação nomeado', () => {
    render(<Pagination params={base} total={40} />)
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeInTheDocument()
  })

  it('axe: sem violação crítica no jsdom', async () => {
    const { container } = render(<Pagination params={base} total={120} />)
    const results = await axe.run(container)
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toEqual([])
  })
})
