import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
  it('renderiza com o texto e variante/tamanho padrão', () => {
    render(<Button>Salvar</Button>)
    const btn = screen.getByRole('button', { name: 'Salvar' })
    expect(btn).toHaveClass('lia-btn', 'lia-btn--primary', 'lia-btn--md')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('aplica classes de variante e tamanho', () => {
    render(
      <Button variant="ghost" size="lg">
        Cancelar
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Cancelar' })
    expect(btn).toHaveClass('lia-btn--ghost', 'lia-btn--lg')
  })

  it('expõe aria-disabled e bloqueia o clique quando desabilitado (sem perder o foco)', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Enviar
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Enviar' })
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    // aria-disabled (não disabled nativo) → permanece no tab order
    expect(btn).not.toBeDisabled()
    btn.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renderiza o ícone decorativo com aria-hidden', () => {
    render(
      <Button icon={<svg data-testid="ico" />}>Com ícone</Button>,
    )
    const wrapper = screen.getByTestId('ico').parentElement
    expect(wrapper).toHaveClass('lia-btn__icon')
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
  })
})
