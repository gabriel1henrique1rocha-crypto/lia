# review-page — Tasks

**Spec**: [spec.md](spec.md) · **Design**: [design.md](design.md) · **Context**: [context.md](context.md) · **Status**: Execute concluído
**Milestone**: M1 — Núcleo de leitura pública · **Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Supabase
> **Status: Execute concluído** — 10/10 tasks implementadas e commitadas (branch `feat/review-page`). Gates de código verdes (typecheck/build/lint + suíte 93 passed / 8 skipped). Gates de banco (T-23/T-24/T-32) e axe de rota (T-31) = **verificação local pendente** (Supabase/Docker indisponível na sessão de Execute; padrão TD-02, marcados `done-code`).
> Documentação em português; nomes de feature, schema, identificadores e código em inglês.
> Numeração global contínua: infra-foundation `T-01..T-10`, book-data `T-11..T-22`, review-page **`T-23..T-32`**.
> Acessibilidade **não é task separada** (C-2 / decisão do usuário): o critério WCAG 2.1 AA está embutido no `Done when` de cada task de UI.
> **Ajuste pré-Execute (2026-07-05):** T-26 dividida em **T-26 formatRating** (util, Sonnet) + **T-27 Rating** (componente, Opus); tasks seguintes renumeradas; dependency graph corrigido (migration→seed sequencial). Código realinhado (commit `7f0d925`: `rating.ts`→`formatRating.ts`).

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
Phase 1 (SEQUENCIAL — não negociável):
  T-23 (migration 0005) ──→ T-24 (seed)
  # o seed é aplicado depois da migration no fluxo db reset; ordem fixa.

Phase 2 (PARALELO — arquivos independentes, não se tocam):
  T-25 [P] (review/queries.ts)
  T-26 [P] (review/formatRating.ts)
  T-28 [P] (BookCover.tsx + .lia-card__media--type)
  T-29 [P] (not-found.tsx)
  T-30 [P] (layout.tsx metadataBase)

Phase 2b (após T-26 — Rating importa formatRating):
  T-27 (Rating.tsx)  ← T-26

Phase 3:
  T-31 (page.tsx)    ← T-25, T-27, T-28, T-29, T-30
  T-32 (rls.integration.test.ts)  ← T-23, T-24
