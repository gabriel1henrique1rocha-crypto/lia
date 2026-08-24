import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * HARD GATE de acessibilidade (INFRA-15).
 * Roda o axe-core nas rotas SSR e reprova com QUALQUER violação de impacto
 * `critical`. Meta: 0 críticos.
 */
const ROUTES = [
  '/',
  '/styleguide',
  '/admin/login',
  '/quem-somos',
  '/autores',
  '/filmografia',
  '/liacast',
  '/sugestoes',
]

/**
 * Rotas da nova arquitetura de informação (public-navigation) + home.
 * Gate MAIS DURO que o geral: ZERO violação de QUALQUER impacto — são páginas
 * de estrutura pura (header/nav/h1/parágrafo), não há desculpa para nenhuma.
 */
const NAV_ROUTES = ['/', '/quem-somos', '/autores', '/filmografia', '/liacast', '/sugestoes']

for (const route of ROUTES) {
  test(`axe: ${route} sem violações críticas`, async ({ page }) => {
    const response = await page.goto(route)

    // Sem isto o axe analisaria a página de erro (5xx) e passaria em falso —
    // a rota precisa responder OK antes de auditar acessibilidade.
    expect(response?.status(), `${route} deveria responder 200`).toBe(200)

    const { violations } = await new AxeBuilder({ page }).analyze()
    const critical = violations.filter((v) => v.impact === 'critical')

    // A mensagem inclui o detalhe das violações para diagnóstico direto no log do CI.
    expect(
      critical,
      `Violações críticas em ${route}:\n${JSON.stringify(
        critical.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })),
        null,
        2
      )}`
    ).toHaveLength(0)
  })
}

for (const route of NAV_ROUTES) {
  test(`axe: ${route} sem NENHUMA violação`, async ({ page }) => {
    const response = await page.goto(route)
    expect(response?.status(), `${route} deveria responder 200`).toBe(200)

    // O header público é o mesmo em toda rota; conferir que ele chegou evita
    // um "verde" auditando uma página sem a navegação que se quer testar.
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()

    const { violations } = await new AxeBuilder({ page }).analyze()
    expect(
      violations,
      `Violações em ${route}:\n${JSON.stringify(
        violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
        })),
        null,
        2
      )}`
    ).toHaveLength(0)
  })
}
