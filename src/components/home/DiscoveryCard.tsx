import { createElement } from 'react'
import type { ReviewListItem } from '@/lib/review/queries'
import { coverArt } from './art'

export type DiscoveryCardProps = {
  review: ReviewListItem
  /** `lg`: faixa de destaques; `sm`: fileiras e grade de resultados. */
  size: 'lg' | 'sm'
  /** Nível do título — segue a hierarquia de onde o card está (HOME-08). */
  headingLevel: 3 | 4
  /**
   * Prefixo ÚNICO desta instância (HOME-22, A-13): a mesma resenha pode estar
   * no destaque e em várias fileiras, e o `id` da sinopse não pode repetir.
   */
  instanceId: string
  /**
   * Cópia do loop do carrossel (HOME-12): sem `id`, sem `aria-describedby` e
   * fora da ordem de Tab. O `aria-hidden` fica no grupo que a contém.
   */
  inert?: boolean
  /** Linha "autor · ano" abaixo do card (fileiras e grade). */
  withByline?: boolean
}

/** "Gênero · Ano" (C-9), omitindo o que faltar. */
export function kickerOf(review: ReviewListItem): string {
  return [review.book.genre?.name, review.book.year ?? undefined].filter(Boolean).join(' · ')
}

/** "Autor · Ano". */
export function bylineOf(review: ReviewListItem): string {
  return [review.book.author, review.book.year ?? undefined].filter(Boolean).join(' · ')
}

/**
 * Card de descoberta da home (HOME-19..24).
 *
 * Por que NÃO é `'use client'`: é puro (sem estado, sem efeito) e renderiza
 * igual no servidor e no cliente — o carrossel o reutiliza para montar as
 * cópias do loop depois da hidratação. O comportamento de Esc (1.4.13) mora
 * num único ouvinte de documento (`SynopsisEscape`), não em cada card.
 *
 * A SINOPSE fica no DOM desde o SSR, visualmente oculta até hover/foco: assim
 * `aria-describedby` a lê em qualquer estado, e sem JS ela continua acessível
 * ao leitor de tela.
 */
export function DiscoveryCard({
  review,
  size,
  headingLevel,
  instanceId,
  inert = false,
  withByline = false,
}: DiscoveryCardProps) {
  const kicker = kickerOf(review)
  const byline = bylineOf(review)
  const temDescricao = review.excerpt.trim() !== '' || review.disabilities.length > 0
  const synId = inert ? undefined : `${instanceId}-sinopse`
  const cover = review.book.cover_url?.trim()
  const art = coverArt(review.id)

  return (
    <>
      <article className={`lia-dcard lia-dcard--${size}`} data-dcard="">
        <div className="lia-dcard__art" data-tone={cover ? undefined : art.tone}>
          {cover ? (
            // Decorativa: o título é texto real logo abaixo (HOME-19).
            // eslint-disable-next-line @next/next/no-img-element
            <img className="lia-dcard__img" src={cover} alt="" loading="lazy" decoding="async" />
          ) : (
            <svg
              className="lia-dcard__shapes"
              viewBox="0 0 248 352"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
              focusable="false"
            >
              <circle className="lia-dcard__shape-fill" cx={art.cx} cy={art.cy} r={art.r} />
              <circle className="lia-dcard__shape-line" cx={art.cx2} cy={art.cy2} r={art.r2} />
              <path className="lia-dcard__shape-path" d={art.path} />
            </svg>
          )}
        </div>
        <div className="lia-dcard__scrim" aria-hidden="true" />

        <div className="lia-dcard__cap">
          {kicker && <span className="lia-dcard__kicker">{kicker}</span>}
          {createElement(
            `h${headingLevel}`,
            { className: 'lia-dcard__title' },
            <a
              className="lia-dcard__link"
              href={`/resenha/${review.slug}`}
              aria-describedby={synId && temDescricao ? synId : undefined}
              tabIndex={inert ? -1 : undefined}
            >
              {review.title}
            </a>
          )}
        </div>

        <div className="lia-dcard__syn" id={synId}>
          <p className="lia-dcard__syn-title" aria-hidden="true">
            {review.title}
          </p>
          <p className="lia-dcard__syn-meta">{byline}</p>
          {review.disabilities.length > 0 && (
            // Sem aria-label na lista: dentro de uma descrição (aria-describedby)
            // o rótulo SUBSTITUIRIA o texto dos itens no cálculo do nome.
            <ul className="lia-dcard__tags">
              {review.disabilities.map((d) => (
                <li key={d.slug} className="lia-dcard__tag">
                  {d.name}
                </li>
              ))}
            </ul>
          )}
          {review.excerpt.trim() !== '' && <p className="lia-dcard__syn-text">{review.excerpt}</p>}
          <span className="lia-dcard__syn-more" aria-hidden="true">
            Ler resenha →
          </span>
        </div>
      </article>
      {withByline && <p className="lia-dcard__byline">{byline}</p>}
    </>
  )
}
