import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotAuthorized } from '../NotAuthorized'

describe('NotAuthorized (SEC-07)', () => {
  it('tem heading e explicação, sem dado sensível', () => {
    render(<NotAuthorized />)
    expect(screen.getByRole('heading', { name: 'Acesso não autorizado' })).toBeInTheDocument()
    expect(screen.getByText(/não tem permissão para acessar o painel/i)).toBeInTheDocument()
  })

  it('oferece Sair via POST server-side', () => {
    const { container } = render(<NotAuthorized />)
    const form = container.querySelector('form')
    expect(form).toHaveAttribute('action', '/auth/signout')
    expect(form).toHaveAttribute('method', 'post')
    expect(screen.getByRole('button', { name: 'Sair' })).toHaveAttribute('type', 'submit')
  })
})
