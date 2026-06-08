# infra-foundation — Tasks

**Spec**: [spec.md](spec.md) · **Design**: [design.md](design.md) · **Status**: Ready to execute
**Milestone**: M0 — Fundação · **Stack**: Next.js (App Router) + React + TypeScript + Tailwind v4 + Supabase
> Documentação em português; nomes de feature, schema, identificadores e código em inglês.

---

## Dependency Graph

```
T-01 (scaffold)
 ├── T-02 (supabase env+client) ─── T-03 (migrations)   [P com T-04→T-05]
 └── T-04 (token layer) ─────────── T-05 (font+layout)
                                          │
                                        T-06 (base components)
                                         ├── T-07 (styleguide)  [P]
                                         └── T-08 (placeholder) [P]
                                                    │
                                                  T-09 (CI)
                                                    │
                                                  T-10 (deploy Vercel)
```

**Grupos de execução paralela:**
- Grupo 2: T-02 `[P]` T-04 (ambos dependem só de T-01)
- Grupo 3: T-03 `[P]` T-05 (T-03↩T-02; T-05↩T-04)
- Grupo 5: T-07 `[P]` T-08 (ambos dependem de T-06)

---

## Requirement → Task Mapping

| Req | Task(s) |
| --- | --- |
| INFRA-01 | T-01 |
| INFRA-02 | T-01 |
| INFRA-03 | T-05, T-08 |
| INFRA-04 | T-02 |
| INFRA-05 | T-03 |
| INFRA-06 | T-03 |
| INFRA-07 | T-04 |
| INFRA-08 | T-04 |
| INFRA-09 | T-04 |
| INFRA-10 | T-05 |
| INFRA-11 | T-06 |
| INFRA-12 | T-06 |
| INFRA-13 | T-06 |
| INFRA-14 | T-09 |
| INFRA-15 | T-07, T-09 |
| INFRA-16 | T-07, T-09 |
| INFRA-17 | T-10 |

**Coverage:** 17/17 requisitos mapeados ✅

---

## Tasks

### T-01 — Scaffold Next.js + dependências

| | |
| --- | --- |
| **Reqs** | INFRA-01, INFRA-02 |
| **Depends on** | — (ponto de partida) |
| **Where** | `/` (raiz do repo) |
| **Status** | `pending` |

**What**: Inicializar o projeto Next.js com App Router, TypeScript strict, ESLint, Tailwind v4 e instalar todas as dependências que as tasks seguintes exigem.

```bash
npx create-next-app@latest . \
  --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
```

Após o scaffold, instalar as dependências adicionais de uma vez:

```bash
npm install @supabase/supabase-js zod lucide-react
npm install -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/jest-dom jsdom \
  @playwright/test @axe-core/playwright \
  @lhci/cli prettier eslint-config-prettier
```

Configurar Prettier (`.prettierrc`) e garantir que `tsconfig.json` tem `"strict": true`. Adicionar script `"format:check": "prettier --check ."` ao `package.json`.

**Done when**:
1. `npm run dev` serve em `localhost:3000` sem erro.
2. `npm run build` conclui sem erros de tipo nem de build.
3. `npm run lint` (ESLint) sai com código 0.
4. `npx tsc --noEmit` sai com código 0.
5. `package.json` lista: `next`, `react`, `typescript`, `tailwindcss` (v4), `@supabase/supabase-js`, `zod`, `lucide-react`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`.
6. `tsconfig.json` tem `"strict": true`.

**Gate**: `npm run build && npm run lint`

---

### T-02 — Supabase env + client tipado `[P com T-04]`

| | |
| --- | --- |
| **Reqs** | INFRA-04 |
| **Depends on** | T-01 |
| **Where** | `src/lib/env.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/database.types.ts`, `supabase/` |
| **Status** | `pending` |

**What**: Inicializar o projeto Supabase (CLI), criar o módulo `env.ts` com validação zod e os clientes tipados (browser + server).

```bash
npx supabase init   # cria supabase/ com config.toml
```

**`src/lib/env.ts`** — valida com zod no import (falha explícita no boot):
```typescript
import { z } from 'zod'
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1).optional(),
})
export const env = schema.parse(process.env)
```

**`src/lib/supabase/client.ts`** — browser, anon key, tipado com `Database`.
**`src/lib/supabase/server.ts`** — server, cookies / service-role, tipado com `Database`.
**`src/lib/database.types.ts`** — skeleton vazio (será substituído após T-03 por `supabase gen types`):
```typescript
export type Database = { public: { Tables: Record<string, never>; Enums: Record<string, never> } }
```
**`.env.local.example`** — template com as três vars documentadas.

**Done when**:
1. `npx tsc --noEmit` passa sem erros nos três arquivos lib.
2. Iniciar o app sem `.env.local` → erro legível nomeando a variável ausente (não `undefined` silencioso).
3. `supabase/config.toml` existe na raiz.
4. `src/lib/database.types.ts` exporta o tipo `Database`.

**Gate**: `npx tsc --noEmit`

---

### T-03 — Migrations: schema + RLS `[P com T-05]`

| | |
| --- | --- |
| **Reqs** | INFRA-05, INFRA-06 |
| **Depends on** | T-02 |
| **Where** | `supabase/migrations/`, `src/lib/database.types.ts` |
| **Status** | `pending` |

**What**: Criar a migration SQL com as 6 entidades, enums, relações, constraints, índices, trigger `updated_at` e RLS deny-by-default. Regenerar `database.types.ts` após aplicar.

Arquivo: `supabase/migrations/0001_core_schema.sql` com o SQL consolidado do design (seção Data Models), incluindo:
- Enums: `review_status`, `comment_status`, `editor_role` (criação guardada via `DO $$`)
- Tabelas: `genre`, `book`, `editor`, `review`, `comment`, `recommendation` com todos os campos, FKs, checks, unique, índices e trigger
- RLS: `ALTER TABLE … ENABLE ROW LEVEL SECURITY` em todas as 6 tabelas; sem `CREATE POLICY` (deny-by-default)

Após aplicar (`supabase db push` ou `supabase start`), regenerar os tipos:
```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

