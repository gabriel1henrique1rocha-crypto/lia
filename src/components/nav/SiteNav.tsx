'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DESTINATIONS, isCurrent } from '@/lib/nav/destinations'

/**
 * Navegação principal do site público — landmark `navigation` ÚNICO e NOMEADO
 * (`aria-label="Principal"`), com os 6 destinos da arquitetura de informação.
 *
 * Cliente por um motivo só: `usePathname()` para marcar a página atual com
 * `aria-current="page"` (WCAG 2.4.8). Não busca dados nem tem estado próprio.
 *
 * Sem menu hambúrguer: em viewport estreito a lista QUEBRA EM LINHAS (flex-wrap
 * no CSS). Todos os itens ficam sempre no DOM, sempre alcançáveis por Tab, na
 * mesma ordem visual — nada de `aria-expanded`, foco preso ou Esc para acertar.
 *
 * A página atual continua sendo um link (não vira texto): quem navega por
 * teclado não perde a parada de tabulação, e o estado é anunciado pelo
 * `aria-current`, não pela remoção do link.
 *
 * O indicador da página atual NÃO depende só de cor (WCAG 1.4.1): soma peso
 * semibold e sublinhado grosso à mudança de cor.
 */
export function SiteNav() {
  const pathname = usePathname()

  return (
    <nav className="lia-site-nav" aria-label="Principal">
      <ul className="lia-site-nav__list">
        {DESTINATIONS.map(({ href, label }) => {
          const current = isCurrent(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                className="lia-site-nav__link"
                aria-current={current ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
