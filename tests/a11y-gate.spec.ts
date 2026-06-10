import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * TESTE DO PRÓPRIO GATE.
 *
 * Prova que o MESMO pipeline axe usado em a11y.spec.ts REPROVA uma violação
 * crítica deliberada — aqui um `<img>` sem `alt`. O teste fica VERDE porque
 * AFIRMA que a violação é detectada; se um dia a regra parar de pegar isto
 * (config quebrada, axe desatualizado), este teste falha e denuncia o gate cego.
 *
 * É a contraparte permanente da demonstração manual de "pipeline vermelho"
 * descrita em docs/CI.md (branch com violação proposital → Actions vermelho).
 *
 * `page.setContent` injeta o HTML quebrado direto na página — não depende do
 * servidor Next, só do mesmo motor axe do gate real.
 */
test('o gate axe detecta <img> sem alt como violação crítica', async ({ page }) => {
  await page.setContent(`
    <main>
      <h1>Gate self-test</h1>
      <img src="capa-do-livro.jpg" />
    </main>
  `)

  const { violations } = await new AxeBuilder({ page }).analyze()
  const imageAlt = violations.find((v) => v.id === 'image-alt')

  expect(imageAlt, 'axe deveria reportar a regra image-alt para <img> sem alt').toBeDefined()
  expect(imageAlt?.impact, 'image-alt deveria ter impacto critical').toBe('critical')
})
