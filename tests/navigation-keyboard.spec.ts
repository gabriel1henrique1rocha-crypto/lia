import { test, expect, type Page } from '@playwright/test'

/**
 * Operação por TECLADO da navegação pública (WCAG 2.1.1 / 2.4.3 / 2.4.7).
 * O axe não cobre nada disto: ordem de tabulação, foco visível de verdade e
 * skip link continuar funcionando são comportamentos, não estrutura.
 */

/** Rótulo acessível do elemento com foco — a "posição" atual do teclado. */
function focusedName(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
  })
}

const NAV_LABELS = [
  'Quem somos',
  'Autores com deficiência',
  'Catálogo',
  'Filmografia',
  'LIACast',
  'Sugestões LIA',
]

test('ordem de tabulação: skip link → marca → os 6 destinos', async ({ page }) => {
  await page.goto('/quem-somos')

  const order: (string | null)[] = []
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    order.push(await focusedName(page))
  }

  expect(order).toEqual(['Ir para o conteúdo principal', 'LIA — página inicial', ...NAV_LABELS])
})

test('o skip link continua pulando o header inteiro', async ({ page }) => {
  await page.goto('/quem-somos')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Ir para o conteúdo principal' })).toBeFocused()

  // Visível ao receber foco (sr-only + focus:not-sr-only) — um skip link
  // que permanece oculto no foco é inútil para quem enxerga e tabula.
  const box = await page.getByRole('link', { name: 'Ir para o conteúdo principal' }).boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(1)
  expect(box?.height ?? 0).toBeGreaterThan(1)

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#main$/)

  // Depois do salto, a próxima parada NÃO pode ser um item do header:
  // o destino é o conteúdo (aqui a página não tem foco tabulável → sai do
  // documento), nunca voltar ao início da navegação.
  await page.keyboard.press('Tab')
  expect(NAV_LABELS).not.toContain(await focusedName(page))
})

test('foco visível em todos os itens do menu', async ({ page }) => {
  await page.goto('/')

  for (const label of NAV_LABELS) {
    const link = page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: label })
    await link.focus()

    const outline = await link.evaluate((el) => {
      const s = getComputedStyle(el)
      return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor }
    })
    // Anel global do @layer base: 3px sólidos em --color-focus-blue (#1f5fd6).
    expect(outline.style, `${label} sem estilo de outline`).toBe('solid')
    expect(parseFloat(outline.width), `${label} com outline fino demais`).toBeGreaterThanOrEqual(2)
    expect(outline.color).toBe('rgb(31, 95, 214)')
  }
})

test('em viewport estreito o menu quebra em linhas e segue inteiro no teclado', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/')

  const links = page.getByRole('navigation', { name: 'Principal' }).getByRole('link')
  await expect(links).toHaveCount(6)

  // Nada de disclosure: nenhum item some nem depende de botão para existir.
  for (const label of NAV_LABELS) {
    await expect(links.filter({ hasText: label }).first()).toBeVisible()
  }
  expect(await page.getByRole('button', { expanded: false }).count()).toBe(0)

  // Quebrou mesmo em mais de uma linha (é este o comportamento escolhido no
  // lugar do hambúrguer) — os itens não estão todos no mesmo `top`.
  const tops = await links.evaluateAll((els) => [
    ...new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))),
  ])
  expect(tops.length).toBeGreaterThan(1)

  // Cada item continua alcançável por Tab, na mesma ordem visual.
  const reached: (string | null)[] = []
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    reached.push(await focusedName(page))
  }
  expect(reached.slice(2)).toEqual(NAV_LABELS)
})

test('aria-current="page" acompanha a rota, um item por vez', async ({ page }) => {
  for (const [path, label] of [
    ['/quem-somos', 'Quem somos'],
    ['/autores', 'Autores com deficiência'],
    ['/', 'Catálogo'],
    ['/filmografia', 'Filmografia'],
    ['/liacast', 'LIACast'],
    ['/sugestoes', 'Sugestões LIA'],
  ] as const) {
    await page.goto(path)
    const nav = page.getByRole('navigation', { name: 'Principal' })
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
    await expect(nav.locator('[aria-current="page"]')).toHaveText(label)
  }
})
