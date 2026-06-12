import { describe, it, expect } from 'vitest'
import { bookInputSchema } from '../schema'

// UUID válido para genreId nos casos felizes.
const GENRE_ID = '550e8400-e29b-41d4-a716-446655440000'
// ISBNs com checksum REAL (verificado) — não os exemplos errados dos specs.
const VALID_ISBN13 = '9783161484100'
const VALID_ISBN10 = '0306406152'

const minimal = { title: 'Dom Casmurro', author: 'Machado de Assis', genreId: GENRE_ID }

describe('bookInputSchema — obrigatórios', () => {
  it('aceita a ficha mínima (title, author, genreId)', () => {
    const r = bookInputSchema.safeParse(minimal)
    expect(r.success).toBe(true)
  })

  it('rejeita quando falta title', () => {
    const r = bookInputSchema.safeParse({ author: 'X', genreId: GENRE_ID })
    expect(r.success).toBe(false)
  })

  it('rejeita quando falta author', () => {
    const r = bookInputSchema.safeParse({ title: 'X', genreId: GENRE_ID })
    expect(r.success).toBe(false)
  })

  it('rejeita quando falta genreId', () => {
    const r = bookInputSchema.safeParse({ title: 'X', author: 'Y' })
    expect(r.success).toBe(false)
  })

  it('rejeita genreId que não é UUID', () => {
    const r = bookInputSchema.safeParse({ ...minimal, genreId: 'não-é-uuid' })
    expect(r.success).toBe(false)
  })

  it('rejeita title só com espaços (trim + min 1)', () => {
    const r = bookInputSchema.safeParse({ ...minimal, title: '   ' })
    expect(r.success).toBe(false)
  })
})

describe('bookInputSchema — ranges numéricos', () => {
  it('rejeita pages = 0', () => {
    const r = bookInputSchema.safeParse({ ...minimal, pages: 0 })
    expect(r.success).toBe(false)
  })

  it('aceita pages = 1', () => {
    const r = bookInputSchema.safeParse({ ...minimal, pages: 1 })
    expect(r.success).toBe(true)
  })

  it('rejeita year futuro', () => {
    const r = bookInputSchema.safeParse({ ...minimal, year: new Date().getFullYear() + 1 })
    expect(r.success).toBe(false)
  })

  it('aceita year passado (1800)', () => {
    const r = bookInputSchema.safeParse({ ...minimal, year: 1800 })
    expect(r.success).toBe(true)
  })
})

describe('bookInputSchema — ISBN (opcional, validado se presente)', () => {
  it('aceita ISBN-13 com checksum válido', () => {
    const r = bookInputSchema.safeParse({ ...minimal, isbn: VALID_ISBN13 })
    expect(r.success).toBe(true)
  })

  it('aceita ISBN-10 com checksum válido', () => {
    const r = bookInputSchema.safeParse({ ...minimal, isbn: VALID_ISBN10 })
    expect(r.success).toBe(true)
  })

  it('rejeita ISBN inválido com mensagem em PT (não só código)', () => {
    const r = bookInputSchema.safeParse({ ...minimal, isbn: '9788535902775' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes('isbn'))
      expect(issue).toBeDefined()
      expect(issue?.message).toMatch(/ISBN/)
    }
  })

  it('aceita quando ISBN é omitido (opcional)', () => {
    const r = bookInputSchema.safeParse(minimal)
    expect(r.success).toBe(true)
  })

  it('aceita ISBN como string vazia (campo deixado em branco)', () => {
    const r = bookInputSchema.safeParse({ ...minimal, isbn: '' })
    expect(r.success).toBe(true)
  })
})

describe('bookInputSchema — consistência de tradução', () => {
  it('rejeita translator sem translatedFrom', () => {
    const r = bookInputSchema.safeParse({ ...minimal, translator: 'Fulano' })
    expect(r.success).toBe(false)
  })

  it('aceita translator com translatedFrom', () => {
    const r = bookInputSchema.safeParse({ ...minimal, translator: 'Fulano', translatedFrom: 'fr' })
    expect(r.success).toBe(true)
  })
})

describe('bookInputSchema — opcionais estruturados', () => {
  it('rejeita coverUrl que não é URL', () => {
    const r = bookInputSchema.safeParse({ ...minimal, coverUrl: 'não-é-url' })
    expect(r.success).toBe(false)
  })

  it('aceita uma ficha completa válida', () => {
    const r = bookInputSchema.safeParse({
      ...minimal,
      publisher: 'Editora Garnier',
      isbn: VALID_ISBN13,
      coverUrl: 'https://example.com/capa.jpg',
      year: 1899,
      pages: 256,
      originalLanguage: 'pt',
    })
    expect(r.success).toBe(true)
  })
})
