import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Field } from '../Field'

describe('Field', () => {
  it('associa o label ao controle via htmlFor/id', () => {
    render(<Field label="E-mail" id="email" />)
    const input = screen.getByLabelText('E-mail')
    expect(input).toBe(document.getElementById('email'))
    expect(input.tagName).toBe('INPUT')
  })

  it('no estado de erro: aria-invalid no controle, role=alert na mensagem e ícone aria-hidden', () => {
    render(<Field label="Nome" id="nome" error="Campo obrigatório" />)
    const input = screen.getByLabelText('Nome')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Campo obrigatório')
    expect(input).toHaveAttribute('aria-describedby', alert.id)

    // ícone Lucide é decorativo
    const icon = alert.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('liga o helpText ao controle via aria-describedby quando não há erro', () => {
    render(<Field label="Senha" id="senha" helpText="Mínimo 8 caracteres" />)
    const input = screen.getByLabelText('Senha')
    expect(input).not.toHaveAttribute('aria-invalid')
    const help = screen.getByText('Mínimo 8 caracteres')
    expect(input).toHaveAttribute('aria-describedby', help.id)
  })

  it('renderiza select com chevron decorativo', () => {
    render(
      <Field label="Gênero" id="genero" as="select">
        <option value="a">A</option>
      </Field>
    )
    const select = screen.getByLabelText('Gênero')
    expect(select.tagName).toBe('SELECT')
    const chevron = select.parentElement?.querySelector('.lia-field__chev')
    expect(chevron).toHaveAttribute('aria-hidden', 'true')
  })

  it('renderiza textarea quando as="textarea"', () => {
    render(<Field label="Bio" id="bio" as="textarea" />)
    expect(screen.getByLabelText('Bio').tagName).toBe('TEXTAREA')
  })
})