**Done when**:
1. `supabase db push` (ou `supabase start` + push) conclui sem erro.
2. As 6 tabelas (`genre`, `book`, `editor`, `review`, `comment`, `recommendation`) existem no schema `public`.
3. Inspecionar: `review.book_id` tem constraint `UNIQUE`; `recommendation` tem `UNIQUE(review_id, voter_hash)`.
4. `INSERT` de voto duplicado (mesmo `review_id` + `voter_hash`) → rejeitado pelo banco com `unique_violation`.
5. `SELECT * FROM review` sem role / com anon key → `0 rows` (RLS negando — sem política pública).
6. `SELECT rolname FROM pg_roles` → RLS listado como `ENABLED` em todas as tabelas.
7. `src/lib/database.types.ts` regenerado contém as 6 tabelas; `npx tsc --noEmit` passa.
8. Reaplicar a migration num schema limpo → idempotente (sem erro de "já existe").

**Gate**: `npx tsc --noEmit` (após regenerar types)

---

### T-04 — Token layer: `globals.css` `[P com T-02]`

| | |
| --- | --- |
| **Reqs** | INFRA-07, INFRA-08, INFRA-09 |
| **Depends on** | T-01 |
| **Where** | `src/app/globals.css` |
| **Status** | `pending` |

**What**: Portar os tokens de `docs/design/lia-tokens.css` para o CSS de entrada do Tailwind v4, corrigindo os dois defeitos apontados na spec (espacamento e foco).

Estrutura de `globals.css`:

```css
@import "tailwindcss";

/* 1. @theme — primitivas que geram utilities */
@theme {
  /* Cores (paper/ink/oxblood/red/green/amber/blue/focus) */
  --color-paper-50: …; …

  /* Tipografia */
  --font-display: var(--font-spectral), Georgia, serif;
  --font-body:    var(--font-newsreader), Georgia, serif;
  --font-ui:      var(--font-ibm-plex-sans), system-ui, sans-serif;
  --text-xs: …; --text-xs--line-height: …; …  /* xs..4xl */
  --font-weight-regular: 400; …
  --tracking-tight: …; --leading-tight: …;

  /* Raio, sombra, container */
  --radius-sm: …; …
  --shadow-card: …; …
  --container-sm: …; …

  /* Spacing (DD-2): desliga escala dinâmica; chaves 0..9 + target-min */
  --spacing: initial;
  --spacing-0: 0px;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 24px;
  --spacing-6: 32px;
  --spacing-7: 48px;
  --spacing-8: 64px;
  --spacing-9: 96px;
  --spacing-target-min: 2.75rem;
}

/* 2. :root — aliases semânticos (não geram utilities) */
:root {
  --surface-page: …; --surface-card: …; …
  --text-strong: …; --text-body: …; --text-link: …; …
  --border-subtle: …; …
  --action-primary-bg: …; --action-primary-fg: …; …
  --feedback-error: …; …
  --focus-ring: var(--color-focus-blue-500);
  --focus-ring-width: 3px;
  --focus-ring-offset-width: 2px;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms; --duration-base: 250ms;
}

/* 3. @layer base — foco global corrigido (INFRA-09) */
@layer base {
  :where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: var(--focus-ring-offset-width);
    /* SEM border-radius — outline segue o raio intrínseco do elemento */
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

**Done when**:
1. `@theme` declarado em `globals.css` sem nenhum hex duplicado em outro arquivo da `src/` (verificar: `grep -rE '#[0-9a-fA-F]{3,6}' src/ --include="*.css" --include="*.ts" --include="*.tsx" | grep -v globals.css` → nenhum resultado).
2. Tailwind resolve `p-5` = 24px, `p-8` = 64px (valores do token, não os defaults 20px/32px).
3. Regra `:focus-visible` em `@layer base` **não** contém `border-radius`.
4. Aliases semânticos (ex: `--surface-page`, `--text-link`) declarados em `:root`.
5. `@media (prefers-reduced-motion)` zera durações.
6. `npm run build` continua passando.

**Gate**: `npm run build`

---

### T-05 — Font layer + `layout.tsx` raiz `[P com T-03]`

| | |
| --- | --- |
| **Reqs** | INFRA-03 (parcial), INFRA-10 |
| **Depends on** | T-04 |
| **Where** | `src/app/layout.tsx` |
| **Status** | `pending` |

**What**: Integrar as 3 famílias self-hosted via `next/font/google` em `layout.tsx`; configurar `<html lang="pt-BR">`, skip link e `<main id="main">`.

```tsx
import { Spectral, Newsreader, IBM_Plex_Sans } from 'next/font/google'

