import { test, expect, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * home-redesign (D-13) em navegador real — HOME-11..24, 27, 32, 35.
 *
 * Audita os componentes montados com dados FIXOS no /styleguide (#home): no CI
 * o banco é placeholder e a home real cai no estado "indisponível". A home
 * real (`/`) entra só no teste de reflow e no gate de a11y geral.
 */

const GUIA = '/styleguide'
const faixa = (page: Page) => page.locator('#home .lia-strip__viewport')
const botaoPausa = (page: Page) => page.getByRole('button', { name: /carrossel$/ })

/**
 * O card do elemento focado está inteiro dentro da área livre da faixa: entre
 * as bordas menos o `scroll-padding-inline`, que por construção é MAIOR que a
 * máscara (`--strip-focus-gap = --strip-mask + folga`).
 */
async function esperarCardForaDaMascara(page: Page, focado: Locator) {
  await expect(focado).toHaveClass(/lia-dcard__link/)
  const card = focado.locator('xpath=ancestor::article[1]')
  const folga = await faixa(page).evaluate(
    (el) => parseFloat(getComputedStyle(el).scrollPaddingInlineStart) || 0
  )
  expect(folga).toBeGreaterThan(0)
  const v = (await faixa(page).boundingBox())!
  // O ajuste roda no quadro seguinte ao foco (depois da rolagem nativa).
  await expect
    .poll(async () => (await card.boundingBox())!.x)
    .toBeGreaterThanOrEqual(v.x + folga - 1)
  const c = (await card.boundingBox())!
  expect(c.x + c.width).toBeLessThanOrEqual(v.x + v.width - folga + 1)
}

test('axe: seção da home no guia sem NENHUMA violação (incl. contraste)', async ({ page }) => {
  await page.goto(GUIA)
  await expect(page.getByRole('heading', { name: 'Em destaque' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('#home').analyze()
  expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
})

test('movimento automático: a faixa rola sozinha e Pausar a para (HOME-12/13)', async ({
  page,
}) => {
  await page.goto(GUIA)
  await faixa(page).scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0) // ponteiro fora da faixa
  const antes = await faixa(page).evaluate((el) => el.scrollLeft)
  await page.waitForTimeout(1500)
  const depois = await faixa(page).evaluate((el) => el.scrollLeft)
  expect(depois).toBeGreaterThan(antes)

  await botaoPausa(page).click()
  await expect(botaoPausa(page)).toHaveAccessibleName('Retomar carrossel')
  await page.mouse.move(0, 0)
  const parado = await faixa(page).evaluate((el) => el.scrollLeft)
  await page.waitForTimeout(1200)
  expect(await faixa(page).evaluate((el) => el.scrollLeft)).toBe(parado)
})

test('ponteiro sobre a faixa pausa o movimento (HOME-13)', async ({ page }) => {
  await page.goto(GUIA)
  await faixa(page).scrollIntoViewIfNeeded()
  await faixa(page).hover()
  await page.waitForTimeout(300)
  const x = await faixa(page).evaluate((el) => el.scrollLeft)
  await page.waitForTimeout(1200)
  expect(await faixa(page).evaluate((el) => el.scrollLeft)).toBe(x)
})

test('foco por Tab: card inteiro visível além da máscara e movimento parado (HOME-17)', async ({
  page,
}) => {
  await page.goto(GUIA)
  await page.mouse.move(0, 0)
  // Foca o 5º card da faixa pelo teclado a partir do último controle antes dela.
  await page.getByRole('link', { name: 'Ver todas as resenhas' }).focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab')
  const focado = page.locator(':focus')
  await expect(focado).toHaveClass(/lia-dcard__link/)

  await esperarCardForaDaMascara(page, focado)

  const x = await faixa(page).evaluate((el) => el.scrollLeft)
  await page.waitForTimeout(1200)
  expect(await faixa(page).evaluate((el) => el.scrollLeft)).toBe(x)
})

test('a 320px o card focado também fica fora da máscara (HOME-17 + HOME-32)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(GUIA)
  await expect(page.getByRole('button', { name: 'Próximos destaques' })).toBeVisible()
  await page.getByRole('link', { name: 'Ver todas as resenhas' }).focus()
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab')
  await esperarCardForaDaMascara(page, page.locator(':focus'))
})

test('sinopse abre no foco e Esc a dispensa (HOME-21, 1.4.13)', async ({ page }) => {
  await page.goto(GUIA)
  // Esc depende do ouvinte montado no cliente: espera a hidratação (o botão de
  // pausa só existe depois dela).
  await expect(botaoPausa(page)).toBeVisible()
  const link = page.locator('#home .lia-row__list .lia-dcard__link').first()
  await link.focus()
  const sinopse = page.locator('#home .lia-row__list .lia-dcard__syn').first()
  await expect(sinopse).toHaveCSS('opacity', '1')
  await page.keyboard.press('Escape')
  await expect(sinopse).toHaveCSS('opacity', '0')
  // Continua exposta ao leitor de tela.
  await expect(link).toHaveAccessibleDescription(/José Saramago|Darius Marder|Daniel Keyes/)
})

test.describe('prefers-reduced-motion (HOME-14)', () => {
  test('sem pausa, sem cópias e parada', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(GUIA)
    await expect(page.getByRole('button', { name: 'Próximos destaques' })).toBeVisible()
    await expect(botaoPausa(page)).toHaveCount(0)
    await expect(page.locator('#home [data-clone]')).toHaveCount(0)
    await page.mouse.move(0, 0)
    const x = await faixa(page).evaluate((el) => el.scrollLeft)
    await page.waitForTimeout(1200)
    expect(await faixa(page).evaluate((el) => el.scrollLeft)).toBe(x)
  })
})

test.describe('sem JavaScript (HOME-11, HOME-27)', () => {
  test.use({ javaScriptEnabled: false })
  test('lista única, nenhum botão na faixa e nas fileiras; regiões roláveis focáveis', async ({
    page,
  }) => {
    await page.goto(GUIA)
    const home = page.locator('#home')
    await expect(home.locator('[data-clone]')).toHaveCount(0)
    await expect(home.locator('.lia-strip button, .lia-row button')).toHaveCount(0)
    await expect(home.locator('.lia-strip__group .lia-dcard__link')).toHaveCount(10)
    for (const regiao of await home.locator('.lia-row__scroller').all()) {
      await expect(regiao).toHaveAttribute('tabindex', '0')
    }
  })
})

test('reflow a 320px: sem rolagem horizontal da página na home (HOME-32)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  const [scroll, largura] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ])
  expect(scroll).toBeLessThanOrEqual(largura)
})

test('reflow a 320px: seção da home no guia não empurra a página (HOME-32)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto(GUIA)
  const estouro = await page.locator('#home').evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(estouro).toBeLessThanOrEqual(0)
})
