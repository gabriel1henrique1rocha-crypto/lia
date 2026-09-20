'use client'

import { useSyncExternalStore } from 'react'

const semAssinatura = () => () => {}

/**
 * `true` só depois de hidratar. No servidor e na hidratação vale `false` — é o
 * que garante que controles dependentes de JS (setas, pausa) não saiam no HTML
 * do servidor (HOME-11) e que o primeiro render do cliente bata com ele.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false
  )
}

const QUERY = '(prefers-reduced-motion: reduce)'

function assinarMovimento(aviso: () => void) {
  const mq = window.matchMedia?.(QUERY)
  mq?.addEventListener?.('change', aviso)
  return () => mq?.removeEventListener?.('change', aviso)
}

/**
 * `prefers-reduced-motion: reduce`, reagindo AO VIVO à mudança da preferência
 * (HOME-14). No servidor: `false` (nada anima antes de hidratar, de todo modo).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    assinarMovimento,
    () => Boolean(window.matchMedia?.(QUERY).matches),
    () => false
  )
}
