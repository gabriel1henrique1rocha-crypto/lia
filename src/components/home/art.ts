/**
 * Arte do fallback sem capa (HOME-19, A-5) — formas abstratas determinísticas.
 *
 * Mesma resenha → mesmo desenho em qualquer lugar da página (destaque, fileira,
 * grade) e em qualquer render (servidor e cliente), porque tudo deriva de um
 * hash do id. As CORES não moram aqui: `tone` é um índice 1..14 que o CSS
 * traduz para `--color-art-N` (HOME-01: nenhum hex fora do `@theme`).
 */

export const ART_TONES = 14

export type CoverArt = {
  tone: number
  cx: number
  cy: number
  r: number
  cx2: number
  cy2: number
  r2: number
  path: string
}

/** FNV-1a de 32 bits — estável, sem dependência, suficiente para variar a arte. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Geometria no viewBox 248×352 (proporção do card grande do protótipo). */
export function coverArt(id: string): CoverArt {
  const i = hash(id)
  const cx = 40 + (i % 170)
  const cy = 70 + ((i >>> 8) % 110)
  const y0 = 150 + ((i >>> 16) % 60)
  return {
    tone: (i % ART_TONES) + 1,
    cx,
    cy,
    r: 60 + ((i >>> 4) % 60),
    cx2: Math.round(248 - cx * 0.6),
    cy2: cy + 60,
    r2: 30 + ((i >>> 12) % 40),
    path: `M-10 ${y0} C 70 ${y0 - 70}, 170 ${y0 + 70}, 260 ${y0 - 20}`,
  }
}
