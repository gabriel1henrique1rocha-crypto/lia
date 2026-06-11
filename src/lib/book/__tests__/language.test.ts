import { describe, it, expect } from 'vitest'
import { LANGUAGES, languageLabel } from '../language'

describe('languageLabel', () => {
  it('traduz códigos ISO 639-1 conhecidos para o rótulo PT', () => {
    expect(languageLabel('pt')).toBe('Português')
    expect(languageLabel('fr')).toBe('Francês')
    expect(languageLabel('en')).toBe('Inglês')
    expect(languageLabel('es')).toBe('Espanhol')
  })

  it('faz fallback para o próprio código quando desconhecido', () => {
    expect(languageLabel('xx')).toBe('xx')
  })

  it('não quebra com string vazia', () => {
    expect(languageLabel('')).toBe('')
  })
})

describe('LANGUAGES', () => {
  it('é exportado e inclui ao menos os idiomas do M1', () => {
    expect(LANGUAGES.pt).toBe('Português')
    expect(LANGUAGES.en).toBe('Inglês')
    expect(LANGUAGES.es).toBe('Espanhol')
    expect(LANGUAGES.fr).toBe('Francês')
  })

  it('usa códigos em minúsculo como chave', () => {
    for (const code of Object.keys(LANGUAGES)) {
      expect(code).toBe(code.toLowerCase())
    }
  })
})
