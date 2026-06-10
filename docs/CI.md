# CI — Gates de qualidade (T-09)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em **cada push e cada PR**. São três jobs; `a11y` só começa depois que `test` passa.

| Job     | O que roda                                  | Bloqueia o merge?                          |
| ------- | ------------------------------------------- | ------------------------------------------ |
| `lint`  | ESLint · Prettier `--check` · `tsc --noEmit` | Sim                                        |
| `test`  | Vitest (unidade/componente)                 | Sim                                        |
| `a11y`  | axe-core (Playwright) · Lighthouse CI       | Sim para a11y · **Não** para performance   |

## Hard gates

- **axe — 0 violações críticas.** Roda em `/` e `/styleguide`. Qualquer violação de impacto `critical` reprova. (INFRA-15)
- **Lighthouse Accessibility = 100.** Assert `categories:accessibility >= 1.0`. Abaixo disso reprova. (INFRA-16)

## Medido mas NÃO bloqueante

- **Lighthouse Performance (LCP/CLS).** Coletado e reportado como `warn` (LCP alvo ≤ 2500 ms, CLS ≤ 0,1). Não reprova o pipeline — é instável em runners de CI (decisão registrada na spec). O relatório completo é publicado em `temporary-public-storage`; a URL aparece no log do job `a11y`.

## Rodar os checks localmente

Pré-requisito: `npm ci` (ou `npm install`).

```bash
# Gate de lint (espelha o job `lint`)
npm run lint            # ESLint
npm run format:check    # Prettier
npm run typecheck       # tsc --noEmit

# Testes de unidade/componente (job `test`)
npm test                # vitest run
npm run test:watch      # modo watch durante o desenvolvimento

# Acessibilidade (job `a11y`) — exige um build primeiro
npm run build
ENABLE_STYLEGUIDE=true npm run test:a11y   # axe em / e /styleguide
ENABLE_STYLEGUIDE=true npm run lhci        # Lighthouse (a11y + performance)
```

No Windows PowerShell, defina a flag antes do comando:

```powershell
$env:ENABLE_STYLEGUIDE = 'true'; npm run test:a11y
```

> `test:a11y` e `lhci` sobem `next start`, então precisam de um `npm run build` recente. A rota `/styleguide` só responde 200 com `ENABLE_STYLEGUIDE=true`; sem a flag ela é 404 (protegida em produção).

## Teste do próprio gate

Há duas camadas que comprovam que o gate realmente reprova violações:

### 1. Meta-teste automático (sempre verde)

[`tests/a11y-gate.spec.ts`](../tests/a11y-gate.spec.ts) injeta um `<img>` sem `alt` e **afirma** que o axe reporta `image-alt` como `critical`. Roda em todo CI. Se o gate algum dia ficar cego (config quebrada, regra desativada), este teste fica **vermelho** e denuncia o problema — sem precisar quebrar uma página real.

### 2. Demonstração de pipeline vermelho ponta a ponta

Para ver o Actions ficar **vermelho** de verdade com uma violação numa página servida:

```bash
git switch -c chore/a11y-gate-redtest
```

Adicione uma imagem sem `alt` em [`src/app/page.tsx`](../src/app/page.tsx), por exemplo:

```tsx
{/* VIOLAÇÃO DELIBERADA — só para provar o gate. Remover depois. */}
<img src="/next.svg" />
```

```bash
git commit -am "test(ci): violação a11y deliberada para provar o gate"
git push -u origin chore/a11y-gate-redtest
```

Abra o PR (ou veja o run do push). Resultado esperado:

- Job **`a11y` vermelho** no passo `axe` — `image-alt` é `critical` em `/`.
- Ao remover o `<img>` e dar push de novo → **verde**.

Depois de conferir, descarte a branch:

```bash
git push origin --delete chore/a11y-gate-redtest
git switch main && git branch -D chore/a11y-gate-redtest
```

## Branch protection (configuração no GitHub)

Para que os gates realmente barrem o merge, marcar em **Settings → Branches → Branch protection rules** para `main`:

- _Require status checks to pass before merging_ → selecionar `lint`, `test` e `a11y`.
- _Require branches to be up to date before merging_ (opcional, recomendado).

Isso é configuração de repositório (fora do código) e precisa ser feita uma vez na UI do GitHub após o primeiro run do workflow registrar os checks.
