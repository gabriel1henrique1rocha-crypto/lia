import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Rotas do painel de resenhas (T10) em navegador real.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE DÁ E O QUE NÃO DÁ PARA AUDITAR AQUI
 *
 * As duas rotas vivem sob `(protected)` e exigem sessão de editor. Abrir uma
 * sessão exige Supabase + Mailpit locais, que o CI não tem (TD-02) — então
 * `page.goto('/admin/resenhas')` responde a tela de LOGIN, não a lista. Duas
 * consequências, ambas tratadas:
 *
 *   1. o que É auditável na rota é o GATE — e ele é auditado aqui, de verdade:
 *      sem sessão, as duas rotas terminam em `/admin/login`. Isso responde
 *      diretamente "o route group cobre estas rotas?";
 *   2. a árvore renderizada da lista é auditada no `/styleguide`, onde os
 *      MESMOS componentes são montados com dados de mentira (mesma saída de
 *      `EditorReviewsTable`/`EmptyReviews`, mesmo CSS, mesmo motor de axe).
 *
 * Fingir que se auditou a rota autenticada seria pior que dizer o que ficou de
 * fora: o gate estrito abaixo vale para o que ele de fato mediu.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GATE ESTRITO (o mesmo que a T8 estabeleceu): `violations = 0` E
 * `incomplete = 0`. Regra que o axe não conseguiu decidir não é regra aprovada.
 */

const LISTA = '#admin-reviews'
const TABELA = `${LISTA} table`

async function auditar(page: Page, escopo: string) {
  const { violations, incomplete } = await new AxeBuilder({ page }).include(escopo).analyze()
  return { violations, incomplete }
}

type Achados = Awaited<ReturnType<typeof auditar>>

function detalhar(itens: Achados['violations'] | Achados['incomplete']) {
  return JSON.stringify(
    itens.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
    null,
    2
  )
}

function exigirLimpo(rotulo: string, { violations, incomplete }: Achados) {
  expect(violations, `Violações (${rotulo}):\n${detalhar(violations)}`).toHaveLength(0)
  expect(
    incomplete,
    `Regras que o axe não conseguiu decidir (${rotulo}) — não contam como aprovadas:\n${detalhar(incomplete)}`
  ).toHaveLength(0)
}

/* ── 1. O route group cobre as rotas ─────────────────────────────────────── */

for (const rota of ['/admin/resenhas', '/admin/resenhas/nova']) {
  test(`sem sessão, ${rota} termina no login — o gate de (protected) cobre a rota`, async ({
    page,
  }) => {
    await page.goto(rota)

    // O que importa não é qual camada barrou (proxy otimista ou o
    // `requireEditor()` do layout, que é a autoritativa) — é que NENHUMA das
    // duas deixou a página do painel renderizar sem sessão.
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/resenhas/i)
  })
}

test('nenhum conteúdo do painel vaza no HTML da resposta sem sessão', async ({ page }) => {
  const resposta = await page.goto('/admin/resenhas')
  const html = (await resposta?.text()) ?? ''

  // Redirect antes de renderizar: o corpo da lista nunca é montado, então nem
  // um título de resenha nem o cabeçalho da tabela aparecem no fio.
  expect(html).not.toContain('Suas resenhas')
  expect(html).not.toContain('Atualizada em')
})

/* ── 2. axe (componentes montados no guia de estilos) ────────────────────── */

test('axe: lista com resenhas sem NENHUMA violação', async ({ page }) => {
  const resposta = await page.goto('/styleguide')
  expect(resposta?.status()).toBe(200)
  await expect(page.locator(TABELA)).toBeVisible()

  exigirLimpo('lista do painel', await auditar(page, LISTA))
})

test('axe: a tabela isolada — cabeçalhos, caption e região rolável', async ({ page }) => {
  await page.goto('/styleguide')
  await expect(page.locator(TABELA)).toBeVisible()

  exigirLimpo('tabela', await auditar(page, TABELA))
})

/* ── 3. Estrutura e cor ──────────────────────────────────────────────────── */

