# review-listing-search — Design

> Fase Design da feature especificada em [spec.md](spec.md) (LST-01..27) com decisões de [context.md](context.md) (C-1..C-5, D-04 **Aceita** — server-side `ilike`).
> Base visual: **Tela 1** de [Wireframes LIA (standalone).html](../../../docs/design/Wireframes%20LIA%20(standalone).html) (frames 1A grid · 1C vazio · 1D foco).
> Stack verificada no código: Next **16.2.7** (App Router; `searchParams` é **Promise**), React 19, `@supabase/supabase-js` 2.x, Tailwind v4 `@theme` (D-07).
> Precedentes reusados: `getPublishedReviewBySlug` ([queries.ts](../../../src/lib/review/queries.ts)), `Rating`/`formatRating` (C-1 review-page), `BookCover`, classes `lia-*` do `@layer components`, layout com skip link + `<header>` landmark.

---

## 1 · Arquitetura da rota `/`

### Fluxo (SSR, estado 100% na URL)

```
GET /?q=dom&genero=romance&autor=…&nota=4&ordem=recentes&pagina=2
        │
        ▼
src/app/page.tsx  (Server Component async — substitui o placeholder atual)
        │  const params = parseListingParams(await searchParams)   ← DD-2 (normaliza/valida)
        │
        ├─► listFeaturedReviews()          ← destaque: 4 mais recentes (C-5, DD-5)
        ├─► listPublishedReviews(params)   ← { rows, total }  (DD-3: ilike+filtros+order+range+count)
        └─► listFilterOptions()            ← gêneros/autores derivados do acervo publicado (DD-4)
        │
        ▼
HTML completo no primeiro byte (grid, contagem, paginação, estado vazio)
Links e form GET reproduzem qualquer estado por URL — compartilhável, funciona sem JS.
```

### Decisões de design

- **DD-1 — Estado em `searchParams`, zero estado client para busca/filtros/paginação.** A página é Server Component `async`; em Next 16 `searchParams` chega como `Promise` (mesmo contrato de `params` já usado na `/resenha/[slug]`). Busca/filtros = **um único `<form method="GET" action="/">`** (campo `q` + selects `genero`, `autor`, `nota`, `ordem` + botão "Buscar" como ação primária — wireframe nota 2); paginação = **links** `?pagina=n` preservando os demais parâmetros. Sem JS tudo funciona por navegação padrão (LST-25); com JS nada muda (não há enhancement necessário no MVP). *(LST-07, LST-11, LST-25)*

- **DD-2 — Parser central `parseListingParams`** (`src/lib/review/listingParams.ts`): valida e normaliza cada parâmetro — `q` (trim, comprimento máx. ~100), `genero`/`autor` (string simples), `nota` (inteiro 1–5), `ordem` (∈ `recentes` | `nota` | `titulo`, default `recentes`), `pagina` (inteiro ≥ 1, default 1). **Valor inválido → default silencioso, nunca 500** (edge cases do spec). Página além do total → normalizada para a última válida na página (após o `count`). Retorna tipo `ListingParams` — o mesmo objeto alimenta query, links de paginação e o eco do estado vazio. *(edge cases; LST-13)*

- **DD-3 — Uma query composta** (ver §3). `book!inner` para poder filtrar por campos aninhados; `.eq('status','published')` **explícito** como defesa em profundidade além da RLS (mesmo racional documentado em `getPublishedReviewBySlug`); `count: 'exact'` + `.range()` na mesma chamada — **uma viagem ao banco** para fatia + total. *(LST-06, LST-14, LST-19, LST-20)*

- **DD-4 — Opções de filtro derivadas do acervo publicado** (LST-08/09): `listFilterOptions()` faz **uma** query leve (`review` published → `book(author, genre(name, slug))`) e deduplica em JS (Set) — nenhum valor de filtro sem resultado possível. Volume do MVP (unidades/dezenas) torna isso trivial; se crescer, vira RPC/materialized view (nota futura, não agora).

