import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { ListingControls } from '../ListingControls'
import type { ListingParams } from '@/lib/review/listingParams'

const options = {
  genres: [
    { name: 'Romance', slug: 'romance' },
    { name: 'Realismo', slug: 'realismo' },
  ],
  authors: ['Machado de Assis', 'Eça de Queirós'],
  disabilities: [],
}

const params: ListingParams = {
  q: 'dom',
  genero: 'romance',
  autor: '',
  deficiencia: '',
  ordem: 'titulo',
  pagina: 1,
}

describe('ListingControls', () => {
  it('é Server Component (sem diretiva use client)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/listing/ListingControls.tsx'),
      'utf8'
    )
    expect(src).not.toMatch(/^\s*['"]use client['"]\s*;?\s*$/m)
  })

  it('é um form GET com landmark de busca apontando para /', () => {
    const { container } = render(<ListingControls params={params} options={options} />)
    const form = container.querySelector('form')!
    expect(form.getAttribute('method')?.toLowerCase()).toBe('get')
    expect(form.getAttribute('action')).toBe('/')
    expect(screen.getByRole('search')).toBe(form)
  })

  it('todos os controles têm rótulo associado (getByLabelText)', () => {
    render(<ListingControls params={params} options={options} />)
    expect(screen.getByLabelText('Buscar por título ou autor')).toHaveValue('dom')
    expect(screen.getByLabelText('Gênero')).toHaveValue('romance')
    expect(screen.getByLabelText('Autor')).toHaveValue('')
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('titulo')
    // "Nota mínima" saiu com D-11 — o controle não existe mais.
    expect(screen.queryByLabelText('Nota mínima')).toBeNull()
  })

  it('renderiza as opções derivadas do acervo (DD-4)', () => {
    render(<ListingControls params={params} options={options} />)
    const genero = screen.getByLabelText('Gênero')
    expect(genero).toHaveTextContent('Romance')
    expect(genero).toHaveTextContent('Realismo')
    const autor = screen.getByLabelText('Autor')
    expect(autor).toHaveTextContent('Machado de Assis')
    expect(autor).toHaveTextContent('Eça de Queirós')
  })

  it('tem botão de busca primário', () => {
    render(<ListingControls params={params} options={options} />)
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveClass('lia-btn--primary')
  })

  it('axe: sem violação crítica no jsdom', async () => {
    const { container } = render(<ListingControls params={params} options={options} />)
    const results = await axe.run(container)
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical).toEqual([])
  })
})

describe('filtro por deficiência representada (D-12, DIS-07)', () => {
  const comDeficiencias = {
    ...options,
    disabilities: [
      { name: 'Deficiência física', slug: 'deficiencia-fisica' },
      { name: 'TEA', slug: 'tea' },
    ],
  }

  it('aparece como PRIMEIRO select, ao lado da busca, com "Todas" e a pré-seleção da URL', () => {
    const { container } = render(
      <ListingControls params={{ ...params, deficiencia: 'tea' }} options={comDeficiencias} />
    )
    const select = screen.getByLabelText('Deficiência representada')
    expect(select).toHaveValue('tea')
    expect(select).toHaveAttribute('name', 'deficiencia')
    expect(select).toHaveTextContent('Todas as deficiências')
    const primeiroSelect = container.querySelector('form select')
    expect(primeiroSelect).toBe(select)
  })

  it('sem nenhum termo com resenha publicada, o controle não é renderizado', () => {
    render(<ListingControls params={params} options={options} />)
    expect(screen.queryByLabelText('Deficiência representada')).toBeNull()
  })
})

describe('home-redesign — "Mais filtros" e "Limpar" (C-2, HOME-29)', () => {
  it('gênero/autor/ordem ficam num <details> fechado quando nenhum deles está ativo', () => {
    const { container } = render(
      <ListingControls
        params={{ ...params, genero: '', autor: '', ordem: 'recentes' }}
        options={options}
      />
    )
    const details = container.querySelector('details')!
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByText('Mais filtros').tagName).toBe('SUMMARY')
    for (const nome of ['genero', 'autor', 'ordem']) {
      expect(details.querySelector(`[name="${nome}"]`)).not.toBeNull()
    }
  })

  it('abre sozinho quando um filtro escondido está ativo (o filtro aplicado não fica oculto)', () => {
    const { container } = render(<ListingControls params={params} options={options} />)
    expect(container.querySelector('details')).toHaveAttribute('open')
  })

  it('"Limpar" é link para / (funciona sem JS)', () => {
    render(<ListingControls params={params} options={options} />)
    expect(screen.getByRole('link', { name: 'Limpar' })).toHaveAttribute('href', '/')
  })
})
