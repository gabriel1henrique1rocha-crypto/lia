'use client'

import { useEffect, useRef } from 'react'

/**
 * Confirmação de criação, exibida na lista depois do redirect (T10).
 *
 * POR QUE MOVER O FOCO, e não confiar na live region: a mensagem chega junto com
 * o documento (o redirect é uma navegação, não uma atualização de estado). Live
 * region só anuncia o que MUDA depois do carregamento — conteúdo já presente no
 * HTML inicial passa em silêncio. Sem isto, quem usa leitor de tela seria levado
 * para uma lista nova sem nunca ouvir que a resenha foi criada.
 *
 * Mesmo padrão do `LoginError` (security-foundation), com `role="status"` no
 * lugar de `role="alert"`: sucesso não interrompe.
 */
export function CreatedNotice({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <p ref={ref} tabIndex={-1} role="status" className="lia-admin-notice">
      {children}
    </p>
  )
}