- **DD-5 — Carrossel = conteúdo server-rendered + realce progressivo mínimo.** A seção "Em destaque" renderiza no servidor uma **lista de links** (slides completos no HTML — capa, título, autor, nota). O comportamento de carrossel (setas ‹ › e indicadores de posição) é um wrapper client **fino** (`'use client'` só no controle, slides como `children` server-rendered — padrão composição RSC). **Sem giro automático por construção** (não existe timer). **Sem JS**: a região degrada para lista rolável horizontal (CSS `overflow-x` + `scroll-snap`) — todo o conteúdo alcançável por teclado/scroll, cumprindo LST-25. Fonte do destaque: **4 mais recentes** (`published_at desc`, C-5) via `listFeaturedReviews()` — reusa a mesma query base com `limit(4)`. *(LST-16, LST-17, LST-18)*

- **DD-6 — Paginação:** `pageSize = 12` (divisível por 2/3/4 colunas do grid). Links ‹ › + números com reticências (padrão wireframe `‹ 1 2 3 … ›`); página atual com `aria-current="page"` **e** distinção não-cromática (peso/fundo). Cada link preserva `q/genero/autor/nota/ordem` (helper `buildListingHref(params, overrides)` no mesmo módulo do parser). *(LST-13)*

- **DD-7 — Primeiro consumo dos tokens sálvia (marca).** A seção "Em destaque" é a **região de marca** da home: fundo `--color-sage-100`, eyebrow/rótulo da seção em `--color-sage-700`. Contrastes (calculados na tokenização): `ink-900` sobre `sage-100` = **13.0:1 AAA** (texto dos slides), `sage-700` sobre `sage-100` = **5.5:1 AA** (eyebrow/acento). Distingue visualmente destaque × resultados sem inventar cor nova, no espírito da variante "pastel" da marca (`LIA Marca.html`). Consumo **via classes `lia-*` no `@layer components`** (como `lia-card__media--type` consome `--color-oxblood-700`) — componentes seguem sem hex hard-coded. *(LST-26)*

- **DD-8 — Extrair `excerpt()` para util compartilhado.** A `/resenha/[slug]` já tem um `excerpt()` local (corte em palavra, ~160 chars) para meta description. O `ReviewCard` precisa do mesmo comportamento para o trecho (LST-02). **Mover para `src/lib/review/excerpt.ts`** e consumir nos dois lugares — evita duplicação divergente (mesma técnica, limites diferentes por parâmetro).

- **DD-9 — Anúncio de resultados (LST-23):** a contagem ("Resenhas · N") vive num `<p role="status">` acima do grid. Em navegação SSR (form GET) a página recarrega — o anúncio natural é o `<title>` do documento + ordem de leitura; o `role="status"` garante o anúncio também no cenário com JS futuro e no estado vazio (1C usa `role="status"`, do wireframe). **Nota honesta:** com form GET não há "atualização sem recarga" — o requisito "sem roubar foco" é atendido porque navegação de página é o comportamento padrão esperado (previsível), não um foco roubado por script.
  - **Mecânica explícita (dita, não presumida):** numa navegação SSR completa, uma região `aria-live`/`role="status"` já presente no HTML inicial **não dispara anúncio** — live regions só anunciam mutações *após* a carga. Logo, o anúncio de "X resultados" / "nenhum resultado" ao mudar busca/filtro vem de **duas fontes explícitas**: **(1)** o `<title>` do documento reflete o estado da consulta (§5 — ex.: `Busca: "dom" · LIA`), que o leitor de tela lê na troca de página; **(2)** a contagem em `<p role="status">` é o **primeiro conteúdo na ordem de leitura** da região de resultados (logo após o `<h2>`), e o `EmptyState` em `role="status"` idem. O `role="status"` só dispara *por si* quando o resultado troca por **mutação de DOM sem recarga** (enhancement JS futuro), e permanece como camada progressiva. Em **nenhum** caminho o foco é movido por script.

- **DD-10 — Header/rodapé mínimos (C-2):** o layout **já tem** skip link + `<header>` landmark com o wordmark. Ajustes desta feature: (a) wordmark vira **link para `/`** (padrão universal; hoje é `<span>`); (b) **sem `<nav>`** — só existe uma rota pública além das resenhas; nav completa (Gêneros/Sobre) chega com as rotas, sem links mortos; (c) adicionar **`<footer>` mínimo** (landmark `contentinfo` com texto do site) fechando a ordem de leitura da Tela 1. *(LST-21)*

---

