'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReviewListItem } from '@/lib/review/queries'
import { DiscoveryCard } from './DiscoveryCard'
import { IconNext, IconPause, IconPlay, IconPrev } from './icons'
import { useMounted, useReducedMotion } from './hooks'

/** Velocidade do movimento automático (HOME-12) — ajuste aqui, não no laço. */
export const STRIP_SPEED_PX_PER_S = 28
/** Quanto tempo o movimento espera depois de uma ação manual (HOME-13). */
const MANUAL_HOLD_MS = 900
/** Cards por clique de seta (HOME-16). */
const CARDS_PER_STEP = 2
/** Pausa pelo botão vale para a sessão (C-10). */
const PAUSE_KEY = 'olda:destaques-pausados'

function lerPausa(): boolean {
  try {
    return window.sessionStorage.getItem(PAUSE_KEY) === '1'
  } catch {
    return false
  }
}
function gravarPausa(pausado: boolean) {
  try {
    if (pausado) window.sessionStorage.setItem(PAUSE_KEY, '1')
    else window.sessionStorage.removeItem(PAUSE_KEY)
  } catch {
    /* sessionStorage indisponível (aba privada, bloqueio) — pausa só em memória */
  }
}

/**
 * Faixa "Em destaque" com movimento automático (D-13a, HOME-10..18).
 *
 * SEM JS (e no HTML do servidor): a lista única num viewport rolável — cada
 * card é um link e o Tab rola a faixa sozinho. Nenhum botão aparece antes de
 * montar no cliente (HOME-11): controle que não funciona não vai para a tela.
 *
 * COM JS: rola por `scrollLeft` + `requestAnimationFrame` — e não `transform` —
 * para que o foco por Tab traga o card para a vista (2.4.11). O loop infinito
 * usa um SEGUNDO grupo, montado só no cliente, `aria-hidden` e com links fora
 * do Tab; quando a rolagem passa da largura do primeiro grupo, volta a mesma
 * distância (salto invisível, os dois grupos são idênticos).
 *
 * O movimento para sozinho (sem mexer no botão) com ponteiro sobre a faixa,
 * foco dentro dela, aba oculta, faixa fora da viewport e logo após ação manual;
 * e nunca começa com `prefers-reduced-motion` ou quando a faixa não enche a
 * viewport (HOME-14/15).
 */