```

**Grupos de execução paralela:**
- **Fase 1 é sequencial e não negociável:** `T-23 → T-24`. A migration abre a leitura pública; o seed roda **depois** (o `supabase db reset` aplica migrations e só então o `seed.sql`).
- **Fase 2 (paralela):** `T-25 [P] T-26 [P] T-28 [P] T-29 [P] T-30 [P]` — cinco arquivos independentes, nenhum compartilha arquivo/estado. Podem rodar concorrentes entre si (e com a Fase 1, que é DB-only).
- **T-27 (Rating) NÃO é paralela com T-26:** `Rating.tsx` importa `formatRating` → depende de T-26. (Correção do ajuste: embora ambos sejam da mesma feature de nota, o componente toca o util.)
- **Fase 3:** `T-31` (page ← componentes + queries + metadataBase) e `T-32` (teste RLS ← migration + seed) não se tocam → podem rodar em paralelo.

---

## Requirement → Task Mapping

| Req | Descrição curta | Task(s) |
| --- | --- | --- |
| RVW-01 | Rota `/resenha/[slug]` SSR | T-31 |
| RVW-02 | 404 slug inexistente (UI acessível) | T-29, T-31 |
| RVW-03 | 404 resenha `draft` | T-25 (filtro), T-31 (notFound), T-32 (verif.) |
| RVW-04 | Busca por `slug` com join `book`+`genre` tipada | T-25 |
| RVW-05 | Página sob `<main>`; fornece o `<article>` | T-31 |
| RVW-06 | Título da resenha como `<h1>` | T-31 |
| RVW-07 | Ficha reusando `BookDetails` (`headingLevel=3`) | T-31 |
| RVW-08 | Nota numérica pt-BR, só exibição, acessível (C-1) | T-26 (formatação), T-27 (exibição acessível) |
| RVW-09 | Nota nula → bloco omitido | T-27 (contrato), T-31 (omissão) |
| RVW-10 | Texto em parágrafos semânticos + `body` vazio gracioso | T-31 |
| RVW-11 | Capa tipográfica de fallback com alt acessível | T-28 |
| RVW-12 | Não processar imagem real (escopo `storage-covers`) | T-28 |
| RVW-13 | RLS policy `SELECT` filtrada por `status='published'` | T-23, T-25 (filtro app-side), T-32 (verif.) |
| RVW-14 | GRANT SELECT em `review` (TD-03) | T-23, T-32 (verif.) |
| RVW-15 | Escrita fechada + RLS habilitado + idempotência | T-23, T-32 (verif.) |
| RVW-16 | Seed 1 resenha publicada por livro (4), 1—1 `book` | T-24 |
| RVW-17 | Seed: slug único, rating plausível, body em §, idempotente, editor_id nulo | T-24 |
| RVW-18 | Seed 1 resenha `draft` (5º book de teste) | T-24 |
| RVW-19 | SEO `generateMetadata` (title + meta description) | T-31 |
| RVW-20 | SEO Open Graph (title/description/type/url absoluta) | T-30 (metadataBase), T-31 |
| RVW-21 | 404 não vaza metadados de resenha inexistente | T-31 |
| RVW-22 | Placeholder de comentários + aviso "em breve" (C-2) | T-31 |
| RVW-23 | Botão "Recomendar" desabilitado e acessível (C-2) | T-31 |
| RVW-24 | `<article>` semântico, único `<h1>`, headings hierárquicos | T-31 |
| RVW-25 | Teclado: foco visível, tab order lógico, skip link | T-31 |
| RVW-26 | SSR sem JS: conteúdo e estrutura presentes | T-31 |
| RVW-27 | axe 0 críticos + contraste AA | T-27, T-28, T-29, T-31 |

**Coverage:** 27/27 requisitos mapeados a tasks — **nenhum órfão** ✅ (RVW-08 agora coberto por T-26+T-27; nada perdido na divisão).

---

## Validações pré-aprovação

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T-23: migration 0005 | 1 arquivo SQL | ✅ Atômico |
| T-24: seed.sql (extensão) | 1 arquivo (append idempotente) | ✅ Atômico |
| T-25: review/queries.ts | 1 arquivo (2 exports coesos) | ✅ Atômico |
| T-26: review/formatRating.ts + teste | 1 util puro + 1 test | ✅ Atômico |
| T-27: Rating.tsx + teste | 1 componente | ✅ Atômico |
| T-28: BookCover.tsx + modifier CSS + teste | 1 componente + 1 modifier de classe existente | ✅ Coeso |
| T-29: not-found.tsx + teste | 1 componente | ✅ Atômico |
| T-30: layout.tsx metadataBase | 1 edição pontual em arquivo existente | ✅ Atômico |
| T-31: page.tsx (rota + metadata + article) | 1 arquivo de rota | ✅ Atômico (1 rota) |
| T-32: rls.integration.test.ts | 1 arquivo de teste | ✅ Atômico |

> **Nota de granularidade (item 2 do ajuste — decisão intencional):** em T-28, o modifier `.lia-card__media--type` fica **junto** do `BookCover`. Regra adotada: **CSS acoplado a um único componente fica na mesma task**; só CSS de token/base **reaproveitado por vários componentes** vira task separada (como foi `.lia-book-details` em `book-data` T-18/T-19). O modifier aqui serve exclusivamente ao `BookCover` → não justifica task própria.
> A divisão de T-26/T-27 (formatRating util × Rating componente) segue o oposto: são **conceitos distintos em arquivos distintos** (`formatRating.ts` reusável por `review-listing-search` sem o componente) → duas tasks.

### Check 2 — Diagrama × Definição

| Task | `Depends on` (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T-23 | — | Fase 1, início | ✅ |
| T-24 | T-23 | ← T-23 | ✅ |
| T-25 | — | Fase 2, sem seta de entrada | ✅ |
| T-26 | — | Fase 2, sem seta de entrada | ✅ |
| T-27 | T-26 | ← T-26 | ✅ |
| T-28 | — | Fase 2, sem seta de entrada | ✅ |
| T-29 | — | Fase 2, sem seta de entrada | ✅ |
| T-30 | — | Fase 2, sem seta de entrada | ✅ |
| T-31 | T-25, T-27, T-28, T-29, T-30 | ← T-25, T-27, T-28, T-29, T-30 | ✅ |
| T-32 | T-23, T-24 | ← T-23, T-24 | ✅ |

Nenhuma task marcada `[P]` na Fase 2 depende de outra da mesma fase (T-27 saiu do grupo `[P]` por depender de T-26). ✅

### Check 3 — Co-localização de testes

Stack de testes: **Vitest + RTL** (unit/componente em `src/`, `axe` via jsdom), **Playwright + axe** (a11y de rota), integração RLS **local-only** (TD-02).

| Task | Camada criada/modificada | Tipo requerido | Task diz | Status |
| --- | --- | --- | --- | --- |
| T-23 | Migration SQL (policy+grant) | none (DB-level, gate manual) | none | ✅ |
| T-24 | Seed SQL | none (DB-level, gate manual) | none | ✅ |
| T-25 | Query de servidor (queries.ts) | none¹ (integração em T-32) | none (typecheck) | ✅ |
| T-26 | Util puro TS (formatRating) | unit | unit (formatRating.test.ts) | ✅ |
| T-27 | Server Component (Rating) | componente | componente (Rating.test.tsx, axe) | ✅ |
| T-28 | Server Component (+CSS) | componente | componente (BookCover.test.tsx, axe) | ✅ |
| T-29 | Componente de rota (not-found) | componente | componente (not-found.test.tsx, axe) | ✅ |
| T-30 | Config de metadata (layout) | none | none (build/typecheck) | ✅ |
| T-31 | Rota RSC async (page) | a11y² (Playwright local-seeded) | a11y + build/typecheck | ✅ |
| T-32 | Teste de integração RLS | integration (local-only, TD-02) | integration/local | ✅ |

> ¹ `queries.ts` requer banco real; contrato coberto por integração em T-32 (padrão aceito em `book-data` T-17/T-22).
> ² `page.tsx` é RSC `async` que lê dados semeados; a auditoria axe da rota depende do seed local (TD-02: CI não tem Supabase). Gate de CI = `build + typecheck`; auditoria axe da rota é verificação **local**, embutida no `Done when`.

Todos os checks passaram. ✅

---

## Alocação de modelo por task

| Task | Modelo | Racional |
| --- | --- | --- |
| T-23 | **Opus** | SQL de RLS/GRANT com armadilha TD-03; erro silencioso e de segurança |
| T-24 | Sonnet/Haiku | Seed idempotente mecânico (UUIDs fixos, `on conflict`) |
| T-25 | Sonnet/Haiku | Espelha padrão de `book/queries.ts` + `cache()` |
| T-26 | **Sonnet** | Util puro de formatação (`Intl` pt-BR); testável isolado, baixo risco |
| T-27 | **Opus** | Nota acessível (C-1): texto `sr-only` + contraste AA; carga de a11y |
| T-28 | **Opus** | Capa com `role="img"` + `aria-label` + fallback tipográfico; carga de a11y |
| T-29 | Sonnet/Haiku | Scaffolding de UI simples (WCAG embutido no done) |
| T-30 | Sonnet/Haiku | Edição pontual de config (metadataBase) |
| T-31 | Sonnet/Haiku | Composição/scaffolding do `<article>` a partir de peças prontas |
| T-32 | **Opus** | Teste de integração RLS anon — asserts de segurança (42501, draft invisível, RLS enabled) |

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
| **Tests** | none (verificação manual no banco local; integração em T-32) |
| **Gate** | manual: `supabase db reset` local + inspecionar `pg_policies` |
| **Status** | `done-code` (arquivo criado, commit `4a68d7f`; **gate local Supabase pendente**) |

**What**: Migration idempotente (**arquivo único** — escopo só `review`) que abre leitura pública filtrada de `review`, mantendo escrita deny-by-default:
- Policy guardada via `pg_policies` (padrão 0003): `create policy "review_public_read" on review for select to anon, authenticated using (status = 'published');`
- GRANT explícito (padrão 0004 / TD-03): `grant select on table review to anon, authenticated;`
- **Sem** policy/grant de `INSERT/UPDATE/DELETE`; **sem** `disable row level security`.

**Done when**:
- [ ] Arquivo criado em `supabase/migrations/0005_review_public_read.sql`
- [ ] `supabase db reset` local executa sem erro
- [ ] `SELECT * FROM pg_policies WHERE tablename='review'` lista 1 policy (`review_public_read`, `SELECT`, qual `status = 'published'`)
- [ ] RLS continua `enabled` em `review`; GRANT concede `SELECT` a `anon`/`authenticated`
- [ ] Reaplicar a migration é no-op (idempotente)
- [ ] **TD-03 não fechada**: GRANT restrito a `review`

**Commit**: `feat(db): T-23 migration 0005 — review RLS policy + GRANT (status=published)`

---

### T-24 — Extensão de `supabase/seed.sql` (resenhas)

| | |
| --- | --- |
| **Reqs** | RVW-16, RVW-17, RVW-18 |
| **Depends on** | **T-23** (a migration é aplicada antes do seed no `db reset`; ordem fixa) |
| **Where** | `supabase/seed.sql` (append no `do $$ … $$` existente) |
| **Reuses** | idempotência e estilo do seed atual (UUIDs fixos + `on conflict (id) do nothing`) |
| **Model** | Sonnet/Haiku |
| **Tests** | none (verificação manual local) |
| **Gate** | manual: `supabase db reset` local → contar linhas |
| **Status** | `done-code` (seed estendido, commit `0ffb94c`; **gate local Supabase pendente**) |

**What**: Semear resenhas nos 4 livros existentes + 1 caso `draft`:
- **1 resenha `published` por livro** (Dom Casmurro, O Crime do Padre Amaro, Iracema, O Cortiço), 1—1 com `book` (`book_id` UNIQUE), UUIDs `bbbbbbbb-…`.
- Cada uma: `title`, `slug` único (`dom-casmurro`, `o-crime-do-padre-amaro`, `iracema`, `o-cortico`), `rating` **cabendo em `numeric(2,1)`** (1 casa, ex.: 4.5/4.0/4.5/5.0) e no `check` 0–5, `body` **multi-parágrafo** (`\n\n`), `status='published'`, `published_at=now()`, `editor_id` **omitido** (nullable).
- **5º book de teste** ("Memórias Póstumas de Brás Cubas", UUID `aaaaaaaa-…0005`) + `review` **`draft`** (slug `memorias-postumas-rascunho`, `published_at` nulo) — RVW-18.

**Done when**:
- [ ] `supabase db reset` → 4 `published` (1/livro) + 1 `draft`
- [ ] Reexecutar → sem duplicatas (idempotente)
- [ ] `rating` ≤ 1 casa decimal e no `check` 0–5; `body` ≥ 2 parágrafos; `editor_id` nulo
- [ ] Slugs `published` resolvem conteúdo; `draft` invisível ao anon (confirmado em T-32)

**Commit**: `feat(db): T-24 seed — 4 resenhas publicadas + 5º book/review draft (idempotente)`

---

### T-25 — `src/lib/review/queries.ts` (`getPublishedReviewBySlug` + `ReviewView`)

| | |
| --- | --- |
| **Reqs** | RVW-03 (filtro), RVW-04, RVW-13 (filtro app-side) |
| **Depends on** | — |
| **Where** | `src/lib/review/queries.ts` |
| **Reuses** | padrão de [book/queries.ts](../../../src/lib/book/queries.ts); `createServerClient`; `Tables<'review'>` e `BookView` |
| **Model** | Sonnet/Haiku |
| **Tests** | none¹ (integração coberta por T-32) |
| **Gate** | `npm run typecheck && npm run lint` |
| **Status** | `done` (typecheck ✅ + lint ✅; commit `59747c8`) |

**What**: `ReviewView` + `getPublishedReviewBySlug` **envolvida em `cache()` do React** (dedupe `generateMetadata` + `page`). `select('*, book(*, genre(name, slug))')`, `.eq('slug', slug)`, **`.eq('status','published')`**, `.maybeSingle()`; `if (error) throw error`; `null` em inexistente/draft.

**Done when**:
- [ ] `ReviewView` usa `Tables<'review'>` + `BookView` (sem `any`)
- [ ] `getPublishedReviewBySlug` em `cache()`; filtro `status='published'` explícito; `maybeSingle()`
- [ ] `null` (sem throw) quando não encontrado/draft; `throw` só em erro de DB
- [ ] `npm run typecheck && npm run lint` passa

**Commit**: `feat(review): T-25 queries — getPublishedReviewBySlug (cache + join book/genre)`

> ¹ Requer banco real; contrato coberto por integração em T-32.

---

### T-26 — `src/lib/review/formatRating.ts` (util) + teste

| | |
| --- | --- |
| **Reqs** | RVW-08 (formatação) |
| **Depends on** | — |
| **Where** | `src/lib/review/formatRating.ts` · `src/lib/review/__tests__/formatRating.test.ts` |
| **Reuses** | `Intl.NumberFormat` |
| **Model** | **Sonnet** |
| **Tests** | unit (Vitest) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `done` (4 testes unit ✅; commit `fd3710e` + refactor `7f0d925`) |

**What**: Util **puro** `formatRating(rating: number): string` — valor numérico localizado pt-BR, sempre 1 casa, vírgula decimal (C-1: só número). `Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })`. Testável isolado; reusável por `review-listing-search`.

**Done when**:
- [ ] `formatRating(4.5)` → `'4,5'`; `formatRating(4)` → `'4,0'`; `formatRating(5)` → `'5,0'`; `formatRating(0)` → `'0,0'`
- [ ] Nunca usa `.` como separador decimal
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 4 testes em `formatRating.test.ts`

**Commit**: `feat(review): T-26 formatRating — util de nota pt-BR (Intl, 1 casa)`

---

### T-27 — `src/components/review/Rating.tsx` (componente) + teste

| | |
| --- | --- |
| **Reqs** | RVW-08 (exibição acessível), RVW-09 (contrato), RVW-27 |
| **Depends on** | **T-26** (`Rating` importa `formatRating`) |
| **Where** | `src/components/review/Rating.tsx` · `src/components/review/__tests__/Rating.test.tsx` |
| **Reuses** | `formatRating` (T-26); utilitário `sr-only` (Tailwind v4, usado no skip link) |
| **Model** | **Opus** |
| **Tests** | componente (Vitest + RTL + axe) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `done` (5 testes ✅ c/ axe; commit `fd3710e` + refactor `7f0d925`) |

**What**: `Rating({ rating }: { rating: number })` — Server Component (**sem** `'use client'`). Renderiza `4,5 / 5` visível (`aria-hidden`) **+** `<span class="sr-only">Nota: 4,5 de 5</span>`. **Sem** estrelas/medidor (C-1). A **omissão quando nulo (RVW-09) é do chamador** (T-31).

**Done when**:
- [ ] Server Component; sem estrelas/SVG de medidor
- [ ] Texto `sr-only` anuncia "Nota: X de 5" ao leitor de tela (WCAG 2.1 AA — não só cor/visual)
- [ ] Nota visível e alternativa textual em nós distintos; contraste AA
- [ ] Axe (jsdom/RTL) → 0 críticos
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 2 testes em `Rating.test.tsx`

**Commit**: `feat(review): T-27 Rating — exibição numérica acessível (sr-only, C-1)`

---

### T-28 — `src/components/book/BookCover.tsx` + `.lia-card__media--type` + teste

| | |
| --- | --- |
| **Reqs** | RVW-11, RVW-12, RVW-27 |
| **Depends on** | — |
| **Where** | `src/components/book/BookCover.tsx` · `src/app/globals.css` (modifier em `@layer components`) · `src/components/book/__tests__/BookCover.test.tsx` |
| **Reuses** | classe `lia-card__media` (aspect-ratio 3/2); tokens `--color-oxblood-700`, `--color-paper-0`; mock de [telas-finais.html](../../../docs/design/telas-finais.html) l.245 |
| **Model** | **Opus** |
| **Tests** | componente (Vitest + RTL + axe) |
| **Gate** | quick: `npm run typecheck && npm test` (+ `npm run build` para o CSS) |
| **Status** | `done` (5 testes ✅ c/ axe; build ✅; commit `6ed6ab9`) |

**What**: `BookCover({ title })` (Server Component) — capa **tipográfica** de fallback. `<span class="lia-card__media lia-card__media--type" role="img" aria-label={`Capa de ${title}`}>` com título **visível**. **Não** processa `cover_url` (RVW-12). Novo modifier `.lia-card__media--type` **só tokens** (sem hex). **CSS mantido junto do componente — decisão intencional** (ver nota de granularidade).

**Done when**:
- [ ] Server Component; recebe só `title`
- [ ] `role="img"` + `aria-label="Capa de <título>"` + título como texto visível (WCAG 2.1 AA)
- [ ] Não referencia `cover_url`
- [ ] `.lia-card__media--type` em `@layer components`, só tokens (zero hex); contraste ≥ 4.5:1
- [ ] Axe → 0 críticos; `npm run build` compila o CSS
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 3 testes em `BookCover.test.tsx`

**Commit**: `feat(book): T-28 BookCover — capa tipográfica de fallback (role=img + aria-label)`

---

### T-29 — `src/app/resenha/[slug]/not-found.tsx` (404 acessível) + teste

| | |
| --- | --- |
| **Reqs** | RVW-02, RVW-03 (parte UI), RVW-27 |
| **Depends on** | — |
| **Where** | `src/app/resenha/[slug]/not-found.tsx` · `src/app/resenha/[slug]/__tests__/not-found.test.tsx` |
| **Reuses** | tokens `lia-*`; `<main>`/skip link do layout; `next/link` (SSR) |
| **Model** | Sonnet/Haiku |
| **Tests** | componente (Vitest + RTL + axe) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `done` (4 testes ✅ c/ axe; commit `f00309d`) |

**What**: Página de 404 acessível da rota (renderizada quando `page.tsx` chama `notFound()`).

**Done when**:
- [ ] Um único `<h1>` "resenha não encontrada"; **não vaza** que existe um draft
- [ ] Link de retorno navegável por teclado, foco visível
- [ ] Hierarquia de heading coerente; axe → 0 críticos
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 2 testes

**Commit**: `feat(review): T-29 not-found — página 404 acessível da rota /resenha`

---

### T-30 — `metadataBase` no `src/app/layout.tsx`

| | |
| --- | --- |
| **Reqs** | RVW-20 (og:url/canonical absolutas) |
| **Depends on** | — |
| **Where** | `src/app/layout.tsx` (objeto `metadata` raiz) |
| **Reuses** | export `metadata` existente; `NEXT_PUBLIC_SITE_URL` / fallback local |
| **Model** | Sonnet/Haiku |
| **Tests** | none (config; validado por build + T-31) |
| **Gate** | `npm run typecheck && npm run build` |
| **Status** | `done` (typecheck + build ✅; commit `9301774`) |

**What**: `metadataBase: new URL(NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')` no `metadata` raiz, para `og:url`/canonical relativos de `generateMetadata` (T-31) resolverem absolutos.

**Done when**:
- [ ] `metadata.metadataBase` definido (env com fallback local, sem hardcode de domínio)
- [ ] URL relativa resolve absoluta no `<head>`
- [ ] `npm run typecheck && npm run build` passa

**Commit**: `feat(seo): T-30 metadataBase no layout raiz (og:url/canonical absolutas)`

---

### T-31 — `src/app/resenha/[slug]/page.tsx` (rota + `generateMetadata` + `<article>`)

| | |
| --- | --- |
| **Reqs** | RVW-01, 02 (notFound), 05, 06, 07, 09 (omissão), 10, 19, 20, 21, 22, 23, 24, 25, 26, 27 |
| **Depends on** | T-25, T-27, T-28, T-29, T-30 |
| **Where** | `src/app/resenha/[slug]/page.tsx` |
| **Reuses** | `getPublishedReviewBySlug` (T-25); `Rating` (T-27); `BookCover` (T-28); `BookDetails` (`headingLevel={3}`); `notFound`; classes `lia-btn*`; `<main>`/skip link |
| **Model** | Sonnet/Haiku |
| **Tests** | a11y (Playwright + axe, **local-seeded** — ver TD-02) |
| **Gate** | `npm run typecheck && npm run build` (CI) · axe de rota = verificação local (seed) |
| **Status** | `done-code` (typecheck + build ✅, rota compila como dinâmica ƒ; commit `83c4565`; **axe de rota = verificação local pendente**) |

**What**: `<article>` SSR + SEO/404. `generateMetadata`: `null` → `Metadata` genérico (RVW-21); senão `title`/`description` (resumo ~160 chars) + `openGraph` (type article, url absoluta via T-30). `ReviewPage`: `notFound()` se `null`; ordem header(`h1`+contexto+`Rating` condicional) → `BookCover` → seção Ficha(`h2`+`BookDetails h3`) → seção Resenha(`h2`+parágrafos) → seção Comentários(`h2`+"em breve") → footer botão Recomendar `disabled`. `splitParagraphs(body)` → `<p>` por parágrafo; vazio → `[]`.

**Done when**:
- [ ] `/resenha/<slug>` publicado renderiza via SSR; slug inexistente e `draft` → 404 (T-29), sem 500
- [ ] `<article>` sob `<main>`; único `<h1>`; `BookDetails headingLevel=3`; `Rating` só se `rating != null`
- [ ] Seção Resenha em `<p>`; `body` vazio → sem quebra; placeholders (Comentários "em breve" + Recomendar `disabled` acessível), zero lógica
- [ ] `<head>` com title/description/OG absoluta; 404 não vaza metadados
- [ ] Teclado (foco visível, tab lógico), SSR sem JS; axe na rota seeded → 0 críticos + contraste AA
- [ ] Gate CI: `npm run typecheck && npm run build` passa

**Commit**: `feat(review): T-31 page — rota SSR /resenha/[slug] + generateMetadata + <article>`

---

### T-32 — Teste de integração RLS de `review` (local-only)

| | |
| --- | --- |
| **Reqs** | RVW-13, RVW-14, RVW-15 (verificação) |
| **Depends on** | T-23, T-24 |
| **Where** | `src/lib/review/__tests__/rls.integration.test.ts` |
| **Reuses** | estrutura `describe.skipIf(!RUN)` de [book/__tests__/rls.integration.test.ts](../../../src/lib/book/__tests__/rls.integration.test.ts) |
| **Model** | **Opus** |
| **Tests** | integration (Supabase local — **não roda no CI atual**, ver TD-02) |
| **Gate** | manual (local): `RUN_RLS_INTEGRATION=1 npx vitest run src/lib/review/__tests__/rls.integration.test.ts` |
| **Status** | `done-code` (teste criado, PULA no CI via `skipIf` — suíte verde 93/8; commit `166890e`; **execução local Supabase pendente**) |

**What**: Cliente **anon** sobre o seed (não usa `service_role` → não esbarra na TD-03). Casos: (1) anon lê só publicadas (4) + slugs do seed; (2) `draft` não aparece (filtrado, sem `42501`); (3) `insert`/`update`/`delete` anon → `42501`; (4) RLS `enabled` (toda linha lida é `published`; draft oculto apesar de existir).

**Done when**:
- [ ] Arquivo com `// LOCAL-ONLY — ver TD-02` e `describe.skipIf(!RUN)`
- [ ] (1) `select` anon → 4 + os 4 slugs; (2) draft → `null`, `error null`
- [ ] (3) escrita anon → `42501`; (4) toda linha `published`
- [ ] Chaves via env; local com Supabase → asserts passam; **pulado** no CI

**Commit**: `test(review): T-32 RLS integration — leitura pública filtrada + escrita fechada (local-only)`

---

## Status Summary

| Task | Descrição | Modelo | Depends on | Commit | Status |
| --- | --- | --- | --- | --- | --- |
| T-23 | Migration 0005 (policy + GRANT review) | Opus | — | `4a68d7f` | `done-code` (gate local pendente) |
| T-24 | seed.sql — 4 published + 5º book/review draft | Sonnet/Haiku | T-23 | `0ffb94c` | `done-code` (gate local pendente) |
| T-25 | review/queries.ts — getPublishedReviewBySlug + cache() | Sonnet/Haiku | — | `59747c8` | `done` |
| T-26 | review/formatRating.ts — util de nota pt-BR | Sonnet | — | `fd3710e`+`7f0d925` | `done` (4 testes) |
| T-27 | Rating.tsx — exibição numérica acessível | Opus | T-26 | `fd3710e`+`7f0d925` | `done` (5 testes) |
| T-28 | BookCover.tsx + .lia-card__media--type + teste | Opus | — | `6ed6ab9` | `done` (5 testes) |
| T-29 | not-found.tsx (404 acessível) + teste | Sonnet/Haiku | — | `f00309d` | `done` (4 testes) |
| T-30 | layout.tsx metadataBase | Sonnet/Haiku | — | `9301774` | `done` |
| T-31 | page.tsx — rota SSR + generateMetadata + article | Sonnet/Haiku | T-25,27,28,29,30 | `83c4565` | `done-code` (axe rota local pendente) |
| T-32 | RLS integration test (local-only) | Opus | T-23,24 | `166890e` | `done-code` (exec. local pendente) |

**10 tasks · 27/27 reqs mapeados · 10/10 implementadas e commitadas.** Gates de código verdes (typecheck/build/lint + suíte 93 passed / 8 skipped). **Verificação local pendente** (Supabase/Docker indisponível na sessão de Execute): T-23/T-24 (`db reset` + inspeção), T-31 (axe da rota seeded), T-32 (`RUN_RLS_INTEGRATION=1`). Padrão TD-02 — reproduzível localmente.

> **Lembrete TD-03 (Alta):** a T-23 concede GRANT **apenas** a `review`. TD-03 permanece **ABERTA** para as demais tabelas e deve ser resolvida **antes do M2 (`reviews-crud`)**. Concluir a review-page **não** a fecha.