const spectral = Spectral({
  subsets: ['latin'], weight: ['500','600','700'],
  display: 'swap', variable: '--font-spectral',
})
const newsreader = Newsreader({
  subsets: ['latin'], weight: ['400'],
  display: 'swap', variable: '--font-newsreader',
})
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'], weight: ['400','500','600'],
  display: 'swap', variable: '--font-ibm-plex-sans',
})

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${spectral.variable} ${newsreader.variable} ${ibmPlexSans.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-ink-900">
          Ir para o conteúdo principal
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  )
}
```

**Done when**:
1. `<html>` tem `lang="pt-BR"`.
2. Skip link é o 1º elemento focável; Tab na página revela o link "Ir para o conteúdo principal" visualmente.
3. `<main id="main">` envolve o conteúdo.
4. Aba Network (DevTools): fontes Spectral, Newsreader e IBM Plex Sans servidas do próprio domínio (sem `fonts.googleapis.com`).
5. `next/font/google` com `display: 'swap'` + fallback métrico automático → CLS ≈ 0 (Lighthouse CLS < 0,1).
6. `npx tsc --noEmit` passa.

**Gate**: `npx tsc --noEmit && npm run build`

---

### T-06 — Componentes base: Button, Field, Link, Card

| | |
| --- | --- |
| **Reqs** | INFRA-11, INFRA-12, INFRA-13 |
| **Depends on** | T-05 (layout e tokens prontos) |
| **Where** | `src/components/ui/Button.tsx`, `Field.tsx`, `Link.tsx`, `Card.tsx`, `index.ts`; `src/app/globals.css` (adicionar `@layer components`) |
| **Status** | `pending` |

**What**: Portar o CSS de componentes de `docs/design/lia-components.css` para `@layer components` em `globals.css` e encapsular em componentes React tipados com `forwardRef`. Usar **apenas tokens** e Lucide para ícones.

**`Button.tsx`**
- Props: `variant: 'primary'|'secondary'|'ghost'`, `size: 'sm'|'md'|'lg'` (md = 44px alvo via `--spacing-target-min`), slot de ícone (`icon?`, `iconPosition?`)
- Estado desabilitado: `aria-disabled` (sem remover foco); classe `.lia-btn--disabled` opaca
- Ícone: `aria-hidden="true"` quando decorativo

**`Field.tsx`**
- Props: `label`, `id`, `error?`, `helpText?`, `as?: 'input'|'textarea'|'select'` (default `input`)
- Estado de erro: `aria-invalid="true"` no controle + mensagem `role="alert"` + ícone `AlertCircle` (`aria-hidden`) **e** texto (nunca só cor) + `aria-describedby` ligando controle↔mensagem
- Select: chevron `ChevronDown` decorativo (`aria-hidden`)

**`Link.tsx`**
- Sempre sublinhado (`.lia-link` com `text-decoration: underline`)
- Variante `quiet` (sem underline por padrão, underline no hover — uso restrito)
- Prop `external?: boolean`: adiciona ícone `ExternalLink` (`aria-hidden`) e `target="_blank" rel="noopener noreferrer"`

**`Card.tsx`**
- Variantes: `outline|raised|flat`
- Quando `href` fornecido: renderiza como `<a>` focável com foco visível (usa anel global de T-04)
- Sub-partes: `media`, `body`, `eyebrow`, `title`, `excerpt`, `footer`

**Testes Vitest** (`src/components/ui/__tests__/`):
- `Button.test.tsx`: renderiza; variante/tamanho aplicam classes; `aria-disabled` quando desabilitado
- `Field.test.tsx`: label associado; estado de erro expõe `aria-invalid` + `role="alert"`; ícone `aria-hidden`
- `Link.test.tsx`: tem `text-decoration: underline`; `external` adiciona `ExternalLink` aria-hidden
- `Card.test.tsx`: com `href` renderiza como `<a>` focável

**Done when**:
1. `src/components/ui/index.ts` exporta `Button`, `Field`, `Link`, `Card`.
2. `Button` md: alvo tátil ≥ 44px (CSS `min-height: var(--spacing-target-min)` + `min-width`).
3. `Field` em erro: `aria-invalid="true"`, `role="alert"` na mensagem, ícone `aria-hidden`.
4. `Link`: `text-decoration: underline` visível por default.
5. `Card` com `href`: elemento `<a>`, foco por teclado exibe anel visível.
6. Todos os ícones Lucide têm `aria-hidden="true"` (decorativos) ou rótulo acessível (semânticos).
7. `npx vitest run` passa (sem falhas).
8. `npx tsc --noEmit` passa.

**Gate**: `npx vitest run && npx tsc --noEmit`

---

### T-07 — Styleguide page `[P com T-08]`

| | |
| --- | --- |
| **Reqs** | INFRA-11 (validação visual), INFRA-15, INFRA-16 (alvo das auditorias) |
| **Depends on** | T-06 |
| **Where** | `src/app/styleguide/page.tsx` |
| **Status** | `pending` |

**What**: Criar página de demonstração SSR que renderiza cada componente base em estados-chave. É o **alvo principal das auditorias axe e Lighthouse CI** (CI roda contra `/styleguide`).

Conteúdo mínimo:
- `Button`: variantes primary/secondary/ghost; tamanhos sm/md/lg; estado desabilitado; com ícone
- `Field`: default; com `helpText`; **em estado de erro** (prop `error` setada — para testar `role="alert"`)
- `Field` textarea e select (com chevron)
- `Link`: default (sublinhado); `external`; `quiet`
- `Card`: outline; raised; clicável (com `href`) — para testar foco por teclado

A página deve:
- Ter `<h1>` "Guia de estilos" e seções com `<h2>` por componente (hierarquia correta)
- Renderizar sem JS (SSR — Next.js App Router page.tsx = server component por padrão)
- Ser acessível sem erros axe críticos

**Done when**:
1. `GET /styleguide` retorna 200 e renderiza os 4 componentes.
2. Navegar por teclado (Tab): todos os elementos interativos recebem foco com anel visível.
3. `Field` em erro: `role="alert"` audível no leitor de tela; `aria-invalid` detectado pelo axe.
4. `Card` clicável: Tab alcança o card, Enter/Space ativa o link.
5. axe manual (extensão ou script) → **0 issues críticos**.
6. Lighthouse Accessibility → **100** (ou ≥ 95 na primeira rodada manual).
7. `npm run build` passa.

**Gate**: `npm run build` (verificação manual de a11y antes do CI)

---

### T-08 — Placeholder page `[P com T-07]`

| | |
| --- | --- |
| **Reqs** | INFRA-03 |
| **Depends on** | T-05, T-06 |
| **Where** | `src/app/page.tsx` |
| **Status** | `pending` |

**What**: Substituir o placeholder padrão do create-next-app por uma página acessível conforme as ACs da spec (INFRA-03).

```tsx
export default function HomePage() {
  return (
    <>
      <h1>LIA</h1>
      <p>Leituras e impressões anotadas.</p>
    </>
  )
}
```

A lógica de `<html lang="pt-BR">`, skip link e `<main id="main">` já vem do `layout.tsx` (T-05). O `page.tsx` só precisa entregar conteúdo limpo com hierarquia de headings correta.

**Done when**:
1. `GET /` retorna 200; `<html lang="pt-BR">` presente.
2. Tab na página: skip link "Ir para o conteúdo principal" aparece visualmente; Enter pula para `#main`.
3. `<main>` landmark presente; `<h1>` é o único heading de nível 1.
4. Sem erros axe críticos (verificar com extensão).
5. Renderiza conteúdo com JS desabilitado (SSR).
6. `npm run build` limpo sem erros de tipo.

