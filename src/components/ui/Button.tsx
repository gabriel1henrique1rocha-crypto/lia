'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** Estilo visual. Padrão: `primary`. */
  variant?: ButtonVariant
  /** Tamanho. `md` (padrão) garante alvo de toque ≥ 44px. */
  size?: ButtonSize
  /** Ícone decorativo (Lucide). Renderizado com `aria-hidden`. */
  icon?: ReactNode
  /** Posição do ícone relativa ao texto. Padrão: `start`. */
  iconPosition?: 'start' | 'end'
  /** Ocupa 100% da largura. */
  block?: boolean
  /**
   * Desabilita por ação preservando o foco do teclado (usa `aria-disabled`
   * em vez do atributo nativo `disabled`, que removeria o elemento do tab order).
   */
  disabled?: boolean
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ')

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconPosition = 'start',
    block = false,
    disabled = false,
    type = 'button',
    className,
    children,
    onClick,
    ...rest
  },
  ref
) {
  const iconNode = icon ? (
    <span className="lia-btn__icon" aria-hidden="true">
      {icon}
    </span>
  ) : null

  return (
    <button
      ref={ref}
      type={type}
      aria-disabled={disabled || undefined}
      className={cx(
        'lia-btn',
        `lia-btn--${variant}`,
        `lia-btn--${size}`,
        block && 'lia-btn--block',
        className
      )}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      {...rest}
    >
      {iconPosition === 'start' && iconNode}
      {children}
      {iconPosition === 'end' && iconNode}
    </button>
  )
})
