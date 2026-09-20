import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { DiscoveryCard, bylineOf, kickerOf } from '../DiscoveryCard'
import { coverArt, ART_TONES } from '../art'
import { resenha } from './fixtures'

/** HOME-19..24 — o card de descoberta. */

function montar(props: Partial<Parameters<typeof DiscoveryCard>[0]> = {}) {
  return render(
    <ul>
      <li>
        <DiscoveryCard
          review={resenha(1)}
          size="sm"
          headingLevel={4}
          instanceId="teste-1"
          withByline
          {...props}
        />
      </li>
    </ul>
  )
}

describe('anatomia (HOME-19)', () => {
  it('título é texto real dentro de um link para a resenha, no nível de heading pedido', () => {
    montar()
    const link = screen.getByRole('link', { name: 'Resenha 1' })
    expect(link).toHaveAttribute('href', '/resenha/resenha-1')
    expect(screen.getByRole('heading', { level: 4 })).toContainElement(link)
  })

  it('kicker "Gênero · Ano" e linha de apoio "Autor · Ano" (C-9)', () => {
    const r = resenha(1)
    expect(kickerOf(r)).toBe('Romance · 1991')
    expect(bylineOf(r)).toBe('Autora 1 · 1991')
    expect(kickerOf({ ...r, book: { ...r.book, genre: null, year: null } })).toBe('')
    montar()
    expect(screen.getByText('Romance · 1991')).toBeInTheDocument()
  })

  it('com capa: <img alt=""> decorativa (o título já é texto)', () => {
    const { container } = montar({
      review: resenha(1, {
        book: { ...resenha(1).book, cover_url: 'https://exemplo.test/c.jpg' },
      }),
    })
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('alt', '')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('sem capa: formas abstratas aria-hidden com tom determinístico pelo id', () => {
    const { container } = montar()
    const svg = container.querySelector('.lia-dcard__shapes')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    const art = container.querySelector('.lia-dcard__art')!
    expect(art.getAttribute('data-tone')).toBe(String(coverArt(resenha(1).id).tone))
  })

  it('a arte é estável e o tom fica sempre em 1..14 (cor mora no CSS, HOME-01)', () => {
    for (let i = 0; i < 200; i++) {
      const a = coverArt(`id-${i}`)
      expect(a).toEqual(coverArt(`id-${i}`))
      expect(a.tone).toBeGreaterThanOrEqual(1)
      expect(a.tone).toBeLessThanOrEqual(ART_TONES)
    }
  })
})

describe('sinopse para leitor de tela (HOME-21/22)', () => {
  it('o link é descrito pela sinopse: meta, termos e trecho', () => {
    montar()
    const link = screen.getByRole('link', { name: 'Resenha 1' })
    expect(link).toHaveAttribute('aria-describedby', 'teste-1-sinopse')
    expect(link).toHaveAccessibleDescription(/Autora 1 · 1991/)
    expect(link).toHaveAccessibleDescription(/Deficiência visual/)
    expect(link).toHaveAccessibleDescription(/Trecho da resenha 1\./)
  })

  it('o título repetido e o "Ler resenha" da sinopse ficam fora da descrição', () => {
    montar()
    const link = screen.getByRole('link', { name: 'Resenha 1' })
    expect(link).not.toHaveAccessibleDescription(/Ler resenha/)
    expect(link).not.toHaveAccessibleDescription(/^Resenha 1/)
  })

  it('sem trecho e sem termo: nenhum aria-describedby', () => {
    montar({ review: resenha(1, { excerpt: '', disabilities: [] }) })
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-describedby')
  })

  it('sem trecho mas com termo: descreve pelos termos', () => {
    montar({ review: resenha(1, { excerpt: '' }) })
    expect(screen.getByRole('link')).toHaveAccessibleDescription(/Deficiência visual/)
  })
})

describe('cópia do loop (HOME-12)', () => {
  it('inerte: sem id, sem descrição, fora do Tab', () => {
    const { container } = montar({ inert: true, instanceId: 'copia-1' })
    const link = container.querySelector('a')!
    expect(link).toHaveAttribute('tabindex', '-1')
    expect(link).not.toHaveAttribute('aria-describedby')
    expect(container.querySelector('[id]')).toBeNull()
  })
})

describe('instâncias da mesma resenha (A-13)', () => {
  it('ids das sinopses não se repetem entre instâncias', () => {
    const { container } = render(
      <ul>
        <li>
          <DiscoveryCard review={resenha(1)} size="lg" headingLevel={3} instanceId="destaque-x" />
        </li>
        <li>
          <DiscoveryCard review={resenha(1)} size="sm" headingLevel={4} instanceId="fileira-0-x" />
        </li>
      </ul>
    )
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('axe', () => {
  it('sem violações no card', async () => {
    const { container } = montar()
    const resultado = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(resultado.violations).toEqual([])
  })
})
