import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import axe from 'axe-core'
import { FeaturedCarousel } from '../FeaturedCarousel'
import type { ReviewListItem } from '@/lib/review/queries'

const reviews: ReviewListItem[] = Array.from({ length: 4 }, (_, i) => ({
  id: String(i + 1),
  slug: `resenha-${i + 1}`,
  title: `Título ${i + 1}`,
  rating: 4,
  published_at: null,
  excerpt: `Trecho ${i + 1}`,
  book: {
    title: `Livro ${i + 1}`,
    author: `Autor ${i + 1}`,
    genre: { name: 'Romance', slug: 'romance' },
  },
}))

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('FeaturedCarousel', () => {
  it('a seção é Server Component; só o controle é cliente', () => {
    expect(read('src/components/review/FeaturedCarousel.tsx')).not.toMatch(
      /^\s*['"]use client['"]\s*;?\s*$/m
    )
    expect(read('src/components/review/FeaturedCarouselControls.tsx')).toMatch(
      /^\s*['"]use client['"]\s*;?\s*$/m
    )
  })

  it('NÃO tem giro automático (nenhum timer no código) — LST-16', () => {
    const controls = read('src/components/review/FeaturedCarouselControls.tsx')
    expect(controls).not.toMatch(/setInterval|setTimeout/)
  })

  it('não renderiza nada sem destaques', () => {
    const { container } = render(<FeaturedCarousel reviews={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('é uma seção nomeada "Em destaque" com os slides como links', () => {
    render(<FeaturedCarousel reviews={reviews} />)
    expect(screen.getByRole('region', { name: 'Em destaque' })).toBeInTheDocument()
    reviews.forEach((r) => {
      expect(screen.getByRole('link', { name: r.title })).toHaveAttribute(
        'href',
        `/resenha/${r.slug}`
      )
    })
  })

  it('setas são botões focáveis; a anterior começa desabilitada (borda)', () => {
    render(<FeaturedCarousel reviews={reviews} />)
    expect(screen.getByRole('button', { name: 'Destaque anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próximo destaque' })).toBeEnabled()
  })

  it('anuncia a posição e avança só por ação do usuário (LST-17)', () => {
    render(<FeaturedCarousel reviews={reviews} />)
    expect(screen.getByRole('status')).toHaveTextContent('Destaque 1 de 4')
    fireEvent.click(screen.getByRole('button', { name: 'Próximo destaque' }))
    expect(screen.getByRole('status')).toHaveTextContent('Destaque 2 de 4')
    expect(screen.getByRole('button', { name: 'Destaque anterior' })).toBeEnabled()
  })

  it('axe: sem violação crítica no jsdom', async () => {
    const { container } = render(<FeaturedCarousel reviews={reviews} />)
    const results = await axe.run(container)
    expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([])
  })
})
