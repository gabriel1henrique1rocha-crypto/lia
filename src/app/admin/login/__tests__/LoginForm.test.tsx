import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginForm } from '../LoginForm'

// Mocka a server action para não puxar server-only/next-headers no jsdom.
vi.mock('../actions', () => ({
  requestMagicLink: (prev: unknown) => prev,
}))

describe('LoginForm (a11y)', () => {
  it('tem o campo de e-mail com nome acessível associado', () => {
    render(<LoginForm />)
    // Nome acessível via role (exclui o `*` aria-hidden do Field) — é o que o
    // leitor de tela anuncia.
    const input = screen.getByRole('textbox', { name: /e-mail/i })
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('autocomplete', 'email')
  })

  it('tem a live region presente e VAZIA desde o primeiro render (WCAG 4.1.3)', () => {
    render(<LoginForm />)
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status.textContent).toBe('')
  })

  it('tem o botão de envio acionável', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: 'Enviar link de acesso' })).toBeInTheDocument()
  })
})
