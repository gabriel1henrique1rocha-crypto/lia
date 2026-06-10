import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Link } from '../Link'

describe('Link', () => {
  it('renderiza um <a> com a classe sublinhada por padrão', () => {
    render(<Link href="/sobre">Sobre</Link>)
    const link = screen.getByRole('link', { name: 'Sobre' })
    expect(link).toHaveClass('lia-link')
    expect(link).not.toHaveClass('lia-link--quiet')
  })

  it('aplica a variante quiet', () => {
    render(
      <Link href="/x" variant="quiet">
        Quieto
      </Link>,
    )
    expect(screen.getByRole('link', { name: 'Quieto' })).toHaveClass('lia-link--quiet')
  })

  it('external adiciona target, rel seguro e ícone decorativo', () => {
    render(
      <Link href="https://exemplo.com" external>
        Externo
      </Link>,
    )
    const link = screen.getByRole('link', { name: 'Externo' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    const icon = link.querySelector('.lia-link__external')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})