export function FeaturedStrip({ reviews }: { reviews: ReviewListItem[] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLUListElement>(null)

  const montado = useMounted()
  const reduzido = useReducedMotion()
  const [transborda, setTransborda] = useState(false)
  // Lido na criação do estado (cliente). O botão só aparece depois de montar,
  // então o HTML do servidor não depende deste valor.
  const [pausado, setPausado] = useState(() => (typeof window === 'undefined' ? false : lerPausa()))

  // Estado do laço em refs: muda a cada quadro/evento e não deve re-renderizar.
  const pos = useRef(0)
  const hover = useRef(false)
  const focoDentro = useRef(false)
  const visivel = useRef(true)
  const manualAte = useRef(0)
  const pausadoRef = useRef(pausado)

  const animando = montado && !reduzido && transborda

  // A faixa enche a viewport? Mede o grupo ORIGINAL (as cópias dobrariam a
  // largura) e reavalia em resize/zoom.
  useEffect(() => {
    const viewport = viewportRef.current
    const group = groupRef.current
    if (!viewport || !group) return
    const medir = () => setTransborda(group.offsetWidth > viewport.clientWidth + 1)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(viewport)
    ro.observe(group)
    return () => ro.disconnect()
  }, [])

  // Faixa fora da viewport ou aba oculta → parado (HOME-13, HOME-33).
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let naTela = true
    const atualizar = () => {
      visivel.current = naTela && document.visibilityState === 'visible'
    }
    const io = new IntersectionObserver(([entrada]) => {
      naTela = entrada?.isIntersecting ?? true
      atualizar()
    })
    io.observe(viewport)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [])

  // O laço. Só existe enquanto `animando`.
  useEffect(() => {
    if (!animando) return
    const viewport = viewportRef.current
    const group = groupRef.current
    if (!viewport || !group) return

    let raf = 0
    let ultimo = 0
    pos.current = viewport.scrollLeft

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = ultimo ? Math.min(t - ultimo, 64) : 16
      ultimo = t
      // Rolagem do usuário (gesto, barra, teclado) vence: adota a posição dele.
      if (Math.abs(viewport.scrollLeft - pos.current) > 2) pos.current = viewport.scrollLeft
      const mover =
        !pausadoRef.current &&
        !hover.current &&
        !focoDentro.current &&
        visivel.current &&
        t > manualAte.current
      if (!mover) return
      const volta = group.offsetWidth
      pos.current += (STRIP_SPEED_PX_PER_S * dt) / 1000
      if (volta > 0 && pos.current >= volta) pos.current -= volta
      viewport.scrollLeft = pos.current
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animando])

  const marcarManual = useCallback(() => {
    manualAte.current = performance.now() + MANUAL_HOLD_MS
  }, [])

  function passo(direcao: -1 | 1) {
    const viewport = viewportRef.current
    const group = groupRef.current
    const primeiro = group?.firstElementChild as HTMLElement | null
    if (!viewport || !group || !primeiro) return
    const gap = parseFloat(getComputedStyle(group).columnGap) || 0
    const distancia = (primeiro.offsetWidth + gap) * CARDS_PER_STEP
    marcarManual()
    if (animando) {
      // Com as cópias montadas, dá a volta sem bater na borda.
      const volta = group.offsetWidth
      if (direcao < 0 && viewport.scrollLeft < distancia) viewport.scrollLeft += volta
      if (direcao > 0 && viewport.scrollLeft >= volta - 1) viewport.scrollLeft -= volta
      pos.current = viewport.scrollLeft
    }
    viewport.scrollBy({ left: direcao * distancia, behavior: reduzido ? 'auto' : 'smooth' })
  }

  /**
   * HOME-17 (2.4.11): o navegador só rola o foco para a vista se o elemento
   * estiver FORA do scrollport — e um card meio escondido sob a máscara de
   * borda conta como "visível". Aqui o card focado é trazido para dentro da
   * área livre (`scroll-padding-inline`), sem animação.
   */
  function trazerFocoParaAVista(alvo: EventTarget | null) {
    const viewport = viewportRef.current
    const item = alvo instanceof Element ? alvo.closest('li') : null
    if (!viewport || !item) return
    const folga = parseFloat(getComputedStyle(viewport).scrollPaddingInlineStart) || 0
    const v = viewport.getBoundingClientRect()
    const c = item.getBoundingClientRect()
    if (c.left < v.left + folga) viewport.scrollLeft -= v.left + folga - c.left
    else if (c.right > v.right - folga) viewport.scrollLeft += c.right - (v.right - folga)
    pos.current = viewport.scrollLeft
  }

  function alternarPausa() {
    const proximo = !pausado
    setPausado(proximo)
    pausadoRef.current = proximo
    gravarPausa(proximo)
  }

  if (reviews.length === 0) return null

  return (
    <section className="lia-strip" aria-labelledby="destaque-titulo">
      <div className="lia-strip__head">
        <h2 id="destaque-titulo" className="lia-strip__title">
          Em destaque
        </h2>
        <div className="lia-strip__tools">
          {animando && (
            // Nome acessível CONTÉM o texto visível (2.5.3).
            <button
              type="button"
              className="lia-ctl"
              onClick={alternarPausa}
              aria-label={pausado ? 'Retomar carrossel' : 'Pausar carrossel'}
            >
              {pausado ? <IconPlay size={18} /> : <IconPause size={18} />}
              <span>{pausado ? 'Retomar' : 'Pausar'}</span>
            </button>
          )}
          {montado && transborda && (
            <>
              <button
                type="button"
                className="lia-ctl lia-ctl--icon"
                onClick={() => passo(-1)}
                aria-label="Destaques anteriores"
              >
                <IconPrev />
              </button>
              <button
                type="button"
                className="lia-ctl lia-ctl--icon"
                onClick={() => passo(1)}
                aria-label="Próximos destaques"
              >
                <IconNext />
              </button>
            </>
          )}
          <a className="lia-more-link" href="#resenhas">
            Ver todas as resenhas
          </a>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="lia-strip__viewport"
        data-masked={transborda ? '' : undefined}
        onPointerEnter={() => (hover.current = true)}
        onPointerLeave={() => (hover.current = false)}
        onFocus={(evento) => {
          focoDentro.current = true
          // No quadro seguinte: o evento de foco chega ANTES da rolagem nativa
          // do navegador, que desfaria o ajuste feito aqui.
          const alvo = evento.target
          requestAnimationFrame(() => trazerFocoParaAVista(alvo))
        }}
        onBlur={(evento) => {
          if (!evento.currentTarget.contains(evento.relatedTarget as Node | null))
            focoDentro.current = false
        }}
        onWheel={marcarManual}
        onTouchStart={marcarManual}
        onKeyDown={marcarManual}
      >
        <ul className="lia-strip__group" ref={groupRef}>
          {reviews.map((review) => (
            <li key={review.id} className="lia-strip__item">
              <DiscoveryCard
                review={review}
                size="lg"
                headingLevel={3}
                instanceId={`destaque-${review.id}`}
              />
            </li>
          ))}
        </ul>
        {animando && (
          <ul className="lia-strip__group" aria-hidden="true" data-clone="">
            {reviews.map((review) => (
              <li key={review.id} className="lia-strip__item">
                <DiscoveryCard
                  review={review}
                  size="lg"
                  headingLevel={3}
                  instanceId={`copia-${review.id}`}
                  inert
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
