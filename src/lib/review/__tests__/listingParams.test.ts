import { describe, it, expect } from 'vitest'
import { parseListingParams, buildListingHref, escapeLike, PAGE_SIZE } from '../listingParams'
import type { ListingParams } from '../listingParams'

describe('parseListingParams', () => {
  it('aplica defaults quando não há params', () => {
    expect(parseListingParams({})).toEqual({
      q: '',
      genero: '',
      autor: '',
      nota: null,
      ordem: 'recentes',
      pagina: 1,
    })
  })

  it('trima e limita o termo de busca a 100 chars', () => {
    expect(parseListingParams({ q: '  dom  ' }).q).toBe('dom')
    expect(parseListingParams({ q: 'x'.repeat(150) }).q).toHaveLength(100)
  })

  it('nota: aceita inteiro 1–5, senão null (edge case ?nota=abc / fora de faixa)', () => {
    expect(parseListingParams({ nota: '4' }).nota).toBe(4)
    expect(parseListingParams({ nota: '1' }).nota).toBe(1)
    expect(parseListingParams({ nota: 'abc' }).nota).toBeNull()
    expect(parseListingParams({ nota: '0' }).nota).toBeNull()
    expect(parseListingParams({ nota: '6' }).nota).toBeNull()
    expect(parseListingParams({ nota: '3.9' }).nota).toBe(3) // parseInt trunca; ainda 1–5
  })

  it('ordem: só valores do conjunto, senão default recentes (edge case ?ordem=xyz)', () => {
    expect(parseListingParams({ ordem: 'nota' }).ordem).toBe('nota')
    expect(parseListingParams({ ordem: 'titulo' }).ordem).toBe('titulo')
    expect(parseListingParams({ ordem: 'xyz' }).ordem).toBe('recentes')
  })

  it('pagina: inteiro ≥ 1, senão 1 (edge case ?pagina=abc / negativa)', () => {
    expect(parseListingParams({ pagina: '999' }).pagina).toBe(999)
    expect(parseListingParams({ pagina: 'abc' }).pagina).toBe(1)
    expect(parseListingParams({ pagina: '-2' }).pagina).toBe(1)
    expect(parseListingParams({ pagina: '0' }).pagina).toBe(1)
  })

  it('usa o primeiro valor quando o param vem como array', () => {
    expect(parseListingParams({ q: ['a', 'b'] }).q).toBe('a')
  })

  it('nunca lança para entradas hostis', () => {
    expect(() => parseListingParams({ nota: ['x'], pagina: [], ordem: undefined })).not.toThrow()
  })
})

describe('buildListingHref', () => {
  const base: ListingParams = {
    q: 'dom',
    genero: 'romance',
    autor: 'Machado',
    nota: 4,
    ordem: 'nota',
    pagina: 2,
  }

  it('preserva o estado e troca só o override', () => {
    const href = buildListingHref(base, { pagina: 3 })
    expect(href).toContain('q=dom')
    expect(href).toContain('genero=romance')
    expect(href).toContain('autor=Machado')
    expect(href).toContain('nota=4')
    expect(href).toContain('ordem=nota')
    expect(href).toContain('pagina=3')
  })

  it('omite chaves em default (q vazio, ordem recentes, pagina 1)', () => {
    const href = buildListingHref({
      q: '',
      genero: '',
      autor: '',
      nota: null,
      ordem: 'recentes',
      pagina: 1,
    })
    expect(href).toBe('/')
  })

  it('override para pagina 1 remove o param pagina', () => {
    expect(buildListingHref(base, { pagina: 1 })).not.toContain('pagina=')
  })
})

describe('escapeLike (segurança de curinga — ordem importa)', () => {
  it('escapa % para literal', () => {
    expect(escapeLike('50%')).toBe('50\\%')
  })

  it('escapa _ para literal', () => {
    expect(escapeLike('a_b')).toBe('a\\_b')
  })

  it('escapa a barra invertida PRIMEIRO (não duplica os escapes seguintes)', () => {
    expect(escapeLike('100\\')).toBe('100\\\\')
    // '\%' de entrada → '\\' (barra) + '\%' (percent) = '\\\%'
    expect(escapeLike('\\%')).toBe('\\\\\\%')
  })

  it('termo limpo passa inalterado', () => {
    expect(escapeLike('dom casmurro')).toBe('dom casmurro')
    expect(escapeLike('')).toBe('')
  })
})

describe('PAGE_SIZE', () => {
  it('é 12 (divisível por 2/3/4)', () => {
    expect(PAGE_SIZE).toBe(12)
  })
})
