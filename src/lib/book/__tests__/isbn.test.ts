import { describe, it, expect } from 'vitest'
import { normalizeIsbn, isValidIsbn10, isValidIsbn13, isValidIsbn, formatIsbn } from '../isbn'

// Fixtures com checksum REAL (verificados):
//   ISBN-13 válido: 9783161484100 (978-3-16-148410-0)
//   ISBN-10 válido: 0306406152 (0-306-40615-2)
//   ISBN-10 válido com X: 080442957X (0-8044-2957-X)
// Os ISBNs de exemplo da task (9788535902775 / 8535902770) têm dígito
// verificador incorreto e por isso são (corretamente) rejeitados.

describe('normalizeIsbn', () => {
  it('remove separadores de um ISBN-13', () => {
    expect(normalizeIsbn('978-85-359-0277-5')).toBe('9788535902775')
  })

  it('remove separadores de um ISBN-10', () => {
    expect(normalizeIsbn('85-359-0277-0')).toBe('8535902770')
  })

  it('preserva o X final do ISBN-10 e coloca em maiúsculo', () => {
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X')
  })

  it('remove espaços e outros separadores arbitrários', () => {
    expect(normalizeIsbn('  978 3 16 148410 0 ')).toBe('9783161484100')
  })

  it('é idempotente', () => {
    const raw = '978-3-16-148410-0'
    expect(normalizeIsbn(normalizeIsbn(raw))).toBe(normalizeIsbn(raw))
  })
})

describe('isValidIsbn13', () => {
  it('aceita um ISBN-13 com checksum correto', () => {
    expect(isValidIsbn13('9783161484100')).toBe(true)
  })

  it('aceita ISBN-13 hifenizado (normaliza antes de validar)', () => {
    expect(isValidIsbn13('978-3-16-148410-0')).toBe(true)
  })

  it('rejeita um ISBN-13 com dígito verificador errado', () => {
    expect(isValidIsbn13('9783161484101')).toBe(false)
  })

  it('rejeita strings com comprimento != 13', () => {
    expect(isValidIsbn13('978316148410')).toBe(false)
    expect(isValidIsbn13('')).toBe(false)
  })

  it('rejeita ISBN-13 contendo X', () => {
    expect(isValidIsbn13('978316148410X')).toBe(false)
  })
})

describe('isValidIsbn10', () => {
  it('aceita um ISBN-10 com checksum correto', () => {
    expect(isValidIsbn10('0306406152')).toBe(true)
  })

  it('aceita ISBN-10 cujo dígito verificador é X', () => {
    expect(isValidIsbn10('080442957X')).toBe(true)
  })

  it('aceita ISBN-10 hifenizado', () => {
    expect(isValidIsbn10('0-306-40615-2')).toBe(true)
  })

  it('rejeita um ISBN-10 com checksum errado', () => {
    expect(isValidIsbn10('0306406153')).toBe(false)
  })

  it('rejeita X fora da última posição', () => {
    expect(isValidIsbn10('03064X6152')).toBe(false)
  })

  it('rejeita strings com comprimento != 10', () => {
    expect(isValidIsbn10('030640615')).toBe(false)
  })
})

describe('isValidIsbn', () => {
  it('aceita ISBN-10 e ISBN-13 válidos', () => {
    expect(isValidIsbn('0306406152')).toBe(true)
    expect(isValidIsbn('9783161484100')).toBe(true)
  })

  it('aceita formatos hifenizados', () => {
    expect(isValidIsbn('978-3-16-148410-0')).toBe(true)
    expect(isValidIsbn('0-8044-2957-X')).toBe(true)
  })

  it('rejeita string vazia sem quebrar', () => {
    expect(isValidIsbn('')).toBe(false)
  })

  it('rejeita comprimentos que não são 10 nem 13', () => {
    expect(isValidIsbn('12345')).toBe(false)
    expect(isValidIsbn('12345678901')).toBe(false)
  })
})

describe('formatIsbn', () => {
  it('hifeniza um ISBN-13 de forma legível', () => {
    const out = formatIsbn('9783161484100')
    expect(out).toContain('-')
    expect(normalizeIsbn(out)).toBe('9783161484100')
  })

  it('hifeniza um ISBN-10 de forma legível', () => {
    const out = formatIsbn('0306406152')
    expect(out).toContain('-')
    expect(normalizeIsbn(out)).toBe('0306406152')
  })

  it('aceita entrada já hifenizada e reformata de forma estável', () => {
    expect(formatIsbn(formatIsbn('9783161484100'))).toBe(formatIsbn('9783161484100'))
  })

  it('retorna o valor normalizado quando o comprimento é desconhecido', () => {
    expect(formatIsbn('12345')).toBe('12345')
  })
})
