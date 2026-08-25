import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Formulário de resenha (T8) em navegador REAL.
 *
 * Duas coisas que o teste de unidade não alcança:
 *   · o **axe** sobre a árvore renderizada de verdade — contraste calculado a
 *     partir do CSS aplicado, nomes acessíveis computados pelo motor, e não pelo
 *     jsdom;
 *   · o **teclado**, que é comportamento: ordem de tabulação, foco visível,
 *     acionar os botões sem mouse.
 *
 * O componente é auditado no `/styleguide` porque as rotas do painel são a T10.
 * Ver `src/app/styleguide/ReviewFormDemo.tsx`.
 *
 * GATE ESTRITO: zero violação de QUALQUER impacto — o mesmo rigor aplicado às
 * rotas de navegação em `a11y.spec.ts`, e não o de "sem críticos" das demais.
 * Um formulário é a superfície onde a acessibilidade mais custa quando falha.
 */

const FORM = '.lia-review-form'

/** Todos os campos, na ordem em que aparecem na tela. */
const CAMPOS_EM_ORDEM = [
  'title',
  'author',
  'genreId',
  'publisher',
  'year',
  'isbn',
  'publicationCity',
  'coverUrl',
  'reviewTitle',
  'body',
  'highlightQuote',
  'tagsInput',
  'keywordsInput',
]

/**
 * Identidade do elemento com foco: `name` para campo, texto para botão.
 * Os dois submits compartilham `name="status"` de propósito (é assim que a
 * escolha viaja como dado), então botão precisa ser identificado pelo rótulo.
 */
function focado(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    if (el.tagName === 'BUTTON') return (el.textContent ?? '').trim()
    return el.getAttribute('name') ?? (el.textContent ?? '').trim()
  })
}

async function irAoFormulario(page: Page) {
  const resposta = await page.goto('/styleguide')
  expect(resposta?.status(), '/styleguide deveria responder 200').toBe(200)
  await expect(page.locator(FORM)).toBeVisible()
}

/** Percorre `passos` tabulações e devolve por onde o foco passou. */
async function tabular(page: Page, passos: number) {
  const trajeto: (string | null)[] = []
  for (let i = 0; i < passos; i++) {
    await page.keyboard.press('Tab')
    trajeto.push(await focado(page))
  }
  return trajeto
}

/**
 * Roda o axe restrito ao formulário e cobra DUAS listas vazias.
 *
 * `violations` é o gate óbvio. `incomplete` é o menos óbvio e igualmente
 * necessário: são as regras que o axe NÃO conseguiu decidir — e uma regra
 * indecidida não é uma regra aprovada, é uma regra que não olhou. O caso real
 * deste formulário: o `<legend>` encaixado no recorte da borda do `<fieldset>`
 * deixava o `color-contrast` incompleto nos dois títulos de grupo, ou seja,
 * exatamente os textos que mais importam ficavam sem medição. Aceitar
 * `incomplete` seria declarar contraste verificado sem tê-lo verificado.
 */
async function auditar(page: Page) {
  const { violations, incomplete } = await new AxeBuilder({ page }).include(FORM).analyze()
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
  expect(
    violations,
    `Violações (${rotulo}):
${detalhar(violations)}`
  ).toHaveLength(0)
  expect(
    incomplete,
    `Regras que o axe não conseguiu decidir (${rotulo}) — não contam como aprovadas:
${detalhar(incomplete)}`
  ).toHaveLength(0)
}

/* ── axe ─────────────────────────────────────────────────────────────────── */

test('axe: formulário em repouso sem NENHUMA violação', async ({ page }) => {
  await irAoFormulario(page)
  exigirLimpo('repouso', await auditar(page))
})

test('axe: formulário em ESTADO DE ERRO sem NENHUMA violação', async ({ page }) => {
  await irAoFormulario(page)

  // Publicar vazio reprova em cascata: obrigatórios + corpo exigido na
  // publicação. É o estado com mais elementos na tela (mensagens, ícones,
  // aria-invalid, live region preenchida) — e o mais fácil de quebrar.
  await page.locator(FORM).getByRole('button', { name: 'Publicar' }).click()
  await expect(page.locator(`${FORM} [role="status"]`)).toHaveText(/Confira os campos/)

  exigirLimpo('estado de erro', await auditar(page))
})

test('axe: formulário com itens repetíveis sem NENHUMA violação', async ({ page }) => {
  await irAoFormulario(page)
  const form = page.locator(FORM)

  await form.getByRole('button', { name: 'Adicionar leitura' }).click()
  await form.getByRole('button', { name: 'Adicionar leitura' }).click()
  await expect(form.getByRole('textbox', { name: 'Endereço do link 2' })).toBeVisible()

  exigirLimpo('itens repetíveis', await auditar(page))
})

/* ── teclado ─────────────────────────────────────────────────────────────── */

test('ordem de tabulação: todos os campos, depois adicionar, depois os dois botões', async ({
  page,
}) => {
  await irAoFormulario(page)

  // Entra pelo primeiro campo e tabula até o último controle do formulário.
  await page.locator(`${FORM} [name="title"]`).focus()
  expect(await focado(page)).toBe('title')

  const trajeto = await tabular(page, CAMPOS_EM_ORDEM.length + 2)

  expect(trajeto).toEqual([
    ...CAMPOS_EM_ORDEM.slice(1),
    'Adicionar leitura',
    'Salvar rascunho',
    'Publicar',
  ])
})

