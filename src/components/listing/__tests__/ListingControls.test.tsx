import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { ListingControls } from '../ListingControls'
import type { ListingParams } from '@/lib/review/listingParams'

const options = {
  genres: [
    { name: 'Romance', slug: 'romance' },
    { name: 'Realismo', slug: 'realismo' },
  ],
  authors: ['Machado de Assis', 'Eça de Queirós'],
}

const params: ListingParams = {
  q: 'dom',
  genero: 'romance',
  autor: '',
  nota: 4,
  ordem: 'nota',
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
    expect(screen.getByLabelText('Buscar por título')).toHaveValue('dom')
    expect(screen.getByLabelText('Gênero')).toHaveValue('romance')
    expect(screen.getByLabelText('Autor')).toHaveValue('')
    expect(screen.getByLabelText('Nota mínima')).toHaveValue('4')
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('nota')
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
