/**
 * Arquitetura de informação pública do LIA — fonte única dos destinos do header.
 *
 * A ORDEM do array é a ordem de leitura/tabulação do menu (WCAG 2.4.3): a mesma
 * no DOM e na tela. Consumido por `SiteNav` (render) e pelos testes (contrato).
 *
 * `Resenhas` aponta para `/` porque a listagem de resenhas do M1 É a home
 * (`src/app/page.tsx`, `<h1>Resenhas</h1>`) — não existe rota `/resenhas` no
 * projeto. Preferimos o destino real a um link morto; quando/se a listagem
 * ganhar rota própria, muda-se só este `href`.
 *
 * Os demais cinco destinos são seções DECLARADAS e ainda vazias: têm rota e
 * página honesta ("em construção"), sem conteúdo fictício e sem `noindex`.
 */
export type Destination = {
  /** Caminho absoluto da rota (sem barra final). */
  href: string
  /** Rótulo visível e nome acessível do link. */
  label: string
}

export const DESTINATIONS: readonly Destination[] = [
  { href: '/quem-somos', label: 'Quem somos' },
  { href: '/autores', label: 'Autores com deficiência' },
  { href: '/', label: 'Resenhas' },
  { href: '/filmografia', label: 'Filmografia' },
  { href: '/liacast', label: 'LIACast' },
  { href: '/sugestoes', label: 'Sugestões LIA' },
] as const

/**
 * A rota atual corresponde a este destino?
 *
 * Comparação EXATA: `aria-current="page"` afirma "esta é a página atual", então
 * marcar um item em uma subpágina (ex.: `/resenha/<slug>`) seria uma afirmação
 * falsa para quem usa leitor de tela. Nenhum destino tem subrotas hoje.
 */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href
}