## 2 · Componentes — reusar × novos

### Reusados (sem modificação, salvo onde anotado)

| Componente | Onde entra na home | Consistência |
| --- | --- | --- |
| `BookCover` ([BookCover.tsx](../../../src/components/book/BookCover.tsx)) | Capa tipográfica no `ReviewCard` e nos slides do destaque | Mesma capa da review-page (`lia-card__media--type`); contrato `title`-only preservado |
| `Rating` ([Rating.tsx](../../../src/components/review/Rating.tsx)) | Nota no `ReviewCard` e nos slides | **Idêntico** ao da review-page (C-1: número pt-BR, sem estrelas; sr-only "Nota: X de 5"); omissão quando nula é do chamador |
| `formatRating` | Via `Rating` | — |
| `excerpt()` | Trecho do card + meta description | **Extraído** para `src/lib/review/excerpt.ts` (DD-8) e reusado pela `/resenha/[slug]` |
| Classes `lia-card`, `lia-btn`, `lia-field`, `lia-link` (`@layer components`) | Card, botões, selects/campo de busca, links | Componentes novos consomem **apenas** tokens/classes existentes + sálvia (DD-7) |
| Layout raiz (skip link, `<header>`, `<main id="main">`) | Envolve a home | Ajustes mínimos DD-10 (wordmark→link, footer) |
| `BookDetails` | **Não é consumido na home** | A ficha completa é da página de resenha; o card usa subset (título/autor). Registrado para não parecer órfão — nenhuma divergência criada |

### Novos

| Componente | Arquivo proposto | Wireframe | Responsabilidade |
| --- | --- | --- | --- |
| **`ReviewCard`** | `src/components/review/ReviewCard.tsx` | 1A (rcard: capa → título → autor → nota → trecho) | **O componente compartilhado que esta feature firma** (LST-26). Server Component. Props: `{ slug, title, author, rating, excerpt }`. `<article>` dentro de `<li>`; o link (título) expandido ao card via padrão do styleguide (`a.lia-card`), destino `/resenha/[slug]`. Consome `BookCover` + `Rating` + `lia-card__*`. Sem hex/fonte nova |
| **`ListingControls`** | `src/components/listing/ListingControls.tsx` | 1A (input "Buscar por título…" + botão; selects Gênero/Autor/Nota mín./Ordenar por) | `<form method="GET" role="search">`: campo `q` rotulado (`lia-field`), 4 selects rotulados, botão "Buscar" (`lia-btn--primary`). Recebe `options` (DD-4) + `params` atuais (selects pré-selecionados). Server Component puro — sem estado |
| **`Pagination`** | `src/components/listing/Pagination.tsx` | 1A (`‹ 1 2 3 … ›`) | `<nav aria-label="Paginação">` com links preservando params (DD-6), `aria-current="page"`, ‹ › com nomes acessíveis ("Página anterior/próxima") e desabilitados nas bordas |
| **`EmptyState`** | `src/components/listing/EmptyState.tsx` | 1C ("Nenhuma resenha encontrada" + eco do termo + 2 ações) | `role="status"`; ecoa `q`/filtros ativos; ações "Limpar filtros" e "Ver todas as resenhas" = **links** para `/` (funcionam sem JS). Variante para acervo vazio (LST-04): mensagem informativa, sem ações de recuperação |
| **`FeaturedCarousel`** | `src/components/review/FeaturedCarousel.tsx` (+ wrapper client fino) | 1A/1D (section "em destaque": setas ‹ ›, slides, dots) | DD-5. `<section aria-labelledby>` com eyebrow sálvia (DD-7); setas `<button>` focáveis com foco visível (1D: anel 3px do token); slides = links completos; indicadores refletem slide ativo (`aria-hidden` nos dots decorativos + posição anunciada no controle, ex.: "Slide 2 de 4") |
| **`SiteFooter`** | `src/components/listing/SiteFooter.tsx` (ou inline no layout) | 1A (region footer) | `<footer>` mínimo (DD-10) — texto do site; sem links mortos |

Estrutura semântica da página (`src/app/page.tsx`):

