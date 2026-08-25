import { describe, it, expect } from 'vitest'
import { parseListingParams, buildListingHref, escapeLike, PAGE_SIZE } from '../listingParams'
import type { ListingParams } from '../listingParams'

describe('parseListingParams', () => {
  it('aplica defaults quando não há params', () => {
    expect(parseListingParams({})).toEqual({
      q: '',
      genero: '',
      autor: '',
      ordem: 'recentes',
      pagina: 1,
    })
  })

  it('trima e limita o termo de busca a 100 chars', () => {
    expect(parseListingParams({ q: '  dom  ' }).q).toBe('dom')
    expect(parseListingParams({ q: 'x'.repeat(150) }).q).toHaveLength(100)
  })

  // D-11 removeu o filtro por nota. URL antiga com `?nota=4` precisa DEGRADAR
  // sem erro — param desconhecido é ignorado, não quebra a página.
  it('ignora o param `nota` legado (D-11) sem lançar nem vazar a chave', () => {
    const parsed = parseListingParams({ nota: '4' })
    expect(parsed).not.toHaveProperty('nota')
    expect(parsed).toEqual({ q: '', genero: '', autor: '', ordem: 'recentes', pagina: 1 })
  })

  it('ordem: só valores do conjunto, senão default recentes (edge case ?ordem=xyz)', () => {
    expect(parseListingParams({ ordem: 'titulo' }).ordem).toBe('titulo')
    // `nota` saiu do conjunto com D-11 → cai no default, não é aceita.
    expect(parseListingParams({ ordem: 'nota' }).ordem).toBe('recentes')
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
    ordem: 'titulo',
    pagina: 2,
  }

  it('preserva o estado e troca só o override', () => {
    const href = buildListingHref(base, { pagina: 3 })
    expect(href).toContain('q=dom')
    expect(href).toContain('genero=romance')
    expect(href).toContain('autor=Machado')
    expect(href).toContain('ordem=titulo')
    expect(href).toContain('pagina=3')
  })

  it('omite chaves em default (q vazio, ordem recentes, pagina 1)', () => {
    const href = buildListingHref({
      q: '',
      genero: '',
      autor: '',
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