test('a situação é legível SEM cor — texto + estilo de borda distintos', async ({ page }) => {
  await page.goto('/styleguide')
  const tabela = page.locator(TABELA)

  await expect(tabela.getByText('Rascunho')).toBeVisible()
  await expect(tabela.getByText('Publicada')).toBeVisible()

  // Além da cor, a BORDA muda de estilo: sobrevive a monocromático.
  const estilos = await tabela.locator('.lia-status').evaluateAll((els) =>
    els.map((el) => ({
      status: el.getAttribute('data-status'),
      borda: getComputedStyle(el).borderTopStyle,
    }))
  )
  const draft = estilos.find((e) => e.status === 'draft')
  const published = estilos.find((e) => e.status === 'published')
  expect(draft?.borda).toBe('dashed')
  expect(published?.borda).toBe('solid')
  expect(draft?.borda).not.toBe(published?.borda)
})

test('a tabela tem caption e cabeçalhos de linha e de coluna', async ({ page }) => {
  await page.goto('/styleguide')
  const tabela = page.locator(TABELA)

  await expect(tabela.locator('caption')).toHaveText(/Suas resenhas/)
  await expect(tabela.locator('thead th[scope="col"]')).toHaveCount(4)
  await expect(tabela.locator('tbody th[scope="row"]')).toHaveCount(2)
})

/* ── 4. Teclado ──────────────────────────────────────────────────────────── */

test('a região da tabela é alcançável por Tab e tem nome acessível', async ({ page }) => {
  await page.goto('/styleguide')
  const regiao = page.locator(`${LISTA} [role="region"]`)

  await regiao.focus()
  await expect(regiao).toBeFocused()
  await expect(regiao).toHaveAttribute('aria-labelledby', /.+/)

  // Foco visível: o anel global do @layer base (3px sólidos em #1f5fd6).
  const contorno = await regiao.evaluate((el) => {
    const s = getComputedStyle(el)
    return { estilo: s.outlineStyle, largura: s.outlineWidth, cor: s.outlineColor }
  })
  expect(contorno.estilo).toBe('solid')
  expect(parseFloat(contorno.largura)).toBeGreaterThanOrEqual(2)
  expect(contorno.cor).toBe('rgb(31, 95, 214)')
})

test('do fim da tabela chega-se ao link de criar por Tab, e ele é acionável por teclado', async ({
  page,
}) => {
  await page.goto('/styleguide')

  const regiao = page.locator(`${LISTA} [role="region"]`)
  await regiao.focus()

  // Próxima parada depois da tabela: o convite do estado vazio (a única âncora
  // desta seção — não há link por linha, a rota de edição não existe).
  await page.keyboard.press('Tab')
  const focado = page.locator(`${LISTA} a`).first()
  await expect(focado).toBeFocused()
  await expect(focado).toHaveText(/Escrever a primeira resenha/)

  // Enter navega — e cai no gate, provando o alvo e a proteção de uma vez.
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/admin\/login/)
})

/* ── 5. TD-07 — o chrome público nas rotas de /admin ─────────────────────── */

test('TD-07: o header público precede o conteúdo em /admin, mas o skip link o pula', async ({
  page,
}) => {
  await page.goto('/admin/login')

  // O chrome público (header + nav com os 6 destinos) aparece também no painel
  // — é a TD-07, aberta e NÃO corrigida aqui. O que se fixa é que ela não
  // aprisiona o teclado: o skip link continua sendo a primeira parada e pula
  // o header inteiro de uma vez.
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()

  await page.keyboard.press('Tab')
  const pular = page.getByRole('link', { name: 'Ir para o conteúdo principal' })
  await expect(pular).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#main$/)

  // Depois do salto, a próxima parada NÃO é um item do header.
  await page.keyboard.press('Tab')
  const nomeFocado = await page.evaluate(() => (document.activeElement?.textContent ?? '').trim())
  expect(['Quem somos', 'Catálogo', 'Filmografia', 'LIACast', 'Sugestões LIA']).not.toContain(
    nomeFocado
  )
})
