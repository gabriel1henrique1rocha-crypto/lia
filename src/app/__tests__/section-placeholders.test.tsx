import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, cleanup } from '@testing-library/react'
import axe from 'axe-core'
import { PLACEHOLDER_TEXT } from '@/components/nav/SectionPlaceholder'
import { DESTINATIONS } from '@/lib/nav/destinations'

import QuemSomosPage, { metadata as quemSomosMeta } from '../quem-somos/page'
import AutoresPage, { metadata as autoresMeta } from '../autores/page'
import FilmografiaPage, { metadata as filmografiaMeta } from '../filmografia/page'
import LIACastPage, { metadata as liacastMeta } from '../liacast/page'
import SugestoesPage, { metadata as sugestoesMeta } from '../sugestoes/page'

import type { Metadata } from 'next'
import type { ComponentType } from 'react'

type PlaceholderRoute = {
  path: string
  heading: string
  Page: ComponentType
  metadata: Metadata
  file: string
}

const ROUTES: PlaceholderRoute[] = [
  {
    path: '/quem-somos',
    heading: 'Quem somos',
    Page: QuemSomosPage,
    metadata: quemSomosMeta,
    file: 'src/app/quem-somos/page.tsx',
  },
  {
    path: '/autores',
    heading: 'Autores com deficiência',
    Page: AutoresPage,
    metadata: autoresMeta,
    file: 'src/app/autores/page.tsx',
  },
  {
    path: '/filmografia',
    heading: 'Filmografia',
    Page: FilmografiaPage,
    metadata: filmografiaMeta,
    file: 'src/app/filmografia/page.tsx',
  },
  {
    path: '/liacast',
    heading: 'LIACast',
    Page: LIACastPage,
    metadata: liacastMeta,
    file: 'src/app/liacast/page.tsx',
  },
  {
    path: '/sugestoes',
    heading: 'Sugestões LIA',
    Page: SugestoesPage,
    metadata: sugestoesMeta,
    file: 'src/app/sugestoes/page.tsx',
  },
]

describe.each(ROUTES)('placeholder $path', ({ heading, Page, metadata, file }) => {
  it('é Server Component (sem diretiva use client)', () => {
    const src = readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(src).not.toMatch(/^\s*['"]use client['"]\s?;?\s*$/m)
  })

  it('tem um único <h1> com o nome da seção', () => {
    render(<Page />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(heading)
  })

  it('declara o status com o texto exato acordado', () => {
    render(<Page />)
    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeInTheDocument()
    expect(PLACEHOLDER_TEXT).toBe('Esta seção está em construção e será publicada em breve.')
  })

  it('não inventa conteúdo: só o título e a frase de status', () => {
    const { container } = render(<Page />)
    expect(container.textContent).toBe(`${heading}${PLACEHOLDER_TEXT}`)
    expect(container.textContent?.toLowerCase()).not.toContain('lorem')
    // Página declarada e vazia não tem para onde levar — nenhum link morto.
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('tem metadata com title e description próprios', () => {
    expect(metadata.title).toBe(`${heading} · LIA`)
    expect(typeof metadata.description).toBe('string')
    expect((metadata.description as string).length).toBeGreaterThan(0)
  })

  it('NÃO usa noindex: a página é honesta, só está vazia', () => {
    expect(metadata.robots).toBeUndefined()
  })

  it('axe: sem violação', async () => {
    const { container } = render(
      <main>
        <Page />
      </main>
    )
    const results = await axe.run(container)
    expect(results.violations).toEqual([])
  })
})

describe('cobertura do menu', () => {
  it('todo destino do header tem página — os 5 novos aqui, "Resenhas" na home', () => {
    const placeholderPaths = ROUTES.map((r) => r.path)
    const missing = DESTINATIONS.filter((d) => d.href !== '/' && !placeholderPaths.includes(d.href))
    expect(missing).toEqual([])
  })

  it('o <h1> de cada seção repete o rótulo do menu (sem divergência de nome)', () => {
    for (const { path, heading, Page } of ROUTES) {
      const label = DESTINATIONS.find((d) => d.href === path)?.label
      render(<Page />)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading)
      expect(label).toBe(heading)
      cleanup()
    }
  })
})
