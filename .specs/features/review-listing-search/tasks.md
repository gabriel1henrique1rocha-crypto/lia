# review-listing-search — Tasks

**Design**: [design.md](design.md) (DD-1..10, 27/27) · **Spec**: [spec.md](spec.md) (LST-01..27) · **Context**: [context.md](context.md) (C-1..C-5, D-04 Aceita)
**Status**: Draft — **aguardando revisão antes de Execute**

> **Leitura via `anon`** (RLS no controle — validada em produção; **sem `service_role`** no caminho público, **TD-04**). **Nenhuma migration nova** nesta feature (LST-19): reusa policies/GRANTs `0004` (`book`+`genre`) e `0005` (`review`).
> **a11y WCAG 2.1 AA é DoD embutida** — não há task de a11y separada; cada task de UI carrega foco visível, teclado, semântica e o anúncio de resultados no seu "Done when".
> **Reuso explícito:** `BookCover` e `Rating` **não são recriados** (consumidos como estão); o `excerpt()` é **extraído** (T1), não reescrito. Componentes consomem **só tokens/classes `lia-*`** (D-07) — sem hex/fonte hard-coded.

---

## Gate Check Commands

Derivados do CI e da lição pós-PR #2 (STATE.md — o gate **deve** incluir `format:check`). **Não existe `.specs/codebase/TESTING.md`**; a matriz de teste abaixo é derivada do precedente firme do repo (Vitest unit co-locado em `__tests__/`; Playwright+axe na rota; integração RLS/DB local-only sob flag — TD-02).

| Nível | Comando | Quando |
| --- | --- | --- |
| **quick** | `npm run typecheck && npm run lint && npm run format:check && npm run test` | toda task de lógica/componente (unit) |
| **full** | quick **+** `npm run test:a11y` **+** `npm run lhci` | tasks que mudam a rota `/` (axe/Lighthouse) |
| **build** | `npm run build` | tasks só-CSS/tokens (compilação) |
| **integration (local-only, TD-02)** | `npx supabase start && npx supabase db reset` → `$env:RUN_RLS_INTEGRATION='1'; npx vitest run <arquivo>` | query contra Supabase local; **CI PULA** via `describe.skipIf` |

**Baseline atual:** `93 passed / 8 skipped`. Todo "Done when" exige **os testes anteriores seguem passando** + os novos passam (sem deleção silenciosa).

### Matriz de cobertura derivada (precedente do repo)

| Camada criada/modificada | Tipo de teste exigido | Precedente |
| --- | --- | --- |
| Função pura (`lib/**` util, parser, escape) | **unit** (Vitest) | `formatRating.test.ts`, `isbn.test.ts` |
| Componente React (render/semântica/aria) | **unit** (Testing Library) | `Rating.test.tsx`, `BookDetails.test.tsx` |
| Camada de query (Supabase) | **integration** local-only (flag, skip no CI) | `review/__tests__/rls.integration.test.ts` (TD-02) |
| `page.tsx`/`layout.tsx` SSR wiring | **a11y de rota** (axe/Lighthouse no CI) + build | `review-page`: `page.tsx` sem unit, coberto por axe |
| Tokens `@theme` / `@layer components` (CSS) | **none** (build compila; contraste validado no axe de rota) | `globals.css` do M0 |

---

## Execution Plan

### Phase 1 — Fundação: lógica pura + tokens (paralela)

```
T1  (excerpt util)      ─┐
T2  (listingParams)     ─┤  arquivos distintos → [P]
T3  (tokens sálvia @theme) ─┘   (T3 precede T5: mesmo globals.css)
```

### Phase 2 — Query + estilos

```
T2 ──► T4  (queries: list/featured/options)
T3 ──► T5  (@layer components: grid/carrossel/paginação/empty)
          (T4 ∥ T5 — arquivos distintos)
```

### Phase 3 — Componentes (paralela; nenhum toca globals.css)

```
T1 ──► T6  (ReviewCard) ──► T12 (FeaturedCarousel)
        T7  (ResultsCount)                 [P]
T2,T4 ─► T8  (ListingControls)             [P]
T2 ───► T9  (Pagination)                   [P]
T2 ───► T10 (EmptyState)                   [P]
        T11 (SiteFooter)                   [P]
```

### Phase 4 — Integração (sequencial)

```
T11 ──► T13 (layout: wordmark→link + footer)
T2,T4,T5,T6,T7,T8,T9,T10,T12,T13 ──► T14 (page.tsx home SSR + generateMetadata)
```

---

## Task Breakdown

### T1: Extrair `excerpt()` para util compartilhado [P]

