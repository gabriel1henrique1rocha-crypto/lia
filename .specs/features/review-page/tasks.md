# review-page — Tasks

**Spec**: [spec.md](spec.md) · **Design**: [design.md](design.md) · **Context**: [context.md](context.md) · **Status**: Draft
**Milestone**: M1 — Núcleo de leitura pública · **Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Supabase
> Documentação em português; nomes de feature, schema, identificadores e código em inglês.
> Numeração global contínua: infra-foundation `T-01..T-10`, book-data `T-11..T-22`, review-page **`T-23..T-31`**.
> Acessibilidade **não é task separada** (C-2 / decisão do usuário): o critério WCAG 2.1 AA está embutido no `Done when` de cada task de UI.

---

## Dívida registrada — TD-03 (severidade Alta) permanece ABERTA

> A migration **T-23 (`0005`) concede GRANT apenas à tabela `review`.** Isso **NÃO fecha a TD-03**.
> O GRANT explícito das demais tabelas (`comment`, `recommendation`, `editor`) e do `service_role`/Data API
> continua pendente e **precisa ser resolvido antes do M2 (`reviews-crud`)**, senão o caminho anon/Data API
> dessas tabelas falha com `42501` (pós-2026-05-30, policy RLS não basta sem GRANT de tabela).
> **Rastro:** manter TD-03 em `STATE.md` como blocker aberto; a conclusão da review-page não a resolve.

---

## Dependency Graph

```
Phase 1 (paralelo — nenhuma dependência entre si):
  T-23 [P] (migration 0005 — policy + grant review)
  T-24 [P] (seed.sql — 4 published + 5º book/review draft)
  T-25 [P] (review/queries.ts — getPublishedReviewBySlug + cache())
  T-26 [P] (rating.ts + Rating.tsx)
  T-27 [P] (BookCover.tsx + .lia-card__media--type)
  T-28 [P] (not-found.tsx — 404 acessível)
  T-29 [P] (layout.tsx — metadataBase)

Phase 2 (após Phase 1):
  T-30 (page.tsx — rota + generateMetadata + <article>)  ← T-25, T-26, T-27, T-28, T-29
  T-31 (rls.integration.test.ts)                          ← T-23, T-24
```

**Grupos de execução paralela:**
- Grupo 1: `T-23 [P] T-24 [P] T-25 [P] T-26 [P] T-27 [P] T-28 [P] T-29 [P]` — sete arquivos independentes, nenhum compartilha estado mutável nem arquivo.
- Grupo 2: `T-30` e `T-31` — não compartilham arquivo; T-31 é o único teste de integração de DB (não paralelo-inseguro com outros testes de DB porque é o único). Podem rodar em paralelo.

---

## Requirement → Task Mapping

| Req | Descrição curta | Task(s) |
| --- | --- | --- |
| RVW-01 | Rota `/resenha/[slug]` SSR | T-30 |
| RVW-02 | 404 slug inexistente (UI acessível) | T-28, T-30 |
| RVW-03 | 404 resenha `draft` | T-25 (filtro), T-30 (notFound), T-31 (verif.) |
| RVW-04 | Busca por `slug` com join `book`+`genre` tipada | T-25 |
| RVW-05 | Página sob `<main>`; fornece o `<article>` | T-30 |
| RVW-06 | Título da resenha como `<h1>` | T-30 |
| RVW-07 | Ficha reusando `BookDetails` (`headingLevel=3`) | T-30 |
| RVW-08 | Nota numérica pt-BR, só exibição, acessível (C-1) | T-26 |
| RVW-09 | Nota nula → bloco omitido | T-26 (contrato), T-30 (omissão) |
| RVW-10 | Texto em parágrafos semânticos + `body` vazio gracioso | T-30 |
| RVW-11 | Capa tipográfica de fallback com alt acessível | T-27 |
| RVW-12 | Não processar imagem real (escopo `storage-covers`) | T-27 |
| RVW-13 | RLS policy `SELECT` filtrada por `status='published'` | T-23, T-25 (filtro app-side), T-31 (verif.) |
| RVW-14 | GRANT SELECT em `review` (TD-03) | T-23, T-31 (verif.) |
| RVW-15 | Escrita fechada + RLS habilitado + idempotência | T-23, T-31 (verif.) |
| RVW-16 | Seed 1 resenha publicada por livro (4), 1—1 `book` | T-24 |
| RVW-17 | Seed: slug único, rating plausível, body em §, idempotente, editor_id nulo | T-24 |
| RVW-18 | Seed 1 resenha `draft` (5º book de teste) | T-24 |
| RVW-19 | SEO `generateMetadata` (title + meta description) | T-30 |
| RVW-20 | SEO Open Graph (title/description/type/url absoluta) | T-29 (metadataBase), T-30 |
| RVW-21 | 404 não vaza metadados de resenha inexistente | T-30 |
| RVW-22 | Placeholder de comentários + aviso "em breve" (C-2) | T-30 |
| RVW-23 | Botão "Recomendar" desabilitado e acessível (C-2) | T-30 |
| RVW-24 | `<article>` semântico, único `<h1>`, headings hierárquicos | T-30 |
| RVW-25 | Teclado: foco visível, tab order lógico, skip link | T-30 |
| RVW-26 | SSR sem JS: conteúdo e estrutura presentes | T-30 |
| RVW-27 | axe 0 críticos + contraste AA | T-26, T-27, T-28, T-30 |

