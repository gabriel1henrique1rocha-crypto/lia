'use client'

import {
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref,
} from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'

interface FieldOwnProps {
  /** Texto do rótulo, sempre associado ao controle via `htmlFor`/`id`. */
  label: string
  /** id do controle. Se omitido, um id estável é gerado. */
  id?: string
  /** Mensagem de erro. Quando presente, ativa `aria-invalid` + `role="alert"`. */
  error?: string
  /** Texto auxiliar (ignorado quando há `error`). */
  helpText?: string
  /** Marca o campo como obrigatório (asterisco) ou exibe "(opcional)". */
  required?: boolean
  /** Exibe o marcador "(opcional)" quando não obrigatório. */
  showOptional?: boolean
}

type InputFieldProps = FieldOwnProps &
  Omit<ComponentPropsWithoutRef<'input'>, 'id'> & { as?: 'input' }
type TextareaFieldProps = FieldOwnProps &
  Omit<ComponentPropsWithoutRef<'textarea'>, 'id'> & { as: 'textarea' }
type SelectFieldProps = FieldOwnProps &
  Omit<ComponentPropsWithoutRef<'select'>, 'id'> & {
    as: 'select'
    children?: ReactNode
  }

export type FieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps

type FieldRef = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/** Forma normalizada para destruturação (evita o colapso de `as` na interseção). */
type NormalizedFieldProps = FieldOwnProps & {
  as?: 'input' | 'textarea' | 'select'
  className?: string
} & Record<string, unknown>

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(' ')

export const Field = forwardRef<FieldRef, FieldProps>(function Field(props, ref) {
  const {
    label,
    id: providedId,
    error,
    helpText,
    required,
    showOptional,
    as = 'input',
    className,
    ...rest
  } = props as NormalizedFieldProps

  const generatedId = useId()
  const id = providedId ?? generatedId
  const errorId = `${id}-error`
  const helpId = `${id}-help`

  const describedBy =
    [error ? errorId : null, !error && helpText ? helpId : null]
      .filter(Boolean)
      .join(' ') || undefined

  const controlProps = {
    id,
    className: 'lia-field__control',
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }

  let control: ReactNode
  if (as === 'textarea') {
    control = (
      <textarea
        {...(rest as ComponentPropsWithoutRef<'textarea'>)}
        {...controlProps}
        ref={ref as Ref<HTMLTextAreaElement>}
      />
    )
  } else if (as === 'select') {
    control = (
      <span className="lia-field__select-wrap">
        <select
          {...(rest as ComponentPropsWithoutRef<'select'>)}
          {...controlProps}
          ref={ref as Ref<HTMLSelectElement>}
        />
        <ChevronDown className="lia-field__chev" size={18} aria-hidden="true" />
      </span>
    )
  } else {
    control = (
      <input
        {...(rest as ComponentPropsWithoutRef<'input'>)}
        {...controlProps}
        ref={ref as Ref<HTMLInputElement>}
      />
    )
  }

  return (
    <div className={cx('lia-field', error && 'lia-field--error', className)}>
      <label className="lia-field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="lia-field__req" aria-hidden="true">
            *
          </span>
        )}
        {!required && showOptional && (
          <span className="lia-field__optional">(opcional)</span>
        )}
      </label>

      {control}

      {error ? (
        <p id={errorId} className="lia-field__error" role="alert">
          <AlertCircle className="lia-field__error-icon" size={16} aria-hidden="true" />
          {error}
        </p>
      ) : (
        helpText && (
          <p id={helpId} className="lia-field__help">
            {helpText}
          </p>
        )
      )}
    </div>
  )
})
