import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renderiza como <div> por padrão', () => {
    render(
      <Card data-testid="card">
        <Card.Body>
          <Card.Title>Título</Card.Title>
        </Card.Body>
      </Card>
    )
    const card = screen.getByTestId('card')
    expect(card.tagName).toBe('DIV')
    expect(card).toHaveClass('lia-card')
  })

  it('com href renderiza um <a> focável por teclado', () => {
    render(
      <Card href="/resenha/1">
        <Card.Body>
          <Card.Title>Resenha</Card.Title>
        </Card.Body>
      </Card>
    )
    const link = screen.getByRole('link', { name: /Resenha/ })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/resenha/1')
    // <a href> é focável nativamente (não precisa de tabindex)
    expect(link).not.toHaveAttribute('tabindex')
    expect(link).toHaveClass('lia-card')
  })

  it('aplica a classe da variante raised', () => {
    render(<Card data-testid="card" variant="raised" />)
    expect(screen.getByTestId('card')).toHaveClass('lia-card--raised')
  })

  it('CardTitle respeita o nível semântico via prop as', () => {
    render(
      <Card>
        <Card.Body>
          <Card.Title as="h2">Cabeçalho</Card.Title>
        </Card.Body>
      </Card>
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Cabeçalho' })).toBeInTheDocument()
  })
})
