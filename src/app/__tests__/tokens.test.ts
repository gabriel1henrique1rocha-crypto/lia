import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * home-redesign HOME-01 e HOME-03 — contrato dos tokens.
 *
 *  1. Nenhuma cor literal (hex, rgb/rgba, hsl) fora do bloco `@theme` em `src/`.
 *  2. Os pares de uso do spec §7 cumprem 4.5:1 (texto) / 3:1 (não-texto),
 *     calculados a partir dos VALORES dos tokens lidos do CSS — mudar um token
 *     que quebre contraste falha aqui, sem depender de hex copiado no teste.
 */

const RAIZ = resolve(process.cwd(), 'src')
const CSS = readFileSync(join(RAIZ, 'app/globals.css'), 'utf8')

function semComentarios(texto: string) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function blocoTheme(css: string) {
  const inicio = css.indexOf('@theme {')
  const fim = css.indexOf('\n}\n', inicio)
  return { inicio, fim: fim + 2 }
}

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return nome === '__tests__' ? [] : arquivos(caminho)
    return /\.(css|tsx?)$/.test(nome) && !nome.endsWith('.d.ts') ? [caminho] : []
  })
}

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g

describe('HOME-01 — cor literal só no @theme', () => {
  it('nenhum hex/rgb/hsl fora do bloco @theme em src/', () => {
    const achados: string[] = []
    for (const arquivo of arquivos(RAIZ)) {
      if (arquivo.endsWith('database.types.ts')) continue
      let texto = readFileSync(arquivo, 'utf8')
      if (arquivo.endsWith('globals.css')) {
        const { inicio, fim } = blocoTheme(texto)
        texto = texto.slice(0, inicio) + texto.slice(fim)
      }
      for (const m of semComentarios(texto).matchAll(LITERAL)) {
        achados.push(`${arquivo.replace(RAIZ, 'src')}: ${m[0]}`)
      }
    }
    expect(achados).toEqual([])
  })
})

/* ── Contraste a partir dos tokens ─────────────────────────────────────── */

type RGBA = [number, number, number, number]

const theme = CSS.slice(blocoTheme(CSS).inicio, blocoTheme(CSS).fim)

function token(nome: string): RGBA {
  const m = new RegExp(`--color-${nome}:\\s*([^;]+);`).exec(theme)
  if (!m) throw new Error(`token --color-${nome} não encontrado`)
  const valor = m[1].trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(valor)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgb = /^rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)$/.exec(valor)
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], +rgb[4]]
  throw new Error(`formato não suportado: ${valor}`)
}

/** Compõe uma cor translúcida sobre um fundo opaco. */
function sobre([r, g, b, a]: RGBA, [br, bg, bb]: RGBA): RGBA {
  return [a * r + (1 - a) * br, a * g + (1 - a) * bg, a * b + (1 - a) * bb, 1]
}

function luminancia([r, g, b]: RGBA) {
  const canal = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function razao(a: RGBA, b: RGBA) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const BRANCO: RGBA = [255, 255, 255, 1]

// [descrição, frente, fundo, mínimo]
const PARES: [string, () => RGBA, () => RGBA, number][] = [
  ['ink / ground', () => token('ink'), () => token('ground'), 4.5],
  ['ink / band', () => token('ink'), () => token('band'), 4.5],
  ['ink / campo', () => token('ink'), () => token('field'), 4.5],
  ['secundário / ground', () => token('ink-soft'), () => token('ground'), 4.5],
  ['secundário / band', () => token('ink-soft'), () => token('band'), 4.5],
  ['secundário / campo', () => token('ink-soft'), () => token('field'), 4.5],
  ['borda de campo / campo', () => token('ink-field'), () => token('field'), 3],
  ['borda de campo / band', () => token('ink-field'), () => token('band'), 3],
  ['acento / ground', () => token('teal'), () => token('ground'), 4.5],
  ['acento / band', () => token('teal'), () => token('band'), 4.5],
  ['acento / campo', () => token('teal'), () => token('field'), 4.5],
  ['hover / ground', () => token('teal-deep'), () => token('ground'), 4.5],
  ['hover / band', () => token('teal-deep'), () => token('band'), 4.5],
  ['branco / acento', () => token('white'), () => token('teal'), 4.5],
  ['branco / hover', () => token('white'), () => token('teal-deep'), 4.5],
  ['ground / card escuro', () => token('ground'), () => token('night'), 4.5],
  [
    'ground / overlay (pior caso)',
    () => token('ground'),
    () => sobre(token('overlay'), BRANCO),
    4.5,
  ],
  [
    'divisória / overlay (pior caso)',
    () => token('divider'),
    () => sobre(token('overlay'), BRANCO),
    4.5,
  ],
  [
    'ground / scrim .80 (pior caso)',
    () => token('ground'),
    () => sobre(token('scrim-mid'), BRANCO),
    4.5,
  ],
  ['foco / ground', () => token('teal'), () => token('ground'), 3],
  ['foco / band', () => token('teal'), () => token('band'), 3],
  ['erro / band', () => token('red-700'), () => token('band'), 4.5],
  ['sucesso / band', () => token('green-700'), () => token('band'), 4.5],
  ['aviso / band', () => token('amber-700'), () => token('band'), 4.5],
  ['info / band', () => token('blue-700'), () => token('band'), 4.5],
  ...Array.from({ length: 14 }, (_, i): [string, () => RGBA, () => RGBA, number] => [
    `ground / arte ${i + 1}`,
    () => token('ground'),
    () => token(`art-${i + 1}`),
    4.5,
  ]),
]

describe('HOME-03 — contraste dos pares de uso (spec §7)', () => {
  it.each(PARES)('%s', (_, frente, fundo, minimo) => {
    expect(razao(frente(), fundo())).toBeGreaterThanOrEqual(minimo)
  })
})
