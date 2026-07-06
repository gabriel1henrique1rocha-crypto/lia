import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { ReviewCard, type ReviewCardProps } from '../ReviewCard'

const props: ReviewCardProps = {
  slug: 'dom-casmurro',
  title: 'Dom Casmurro: o ciúme como narrador',
  author: 'Machado de Assis',
  rating: 4.5,
  excerpt: 'Machado entrega em Bento Santiago um dos narradores mais insidiosos.',
}

function renderCard(overrides: Partial<ReviewCardProps> = {}) {
  // <ol> para o <li> ser válido e não disparar a regra listitem do axe.
  return render(
    <ol>
      <ReviewCard {...props} {...overrides} />
    </ol>
  )
}

describe('ReviewCard', () => {
  it('é Server Component (sem diretiva use client)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/review/ReviewCard.tsx'), 'utf8')
    expect(src).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m)
  })

  it('o título é um link para /resenha/[slug], com nome acessível = título', () => {
    renderCard()
    const link = screen.getByRole('link', { name: props.title })
    expect(link).toHaveAttribute('href', '/resenha/dom-casmurro')
  })

  it('exibe autor e trecho', () => {
    renderCard()
    expect(screen.getByText(props.author)).toBeInTheDocument()
    expect(screen.getByText(props.excerpt)).toBeInTheDocument()
  })

  it('renderiza a capa (BookCover) com alternativa textual', () => {
    renderCard()
    expect(screen.getByRole('img', { name: `Capa de ${props.title}` })).toBeInTheDocument()
  })

  it('exibe a nota quando presente (sr-only pt-BR)', () => {
    renderCard()
    expect(screen.getByText('Nota: 4,5 de 5')).toBeInTheDocument()
  })

  it('OMITE a nota quando rating é nulo (C-1)', () => {
    renderCard({ rating: null })
    expect(screen.queryByText(/Nota:/)).toBeNull()
  })

  it('axe: sem violação crítica no jsdom', async () => {
    const { container } = renderCard()
    const results = await axe.run(container)
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toEqual([])
  })
})