test('a região de status não entra no caminho do Tab (é alvo só de foco programático)', async ({
  page,
}) => {
  await irAoFormulario(page)
  await page.locator(`${FORM} [name="title"]`).focus()

  // Tabular para TRÁS a partir do 1º campo não pode aterrissar na live region.
  await page.keyboard.press('Shift+Tab')
  expect(await focado(page)).not.toBe('')
  await expect(page.locator(`${FORM} [role="status"]`)).not.toBeFocused()
})

test('foco visível em todo controle do formulário', async ({ page }) => {
  await irAoFormulario(page)

  const controles = page.locator(`${FORM} input, ${FORM} textarea, ${FORM} select, ${FORM} button`)
  const total = await controles.count()
  expect(total).toBeGreaterThan(10)

  for (let i = 0; i < total; i++) {
    const controle = controles.nth(i)
    await controle.focus()
    const contorno = await controle.evaluate((el) => {
      const s = getComputedStyle(el)
      return { largura: s.outlineWidth, estilo: s.outlineStyle, cor: s.outlineColor }
    })
    const nome = await controle.evaluate((el) => el.getAttribute('name') ?? el.textContent?.trim())
    // Anel global do @layer base: 3px sólidos em --color-focus-blue (#1f5fd6).
    expect(contorno.estilo, `${nome} sem estilo de outline`).toBe('solid')
    expect(parseFloat(contorno.largura), `${nome} com outline fino demais`).toBeGreaterThanOrEqual(
      2
    )
    expect(contorno.cor, `${nome} com anel fora do token de foco`).toBe('rgb(31, 95, 214)')
  }
})

test('adicionar e remover leitura pelo teclado — o foco tem destino nas duas pontas', async ({
  page,
}) => {
  await irAoFormulario(page)
  const form = page.locator(FORM)

  await form.getByRole('button', { name: 'Adicionar leitura' }).focus()
  await page.keyboard.press('Enter')

  // Item criado E foco já no campo que se vai preencher.
  await expect(form.getByRole('textbox', { name: 'Título do link 1' })).toBeFocused()

  await page.keyboard.type('Ensaio sobre Machado')
  await page.keyboard.press('Tab')
  expect(await focado(page)).toBe('furtherReading.0.url')
  await page.keyboard.type('https://exemplo.org/ensaio')

  await page.keyboard.press('Tab')
  expect(await focado(page)).toBe('Remover leitura 1')

  // Remover o ÚLTIMO item restante: o alvo natural some, e o foco vai para o
  // único controle que sobrou daquela seção — nunca para o <body>.
  await page.keyboard.press('Enter')
  await expect(form.getByRole('textbox', { name: 'Título do link 1' })).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Adicionar leitura' })).toBeFocused()
})

test('remover um item do meio deixa o foco na mesma posição da lista', async ({ page }) => {
  await irAoFormulario(page)
  const form = page.locator(FORM)
  const adicionar = form.getByRole('button', { name: 'Adicionar leitura' })

  for (let i = 0; i < 3; i++) await adicionar.click()
  await expect(form.getByRole('button', { name: 'Remover leitura 3' })).toBeVisible()

  await form.getByRole('button', { name: 'Remover leitura 2' }).focus()
  await page.keyboard.press('Enter')

  await expect(form.getByRole('button', { name: 'Remover leitura 3' })).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Remover leitura 2' })).toBeFocused()
})

test('os dois botões são acionáveis por teclado e anunciam na live region', async ({ page }) => {
  await irAoFormulario(page)
  const form = page.locator(FORM)
  const regiao = form.locator('[role="status"]')

  await expect(regiao).toHaveText('')

  await form.locator('[name="title"]').fill('Dom Casmurro')
  await form.locator('[name="author"]').fill('Machado de Assis')
  await form.locator('[name="genreId"]').selectOption({ label: 'Romance' })

  // Enter no primeiro submit.
  await form.getByRole('button', { name: 'Salvar rascunho' }).focus()
  await page.keyboard.press('Enter')
  await expect(regiao).toHaveText(/rascunho seria salvo/)

  // Espaço no segundo — o outro acionamento nativo de <button>.
  await form.locator('[name="body"]').fill('Corpo real da resenha.')
  await form.getByRole('button', { name: 'Publicar' }).focus()
  await page.keyboard.press('Space')
  await expect(regiao).toHaveText(/seria publicada/)
})

test('falha por teclado leva o foco ao primeiro campo com erro', async ({ page }) => {
  await irAoFormulario(page)
  const form = page.locator(FORM)

  await form.getByRole('button', { name: 'Publicar' }).focus()
  await page.keyboard.press('Enter')

  await expect(form.locator('[name="title"]')).toBeFocused()
  await expect(form.locator('[name="title"]')).toHaveAttribute('aria-invalid', 'true')
  // A mensagem está ligada ao campo, não solta na tela.
  const descrito = await form.locator('[name="title"]').getAttribute('aria-describedby')
  await expect(page.locator(`#${descrito}`)).toHaveText(/obrigatório/i)
})
