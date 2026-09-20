'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { DisabilityRow as Row } from '@/lib/review/queries'
import { DiscoveryCard } from './DiscoveryCard'
import { IconNext, IconPrev } from './icons'
import { useReducedMotion } from './hooks'

/** Nome da fileira sem termo (HOME-28, C-4). */
export const OTHER_ROW_TITLE = 'Outras resenhas'

/**
 * Uma fileira da home (HOME-25..28).
 *
 * A ROLAGEM funciona sem JS: a lista mora num wrapper `role="region"` nomeado
 * e focável (`tabIndex=0`) — é assim que teclado sem mouse rola uma área que
 * transborda (axe `scrollable-region-focusable`), e o `<ul>` continua lista
 * (A-7). As SETAS só aparecem depois de montar e só se houver o que rolar.
 */
export function DisabilityRow({ row, index }: { row: Row; index: number }) {
  const titulo = row.term?.name ?? OTHER_ROW_TITLE
  const headingId = useId()
  const regiaoRef = useRef<HTMLDivElement>(null)
  const [transborda, setTransborda] = useState(false)
  const [medido, setMedido] = useState(false)
  const reduzido = useReducedMotion()

  useEffect(() => {
    const regiao = regiaoRef.current
    if (!regiao) return
    const medir = () => {
      setTransborda(regiao.scrollWidth > regiao.clientWidth + 1)
      setMedido(true)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(regiao)
    return () => ro.disconnect()
  }, [])

  function rolar(direcao: -1 | 1) {
    const regiao = regiaoRef.current
    if (!regiao) return
    regiao.scrollBy({
      left: direcao * regiao.clientWidth * 0.8,
      behavior: reduzido ? 'auto' : 'smooth',
    })
  }

  return (
    // `div`, não `section` nomeada: cada fileira como landmark somaria uma dúzia
    // de regiões ao lado da região rolável de mesmo nome (axe landmark-unique).
    // A navegação por heading (h3) já leva a cada fileira (A-8).
    <div className="lia-row">
      <div className="lia-row__head">
        <h3 id={headingId} className="lia-row__title">
          {titulo}
        </h3>
        <div className="lia-row__tools">
          {row.term && (
            // Texto visível "Ver todos" + complemento oculto: nome único por
            // fileira na lista de links, e o visível continua contido (2.5.3).
            <a className="lia-more-link" href={`/?deficiencia=${row.term.slug}`}>
              Ver todos <span className="sr-only">— {titulo}</span>
            </a>
          )}
          {transborda && (
            <>
              <button
                type="button"
                className="lia-ctl lia-ctl--icon"
                onClick={() => rolar(-1)}
                aria-label={`Rolar ${titulo} para trás`}
              >
                <IconPrev />
              </button>
              <button
                type="button"
                className="lia-ctl lia-ctl--icon"
                onClick={() => rolar(1)}
                aria-label={`Rolar ${titulo} para frente`}
              >
                <IconNext />
              </button>
            </>
          )}
        </div>
      </div>
      <div
        ref={regiaoRef}
        className="lia-row__scroller"
        role="region"
        aria-label={titulo}
        // Sem JS (e antes de medir): sempre focável. Medido e sem nada para
        // rolar: sai do Tab — seria uma parada que não faz nada.
        tabIndex={medido && !transborda ? undefined : 0}
      >
        <ul className="lia-row__list">
          {row.reviews.map((review) => (
            <li key={review.id} className="lia-row__item">
              <DiscoveryCard
                review={review}
                size="sm"
                headingLevel={4}
                instanceId={`fileira-${index}-${review.id}`}
                withByline
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
