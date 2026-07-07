'use client'

import { useRef, useState, type ReactNode } from 'react'

/**
 * Controle CLIENTE fino do carrossel de destaque (DD-5). Só o comportamento de
 * setas + indicadores vive aqui; os slides são server-rendered e chegam como
 * `children` (composição RSC). SEM TIMER — nunca gira sozinho (LST-16): só
 * avança por clique. Posição anunciada por `role="status"` (LST-17), sem roubar
 * foco. Sem JS, o `<ul>` degrada para lista rolável (scroll-snap no CSS) e os
 * links continuam alcançáveis por teclado — nenhum slide fica preso fora de vista.
 */
export function FeaturedCarouselControls({
  count,
  children,
}: {
  count: number
  children: ReactNode
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)

  function go(delta: number) {
    setIndex((prev) => {
      const next = Math.min(Math.max(prev + delta, 0), count - 1)
      const slide = trackRef.current?.children[next] as HTMLElement | undefined
      slide?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' })
      return next
    })
  }

  return (
    <>
      <div className="lia-featured__viewport">
        <button
          type="button"
          className="lia-featured__nav"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Destaque anterior"
        >
          ‹
        </button>
        <ul className="lia-featured__track" ref={trackRef}>
          {children}
        </ul>
        <button
          type="button"
          className="lia-featured__nav"
          onClick={() => go(1)}
          disabled={index >= count - 1}
          aria-label="Próximo destaque"
        >
          ›
        </button>
      </div>
      <p className="sr-only" role="status">
        Destaque {index + 1} de {count}
      </p>
      <ol className="lia-featured__dots" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="lia-featured__dot" data-active={i === index ? '' : undefined} />
        ))}
      </ol>
    </>
  )
}