**Gate**: `npm run build`

---

### T-09 — CI: GitHub Actions (lint + test + a11y)

| | |
| --- | --- |
| **Reqs** | INFRA-14, INFRA-15, INFRA-16 |
| **Depends on** | T-07, T-08 (páginas precisam existir antes do workflow as testar) |
| **Where** | `.github/workflows/ci.yml`, `lighthouserc.js` (ou `.lighthouserc.json`) |
| **Status** | `pending` |

**What**: Criar o workflow de CI com 3 jobs que rodam em paralelo exceto `a11y` (que depende de `test`). Configurar branch protection no GitHub para exigir os checks antes do merge.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npx prettier --check .
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx vitest run

  a11y:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      - run: npx start-server-and-test 'npm start' http://localhost:3000 'npx playwright test'
      - run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

**`lighthouserc.js`**:
```js
module.exports = {
  ci: {
    collect: { url: ['http://localhost:3000', 'http://localhost:3000/styleguide'], startServerCommand: 'npm start' },
    assert: { assertions: { 'categories:accessibility': ['error', { minScore: 1.0 }] } },
    upload:  { target: 'temporary-public-storage' },
  },
}
```

**Playwright test** (`tests/a11y.spec.ts`) que roda axe em `/` e `/styleguide`:
```typescript
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('homepage a11y', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
})

test('styleguide a11y', async ({ page }) => {
  await page.goto('/styleguide')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
})
```

