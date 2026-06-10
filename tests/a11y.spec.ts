import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * HARD GATE de acessibilidade (INFRA-15).
 * Roda o axe-core nas rotas SSR e reprova com QUALQUER violação de impacto
 * `critical`. Meta: 0 críticos.
 */
const ROUTES = ['/', '/styleguide']

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
