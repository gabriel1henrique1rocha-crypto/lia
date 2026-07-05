import { describe, it, expect } from 'vitest'
import { formatRating } from '../rating'

describe('formatRating', () => {
  it('formata com vírgula decimal pt-BR e 1 casa', () => {
    expect(formatRating(4.5)).toBe('4,5')
  })

  it('preenche a casa decimal em inteiros', () => {
    expect(formatRating(4)).toBe('4,0')
    expect(formatRating(5)).toBe('5,0')
  })

  it('formata o limite inferior', () => {
    expect(formatRating(0)).toBe('0,0')
  })

  it('nunca usa ponto como separador decimal', () => {
    expect(formatRating(3.5)).not.toContain('.')
    expect(formatRating(3.5)).toBe('3,5')
  })
})
