'use client'

import { useEffect } from 'react'

/**
 * Esc esconde a sinopse do card sob o ponteiro ou em foco (HOME-21, 1.4.13
 * "dispensável").
 *
 * Um ouvinte no `document`, não um por card: com hover puro o foco NÃO está no
 * card, então um `onKeyDown` no card nunca veria o Esc. O card fica marcado com
 * `data-dismissed` até o ponteiro sair E o foco sair — aí volta a abrir no
 * próximo hover/foco (a sinopse não some de vez).
 *
 * Não renderiza nada. Sem JS a sinopse continua abrindo por hover/foco; só não
 * é dispensável por Esc — degradação aceita (o conteúdo não cobre nada que não
 * esteja também no próprio card, e sai com o ponteiro).
 */
export function SynopsisEscape() {
  useEffect(() => {
    let hovered: HTMLElement | null = null

    const cardOf = (alvo: EventTarget | null) =>
      alvo instanceof Element ? alvo.closest<HTMLElement>('[data-dcard]') : null

    const liberarSeSaiu = (card: HTMLElement | null) => {
      if (!card || !card.hasAttribute('data-dismissed')) return
      const temFoco = card.contains(document.activeElement)
      if (hovered !== card && !temFoco) card.removeAttribute('data-dismissed')
    }

    const onPointerOver = (evento: PointerEvent) => {
      const card = cardOf(evento.target)
      if (card === hovered) return
      const anterior = hovered
      hovered = card
      liberarSeSaiu(anterior)
    }
    const onPointerLeaveDoc = () => {
      const anterior = hovered
      hovered = null
      liberarSeSaiu(anterior)
    }
    const onFocusOut = (evento: FocusEvent) => {
      const card = cardOf(evento.target)
      // Depois do blur o activeElement ainda é o antigo; espera o foco assentar.
      queueMicrotask(() => liberarSeSaiu(card))
    }
    const onKeyDown = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      const alvo = cardOf(document.activeElement) ?? hovered
      alvo?.setAttribute('data-dismissed', '')
    }

    document.addEventListener('pointerover', onPointerOver)
    document.documentElement.addEventListener('pointerleave', onPointerLeaveDoc)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerover', onPointerOver)
      document.documentElement.removeEventListener('pointerleave', onPointerLeaveDoc)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return null
}
