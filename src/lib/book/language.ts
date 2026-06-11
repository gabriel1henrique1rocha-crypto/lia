/**
 * Mapa de códigos ISO 639-1 → rótulo legível em português (DD-2).
 *
 * O idioma é armazenado no banco como código ISO 639-1 (`pt`, `fr`, `en`…);
 * a tradução para rótulo acontece só na exibição. `LANGUAGES` também é
 * reutilizado pelos formulários do admin (M2).
 */
export const LANGUAGES: Record<string, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
  la: 'Latim',
  ru: 'Russo',
  ja: 'Japonês',
  zh: 'Chinês',
}

/**
 * Retorna o rótulo PT de um código ISO 639-1. Código desconhecido faz
 * fallback para o próprio código (não quebra a exibição).
 */
export function languageLabel(code: string): string {
  return LANGUAGES[code] ?? code
}