```
<h1>Resenhas</h1>                                ← único h1 (LST-24)
<section aria-labelledby="destaque">             ← "Em destaque" (h2) — fundo sage-100
  <FeaturedCarousel …/>
</section>
<ListingControls …/>                             ← form role="search" (busca + filtros + ordem)
<section aria-labelledby="resultados">           ← h2 "Resenhas" (contagem em role="status")
  <ol class="grid"> <li><ReviewCard/></li> … </ol>   ← lista semântica de resultados
  <Pagination …/>  |  <EmptyState …/>
</section>
```

Ordem de leitura/foco resultante: skip link → header → *(sem nav)* → destaque → busca → filtros → resultados → paginação → footer — exatamente a nota da Tela 1 (LST-21).

---

## 3 · Camada de query (`src/lib/review/queries.ts` — estende o módulo existente)

### `listPublishedReviews(params: ListingParams): Promise<{ rows: ReviewListItem[]; total: number }>`

```
supabase.from('review')
  .select('id, title, slug, rating, body, published_at,
           book!inner ( title, author, genre!inner ( name, slug ) )',
          { count: 'exact' })                       ← fatia + total numa viagem (LST-14)
  .eq('status', 'published')                        ← defesa em profundidade além da RLS (LST-20)
  .ilike('title', `%${escapeLike(q)}%`)             ← se q (LST-05/06; alvo = review.title, C-1)
  .eq('book.genre.slug', genero)                    ← se genero (LST-08; exige !inner)
  .eq('book.author', autor)                         ← se autor (LST-09)
  .gte('rating', nota)                              ← se nota (LST-10)
  .order(col, { ascending, nullsFirst: false })     ← LST-12 (mapa abaixo)
  .range((pagina-1)*12, pagina*12 - 1)              ← LST-13/14, pageSize 12 (DD-6)
```