**Coverage:** 27/27 requisitos mapeados a tasks — **nenhum órfão** ✅

---

## Validações pré-aprovação

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T-23: migration 0005 | 1 arquivo SQL | ✅ Atômico |
| T-24: seed.sql (extensão) | 1 arquivo (append idempotente) | ✅ Atômico |
| T-25: review/queries.ts | 1 arquivo (2 exports coesos) | ✅ Atômico |
| T-26: rating.ts + Rating.tsx + testes | util + seu componente apresentacional (1 conceito) | ✅ Coeso |
| T-27: BookCover.tsx + modifier CSS + teste | 1 componente + 1 modifier de classe existente | ✅ Coeso |
| T-28: not-found.tsx + teste | 1 componente | ✅ Atômico |
| T-29: layout.tsx metadataBase | 1 edição pontual em arquivo existente | ✅ Atômico |
| T-30: page.tsx (rota + metadata + article) | 1 arquivo de rota | ✅ Atômico (1 rota) |
| T-31: rls.integration.test.ts | 1 arquivo de teste | ✅ Atômico |

> Nota de granularidade: em `book-data`, `BookDetails` (T-18) e seu CSS (T-19) foram tasks separadas porque `.lia-book-details` era um bloco extenso. Aqui `.lia-card__media--type` é **um único modifier** que estende `.lia-card__media` já existente → mantido dentro de T-27 (coeso, não justifica task própria). `formatRating` + `Rating` ficam juntos (T-26) por serem o mesmo conceito (util puro + seu componente de apresentação).

### Check 2 — Diagrama × Definição