**What**: Mover a função `excerpt()` local da review-page para `src/lib/review/excerpt.ts` (export nomeado, mesmo comportamento: normaliza espaços, corta em palavra, `…` no fim; `max` parametrizável) e fazer `/resenha/[slug]` importá-la.
**Where**: `src/lib/review/excerpt.ts` (novo) · `src/app/resenha/[slug]/page.tsx` (passa a importar; remove a cópia local)
**Depends on**: None
**Reuses**: a implementação já existente em [resenha/[slug]/page.tsx:11-18](../../../src/app/resenha/[slug]/page.tsx#L11-L18) (movida, não reescrita)
**Requirement**: LST-02 (trecho do card), DD-8
**Model**: **Sonnet** (refactor mecânico de código já em produção — não pode regredir a meta description da review-page)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `excerpt(body: string | null, max = 160): string` exportada de `src/lib/review/excerpt.ts`
- [ ] `/resenha/[slug]` importa de `@/lib/review/excerpt`; **zero** cópia local remanescente; meta description idêntica à atual
- [ ] Unit test cobre: texto curto (sem corte), corte em palavra + `…`, `null`/vazio → `''`, exatamente no limite
- [ ] Gate **quick** passa; baseline 93 segue verde + novos passam

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/lib/review/__tests__/excerpt.test.ts` → todos verdes; `npm run build` compila a review-page.
**Commit**: `refactor(review): extrai excerpt() para util compartilhado (DD-8)`

---

### T2: `listingParams` — parser + `buildListingHref` + `escapeLike` [P]

**What**: Módulo de lógica pura de listagem: (a) `parseListingParams(searchParams)` que valida/normaliza `q` (trim, máx ~100), `genero`/`autor` (string), `nota` (int 1–5), `ordem` (∈ `recentes|nota|titulo`, default `recentes`), `pagina` (int ≥1, default 1) — **inválido → default silencioso, nunca lança**; (b) `buildListingHref(params, overrides)` que serializa preservando os demais params; (c) `escapeLike(term)` conforme algoritmo explícito do design §3 (escapa `\`→`\\` **primeiro**, depois `%`→`\%`, `_`→`\_`). Exporta o tipo `ListingParams`.
**Where**: `src/lib/review/listingParams.ts` (novo)
**Depends on**: None
**Reuses**: padrão de tipos derivados do schema (queries.ts); convenção de módulos puros em `src/lib/`
**Requirement**: LST-06 (escapeLike), LST-07, LST-11, LST-12 (default), LST-13, edge cases (`?nota=abc`/`?pagina=999`/`?ordem=xyz` → normaliza sem 500), DD-1, DD-2
**Model**: **Opus** (segurança: `escapeLike` = injeção de padrão LIKE; normalização defensiva contra params hostis)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `parseListingParams` nunca lança: valores inválidos caem no default (tabela de casos no unit test)
- [ ] `escapeLike`: ordem correta (`\` primeiro); `50%`→`50\%`, `a_b`→`a\_b`, `100\`→`100\\`; **teste unitário dedicado** cobre os três (LST-06 / edge case)
- [ ] `buildListingHref(params, { pagina: 2 })` preserva `q/genero/autor/nota/ordem` e troca só `pagina`; omite chaves em default para URLs limpas
- [ ] `ListingParams` exportado e usado como contrato único (query, links, eco do empty)
- [ ] Gate **quick** passa; novos unit tests verdes
- [ ] **Nota no código** apontando §3 sobre a dependência do ESCAPE default `\` do PostgreSQL a **verificar** na T4 (não presumir)

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/lib/review/__tests__/listingParams.test.ts` → verde, incluindo os 3 casos de `escapeLike` e os casos-limite de parse.
**Commit**: `feat(review): parser de listagem + buildListingHref + escapeLike (DD-1/2, LST-06)`

---

### T3: Tokens sálvia no `@theme` (marca — seção destaque) [P]

**What**: Adicionar `--color-sage-100` e `--color-sage-700` ao bloco `@theme` de `globals.css` (valores da marca, alinhados ao par pastel do `LIA Marca.html`), com os contrastes anotados como comentário: `ink-900`/`sage-100` = **13.0:1 (AAA)**, `sage-700`/`sage-100` = **5.5:1 (AA)**. Só declaração de token — **sem** consumo aqui.
**Where**: `src/app/globals.css` (`@theme`)
**Depends on**: None
**Reuses**: padrão de tokens de cor existente (`--color-oxblood-*`, `--color-paper-*`)
**Requirement**: LST-26/DD-7 (habilitador); **fecha a pendência de STATE.md** "cores sálvia — decisão pendente, resolver antes de a listagem consumir tokens"
**Model**: **Opus** (contraste/design-system — a razão AA/AAA precisa fechar antes de virar acento de marca)

> **Decisão resolvida (2026-07-06):** adotar sálvia — confirmado pelo usuário no início do Execute. Verificação prévia constatou que os tokens **não existiam** no repo (`globals.css`/histórico git sem `--sage-*`; único "sage" era falso positivo em "mensagens"). Portanto **T3 CRIA** os tokens (não é no-op nem decisão) e T5 apenas consome.

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `--color-sage-100` e `--color-sage-700` no `@theme`; utilitários Tailwind (`bg-sage-100`, `text-sage-700`) resolvem
- [ ] Comentário com as razões de contraste (13.0:1 / 5.5:1) e a referência a DD-7
- [ ] **Zero hex** fora do `@theme` (nenhum consumo hard-coded)
- [ ] Gate **build** passa (CSS compila)

**Tests**: none (declaração de token; contraste validado no axe de rota em T14) · **Gate**: build
**Verify**: `npm run build`; inspecionar `globals.css` — tokens presentes no `@theme`.
**Commit**: `feat(design): tokens sálvia no @theme p/ seção destaque (DD-7)`

---

### T4: Camada de query — `listPublishedReviews` / `listFeaturedReviews` / `listFilterOptions`

**What**: Estender `src/lib/review/queries.ts`: (a) tipo `ReviewListItem` (subset tipado + `book{title,author,genre{name,slug}}` + `excerpt` derivado no servidor — **não** carrega `body` inteiro ao card); (b) `listPublishedReviews(params): Promise<{rows, total}>` — `book!inner`, `.eq('status','published')` **explícito**, `.ilike('title', '%'+escapeLike(q)+'%')` quando há `q`, `.eq/.gte` dos filtros, mapa de ordenação (§3: recentes/nota nulls-last/título), `.range()` + `count:'exact'` **numa viagem**; (c) `listFeaturedReviews()` — mesma base, `published_at desc` + `limit(4)`, sem filtros; (d) `listFilterOptions()` — query leve das publicadas, dedupe/sort em JS.
**Where**: `src/lib/review/queries.ts` (estende) · teste em `src/lib/review/__tests__/listing.integration.test.ts`
**Depends on**: T2 (`escapeLike`, tipo `ListingParams`)
**Reuses**: `createServerClient()` (anon), `getPublishedReviewBySlug` como padrão (`status='published'` explícito), `BookView`/`ReviewView`, `Tables<'review'>`
**Requirement**: LST-06, LST-08, LST-09, LST-10, LST-11, LST-12, LST-14, LST-18, LST-19, LST-20, LST-27, DD-3/4/5
**Model**: **Opus** (segurança: `ilike`+escape, `!inner`, `status='published'` como defesa em profundidade além da RLS; TD-04)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `listPublishedReviews` compõe busca+filtros+ordem+`range`+`count` numa **única** chamada; retorna `{rows: ReviewListItem[], total}`
- [ ] `.eq('status','published')` **explícito** em **todas** as três queries; leitura via **anon** (`createServerClient`) — **sem** `service_role` (TD-04); **nenhuma migration** criada (LST-19)
- [ ] `escapeLike` aplicado ao `q`; **verificado** (Context7/docs supabase-js+PostgREST) que o `ilike` gerado preserva `\` como escape default — resultado da verificação anotado no código (§3, Knowledge Chain)
- [ ] Ordenação: `recentes`→`published_at desc` (default), `nota`→`rating desc` **nulls last**, `titulo`→`title asc`
- [ ] `excerpt` derivado no servidor (reusa T1); `body` completo não trafega ao card
- [ ] Comentário apontando D-04 (full scan do `ilike` aceito no MVP; gatilho pg_trgm/tsvector)
- [ ] **Integration test local-only** (padrão TD-02, `skipIf` no CI): busca `dom` retorna só publicadas; filtro gênero+nota restringe; `draft` nunca aparece; `range` fatia; `total` bate; `50%` casa literal
- [ ] Gate **quick** passa no CI (teste de integração PULA); teste de integração **verde localmente**

**Tests**: integration (local-only) · **Gate**: quick (CI) + integration (local)
**Verify**: `npx supabase start && npx supabase db reset`; `$env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/review/__tests__/listing.integration.test.ts` → verde; draft invisível confirmado.
**Commit**: `feat(review): listPublishedReviews/Featured/FilterOptions via anon (LST-14/19/20/27)`

---

### T5: Estilos das novas peças — `@layer components`

**What**: Adicionar a `globals.css` (`@layer components`) as classes das peças novas — grid de resultados (`lia-grid`), seção destaque/carrossel (`lia-featured*` com fundo `--color-sage-100`, eyebrow `--color-sage-700`, degradê `overflow-x`+`scroll-snap` sem JS), paginação (`lia-pagination*`), estado vazio (`lia-empty*`), controles/selects (reusa `lia-field`/`lia-btn`; wrap do form). **Só tokens** (inclui sálvia da T3), sem hex; anel de foco global (M0) intacto nos elementos interativos.
**Where**: `src/app/globals.css` (`@layer components`)
**Depends on**: T3 (tokens sálvia) — **mesmo arquivo**, portanto sequencial após T3
**Reuses**: `lia-card`, `lia-field`, `lia-btn`, `lia-link` existentes; tokens `--focus-ring*`, `--surface-*`, `--border-*`
**Requirement**: LST-25 (contraste/estrutura visual), DD-5 (degradê sem JS), DD-6, DD-7
**Model**: **Sonnet** (port mecânico do wireframe Tela 1 para classes; disciplina de só-tokens)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Classes `lia-grid`, `lia-featured*`, `lia-pagination*`, `lia-empty*` no `@layer components`, **só** com `var(--token)` (sálvia inclusa)
- [ ] Carrossel sem JS: `overflow-x`+`scroll-snap` na trilha (degradação DD-5); grid responsivo (12 = múltiplo de 2/3/4 colunas)
- [ ] `aria-current="page"` da paginação com distinção **não-cromática** (peso/fundo) além de cor
- [ ] **Zero hex** hard-coded; `npm run format:check` limpo
- [ ] Gate **build** passa

**Tests**: none (CSS; contraste/contraste-real validados no axe de rota T14) · **Gate**: build
**Verify**: `npm run build`; abrir `/styleguide`/`/` no dev não quebra layout existente.
**Commit**: `feat(design): classes @layer components da listagem (grid/carrossel/paginação/empty)`

---

### T6: `ReviewCard` — componente compartilhado [P]

**What**: Server Component `ReviewCard` (o componente que a feature **firma**, LST-26). Props `{ slug, title, author, rating, excerpt }`. `<article>` dentro de `<li>`; título é o link (`a.lia-card`) que expande o alvo ao card inteiro → `/resenha/[slug]`. Consome `BookCover` (capa tipográfica), `Rating` (omitido se `rating` nulo — responsabilidade do card), `excerpt` já cortado. Só tokens/classes `lia-card__*`.
**Where**: `src/components/review/ReviewCard.tsx` (novo) · teste em `src/components/review/__tests__/ReviewCard.test.tsx`
**Depends on**: T1 (excerpt — o card recebe o trecho já cortado, mas o tipo/uso alinha com DD-8)
**Reuses**: `BookCover` ([BookCover.tsx](../../../src/components/book/BookCover.tsx)) e `Rating` ([Rating.tsx](../../../src/components/review/Rating.tsx)) **sem recriar**; classes `lia-card`
**Requirement**: LST-01, LST-02, LST-26
**Model**: **Sonnet** (card estático — scaffolding mecânico; a11y de semântica embutida)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Renderiza `BookCover` + título (link p/ `/resenha/[slug]`) + autor + `Rating` (só quando `rating != null`) + trecho
- [ ] **a11y**: `<article>` em `<li>`; nome acessível do link = título; foco visível (anel global) no link; sem `div` clicável (link nativo); sem hex/fonte nova
- [ ] Unit test: renderiza campos; link tem `href` correto e nome acessível = título; `rating` nulo → **sem** nó de nota; capa expõe `aria-label`
- [ ] Gate **quick** passa

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx`.
**Commit**: `feat(review): ReviewCard compartilhado (BookCover+Rating, LST-26)`

---

### T7: `ResultsCount` — anúncio de resultados (aria-live) [P]

**What**: Componente `ResultsCount` que renderiza a contagem "Resenhas · N" em `<p role="status">` (DD-9). Isola o nó `aria-live` para torná-lo unit-testável (LST-23). Número em pt-BR.
**Where**: `src/components/listing/ResultsCount.tsx` (novo) · teste co-locado
**Depends on**: None
**Reuses**: convenção `sr-only`/semântica do `Rating`; nenhuma cor nova
**Requirement**: LST-03, LST-23, DD-9
**Model**: **Opus** (o `aria-live` é o ponto de a11y que você destacou — mecânica de live region é sutil, ver DD-9)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `<p role="status">Resenhas · {total}</p>`; total formatado pt-BR
- [ ] Unit test assevera `role="status"` e o texto com a contagem
- [ ] Comentário referenciando DD-9 (em navegação SSR o anúncio vem do `<title>` + ordem de leitura; `role="status"` é a camada progressiva/estado vazio — **não rouba foco**)
- [ ] Gate **quick** passa

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/components/listing/__tests__/ResultsCount.test.tsx`.
**Commit**: `feat(listing): ResultsCount com role="status" (LST-03/23, DD-9)`

---

### T8: `ListingControls` — form de busca + filtros + ordenação [P]

**What**: `<form method="GET" action="/" role="search">` com campo `q` rotulado (`lia-field`), 4 selects rotulados (Gênero, Autor, Nota mín., Ordenar por) e botão "Buscar" (`lia-btn--primary`). Recebe `options` (de `listFilterOptions`) e `params` atuais (selects pré-selecionados / eco do `q`). Server Component puro (sem estado).
**Where**: `src/components/listing/ListingControls.tsx` (novo) · teste co-locado
**Depends on**: T2 (tipo `ListingParams`, eco dos params), T4 (shape de `listFilterOptions`)
**Reuses**: `lia-field`, `lia-btn`; anel de foco global
**Requirement**: LST-05, LST-07, LST-08, LST-09, LST-10, LST-11, LST-12, LST-22
**Model**: **Opus** (carga de a11y: rótulos programáticos, `role="search"`, teclado, ordem)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `form method="GET" action="/"` com `q` + 4 selects, cada controle com `<label>` **associado** (`for`/`id`); botão "Buscar" primário
- [ ] Selects pré-selecionam o valor de `params`; `q` ecoa o termo atual; `ordem` default = `recentes`
- [ ] **a11y**: `role="search"`; navegável por teclado; foco visível; sem `<div>` como controle; funciona **sem JS** (submit GET navega)
- [ ] Unit test: labels associados (via `getByLabelText`); selects renderizam `options`; valores atuais pré-selecionados; método GET/action `/`
- [ ] Gate **quick** passa

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/components/listing/__tests__/ListingControls.test.tsx`.
**Commit**: `feat(listing): ListingControls (form GET busca+filtros+ordem, LST-05/08/09/10/12)`

---

### T9: `Pagination` — paginador acessível [P]

**What**: `<nav aria-label="Paginação">` com ‹ › + números e reticências (padrão `‹ 1 2 3 … ›`), links via `buildListingHref` preservando `q/genero/autor/nota/ordem`; página atual com `aria-current="page"` **e** distinção não-cromática; ‹ › com nome acessível ("Página anterior/próxima") e desabilitados nas bordas.
**Where**: `src/components/listing/Pagination.tsx` (novo) · teste co-locado
**Depends on**: T2 (`buildListingHref`, `pagina`/`pageSize`)
**Reuses**: `buildListingHref` (T2); classes `lia-pagination*` (T5, aplicadas em runtime)
**Requirement**: LST-13, LST-22
**Model**: **Opus** (a11y: `aria-current`, nomes acessíveis, estado de borda)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Links com `href` de `buildListingHref` preservando todos os params; `?pagina=n`
- [ ] Página atual com `aria-current="page"` + distinção não só por cor
- [ ] ‹ › com nome acessível; nas bordas ficam **desabilitados** (não um link morto)
- [ ] **a11y**: `<nav aria-label>`; links nativos; foco visível
- [ ] Unit test: `aria-current` na página ativa; hrefs preservam params; ‹ › desabilitado na primeira/última; nome acessível das setas
- [ ] Gate **quick** passa

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/components/listing/__tests__/Pagination.test.tsx`.
**Commit**: `feat(listing): Pagination com aria-current + preservação de params (LST-13)`

---

### T10: `EmptyState` — sem-resultados + acervo-vazio [P]

**What**: Bloco `role="status"` "Nenhuma resenha encontrada" que **ecoa** `q`/filtros ativos (texto, não só ícone/cor) e oferece recuperação por **links** ("Limpar filtros" → `/`; "Ver todas as resenhas" → `/`). **Variante** para acervo vazio (LST-04): mensagem informativa distinta, **sem** ações de recuperação.
**Where**: `src/components/listing/EmptyState.tsx` (novo) · teste co-locado
**Depends on**: T2 (`buildListingHref` p/ "limpar"; eco de `params`)
**Reuses**: `lia-empty*` (T5); `lia-link`/`lia-btn`
**Requirement**: LST-04, LST-15, LST-22
**Model**: **Opus** (a11y: `role="status"`, recuperação sem depender de cor/JS)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Variante **sem-resultados**: `role="status"`, ecoa termo/filtros, 2 **links** de recuperação (funcionam sem JS)
- [ ] Variante **acervo-vazio**: mensagem informativa, **sem** ações de recuperação (distinta da busca vazia — LST-04)
- [ ] **a11y**: recuperação por link nativo; texto (não só ícone); foco visível
- [ ] Unit test: `role="status"`; eco do termo; links com `href` p/ `/`; a variante acervo-vazio não renderiza recuperação
- [ ] Gate **quick** passa

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/components/listing/__tests__/EmptyState.test.tsx`.
**Commit**: `feat(listing): EmptyState (sem-resultados + acervo-vazio, LST-04/15)`

---

### T11: `SiteFooter` — rodapé mínimo [P]

**What**: `<footer>` mínimo (landmark `contentinfo`) com texto do site, **sem links mortos** (DD-10/C-2). Fecha a ordem de leitura da Tela 1.
**Where**: `src/components/listing/SiteFooter.tsx` (novo) · teste co-locado
**Depends on**: None
**Reuses**: tokens de texto/borda existentes
**Requirement**: LST-21 (rodapé da ordem de leitura), DD-10
**Model**: **Haiku** (scaffolding mecânico — sem lógica)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `<footer>` com texto do site; **sem** links para rotas inexistentes
- [ ] **a11y**: landmark `contentinfo` único; sem hex novo
- [ ] Unit test: renderiza `contentinfo`; sem links mortos
- [ ] Gate **quick** passa

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/components/listing/__tests__/SiteFooter.test.tsx`.
**Commit**: `feat(listing): SiteFooter mínimo (contentinfo, DD-10)`

---

### T12: `FeaturedCarousel` — destaque server + wrapper client fino [P]

**What**: Seção "Em destaque" (DD-5). Conteúdo **server-rendered**: `<section aria-labelledby>` (eyebrow sálvia) com os 4 slides = links completos (reusa `ReviewCard` como slide). Comportamento de carrossel (setas ‹ › + indicadores) num wrapper client **fino** (`'use client'` só no controle; slides como `children`). **Sem timer / sem giro automático por construção.** Sem JS → degrada para lista rolável (`overflow-x`+`scroll-snap`, classes T5).
**Where**: `src/components/review/FeaturedCarousel.tsx` (+ wrapper client no mesmo dir) · teste co-locado
**Depends on**: T6 (reusa `ReviewCard` no slide). Estilos sálvia/degradê vêm de T3/T5 (validados no axe de rota T14).
**Reuses**: `ReviewCard` (T6); `BookCover`/`Rating` via ele; classes `lia-featured*` (T5)
**Requirement**: LST-16, LST-17, LST-18, LST-22
**Model**: **Opus** (maior risco de a11y da feature — foco em slides ocultos, anúncio de posição, teclado; interação client)

> **Confirmado no design (não auto-rotaciona):** DD-5/§4 e LST-16 — **sem timer, nunca gira sozinho**. Portanto **não** há gate de pausa WCAG 2.2.2 a resolver; a decisão de simplificar para destaque estático **não é necessária**.

**Done when**:
- [ ] **Sem timer**: nenhuma rotação automática (verificável por ausência de `setInterval`/`setTimeout` de avanço)
- [ ] Setas são `<button>` focáveis com foco visível; avançam/voltam **só por ação**
- [ ] Slides = links completos (capa+título+autor+nota) via `ReviewCard`; posição anunciada ("Slide n de 4"); dots decorativos `aria-hidden`
- [ ] **Foco não fica preso em slide fora de vista** (conteúdo oculto não recebe foco de teclado indevido, ou permanece alcançável) — validado no unit + no axe de rota
- [ ] **Sem JS**: a região degrada para lista rolável com **todo** o conteúdo alcançável (DD-5)
- [ ] Unit test: ausência de timer; setas são `button` com nome acessível; slides têm `href`; posição anunciada
- [ ] Gate **quick** passa

**Tests**: unit · **Gate**: quick (a11y de contraste/rota fecha em T14)
**Verify**: `npx vitest run src/components/review/__tests__/FeaturedCarousel.test.tsx`; navegação por teclado no dev não dispara movimento sem ação.
**Commit**: `feat(review): FeaturedCarousel sem giro automático (LST-16/17/18, DD-5)`

---

### T13: `layout.tsx` — wordmark→link + `<footer>`

**What**: Ajuste mínimo do layout raiz (DD-10): (a) wordmark "LIA" vira **link para `/`** (hoje `<span>`); (b) montar `<SiteFooter/>` após o `<main>`; (c) **sem `<nav>`** (só há `/` pública além das resenhas). Skip link + `<header>` landmark permanecem intactos.
**Where**: `src/app/layout.tsx` (modifica)
**Depends on**: T11 (`SiteFooter`)
**Reuses**: header/skip link existentes ([layout.tsx](../../../src/app/layout.tsx)); `SiteFooter` (T11)
**Requirement**: LST-21, LST-24 (não cria 2º `<main>`), DD-10
**Model**: **Sonnet** (wiring de layout — mecânico; preservar landmarks)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Wordmark é `<a href="/">` com nome acessível; skip link `#main` segue funcional; `<header>` e `<main id="main">` intactos (único `<main>`)
- [ ] `<SiteFooter/>` renderiza como `contentinfo` após o `<main>`; **sem** `<nav>` com links mortos
- [ ] **a11y**: ordem header → main → footer; axe da rota `/` sem críticos novos
- [ ] Gate **full** passa (axe/Lighthouse na `/`)

**Tests**: a11y (rota) · **Gate**: full
**Verify**: `npm run test:a11y` (axe `/` 0 críticos); navegar por teclado: skip link → header (wordmark linka `/`) → main → footer.
**Commit**: `feat(layout): wordmark→link e footer contentinfo (DD-10, LST-21)`

---

### T14: `page.tsx` — home SSR + `generateMetadata`

**What**: Substituir o placeholder por home real. Server Component `async`: `parseListingParams(await searchParams)` → `Promise.all([listFeaturedReviews(), listPublishedReviews(params), listFilterOptions()])` → renderiza a estrutura semântica do design §2 (único `<h1>Resenhas</h1>`; `<section>` destaque com `FeaturedCarousel`; `ListingControls`; `<section>` resultados com `ResultsCount` + `<ol>` de `ReviewCard`; `Pagination` **ou** `EmptyState`). `generateMetadata` conforme §5: `title` reflete estado (busca), **canonical sempre `/`**, `robots.index=false` quando **qualquer** searchParam ativo (inclui `pagina>1`), `index` na home limpa. Normaliza `pagina` além do total após o `count`.
**Where**: `src/app/page.tsx` (substitui)
**Depends on**: T2, T4, T5, T6, T7, T8, T9, T10, T12, T13
**Reuses**: todas as peças acima; padrão de `generateMetadata` da review-page; `metadataBase` do layout
**Requirement**: LST-01, LST-03, LST-04, LST-11, LST-21, LST-23, LST-24, LST-25 (+ integra 05–18)
**Model**: **Opus** (integra o `aria-live` DD-9 + `generateMetadata` SEO §5 — canonical/noindex por param é correção sensível; ponto onde LST-23/24/25 aterrissam)

**Tools**: MCP: NONE · Skill: `/verify` (dirigir a rota `/` no Execute), `/code-review` (opcional pós-implementação)

**Done when**:
- [ ] `searchParams` (Promise) parseado; 3 queries no `Promise.all`; SSR entrega grid/contagem/paginação/vazio **no primeiro byte** (view-source tem os cards)
- [ ] Estrutura §2: **único** `<h1>`; sections com `aria-labelledby`; resultados em `<ol>/<li>`; `ResultsCount` como 1º conteúdo da região de resultados; sob o `<main>` do layout (não cria 2º `<main>`)
- [ ] Empty: `total===0` **com** filtros → `EmptyState` sem-resultados; **sem** filtros e acervo vazio → variante acervo-vazio (LST-04)
- [ ] `pagina` além do total normalizada para a última válida (sem 500)
- [ ] `generateMetadata`: canonical **sempre `/`**; `robots:{index:false,follow:true}` se **algum** de `q/genero/autor/nota/ordem/pagina` presente, senão `index,follow`; title reflete busca (DD-9 fonte 1)
- [ ] **a11y (DoD)**: axe `/` **0 críticos**; contraste ≥ 4.5:1 (par sálvia validado); ordem de foco skip→header→destaque→busca→filtros→resultados→paginação→footer; **funciona sem JS** (form GET + links)
- [ ] Gate **full** passa (typecheck/lint/format/test + axe `/` + Lighthouse)

**Tests**: a11y (rota) + build · **Gate**: full
**Verify**: `npm run build && npm run start`; `curl localhost:3000/` → cards no HTML (SSR); `?q=dom` reproduz; JS off → busca/filtros/paginação navegam; `npm run test:a11y` 0 críticos; conferir `<link rel=canonical href="/">` e `robots noindex` com param ativo.
**Commit**: `feat(home): página / SSR com listagem/busca/filtros/paginação/destaque (LST-01/03/04/21/23/24/25)`

---

## Mapa Requisito → Task (27/27, sem órfãos)

| Req | Task(s) | Req | Task(s) |
| --- | --- | --- | --- |
| LST-01 | T6, T14 | LST-15 | T10 |
| LST-02 | T1, T6 | LST-16 | T12 |
| LST-03 | T4, T7, T14 | LST-17 | T12 |
| LST-04 | T10, T14 | LST-18 | T4, T12 |
| LST-05 | T8 | LST-19 | T4 |
| LST-06 | T2, T4 | LST-20 | T4 |
| LST-07 | T2, T8 | LST-21 | T11, T13, T14 |
| LST-08 | T4, T8 | LST-22 | T8, T9, T12 |
| LST-09 | T4, T8 | LST-23 | T7, T14 |
| LST-10 | T4, T8 | LST-24 | T14 |
| LST-11 | T2, T4, T8 | LST-25 | T3, T5, T8, T12, T14 |
| LST-12 | T2, T4, T8 | LST-26 | T6 |
| LST-13 | T2, T9 | LST-27 | T4 |
| LST-14 | T4 | | |

**Cobertura: 27/27.** Toda task traça ≥1 requisito; nenhum requisito sem task.

---

## Validação pré-aprovação (3 gates obrigatórios)

### Gate 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T1 excerpt util | 1 função + 1 consumo | ✅ |
| T2 listingParams | 3 funções puras coesas (1 arquivo) | ✅ coeso |
| T3 tokens sálvia | 2 tokens `@theme` | ✅ |
| T4 queries | 3 fns + 1 tipo (1 módulo coeso) | ✅ coeso |
| T5 estilos | classes `@layer` (1 arquivo) | ✅ |
| T6 ReviewCard | 1 componente | ✅ |
| T7 ResultsCount | 1 componente | ✅ |
| T8 ListingControls | 1 componente (form) | ✅ |
| T9 Pagination | 1 componente | ✅ |
| T10 EmptyState | 1 componente (2 variantes) | ✅ |
| T11 SiteFooter | 1 componente | ✅ |
| T12 FeaturedCarousel | 1 componente + wrapper fino | ✅ coeso |
| T13 layout | 1 arquivo (ajuste) | ✅ |
| T14 page | 1 arquivo (integração) | ✅ |

### Gate 2 — Diagrama × Definição (cross-check de dependências)

| Task | Depends on (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz Phase 1) | ✅ |
| T2 | None | (raiz Phase 1) | ✅ |
| T3 | None | (raiz; precede T5) | ✅ |
| T4 | T2 | T2→T4 | ✅ |
| T5 | T3 | T3→T5 | ✅ |
| T6 | T1 | T1→T6 | ✅ |
| T7 | None | (raiz Phase 3) | ✅ |
| T8 | T2, T4 | T2,T4→T8 | ✅ |
| T9 | T2 | T2→T9 | ✅ |
| T10 | T2 | T2→T10 | ✅ |
| T11 | None | (raiz Phase 3) | ✅ |
| T12 | T6 | T6→T12 | ✅ |
| T13 | T11 | T11→T13 | ✅ |
| T14 | T2,T4,T5,T6,T7,T8,T9,T10,T12,T13 | todas→T14 | ✅ |

Nenhuma task `[P]` depende de outra `[P]` do mesmo grupo (T3/T5 são sequenciais no mesmo `globals.css` e **não** estão marcadas `[P]` entre si). ✅

### Gate 3 — Co-locação de testes (× matriz derivada)

| Task | Camada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | função pura | unit | unit | ✅ |
| T2 | função pura | unit | unit | ✅ |
| T3 | token CSS | none | none | ✅ |
| T4 | query Supabase | integration (local-only) | integration | ✅ |
| T5 | CSS `@layer` | none | none | ✅ |
| T6 | componente | unit | unit | ✅ |
| T7 | componente | unit | unit | ✅ |
| T8 | componente | unit | unit | ✅ |
| T9 | componente | unit | unit | ✅ |
| T10 | componente | unit | unit | ✅ |
| T11 | componente | unit | unit | ✅ |
| T12 | componente | unit | unit | ✅ |
| T13 | layout SSR | a11y de rota | a11y (rota) | ✅ |
| T14 | page SSR | a11y de rota | a11y (rota)+build | ✅ |

Sem `Tests: none` indevido (só CSS/tokens). Nenhuma task adia teste para outra. ✅

---

## Alocação de modelo (resumo)

| Modelo | Tasks | Racional |
| --- | --- | --- |
| **Opus** | T2, T3, T4, T7, T8, T9, T10, T12, T14 | segurança (`escapeLike`/`ilike`, TD-04), contraste/design-system (sálvia), carga de a11y (controles, paginação, empty, carrossel), `aria-live`/SEO |
| **Sonnet** | T1, T5, T6, T13 | refactor seguro, CSS mecânico (só tokens), card estático, wiring de layout |
| **Haiku** | T11 | scaffolding puro (footer) |

---

## Notas de Execute (não executar agora)

- **Sem migration** nesta feature (LST-19); leitura **anon** reusa `0004`/`0005`; **nunca** `service_role` no caminho público (TD-04).
- **Verificação pendente (Knowledge Chain)** em T4: confirmar o comportamento de escape do `ilike` do supabase-js/PostgREST (Context7/docs) antes de fechar `escapeLike` — não presumir.
- **Decisão resolvida (2026-07-06):** adotar sálvia (confirmado no Execute). Os tokens `--color-sage-100` (#dce5d3, fundo) / `--color-sage-700` (#4f5c47, eyebrow) **não existiam** no repo → T3 os **cria** no `@theme`; T5 consome.
- **Testes de banco** (T4) rodam **local-only** (TD-02) — o CI os pula; rodar a verificação local antes do PR.

**PARAR aqui — aguardando revisão do design corrigido + tasks.md antes de avançar para Execute.**
