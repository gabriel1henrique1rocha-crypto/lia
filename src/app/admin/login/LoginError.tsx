'use client'

import { useEffect, useRef } from 'react'

/**
 * Erro do callback (link inválido/expirado) renderizado no SERVIDOR e trazido
 * pronto no HTML. Move o FOCO para a mensagem ao montar (WCAG 2.4.3), para que
 * teclado e leitor de tela aterrissem no contexto certo; `role="alert"` reforça
 * o anúncio. Componente client mínimo — só o foco exige o browser.
 */
export function LoginError({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <p ref={ref} tabIndex={-1} role="alert" className="lia-login__callback-error">
      {message}
    </p>
  )
}
