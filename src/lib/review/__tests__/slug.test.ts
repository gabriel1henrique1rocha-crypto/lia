import { describe, it, expect } from 'vitest'
import { slugify, MAX_SLUG_BASE_LENGTH } from '../slug'

describe('slugify', () => {
  it('normaliza título comum: minúsculas, hífens, sem pontuação', () => {
    expect(slugify('Dom Casmurro')).toBe('dom-casmurro')
    expect(slugify('Dom Casmurro, 50 anos!')).toBe('dom-casmurro-50-anos')
  })

  it('reduz acentuação do português ao ASCII PRESERVANDO a palavra', () => {
    // O ponto é não descartar a letra acentuada: `ação` vira `acao`, não `ao`.
    expect(slugify('Ação e Coração')).toBe('acao-e-coracao')
    expect(slugify('Iracema é uma lenda')).toBe('iracema-e-uma-lenda')
    expect(slugify('Memórias Póstumas')).toBe('memorias-postumas')
    expect(slugify('Açúcar, Ônibus e Cafés')).toBe('acucar-onibus-e-cafes')
    expect(slugify('ÇÃO')).toBe('cao')
  })

  it('colapsa separadores e não deixa hífen nas pontas', () => {
    expect(slugify('  espaços    demais  ')).toBe('espacos-demais')
    expect(slugify('---traços---nas---pontas---')).toBe('tracos-nas-pontas')
    expect(slugify('a / b : c ; d')).toBe('a-b-c-d')
  })

  it('é DETERMINÍSTICO: mesma entrada, mesma saída', () => {
    const titulo = 'Grande Sertão: Veredas'
    const primeira = slugify(titulo)
    for (let i = 0; i < 5; i++) expect(slugify(titulo)).toBe(primeira)
    expect(primeira).toBe('grande-sertao-veredas')
  })

  // ── Casos de borda: todos devolvem '' (o fallback vive no banco) ──────────

  it('título vazio → string vazia', () => {
    expect(slugify('')).toBe('')
  })

  it('só espaços → string vazia', () => {
    expect(slugify('    ')).toBe('')
  })

  it('só símbolos (normaliza para nada) → string vazia', () => {
    expect(slugify('!!! ??? ---')).toBe('')
    expect(slugify('@#$%^&*()')).toBe('')
    expect(slugify('—–…')).toBe('')
  })

  it('NÃO inventa fallback: quem decide o `resenha` é unique_review_slug (0011)', () => {
    // Duplicar a constante aqui criaria dois lugares para mudá-la. Este teste
    // trava a fronteira: se alguém fizer slugify devolver 'resenha', quebra.
    expect(slugify('!!!')).not.toBe('resenha')
    expect(slugify('!!!')).toBe('')
  })

  it('título muito longo → truncado no teto, sem hífen solto na borda', () => {
    const longo = 'palavra '.repeat(40) // 320 chars
    const slug = slugify(longo)
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_BASE_LENGTH)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.startsWith('palavra-palavra')).toBe(true)
  })

  it('truncamento também é determinístico', () => {
    const longo =
      'Um titulo bastante extenso que certamente ultrapassa o teto imposto pela aplicacao inteira'
    expect(slugify(longo)).toBe(slugify(longo))
    expect(slugify(longo).length).toBeLessThanOrEqual(MAX_SLUG_BASE_LENGTH)
  })

  it('título no limite exato NÃO é truncado', () => {
    const exato = 'a'.repeat(MAX_SLUG_BASE_LENGTH)
    expect(slugify(exato)).toHaveLength(MAX_SLUG_BASE_LENGTH)
    expect(slugify(exato)).toBe(exato)
  })

  it('números e mistura alfanumérica são preservados', () => {
    expect(slugify('1984')).toBe('1984')
    expect(slugify('Fahrenheit 451')).toBe('fahrenheit-451')
  })
})
