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

/* ── Capa: as duas variantes ─────────────────────────────────────────────── */

/**
 * O "BLOCO VINHO" — a asserção que o jsdom não consegue fazer.
 *
 * `.lia-card__media` é `width:100%` + `aspect-ratio`, ou seja: NÃO TEM ALTURA
 * PRÓPRIA — tem a altura que a largura do container lhe der. Como o `<article
 * class="lia-review">` da rota não tinha regra de CSS nenhuma (a classe existia,
 * o seletor não), a capa herdava os 1280px do `<main>` e virava **853px** de
 * oxblood-700 sólido acima de qualquer conteúdo.
 *
 * O teto de 320px abaixo não é estético, é a definição operacional de "não
 * domina a página": mais que isso e a capa volta a ocupar mais de um terço da
 * primeira dobra num laptop, que é como o defeito era percebido.
 */
const TETO_CAPA = 320

test('capa SEM cover_url: miniatura, não uma parede de cor', async ({ page }) => {
  await irAoGuia(page)
  const capa = page.locator('#capa-sem-url .lia-card__media')
  await capa.scrollIntoViewIfNeeded()

  const caixa = (await capa.boundingBox())!
  expect(
    caixa.height,
    `A capa sem imagem mede ${Math.round(caixa.height)}px de altura — o defeito de produção media 853px.`
  ).toBeLessThanOrEqual(TETO_CAPA)

  // Proporção de LIVRO (2/3 retrato), não de banner (3/2 paisagem): é o que a
  // faz ler como capa em vez de faixa.
  expect(caixa.height).toBeGreaterThan(caixa.width)
  expect(caixa.height / caixa.width).toBeCloseTo(1.5, 1)
})

test('capa COM cover_url: imagem real, na MESMA caixa da variante sem capa', async ({ page }) => {
  await irAoGuia(page)
  const img = page.locator('#capa-com-url img')
  await img.scrollIntoViewIfNeeded()

  // Carregou de verdade: um src quebrado passaria nas asserções de caixa e
  // esconderia que a variante "com capa" nunca foi exercida.
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true)
  await expect(img).toHaveAttribute('alt', 'Capa de O Nome da Rosa')

  const comCapa = (await img.boundingBox())!
  const semCapa = (await page.locator('#capa-sem-url .lia-card__media').boundingBox())!

  expect(comCapa.height).toBeLessThanOrEqual(TETO_CAPA)
  // Mesma caixa nas duas: a página não muda de altura conforme a capa exista —
  // é o que impede o salto de layout quando as capas chegarem (RVW-12).
  expect(Math.round(comCapa.width)).toBe(Math.round(semCapa.width))
  expect(Math.round(comCapa.height)).toBe(Math.round(semCapa.height))
})

test('axe: capa SEM cover_url — gate estrito', async ({ page }) => {
  await irAoGuia(page)
  exigirLimpo('capa sem cover_url', await auditar(page, '#capa-sem-url'))
})

test('axe: capa COM cover_url — gate estrito', async ({ page }) => {
  await irAoGuia(page)
  await page.locator('#capa-com-url img').scrollIntoViewIfNeeded()
  exigirLimpo('capa com cover_url', await auditar(page, '#capa-com-url'))
})

/* ── Medida de leitura ───────────────────────────────────────────────────── */

test('o texto corrido respeita a largura máxima de leitura', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await irAoGuia(page)

  const paragrafo = page.locator('#corpo-prosa .lia-review__prose > p')
  await paragrafo.scrollIntoViewIfNeeded()

  const { largura, prose } = await paragrafo.evaluate((el) => ({
    largura: el.getBoundingClientRect().width,
    prose: getComputedStyle(el).maxWidth,
  }))

  // 42rem = 672px. Antes do polish o mesmo parágrafo media 1280px.
  expect(prose).toBe('672px')
  expect(largura).toBeLessThanOrEqual(672)
})

test('a medida cai na faixa tipográfica de 45–75 caracteres por linha', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await irAoGuia(page)

  const paragrafo = page.locator('#corpo-prosa .lia-review__prose > p')
  await paragrafo.scrollIntoViewIfNeeded()

  // Mede a largura MÉDIA do caractere na fonte REAL do parágrafo (Newsreader
  // 18px) — contar `ch` do CSS usaria a largura do "0", que numa serifada
  // proporcional não representa o texto corrido.
  const chars = await paragrafo.evaluate((el) => {
    const sonda = document.createElement('span')
    sonda.textContent = '0'.repeat(100)
    sonda.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'
    sonda.style.font = getComputedStyle(el).font
    document.body.appendChild(sonda)
    const larguraChar = sonda.getBoundingClientRect().width / 100
    sonda.remove()
    return el.getBoundingClientRect().width / larguraChar
  })

  expect(
    chars,
    `A linha mede ~${Math.round(chars)} caracteres (antes: ~133).`
  ).toBeGreaterThanOrEqual(45)
  expect(chars).toBeLessThanOrEqual(75)
})

test('a coluna estreita NÃO cria rolagem horizontal em viewport de celular', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await irAoGuia(page)

  const estoura = await page.locator('#corpo-prosa').evaluate((el) => {
    const limite = el.getBoundingClientRect().right
    return [...el.querySelectorAll('*')].some((f) => f.getBoundingClientRect().right > limite + 0.5)
  })
  expect(estoura, 'algum filho do corpo transborda o container a 320px').toBe(false)
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
