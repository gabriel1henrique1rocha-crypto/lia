'use client'

import { useActionState } from 'react'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { requestMagicLink, type LoginState } from './actions'

const INITIAL: LoginState = { status: 'idle', message: '' }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, INITIAL)

  return (
    <form action={formAction} noValidate className="lia-login__form">
      <Field
        as="input"
        type="email"
        name="email"
        label="E-mail"
        required
        autoComplete="email"
        inputMode="email"
        // Erro de validação associado ao campo (aria-describedby + role=alert
        // pelo próprio Field). Não depende de cor.
        error={state.status === 'error' ? state.message : undefined}
      />

      <Button type="submit" block disabled={pending} aria-busy={pending || undefined}>
        {pending ? 'Enviando…' : 'Enviar link de acesso'}
      </Button>

      {/* Live region SEMPRE presente no DOM desde o 1º render (vazia) — só assim
          o leitor de tela anuncia o sucesso quando o texto chega (WCAG 4.1.3). */}
      <p role="status" aria-live="polite" className="lia-login__status">
        {state.status === 'sent' ? state.message : ''}
      </p>
    </form>
  )
}
