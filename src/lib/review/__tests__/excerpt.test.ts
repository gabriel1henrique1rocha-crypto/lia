import { describe, it, expect } from 'vitest'
import { excerpt } from '../excerpt'

describe('excerpt', () => {
  it('retorna string vazia para body nulo ou vazio', () => {
    expect(excerpt(null)).toBe('')
    expect(excerpt('')).toBe('')
    expect(excerpt('   ')).toBe('')
  })

  it('normaliza espaços em branco (quebras/tabs viram espaço único)', () => {
    expect(excerpt('linha um\n\nlinha  dois\ttres')).toBe('linha um linha dois tres')
  })

  it('retorna o texto inteiro quando abaixo do limite', () => {
    expect(excerpt('curto', 160)).toBe('curto')
  })

  it('retorna o texto inteiro quando exatamente no limite (sem reticências)', () => {
    const s = 'a'.repeat(20)
    expect(excerpt(s, 20)).toBe(s)
  })

  it('corta no limite de palavra e acrescenta reticências', () => {
    // 'um dois tres quatro' com max=11 → 'um dois' (última palavra completa) + …
    expect(excerpt('um dois tres quatro', 11)).toBe('um dois…')
  })

  it('faz corte duro quando a primeira palavra excede o limite (sem espaço)', () => {
    expect(excerpt('abcdefghij', 4)).toBe('abcd…')
  })

  it('usa 160 como limite padrão', () => {
    const long = 'palavra '.repeat(40).trim() // ~319 chars
    const out = excerpt(long)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(161) // 160 + reticência
  })
})