- **Mapa de ordenação** (`ordem` → SQL): `recentes` → `published_at desc` (default) · `nota` → `rating desc` com **nulls last** (resenha sem nota não "vence") · `titulo` → `title asc` (collation do banco; suficiente no MVP).
- **`escapeLike(term)` — algoritmo explícito (a ordem importa):** **(1)** `\` → `\\` **primeiro** (senão os escapes seguintes se auto-escapam); **(2)** `%` → `\%`; **(3)** `_` → `\_`. O resultado entra no template como `` `%${escapeLike(q)}%` `` — os `%` da **moldura** seguem curinga; os do **termo** viram literais (buscar `50%` casa o literal "50%"; `a_b` casa o `_` literal, não "qualquer caractere"; sem padrão injetado). Baseia-se no **ESCAPE padrão `\`** do `LIKE/ILIKE` do PostgreSQL. O client Supabase **parametriza o valor** (blinda contra SQL injection); o `escapeLike` trata **só** a semântica de curinga do LIKE (injeção de *padrão*, não de SQL). **Verificar na implementação (Knowledge Chain — Context7/docs supabase-js + PostgREST), não presumir:** confirmar que o operador `ilike` gerado preserva `\` como escape default (não emite `ESCAPE ''`, que o desligaria); se não preservar, aplicar a forma equivalente que restaure o escape. Coberto por **teste unitário** (`escapeLike` com `50%`, `a_b`, `100\`).
- **`ReviewListItem`** (novo tipo, mesmo padrão `ReviewView`/`BookView`): subset tipado — `id, title, slug, rating, published_at` + `book { title, author, genre { name, slug } }` + `excerpt` derivado (DD-8). **Não** carrega `body` inteiro até o cliente do card — o excerpt é cortado no servidor.
- **`!inner`**: obrigatório para filtrar por `book.genre.slug`/`book.author` (sem o hint, o PostgREST não restringe a linha pai). Como **toda** review tem book (FK not null) e todo book tem genre (0002), o inner join não perde linhas.
- **Performance/D-04 (registrado):** `ilike '%…%'` não usa índice B-tree → full scan. Aceito no MVP; **gatilho de evolução:** volume na casa de milhares → migration aditiva com `pg_trgm` (GIN) ou coluna `tsvector` + full-text, sem mudar o contrato de `listPublishedReviews`. Comentário no código apontando para D-04.
- **Nenhuma migration nesta feature** (LST-19): leitura reusa policy+GRANT `0005` (`review`) e `0004` (`book`+`genre`), via **cliente anon** — `createServerClient()` atual; TD-04 (separação client público × admin) permanece agendada para pré-M2, sem service_role no Production hoje.

### `listFeaturedReviews(): Promise<ReviewListItem[]>` — mesma base, `order published_at desc` + `limit 4`, sem filtros (DD-5/C-5).

### `listFilterOptions(): Promise<{ genres: {name,slug}[]; authors: string[] }>` — DD-4: uma query leve das publicadas (campos `book(author, genre(name,slug))`), dedupe/sort em JS.

---

## 4 · Acessibilidade (DoD embutida — como cada exigência foi resolvida)

| Exigência | Resolução no design |
| --- | --- |
| Busca/filtros por teclado (LST-22) | Form GET com controles nativos (`input`, `select`, `button`) — teclado de graça; foco visível via anel 3px global do M0 (`:focus-visible`); 1D confirma o anel no campo de busca |
| Resultados/contagem anunciáveis (LST-23) | Contagem "Resenhas · N" em `<p role="status">` (DD-9); título do documento reflete o estado; estado vazio em `role="status"` (1C) |
| Foco visível (LST-22) | Tokens `--focus-ring*` já globais (`:where(...):focus-visible` no `@layer base`); setas do carrossel e links de paginação são elementos nativos cobertos |
| Empty state acessível (LST-15) | `role="status"` + texto ecoando termo/filtros (não só ícone/cor) + recuperação por **links** (1C) |
| Paginação teclado + estado atual (LST-13) | `<nav aria-label="Paginação">`, links nativos, `aria-current="page"` + distinção não-cromática; ‹ › com nome acessível |
| Carrossel (LST-16/17) | Sem timer (nunca gira só); setas `<button>` focáveis; slides = links com conteúdo completo; posição anunciada ("Slide n de 4"); sem JS → lista rolável (conteúdo íntegro) |
| Semântica (LST-24) | Único `<h1>Resenhas</h1>`; sections com `aria-labelledby`; resultados em `<ol>`/`<li>`; página vive sob o `<main id="main">` do layout |
| Ordem de leitura (LST-21) | Estrutura do §2 espelha a nota da Tela 1; skip link do layout intacto |
| Sem JS / SSR (LST-25) | Tudo por `searchParams` + form GET + links; carrossel degrada (DD-5); axe na rota `/` já está no gate de CI do M0 |
| Contraste (LST-25) | Só tokens com razões anotadas; par sálvia validado (13.0:1 / 5.5:1 — DD-7) |

**Nota de consistência (não é escopo novo):** o wireframe desenha estrelas (`★★★★`) nos cards/slides — **lo-fi ilustrativo**. Prevalece a decisão C-1 da review-page: nota **numérica** via `Rating`. O filtro "Nota mín." usa opções numéricas (ex.: "4+"), sem estrelas. D-01 (escala/estrelas) continua no M2.

---

## 5 · SEO (home pública + searchParams)

- **`generateMetadata`** na página: título estável `LIA — Leituras e impressões anotadas` (herda padrão do layout) + description da home. Quando há busca/filtros ativos, o título **pode** refletir o estado (ex.: `Busca: "dom" · LIA`) para diferenciar abas/histórico — sem impacto de indexação por causa da regra abaixo.
- **Canonical sempre `/`** (`alternates.canonical: '/'`, resolvida absoluta pelo `metadataBase` existente): qualquer combinação `?q/genero/autor/nota/ordem/pagina` aponta o canônico para a home limpa → **zero conteúdo duplicado indexável** por combinação de filtros.
- **`robots: { index: false, follow: true }` quando qualquer searchParam estiver ativo** (inclusive `pagina>1`): páginas filtradas não entram no índice, mas o crawler **segue** os links dos cards → as `/resenha/[slug]` (essas sim indexáveis) continuam descobertas. A home limpa (`/` sem params) permanece `index, follow`.
- **Racional:** o conteúdo indexável do site são as resenhas individuais; a listagem é navegação. Sitemap/JSON-LD ficam em `seo-core` (fora de escopo, como no spec).

---

## 6 · Rastreabilidade — 27/27

| Req | Elemento do design |
| --- | --- |
| LST-01 | `page.tsx` SSR + grid `<ol>` de `ReviewCard` (§2) |
| LST-02 | `ReviewCard` (BookCover + título + autor + Rating + excerpt; link p/ `/resenha/[slug]`) |
| LST-03 | Contagem `Resenhas · N` via `count: 'exact'` (DD-9) |
| LST-04 | Variante "acervo vazio" do `EmptyState` (≠ sem-resultados) |
| LST-05 | `ListingControls`: campo `q` rotulado + botão "Buscar" primário |
| LST-06 | `.ilike('title','%…%')` + `escapeLike` (§3) |
| LST-07 | Form GET → `?q=` na URL (DD-1) |
| LST-08 | Select Gênero → `.eq('book.genre.slug')` + opções derivadas (DD-4) |
| LST-09 | Select Autor → `.eq('book.author')` + opções derivadas (DD-4) |
| LST-10 | Select Nota mín. → `.gte('rating', n)` |
| LST-11 | Um único form GET compõe todos os params; links preservam estado (`buildListingHref`) |
| LST-12 | Select "Ordenar por" → mapa de ordenação (§3), default `recentes` |
| LST-13 | `Pagination` (‹ › + números, `aria-current="page"`, `?pagina=`) (DD-6) |
| LST-14 | `.range()` + `count: 'exact'` numa viagem (§3) |
| LST-15 | `EmptyState` `role="status"` + eco + links de recuperação (1C) |
| LST-16 | `FeaturedCarousel` sem timer; setas `<button>` focáveis (DD-5) |
| LST-17 | Slides = links completos; posição anunciada; dots refletem ativo |
| LST-18 | `listFeaturedReviews()` = 4 mais recentes, derivado, sem schema novo (C-5) |
| LST-19 | Cliente anon + policies/GRANTs 0004/0005; **sem migration**; sem service_role (TD-04) |
| LST-20 | `.eq('status','published')` explícito em todas as queries (§3) |
| LST-21 | Estrutura §2 = ordem da Tela 1; skip link intacto; footer novo (DD-10) |
| LST-22 | Controles nativos + anel de foco global (§4) |
| LST-23 | `role="status"` na contagem + title do documento (DD-9) |
| LST-24 | `<h1>` único; sections `aria-labelledby`; `<ol>`; sob `<main>` do layout |
| LST-25 | Form GET/links sem JS; carrossel degrada; axe/contraste no CI (§4) |
| LST-26 | `ReviewCard` compartilhado, só tokens/classes `lia-*` + sálvia (DD-7); consome BookCover/Rating |
| LST-27 | `listPublishedReviews(params)` tipada (`ReviewListItem`), padrão queries.ts (§3) |

**27/27 mapeados — sem órfãos.** Nenhum requisito do spec se mostrou impossível; a única tensão encontrada (estrelas do wireframe × C-1 numérico) está registrada no §4 como nota de consistência, resolvida a favor do precedente C-1 — sem escopo novo.

---

## 7 · Arquivos previstos (Execute — referência, não implementação)

| Arquivo | Ação |
| --- | --- |
| `src/app/page.tsx` | **Substituir** placeholder pela home real |
| `src/lib/review/listingParams.ts` | Novo — parser/normalizador + `buildListingHref` |
| `src/lib/review/queries.ts` | Estender — `listPublishedReviews`, `listFeaturedReviews`, `listFilterOptions`, tipo `ReviewListItem` |
| `src/lib/review/excerpt.ts` | Novo — util extraído; `/resenha/[slug]/page.tsx` passa a consumir |
| `src/components/review/ReviewCard.tsx` | Novo — componente compartilhado |
| `src/components/review/FeaturedCarousel.tsx` | Novo — server + wrapper client fino |
| `src/components/listing/ListingControls.tsx` | Novo |
| `src/components/listing/Pagination.tsx` | Novo |
| `src/components/listing/EmptyState.tsx` | Novo |
| `src/app/layout.tsx` | Ajuste mínimo — wordmark→link, `<footer>` (DD-10) |
| `src/app/globals.css` | `@layer components` — classes das novas peças (grid, carrossel, paginação, empty), só tokens |

Testes (direção para a fase Tasks): unit do parser (`listingParams`) e do `escapeLike`/excerpt; integração das queries no padrão local-only TD-02; axe da rota `/` já coberto pelo CI.