| Task | `Depends on` (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T-23 | — | Fase 1, sem seta de entrada | ✅ |
| T-24 | — | Fase 1, sem seta de entrada | ✅ |
| T-25 | — | Fase 1, sem seta de entrada | ✅ |
| T-26 | — | Fase 1, sem seta de entrada | ✅ |
| T-27 | — | Fase 1, sem seta de entrada | ✅ |
| T-28 | — | Fase 1, sem seta de entrada | ✅ |
| T-29 | — | Fase 1, sem seta de entrada | ✅ |
| T-30 | T-25, T-26, T-27, T-28, T-29 | ← T-25, T-26, T-27, T-28, T-29 | ✅ |
| T-31 | T-23, T-24 | ← T-23, T-24 | ✅ |

Nenhuma task marcada `[P]` na Fase 1 depende de outra da mesma fase. ✅

### Check 3 — Co-localização de testes

Stack de testes: **Vitest + RTL** (unit/componente em `src/`, `axe` via jsdom), **Playwright + axe** (a11y de rota), integração RLS **local-only** (TD-02).

| Task | Camada criada/modificada | Tipo requerido | Task diz | Status |
| --- | --- | --- | --- | --- |
| T-23 | Migration SQL (policy+grant) | none (DB-level, gate manual) | none | ✅ |
| T-24 | Seed SQL | none (DB-level, gate manual) | none | ✅ |
| T-25 | Query de servidor (queries.ts) | none¹ (integração em T-31) | none (typecheck) | ✅ |
| T-26 | Util puro TS + Server Component | unit + componente | unit (rating.test.ts) + componente (Rating.test.tsx, axe) | ✅ |
| T-27 | Server Component (+CSS) | componente | componente (BookCover.test.tsx, axe) | ✅ |
| T-28 | Componente de rota (not-found) | componente | componente (not-found.test.tsx, axe) | ✅ |
| T-29 | Config de metadata (layout) | none | none (build/typecheck) | ✅ |
| T-30 | Rota RSC async (page) | a11y² (Playwright local-seeded) | a11y + build/typecheck | ✅ |
| T-31 | Teste de integração RLS | integration (local-only, TD-02) | integration/local | ✅ |

> ¹ `queries.ts` requer banco real; teste unitário com mock não acrescenta cobertura de contrato — integração coberta em T-31 (padrão aceito em `book-data` T-17/T-22).
> ² `page.tsx` é RSC `async` que lê dados semeados; a auditoria axe da rota depende do seed local (TD-02: CI não tem Supabase). Gate de CI = `build + typecheck`; auditoria axe da rota é verificação **local** (seed presente), embutida no `Done when`.

Todos os checks passaram. ✅

---

## Alocação de modelo por task

| Task | Modelo | Racional |
| --- | --- | --- |
| T-23 | **Opus** | SQL de RLS/GRANT com armadilha TD-03; erro é silencioso e de segurança |
| T-24 | Sonnet/Haiku | Seed idempotente mecânico (UUIDs fixos, `on conflict`) |
| T-25 | Sonnet/Haiku | Espelha padrão de `book/queries.ts` + `cache()` |
| T-26 | **Opus** | Nota acessível (C-1): `Intl` pt-BR + texto `sr-only`, carga de a11y |
| T-27 | **Opus** | Capa com `role="img"` + `aria-label` + fallback tipográfico (D-05), carga de a11y |
| T-28 | Sonnet/Haiku | Scaffolding de UI simples (WCAG embutido no done) |
| T-29 | Sonnet/Haiku | Edição pontual de config (metadataBase) |
| T-30 | Sonnet/Haiku | Composição/scaffolding do `<article>` a partir de peças prontas |
| T-31 | **Opus** | Teste de integração RLS anon — asserts de segurança (42501, draft invisível, RLS enabled) |

---

## Tasks

### T-23 — Migration `0005_review_public_read.sql`

| | |
| --- | --- |
| **Reqs** | RVW-13, RVW-14, RVW-15 |
| **Depends on** | — |
| **Where** | `supabase/migrations/0005_review_public_read.sql` |
| **Reuses** | padrão policy guardada de [0003](../../../supabase/migrations/0003_book_public_read_policy.sql) + GRANT explícito de [0004](../../../supabase/migrations/0004_public_read_grants.sql) |
| **Model** | **Opus** |
| **Tests** | none (verificação manual no banco local; integração em T-31) |
| **Gate** | manual: `supabase db reset` local + inspecionar `pg_policies` |
| **Status** | `pending` |

**What**: Migration idempotente (**arquivo único** — escopo só `review`) que abre leitura pública filtrada de `review`, mantendo escrita deny-by-default:
- Policy guardada via `pg_policies` (padrão 0003):
  `create policy "review_public_read" on review for select to anon, authenticated using (status = 'published');`
- GRANT explícito (padrão 0004 / TD-03):
  `grant select on table review to anon, authenticated;`
- **Sem** policy/grant de `INSERT/UPDATE/DELETE`; **sem** `disable row level security`.

**Done when**:
- [ ] Arquivo criado em `supabase/migrations/0005_review_public_read.sql`
- [ ] `supabase db reset` local executa sem erro
- [ ] `SELECT * FROM pg_policies WHERE tablename='review'` lista exatamente 1 policy (`review_public_read`, command `SELECT`, qual `status = 'published'`)
- [ ] RLS continua `enabled` em `review` (não há `alter table … disable`)
- [ ] GRANT concede `SELECT` a `anon` e `authenticated` (verificável via `information_schema.role_table_grants`)
- [ ] Reaplicar a migration é no-op (idempotente): guarda `pg_policies` + `grant` re-concedido sem erro
- [ ] **TD-03 não fechada**: GRANT restrito a `review`; nenhuma outra tabela tocada

**Commit**: `feat(db): T-23 migration 0005 — review RLS policy + GRANT (status=published)`

---

### T-24 — Extensão de `supabase/seed.sql` (resenhas)

| | |
| --- | --- |
| **Reqs** | RVW-16, RVW-17, RVW-18 |
| **Depends on** | — |
| **Where** | `supabase/seed.sql` (append no `do $$ … $$` existente, após os `insert into book`) |
| **Reuses** | idempotência e estilo do seed atual (UUIDs fixos + `on conflict (id) do nothing`) |
| **Model** | Sonnet/Haiku |
| **Tests** | none (verificação manual local) |
| **Gate** | manual: `supabase db reset` local → contar linhas |
| **Status** | `pending` |

**What**: Semear resenhas nos 4 livros de domínio público existentes + 1 caso `draft`:
- **1 resenha `published` por livro** (Dom Casmurro, O Crime do Padre Amaro, Iracema, O Cortiço), respeitando `book` **1—1** `review` (`book_id` UNIQUE). UUIDs fixos `bbbbbbbb-…`.
- Cada resenha: `title`, `slug` único derivado do título (`dom-casmurro`, `o-crime-do-padre-amaro`, `iracema`, `o-cortico`), `rating` plausível **cabendo em `numeric(2,1)`** (1 casa decimal, ex.: `4.5`, `4.0`, `4.5`, `5.0`) e dentro do `check` 0–5, `body` **multi-parágrafo** (separado por `\n\n`), `status='published'`, `published_at = now()`, `editor_id` **omitido** (nullable).
- **5º book de teste** (domínio público, ex.: "Memórias Póstumas de Brás Cubas", UUID `aaaaaaaa-…0005`) + sua `review` **`status='draft'`** (slug ex.: `memorias-postumas-rascunho`, `published_at` nulo) — para o teste de visibilidade (RVW-18).

**Done when**:
- [ ] `supabase db reset` local → **4 resenhas `published`** (1 por livro existente) + **1 `draft`** (no 5º book)
- [ ] Reexecutar `supabase db reset` → **sem duplicatas** (idempotente)
- [ ] Todos os `rating` têm no máximo 1 casa decimal (não estouram `numeric(2,1)`) e passam o `check` 0–5
- [ ] Cada `body` tem ≥ 2 parágrafos separados por `\n\n`
- [ ] `editor_id` das resenhas semeadas é `NULL` (sem editores no M1)
- [ ] Os 4 slugs `published` resolvem conteúdo; o slug `draft` **não** aparece para o cliente anon (confirmado em T-31)

**Commit**: `feat(db): T-24 seed — 4 resenhas publicadas + 5º book/review draft (idempotente)`

---

### T-25 — `src/lib/review/queries.ts` (`getPublishedReviewBySlug` + `ReviewView`)

| | |
| --- | --- |
| **Reqs** | RVW-03 (filtro), RVW-04, RVW-13 (filtro app-side) |
| **Depends on** | — |
| **Where** | `src/lib/review/queries.ts` |
| **Reuses** | padrão de [book/queries.ts](../../../src/lib/book/queries.ts); `createServerClient` de [supabase/server.ts](../../../src/lib/supabase/server.ts); `Tables<'review'>` e `BookView` de `book/queries` |
| **Model** | Sonnet/Haiku |
| **Tests** | none¹ (integração coberta por T-31) |
| **Gate** | `npm run typecheck && npm run lint` |
| **Status** | `pending` |

**What**: Criar `queries.ts` com o tipo `ReviewView` e a função `getPublishedReviewBySlug`, **envolvida em `cache()` do React** para deduplicar a chamada dupla `generateMetadata` + `page` na mesma requisição.

**Interfaces**:
```typescript
import { cache } from 'react'
import type { Tables } from '@/lib/database.types'
import type { BookView } from '@/lib/book/queries'

export type ReviewView = Tables<'review'> & { book: BookView }

export const getPublishedReviewBySlug = cache(
  async (slug: string): Promise<ReviewView | null> => { /* … */ }
)
```

**Comportamento** (design):
- `select('*, book(*, genre(name, slug))')`, `.eq('slug', slug)`, **`.eq('status', 'published')`**, `.maybeSingle()`.
- Filtro `status='published'` **explícito na query** (não delegado ao RLS — vale mesmo com `service_role`).
- `if (error) throw error`; retorno `null` quando inexistente **ou** `draft`.

**Done when**:
- [ ] `ReviewView` usa `Tables<'review'>` + `BookView` (sem `any`)
- [ ] `getPublishedReviewBySlug` está envolvida em `cache()` (`import { cache } from 'react'`)
- [ ] Query aplica `.eq('status','published')` explicitamente e `.maybeSingle()`
- [ ] Retorna `null` (sem `throw`) quando não encontrado ou `draft`; `throw` só em erro de DB
- [ ] `npm run typecheck && npm run lint` passa (sem erro no arquivo)

**Commit**: `feat(review): T-25 queries — getPublishedReviewBySlug (cache + join book/genre)`

> ¹ Requer banco real; contrato coberto por integração em T-31.

---

### T-26 — `src/lib/review/rating.ts` (`formatRating`) + `src/components/review/Rating.tsx` + testes

| | |
| --- | --- |
| **Reqs** | RVW-08, RVW-09 (contrato), RVW-27 |
| **Depends on** | — |
| **Where** | `src/lib/review/rating.ts` · `src/components/review/Rating.tsx` · `src/lib/review/__tests__/rating.test.ts` · `src/components/review/__tests__/Rating.test.tsx` |
| **Reuses** | classe utilitária `sr-only` (skip link/layout); `Intl.NumberFormat` |
| **Model** | **Opus** |
| **Tests** | unit (Vitest) + componente (Vitest + RTL + axe) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `pending` |

**What**: Util puro `formatRating` + componente apresentacional `Rating` (C-1: **só número**, sem estrelas/medidor).

**Interfaces**:
```typescript
// rating.ts
export function formatRating(rating: number): string   // 4.5 → "4,5" (Intl pt-BR, 1 casa min/max)
// Rating.tsx (Server Component, sem 'use client')
export function Rating({ rating }: { rating: number }): JSX.Element
```

**Comportamento**: `Rating` renderiza `4,5 / 5` visível **+** `<span class="sr-only">Nota: 4,5 de 5</span>`. Assume `rating` presente — a **omissão quando nulo (RVW-09) é responsabilidade do chamador** (T-30).

**Done when**:
- [ ] `formatRating(4.5)` → `'4,5'`; `formatRating(4)` → `'4,0'`; `formatRating(5)` → `'5,0'` (vírgula decimal pt-BR, sempre 1 casa)
- [ ] `Rating` é Server Component (sem `'use client'`); **sem** estrelas/SVG de medidor
- [ ] Texto acessível `sr-only` anuncia "Nota: X de 5" (leitor de tela) — não só cor/visual (WCAG 2.1 AA)
- [ ] Componente expõe a nota visível e a alternativa textual (dois nós distintos)
- [ ] Axe (jsdom/RTL) → 0 issues críticos ao renderizar `Rating`
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 4 testes em `rating.test.ts` + ≥ 2 em `Rating.test.tsx`

**Commit**: `feat(review): T-26 Rating — formatRating pt-BR + exibição numérica acessível`

---

### T-27 — `src/components/book/BookCover.tsx` + `.lia-card__media--type` + testes

| | |
| --- | --- |
| **Reqs** | RVW-11, RVW-12, RVW-27 |
| **Depends on** | — |
| **Where** | `src/components/book/BookCover.tsx` · `src/app/globals.css` (modifier em `@layer components`) · `src/components/book/__tests__/BookCover.test.tsx` |
| **Reuses** | classe `lia-card__media` (aspect-ratio 3/2) de [globals.css:483](../../../src/app/globals.css#L483); tokens `--oxblood-700`, `--paper-0`; mock de [telas-finais.html](../../../docs/design/telas-finais.html) l.245 |
| **Model** | **Opus** |
| **Tests** | componente (Vitest + RTL + axe) |
| **Gate** | quick: `npm run typecheck && npm test` (+ `npm run build` para o CSS) |
| **Status** | `pending` |

**What**: Componente `BookCover` (Server Component) que renderiza a capa **tipográfica** de fallback, + novo modifier `.lia-card__media--type` consumindo **apenas tokens** (sem hex).

**Interfaces**:
```typescript
// BookCover.tsx (sem 'use client')
export function BookCover({ title }: { title: string }): JSX.Element
```

**Markup** (design): `<span class="lia-card__media lia-card__media--type" role="img" aria-label={`Capa de ${title}`}>` com o título **visível** dentro (não só imagem). **Não** processa `cover_url` (RVW-12 — pipeline de imagem é `storage-covers`).

**Done when**:
- [ ] `BookCover` é Server Component (sem `'use client'`); recebe **só** `title` (contrato mínimo à prova de escopo)
- [ ] Renderiza `role="img"` + `aria-label="Capa de <título>"` e o título como texto visível (WCAG 2.1 AA — alternativa textual, não texto-como-imagem)
- [ ] **Não** referencia/processa `cover_url` (RVW-12)
- [ ] `.lia-card__media--type` adicionada em `@layer components` ao lado de `.lia-card__media`, **só tokens** (zero hex): fundo `--oxblood-700`, texto `--paper-0`, `align-items:flex-end`, padding
- [ ] Contraste texto/fundo ≥ 4.5:1 (token `--paper-0` sobre `--oxblood-700`)
- [ ] Axe (jsdom/RTL) → 0 issues críticos; `npm run build` compila o CSS sem erro
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 3 testes em `BookCover.test.tsx`

**Commit**: `feat(book): T-27 BookCover — capa tipográfica de fallback (role=img + aria-label)`

---

### T-28 — `src/app/resenha/[slug]/not-found.tsx` (404 acessível)

| | |
| --- | --- |
| **Reqs** | RVW-02, RVW-03 (parte UI), RVW-27 |
| **Depends on** | — |
| **Where** | `src/app/resenha/[slug]/not-found.tsx` · `src/app/resenha/[slug]/__tests__/not-found.test.tsx` |
| **Reuses** | tokens `lia-*`; `<main>`/skip link do [layout.tsx](../../../src/app/layout.tsx); classes `lia-btn` para o link de volta |
| **Model** | Sonnet/Haiku |
| **Tests** | componente (Vitest + RTL + axe) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `pending` |

**What**: Página de 404 **acessível** da rota, renderizada automaticamente pelo Next quando `page.tsx` chama `notFound()` (slug inexistente ou `draft`).

**Done when**:
- [ ] Arquivo `not-found.tsx` na pasta da rota
- [ ] Um único `<h1>` com mensagem clara de "resenha não encontrada" (rascunho indistinguível de inexistente — **sem vazar** que existe um draft)
- [ ] Link de retorno (ex.: para a home) navegável por teclado com **foco visível** (tokens M0)
- [ ] Hierarquia de heading coerente; nenhum heading órfão (WCAG 2.1 AA)
- [ ] Axe (jsdom/RTL) → 0 issues críticos
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 2 testes em `not-found.test.tsx`

**Commit**: `feat(review): T-28 not-found — página 404 acessível da rota /resenha`

---

### T-29 — `metadataBase` no `src/app/layout.tsx`

| | |
| --- | --- |
| **Reqs** | RVW-20 (og:url/canonical absolutas) |
| **Depends on** | — |
| **Where** | `src/app/layout.tsx` (objeto `metadata` raiz) |
| **Reuses** | export `metadata` já existente no layout; var de ambiente de site (padrão `NEXT_PUBLIC_SITE_URL` / fallback local) |
| **Model** | Sonnet/Haiku |
| **Tests** | none (config de metadata; validado por build + em T-30) |
| **Gate** | `npm run typecheck && npm run build` |
| **Status** | `pending` |

**What**: Adicionar `metadataBase: new URL(<site url>)` ao `metadata` raiz do layout, para que `og:url` e canonical relativos de `generateMetadata` (T-30) resolvam **absolutos** já nesta feature (decisão da revisão 2026-06-12).

**Done when**:
- [ ] `metadata.metadataBase` definido no layout raiz com a URL do site (env com fallback determinístico local, sem hardcode de domínio proibido)
- [ ] Metadata relativa (`url: '/resenha/<slug>'`) resolve para URL absoluta no `<head>` renderizado
- [ ] `npm run typecheck && npm run build` passa

**Commit**: `feat(seo): T-29 metadataBase no layout raiz (og:url/canonical absolutas)`

---

### T-30 — `src/app/resenha/[slug]/page.tsx` (rota + `generateMetadata` + `<article>`)

| | |
| --- | --- |
| **Reqs** | RVW-01, 02 (notFound), 05, 06, 07, 09 (omissão), 10, 19, 20, 21, 22, 23, 24, 25, 26, 27 |
| **Depends on** | T-25, T-26, T-27, T-28, T-29 |
| **Where** | `src/app/resenha/[slug]/page.tsx` |
| **Reuses** | `getPublishedReviewBySlug` (T-25); `Rating` (T-26); `BookCover` (T-27); [BookDetails](../../../src/components/book/BookDetails.tsx) (`headingLevel={3}`); `notFound` de `next/navigation`; classes `lia-btn`, `lia-btn--secondary`; `<main>`/skip link do layout |
| **Model** | Sonnet/Haiku |
| **Tests** | a11y (Playwright + axe, **local-seeded** — ver TD-02) |
| **Gate** | `npm run typecheck && npm run build` (CI) · axe de rota = verificação local (seed) |
| **Status** | `pending` |

**What**: Compor a resenha completa num `<article>` SSR + emitir SEO/404.
- `generateMetadata({ params })`: busca via `getPublishedReviewBySlug`; se `null` → `Metadata` genérico **sem dados de resenha** (RVW-21). Senão: `title: "${review.title} · LIA"`, `description` = resumo do `body` (~160 chars, corte em palavra), `openGraph: { title, description, type: 'article', url: '/resenha/${slug}' }` (absoluta via metadataBase de T-29).
- `ReviewPage({ params })`: resolve; `null` → `notFound()`; senão renderiza o `<article>` na ordem do design (header `h1`+contexto+`Rating` condicional → `BookCover` → `<section>` Ficha `h2`+`BookDetails h3` → `<section>` Resenha `h2`+parágrafos → `<section>` Comentários `h2`+aviso "em breve" → footer botão "Recomendar" `disabled`+`aria-describedby`).
- Helper `splitParagraphs(body)`: `body.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)`; `body` vazio/nulo → `[]` (degradação graciosa). **Sem** `dangerouslySetInnerHTML`.
- `Rating` só renderiza quando `rating != null` (RVW-09).

**Done when**:
- [ ] `/resenha/<slug>` publicado renderiza **via SSR** (conteúdo factual no HTML inicial, sem depender de hidratação — RVW-01/26)
- [ ] Slug inexistente **e** resenha `draft` → `notFound()` → 404 acessível (via T-28), sem 500 (RVW-02/03)
- [ ] `<article>` sob o `<main>` do layout (a página **não** cria outro `<main>` — RVW-05); **único `<h1>`** = `review.title` (RVW-06/24)
- [ ] Ficha via `BookDetails` com `headingLevel={3}` sob `<h2>Ficha técnica</h2>` (RVW-07); bloco Tradução vira `<h3>` coerente
- [ ] `Rating` presente só quando `rating != null`; nulo → bloco omitido, resto intacto (RVW-09)
- [ ] `<section><h2>Resenha</h2>` + `body` em `<p>` por parágrafo; `body` vazio → seção sem parágrafos, sem quebra (RVW-10)
- [ ] Placeholders: `<section>` Comentários com aviso "em breve" (texto) + botão "Recomendar" `disabled` acessível (`aria-describedby`), **zero lógica de negócio** (RVW-22/23)
- [ ] `<head>`: `title`, meta description e OG (title/description/type/**url absoluta**) coerentes por requisição (RVW-19/20); slug 404 **não vaza** metadados de resenha (RVW-21)
- [ ] Teclado: tab order lógico, **foco visível**, skip link funcionando (RVW-25); conteúdo presente **sem JS** (RVW-26)
- [ ] axe na rota `/resenha/dom-casmurro` (seed local) → **0 críticos**, contraste ≥ 4.5:1 (RVW-27); ordem de headings validada (único `h1`, `h2`/`h3` hierárquicos)
- [ ] Gate CI: `npm run typecheck && npm run build` passa

**Commit**: `feat(review): T-30 page — rota SSR /resenha/[slug] + generateMetadata + <article>`

---

### T-31 — Teste de integração RLS de `review` (local-only)

| | |
| --- | --- |
| **Reqs** | RVW-13, RVW-14, RVW-15 (verificação) |
| **Depends on** | T-23, T-24 |
| **Where** | `src/lib/review/__tests__/rls.integration.test.ts` |
| **Reuses** | client `anon` de [supabase/client.ts](../../../src/lib/supabase/client.ts); estrutura `describe.skipIf(!RUN)` de [book/__tests__/rls.integration.test.ts](../../../src/lib/book/__tests__/rls.integration.test.ts) |
| **Model** | **Opus** |
| **Tests** | integration (Supabase local — **não roda no CI atual**, ver TD-02) |
| **Gate** | manual (local): `RUN_RLS_INTEGRATION=1 npx vitest run src/lib/review/__tests__/rls.integration.test.ts` |
| **Status** | `pending` |

**What**: Teste com o client **anon** sobre o seed (T-24), **sem** precisar de `service_role` em `review` (não esbarra na TD-03).

**Casos** (design):
1. anon `select` em `review` retorna **só publicadas** (4) e contém os slugs do seed.
2. a review `draft` semeada **não** aparece para anon (linha filtrada, **sem** erro de permissão — indistinguível de inexistente).
3. anon `insert` / `update` / `delete` em `review` → erro **`42501`** (sem grant/policy de escrita).
4. RLS de `review` permanece **`enabled`** (consulta a metadados, como no teste de `book`).

**Done when**:
- [ ] Arquivo criado com comentário `// LOCAL-ONLY — ver TD-02 em STATE.md` e `describe.skipIf(!RUN)`
- [ ] Caso 1: `select` anon → `data.length === 4` e inclui os 4 slugs publicados
- [ ] Caso 2: nenhum registro `draft` retorna; `error` é `null` (filtrado, não `42501`)
- [ ] Caso 3: `insert`/`update`/`delete` anon → `error.code === '42501'`
- [ ] Caso 4: RLS de `review` reportado como `enabled`
- [ ] Chaves lidas via env (nunca hardcoded); executar local com Supabase → todos os asserts passam; **pulado** no CI

**Commit**: `test(review): T-31 RLS integration — leitura pública filtrada + escrita fechada (local-only)`

---

## Status Summary

| Task | Descrição | Modelo | Depends on | Status |
| --- | --- | --- | --- | --- |
| T-23 | Migration 0005 (policy + GRANT review) | Opus | — | `pending` |
| T-24 | seed.sql — 4 published + 5º book/review draft | Sonnet/Haiku | — | `pending` |
| T-25 | review/queries.ts — getPublishedReviewBySlug + cache() | Sonnet/Haiku | — | `pending` |
| T-26 | rating.ts + Rating.tsx + testes | Opus | — | `pending` |
| T-27 | BookCover.tsx + .lia-card__media--type + teste | Opus | — | `pending` |
| T-28 | not-found.tsx (404 acessível) + teste | Sonnet/Haiku | — | `pending` |
| T-29 | layout.tsx metadataBase | Sonnet/Haiku | — | `pending` |
| T-30 | page.tsx — rota SSR + generateMetadata + article | Sonnet/Haiku | T-25,26,27,28,29 | `pending` |
| T-31 | RLS integration test (local-only) | Opus | T-23,24 | `pending` |

**9 tasks · 27/27 reqs mapeados · 0 executadas — aguardando aprovação para a fase Execute.**

> **Lembrete TD-03 (Alta):** a T-23 concede GRANT **apenas** a `review`. TD-03 permanece **ABERTA** para as demais tabelas e deve ser resolvida **antes do M2 (`reviews-crud`)`**. Concluir a review-page **não** a fecha.
