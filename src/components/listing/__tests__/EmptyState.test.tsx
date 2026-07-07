import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { EmptyState } from '../EmptyState'
import type { ListingParams } from '@/lib/review/listingParams'

const params: ListingParams = {
  q: 'inexistente',
  genero: '',
  autor: '',
  nota: null,
  ordem: 'recentes',
  pagina: 1,
}

describe('EmptyState', () => {
  describe('variante no-results', () => {
    it('anuncia via role="status" e ecoa o termo de busca', () => {
      render(<EmptyState variant="no-results" params={params} />)
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Nenhuma resenha encontrada')
      expect(status).toHaveTextContent('inexistente')
    })

    it('oferece recuperação por links para / (funciona sem JS)', () => {
      render(<EmptyState variant="no-results" params={params} />)
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(2)
      links.forEach((link) => expect(link).toHaveAttribute('href', '/'))
    })

    it('axe: sem violação crítica', async () => {
      const { container } = render(<EmptyState variant="no-results" params={params} />)
      const results = await axe.run(container)
      expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([])
    })
  })

  describe('variante empty-catalog', () => {
    it('é informativa e NÃO oferece ações de recuperação (LST-04)', () => {
      render(<EmptyState variant="empty-catalog" />)
      expect(screen.getByRole('status')).toHaveTextContent('Ainda não há resenhas publicadas')
      expect(screen.queryByRole('link')).toBeNull()
    })
  })
})