**Done when**:
1. Workflow dispara em todo PR contra `main`.
2. Job `lint`: ESLint + Prettier + tsc — falha em qualquer um reprova o pipeline.
3. Job `test`: Vitest — falha em qualquer teste reprova.
4. Job `a11y`: issue crítico no axe em `/` ou `/styleguide` → `fail`; Lighthouse Accessibility < 100 → `fail`.
5. PR com violação a11y deliberada (ex: `<img>` sem `alt`) → pipeline vermelho no passo axe; corrigir → verde.
6. Status dos checks rastreável ao commit no GitHub (check marks na UI de PR).
7. Branch protection em `main` configurada: todos os 3 checks obrigatórios antes do merge.

**Gate**: push de PR de teste com violação → pipeline falha no step a11y

---

### T-10 — Deploy inicial na Vercel

| | |
| --- | --- |
| **Reqs** | INFRA-17 |
| **Depends on** | T-09 (CI verde antes do primeiro deploy de produção) |
| **Where** | Vercel dashboard + `vercel.json` (se necessário) |
| **Status** | `pending` · P2 (não bloqueia dev local) |

**What**: Conectar o repositório à Vercel, configurar variáveis de ambiente e validar o deploy ponta a ponta.

Passos:
1. Importar o repo em `vercel.com/new`.
2. Configurar env vars no projeto Vercel (ambiente **Production** e **Preview**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Disparar o primeiro deploy (push em `main` ou via "Redeploy" na dashboard).
4. Após o build verde, auditar a URL de produção.

**Done when**:
1. URL de produção da Vercel responde com 200 e renderiza o placeholder.
2. `<html lang="pt-BR">` presente na URL de produção.
3. Fontes self-hosted: aba Network na URL de produção → sem requisições para `fonts.googleapis.com`.
4. axe na URL de produção → 0 issues críticos.
5. Lighthouse Accessibility na URL de produção → ≥ 95 (100 ideal).
6. Push em `main` dispara deploy automático sem intervenção manual.

**Gate**: axe + Lighthouse contra a URL de produção

---

## Status Summary

| Task | Reqs | Depends | Parallel | Status |
| --- | --- | --- | --- | --- |
| T-01 Scaffold | INFRA-01,02 | — | — | `pending` |
| T-02 Supabase env | INFRA-04 | T-01 | [P] T-04 | `pending` |
| T-03 Migrations | INFRA-05,06 | T-02 | [P] T-05 | `pending` |
| T-04 Token layer | INFRA-07,08,09 | T-01 | [P] T-02 | `pending` |
| T-05 Font layer | INFRA-03p,10 | T-04 | [P] T-03 | `pending` |
| T-06 Base components | INFRA-11,12,13 | T-05 | — | `pending` |
| T-07 Styleguide | INFRA-15,16 (alvo) | T-06 | [P] T-08 | `pending` |
| T-08 Placeholder | INFRA-03 | T-05,T-06 | [P] T-07 | `pending` |
| T-09 CI workflow | INFRA-14,15,16 | T-07,T-08 | — | `pending` |
| T-10 Deploy Vercel | INFRA-17 | T-09 | — | `pending` |

**Total:** 10 tasks · 17 requisitos cobertos · 0 não mapeados ✅
