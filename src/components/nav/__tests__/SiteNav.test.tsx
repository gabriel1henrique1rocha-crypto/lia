import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { SiteNav } from '../SiteNav'
import { DESTINATIONS } from '@/lib/nav/destinations'

// `usePathname` só existe dentro do router do App Router — mockado para dirigir
// a rota ativa em cada caso de teste.
const pathname = vi.hoisted(() => ({ value: '/' }))
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}))

beforeEach(() => {
  pathname.value = '/'
})

/** Um <nav> nomeado é um landmark: `getByRole('navigation', { name })`. */
function nav() {
  return screen.getByRole('navigation', { name: 'Principal' })
}

describe('SiteNav', () => {
  it('é um landmark de navegação único e nomeado', () => {
    render(<SiteNav />)
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(nav()).toBeInTheDocument()
  })

  it('expõe os 6 destinos, na ordem, com os hrefs corretos', () => {
    render(<SiteNav />)
    const links = within(nav()).getAllByRole('link')

    expect(links).toHaveLength(6)
    expect(links.map((a) => a.textContent)).toEqual([
      'Quem somos',
      'Autores com deficiência',
      'Resenhas',
      'Filmografia',
      'LIACast',
      'Sugestões LIA',
    ])
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/quem-somos',
      '/autores',
      '/', // a listagem de resenhas do M1 É a home — não existe rota /resenhas
      '/filmografia',
      '/liacast',
      '/sugestoes',
    ])
  })

  it('a ordem visível do menu é a ordem da fonte única de destinos', () => {
    render(<SiteNav />)
    const links = within(nav()).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(DESTINATIONS.map((d) => d.href))
  })

  it.each(DESTINATIONS.map((d) => [d.href, d.label] as const))(
    'em %s marca apenas "%s" com aria-current="page"',
    (href, label) => {
      pathname.value = href
      render(<SiteNav />)

      const marked = within(nav())
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'page')

      expect(marked).toHaveLength(1)
      expect(marked[0]).toHaveAccessibleName(label)
    }
  )

  it('a página atual continua sendo um link (não perde a parada de tabulação)', () => {
    pathname.value = '/liacast'
    render(<SiteNav />)
    const current = within(nav()).getByRole('link', { name: 'LIACast' })
    expect(current).toHaveAttribute('href', '/liacast')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  it('em rota fora do menu nenhum item é marcado como atual', () => {
    pathname.value = '/resenha/alguma-resenha'
    render(<SiteNav />)
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current')
    }
  })

  it('axe: sem violação', async () => {
    render(
      <>
        <SiteNav />
        <main>
          <h1>Conteúdo</h1>
        </main>
      </>
    )
    const results = await axe.run(document.body)
    expect(results.violations).toEqual([])
  })
})
