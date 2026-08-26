import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Campos novos da resenha pública (T11/T12) em navegador real.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ONDE ISTO RODA, E POR QUÊ NÃO EM `/resenha/[slug]`
 *
 * A rota depende de uma resenha PUBLICADA no banco, e o servidor do gate a11y
 * sobe com credenciais de placeholder (TD-02: o CI não tem Supabase). Ir à rota
 * daria 404, não a página. Então:
 *
 *   · os COMPONENTES novos são auditados aqui, no `/styleguide`, com o CSS de
 *     verdade — é o único lugar onde `color-contrast` pode ser calculado;
 *   · a PÁGINA INTEIRA (ordem de headings, listas, landmarks, degradação com e
 *     sem os campos) é auditada em jsdom, no teste de unidade da rota, que roda
 *     o mesmo axe-core sobre a árvore que a rota produz.
 *
 * Nenhum dos dois sozinho cobre tudo; juntos cobrem, e a divisão está dita em
 * vez de disfarçada.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GATE ESTRITO (padrão da T8): `violations = 0` E `incomplete = 0`. Regra que o
 * axe não conseguiu decidir não é regra aprovada.
 */

const SECAO = '#review-public'

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

async function irAoGuia(page: Page) {
  const resposta = await page.goto('/styleguide')
  expect(resposta?.status(), '/styleguide deveria responder 200').toBe(200)
  await expect(page.locator(SECAO)).toBeVisible()
}

/* ── axe ─────────────────────────────────────────────────────────────────── */

test('axe: campos novos da resenha sem NENHUMA violação', async ({ page }) => {
  await irAoGuia(page)
  exigirLimpo('campos novos da resenha', await auditar(page, SECAO))
})

test('axe: a ficha COM cidade de publicação segue limpa', async ({ page }) => {
  await irAoGuia(page)

  // A ficha completa do guia agora traz `publication_city` — a linha nova entra
  // na mesma `<dl>`, então o que se audita é que ela não quebrou o par dt/dd.
  const ficha = page.locator('#ficha')
  await expect(ficha.getByText('Cidade de publicação')).toBeVisible()

  exigirLimpo('ficha com cidade de publicação', await auditar(page, '#ficha'))
})

test('axe: a ficha SEM cidade de publicação segue limpa (caso de produção)', async ({ page }) => {
  await irAoGuia(page)

  // A ficha mínima do guia não tem cidade: nenhum `<dt>` órfão deve sobrar.
  const minima = page.locator('#ficha .lia-card', { hasText: 'Iracema' })
  await expect(minima.getByText('Cidade de publicação')).toHaveCount(0)

  exigirLimpo('ficha sem cidade de publicação', await auditar(page, '#ficha'))
})

/* ── Frase de destaque ───────────────────────────────────────────────────── */

test('a figura do destaque tem NOME ACESSÍVEL vindo da legenda', async ({ page }) => {
  await irAoGuia(page)

  // Esta é a asserção que o jsdom não consegue fazer: o `dom-accessibility-api`
  // não implementa `figcaption` como fonte de nome. O Chromium implementa — e é
  // o nome que responde "citação de quê?" antes de a frase ser lida.
  const figura = page.locator(`${SECAO} figure`)
  await expect(figura).toHaveAccessibleName('Trecho em destaque')
  await expect(page.getByRole('figure', { name: 'Trecho em destaque' })).toHaveCount(1)
})

test('o destaque é um blockquote — e não finge atribuição que não existe', async ({ page }) => {
  await irAoGuia(page)
  const figura = page.locator(`${SECAO} figure`)

  await expect(figura.locator('blockquote')).toHaveCount(1)
  await expect(figura.locator('cite')).toHaveCount(0)
  // Não é escondido do leitor de tela: pode ser conteúdo único, não só eco.
  await expect(figura.locator('[aria-hidden="true"]')).toHaveCount(0)
})

/* ── Tags ────────────────────────────────────────────────────────────────── */

test('as tags são lista semântica e NÃO prometem filtro (D-12)', async ({ page }) => {
  await irAoGuia(page)
  const tags = page.locator(`${SECAO} .lia-review-tags`)

  await expect(tags.getByRole('listitem')).toHaveCount(3)
  await expect(tags.locator('a')).toHaveCount(0)
  await expect(tags.locator('button, [role="button"], [role="link"]')).toHaveCount(0)

  // Nem a APARÊNCIA insinua clique: sem cursor de mão, sem sublinhado.
  const estilos = await tags
    .locator('li')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return { cursor: s.cursor, decoracao: s.textDecorationLine }
    })
  expect(estilos.cursor).not.toBe('pointer')
  expect(estilos.decoracao).toBe('none')
})

test('a seção de tags é nomeada pelo próprio heading', async ({ page }) => {
  await irAoGuia(page)
  await expect(page.getByRole('region', { name: 'Tags' })).toHaveCount(1)
})

/* ── Assinatura ──────────────────────────────────────────────────────────── */

test('a assinatura é inequívoca: diz que é da RESENHA, não do livro', async ({ page }) => {
  await irAoGuia(page)
  const secao = page.locator(SECAO)

  await expect(secao.getByText('Resenha por Ana Ribeiro')).toBeVisible()
  // A linha vizinha atribui a OBRA com relação explícita — os dois nomes de
  // pessoa não podem ficar a um travessão de parecerem o mesmo papel.
  await expect(secao.getByText('de Umberto Eco')).toBeVisible()
  await expect(secao.locator('cite')).toHaveText('O Nome da Rosa')
})

test('assinatura e obra se distinguem por mais do que a posição', async ({ page }) => {
  await irAoGuia(page)

  const pesos = await page
    .locator(`${SECAO} .lia-review__byline, ${SECAO} .lia-review__subject`)
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).fontWeight))

  // Duas linhas seguidas com nome de pessoa: se fossem visualmente idênticas,
  // a única pista da diferença seria a ordem — que ninguém lê como hierarquia.
  expect(new Set(pesos).size).toBeGreaterThan(1)
})
