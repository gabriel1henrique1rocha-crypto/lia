# review-listing-search — Especificação

> Milestone **M1 — Núcleo de leitura pública**. **A porta de entrada pública do LIA (home `/`).**
> Fonte de verdade: [PRD](../../../docs/PRD-LIA.md) (busca/listagem, seção 6.1), a **Tela 1** de [docs/design/Wireframes LIA (standalone).html](../../../docs/design/Wireframes%20LIA%20(standalone).html) (destaque/carrossel → busca → filtros+ordenação → grid → paginação → estado vazio) e o [sitemap](../../../docs/design/LIA%20—%20Sitemap%20da%20aplicação.pdf) (`/`, `/genero/[slug]`, `/recomendacoes`).
> Endereça a decisão **D-04 (estratégia de busca)** — ver [context.md](context.md) D-04.
> Reusa o caminho de leitura pública já aberto para `review` (RLS + GRANT da migration `0005`, via cliente **anon** — TD-04) e os componentes/tokens já firmados na `review-page`/`book-data` (`Rating`, `BookCover`, tokens `--sage-100/700`).
> Decisões de gray areas em [context.md](context.md) (C-1…C-5). Documentação em português; nomes de feature, schema, identificadores e código em inglês.

## Problem Statement

A `review-page` (`/resenha/[slug]`) já está pública, mas **não há como chegar até ela**: o site não tem home navegável, listagem, busca nem filtros. Hoje `/` é um placeholder ([src/app/page.tsx](../../../src/app/page.tsx)) e o único caminho para uma resenha é conhecer o slug. Sem a listagem, o objetivo central do PRD — **o público encontrar e ler resenhas** — não se cumpre, e o seed do M1 não é descobrível.

Esta feature entrega a **home `/` (SSR)** com: um destaque (carrossel acessível, sem giro automático), **busca por título**, **filtros combináveis** (gênero, autor, nota mínima), **ordenação**, **grid de resultados**, **paginação** e **estado vazio com recuperação** — tudo lendo **apenas resenhas `published`** via cliente **anon** (RLS no controle, como na `review-page`; drafts nunca aparecem). Ao fazê-lo, **firma o componente compartilhado `ReviewCard`** (capa + título + autor + nota + trecho) que a `review-page` e telas futuras reusam, mantendo consistência com `Rating` e `BookCover` já existentes. Resolve a **D-04** registrando a abordagem de busca da feature.

## Goals

- [ ] Entregar a **home `/` (App Router, SSR)** que lista as resenhas **publicadas** em **grid** de cartões, com dados factuais no HTML inicial (sem depender de hidratação).
- [ ] **Busca por título** e **filtros** (gênero, autor, nota mínima) e **ordenação**, **combináveis**, refletidos na **URL** (`searchParams`) — compartilháveis e operáveis **sem JavaScript** (D-04).
- [ ] **Paginação** acessível (‹/› + números, `aria-current="page"`), com contagem total de resultados.
- [ ] **Estado vazio** ("Nenhuma resenha encontrada") com `role="status"` e **caminho de recuperação** (limpar filtros / ver todas).
- [ ] **Destaque** em carrossel **sem giro automático**, teclado-acessível (setas focáveis, slides como links, indicadores de posição).
- [ ] **Firmar o componente `ReviewCard`** reutilizável (capa via `BookCover`, título, autor, nota via `Rating`, trecho), consistente com a `review-page`.
- [ ] Ler **somente `status='published'`** via **anon** (reusa policy/GRANT da `0005`; **sem** `service_role` na leitura pública — TD-04). Drafts invisíveis.
- [ ] **Acessibilidade WCAG 2.1 AA embutida** como Definition of Done (não fase separada): busca/filtros operáveis por teclado, resultados anunciáveis a leitor de tela, foco visível, estado vazio acessível, contraste ≥ 4.5:1, axe 0 críticos no CI.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Rota dedicada **`/genero/[slug]`** (landing por gênero) | Adiada (ver C-4). O **filtro de gênero em `/`** cobre a descoberta no MVP; a rota dedicada vira follow-up trivial que reusa a mesma query. Confirmar na revisão. |
| Rota **`/recomendacoes`** | **M3** (`recommendations`, D-03) — depende do modelo de indicação, ainda não decidido. Fora do M1. |
| **Alternância grid ⇄ lista** (toggle de visualização) | O wireframe mostra as duas variações "para comparar"; o MVP entrega **só o grid** (C-3). Toggle de lista é P2/futuro. |
| **Busca full-text** (tsvector, ranking, acentos/stemming) | D-04: MVP usa `ilike`; full-text é evolução futura (ver context.md D-04). |
| **CRUD/admin** de resenhas; coluna/flag de "destaque" no schema | M2 (`reviews-crud`, `admin-reviews`). O destaque do MVP é **derivado** (sem schema novo — C-5). |
| Exibição de **imagem** real de capa | M1 `storage-covers` — aqui só a **capa tipográfica** (`BookCover`). |
| **schema.org**/JSON-LD, sitemap, OG dedicado da listagem | M1 `seo-core` — aqui só o `<title>`/meta básico da home. |
| **Header/nav/rodapé global do site** completos | Ver C-2: entra um **cabeçalho mínimo** (wordmark + skip link já existente) e links **só para rotas existentes**; nav completa (Gêneros/Sobre) acompanha as rotas quando existirem. |

---

## Requisitos Funcionais

> IDs `LST-nn`, rastreáveis. Todos assumem leitura **anon** de `status='published'` (nunca drafts).

### Listagem (grid)
- **LST-01** — `/` renderiza via **SSR** a lista de resenhas **publicadas** em **grid** de `ReviewCard`.
- **LST-02** — Cada `ReviewCard` exibe: **capa** (`BookCover` tipográfica — sem `cover_url` no seed), **título da resenha**, **autor do livro**, **nota** (`Rating`, numérica pt-BR; omitida se nula) e **trecho** do corpo; o cartão inteiro é um **link** para `/resenha/[slug]`.
- **LST-03** — A lista exibe a **contagem total** de resultados (ex.: "Resenhas · 128") coerente com filtros/busca ativos.
- **LST-04** — Sem nenhuma resenha publicada no banco, a home degrada para um estado informativo acessível (distinto do "sem resultados de busca").

### Busca por título
- **LST-05** — Campo **"Buscar por título…"** rotulado + botão **"Buscar"** (ação primária da região `main`); a busca filtra por **título** (ver C-1 para o alvo exato: resenha vs. livro).
- **LST-06** — A busca é **case-insensitive** e por correspondência parcial (`ilike '%termo%'`), lendo só publicadas.
- **LST-07** — O termo de busca é refletido na **URL** (`?q=`), tornando o resultado **compartilhável** e reprodutível via SSR.

### Filtros
- **LST-08** — Filtro **Gênero** (select rotulado) restringe por `genre` do livro.
- **LST-09** — Filtro **Autor** (select rotulado) restringe por `book.author`.
- **LST-10** — Filtro **Nota mínima** (select rotulado) restringe por `review.rating >= n`.
- **LST-11** — Busca + filtros são **combináveis** (aplicados em conjunto, E lógico) e **cada um** refletido na URL (`?genero=&autor=&nota=`); alterá-los **não perde o contexto da página**.

### Ordenação
- **LST-12** — Controle **"Ordenar por"** (select rotulado) com opções mínimas: **mais recentes** (`published_at desc`, padrão), **nota** (`rating desc`) e **título A–Z**; refletido na URL (`?ordem=`).

### Paginação
- **LST-13** — Resultados **paginados** (tamanho de página fixo — definir na Design), com controles ‹/› + números; a página atual marcada com **`aria-current="page"`** (não só por cor); página refletida na URL (`?pagina=`).
- **LST-14** — A query lê apenas a **fatia** da página corrente (`range`) + a **contagem total** para montar o paginador (sem carregar todas as linhas).

### Estado vazio
- **LST-15** — Quando busca/filtros **não retornam resultados**, exibir bloco **"Nenhuma resenha encontrada"** com `role="status"`, ecoando o termo/filtros, e **ações de recuperação** ("Limpar filtros" / "Ver todas as resenhas").

### Destaque / carrossel
- **LST-16** — Seção **"Em destaque"** com um **carrossel que NÃO gira sozinho** (só avança por ação do usuário), setas anterior/próximo **focáveis** por teclado com foco visível.
- **LST-17** — Cada slide é um **link acessível** (capa + título + autor + nota) para a resenha; **indicadores de posição** refletem o slide ativo.
- **LST-18** — A fonte do "destaque" é **derivada** (sem coluna nova no schema — ver C-5), lendo só publicadas.

### Dados / Segurança
- **LST-19** — Toda leitura usa o **cliente anon** e a **policy/GRANT já existentes** (`0005` para `review`; `0004` para `book`+`genre`); **nenhuma** `service_role` no caminho público (TD-04). **Nenhuma migration nova** é exigida para leitura (índice de performance é opcional — ver Notas).
- **LST-20** — Resenhas `draft` **nunca** aparecem em listagem, busca, filtros nem destaque (filtro `status='published'` **explícito** na query, não delegado só ao RLS — coerente com `getPublishedReviewBySlug`).

### Acessibilidade (DoD embutida)
- **LST-21** — Ordem de leitura/foco: **pular para conteúdo → header → nav → destaque → busca → filtros → resultados → paginação → footer**; skip link do layout raiz funcionando.
- **LST-22** — Todos os controles (campo de busca, selects de filtro/ordenação, setas do carrossel, links de paginação, cartões) são **operáveis por teclado** com **foco visível** (token de foco do M0).
- **LST-23** — A **atualização dos resultados** é anunciável a leitor de tela (contagem/estado via `role="status"`/`aria-live` apropriado, sem roubar foco).
- **LST-24** — Semântica: **um único `<h1>`** na home, headings hierárquicos por região; a home fornece conteúdo sob o `<main id="main">` do layout (não cria segundo `<main>`).
- **LST-25** — axe **0 issues críticos** no CI (rota `/`) e contraste **≥ 4.5:1**; funciona **sem JavaScript** (SSR + `searchParams`).

### Componentes compartilhados (consistência)
- **LST-26** — Firmar **`ReviewCard`** reutilizável, consumindo **`BookCover`** e **`Rating`** já existentes e **apenas tokens** do design system (sem cor/fonte hard-coded); a `review-page` e telas futuras devem poder reusá-lo sem divergência visual.
- **LST-27** — A **camada de query** ganha `listPublishedReviews(params)` tipada (busca/filtros/ordenação/paginação), no padrão de [src/lib/review/queries.ts](../../../src/lib/review/queries.ts)/[src/lib/book/queries.ts](../../../src/lib/book/queries.ts) (join `book`+`genre`, tipos derivados do schema).

---

## User Stories

### P1 — MVP

#### P1: Home lista resenhas publicadas em grid ⭐
**Como** leitor, **quero** abrir a home e ver as resenhas publicadas em cartões, **para** descobrir o que ler sem conhecer URLs.
**Why P1**: é a porta de entrada do site; sem ela não há descoberta.
**Cobre**: LST-01, LST-02, LST-03, LST-04, LST-19, LST-20, LST-26, LST-27.
**Critérios**: `/` renderiza via SSR ≥ N cartões (grid) com capa tipográfica, título, autor, nota (pt-BR, omitida se nula) e trecho; cada cartão linka `/resenha/[slug]`; contagem total visível; drafts ausentes.
**Independent Test**: abrir `/` → grid com as 4 publicadas do seed, cada uma clicável; a `draft` não aparece; "view source" tem os cartões (SSR).

#### P1: Busca por título ⭐
**Como** leitor, **quero** buscar por título, **para** achar uma resenha específica.
**Why P1**: busca é requisito central do PRD e a razão da D-04.
**Cobre**: LST-05, LST-06, LST-07, LST-11.
**Critérios**: digitar termo + "Buscar" filtra por título (`ilike`, case-insensitive, parcial); `?q=` na URL; recarregar reproduz o resultado (SSR); combina com filtros.
**Independent Test**: buscar "dom" → só resultados compatíveis; copiar a URL com `?q=dom` em nova aba → mesmo resultado; sem JS, o form navega e filtra.

#### P1: Filtros (gênero, autor, nota mínima) + ordenação ⭐
**Como** leitor, **quero** filtrar por gênero/autor/nota e ordenar, **para** refinar a lista.
**Why P1**: refinar é parte do "encontrar" do PRD; a Tela 1 os prevê.
**Cobre**: LST-08, LST-09, LST-10, LST-11, LST-12.
**Critérios**: selects rotulados de Gênero, Autor, Nota mín., Ordenar por; combináveis; refletidos na URL; alterar um não descarta os demais; ordenação padrão = mais recentes.
**Independent Test**: aplicar Gênero+Nota mín. → lista restringe; trocar ordenação → reordena mantendo filtros; URL carrega os quatro parâmetros.

#### P1: Paginação ⭐
**Como** leitor, **quero** navegar por páginas de resultados, **para** percorrer o acervo sem uma página gigante.
**Why P1**: acervo cresce; a Tela 1 mostra paginador.
**Cobre**: LST-13, LST-14.
**Critérios**: paginador ‹/›+números; `aria-current="page"`; `?pagina=` na URL; a query lê só a fatia + contagem total.
**Independent Test**: com > 1 página, ir para "2" → nova fatia; `aria-current` na página ativa; `?pagina=2` reproduz via SSR.

#### P1: Estado vazio com recuperação ⭐
**Como** leitor cuja busca não retornou nada, **quero** uma mensagem clara e um caminho de volta, **para** não ficar preso.
**Why P1**: sem recuperação, um filtro estreito parece um site quebrado.
**Cobre**: LST-15.
**Critérios**: bloco "Nenhuma resenha encontrada" em `role="status"`, ecoando termo/filtros, com "Limpar filtros" e "Ver todas as resenhas".
**Independent Test**: buscar termo impossível → mensagem anunciada por leitor de tela; "Limpar filtros" volta à lista completa.

#### P1: Destaque em carrossel acessível ⭐
**Como** leitor, **quero** ver resenhas em destaque num carrossel que eu controlo, **para** ter uma porta de entrada curada sem movimento involuntário.
**Why P1**: a Tela 1 abre pelo destaque; carrossel automático é barreira de a11y — precisa ser especificado como manual desde já.
**Cobre**: LST-16, LST-17, LST-18.
**Critérios**: sem giro automático; setas focáveis com foco visível; slides são links (capa+título+autor+nota); indicadores refletem o ativo; fonte derivada (sem schema novo).
**Independent Test**: por teclado, avançar/voltar slides; nenhum movimento sem ação; cada slide abre a resenha.

#### P1: Acessibilidade WCAG 2.1 AA (DoD) ⭐
**Como** usuário de teclado/leitor de tela, **quero** operar busca, filtros e resultados sem mouse e ser avisado das mudanças, **para** usar o site sem barreiras.
**Why P1**: a11y é DoD de toda feature (Roadmap) e a home é a página mais acessada.
**Cobre**: LST-21…LST-25.
**Critérios**: ordem de foco da Tela 1; foco visível em todos os controles; mudança de resultados anunciada sem roubar foco; único `<h1>`; funciona sem JS; axe 0 críticos + contraste AA no CI.
**Independent Test**: percorrer a home só por teclado na ordem especificada; desligar JS (busca/filtros ainda navegam); axe 0 críticos.

### Fase futura (não nesta feature)
- **Alternância grid ⇄ lista** (toggle) — P2 (C-3).
- **Busca full-text** (tsvector/ranking/acentos) — evolução da D-04.
- Rota **`/genero/[slug]`** dedicada — follow-up (C-4).
- Rota **`/recomendacoes`** — M3 (D-03).

---

## Edge Cases

- **Banco sem resenhas publicadas** → home mostra estado informativo (≠ "sem resultados de busca").
- **Busca sem resultados** → `role="status"` + recuperação; nunca 404.
- **Filtro/ordem/página inválidos na URL** (`?nota=abc`, `?pagina=999`, `?ordem=xyz`) → **degradar com segurança** (ignorar/normalizar para o padrão), sem 500 e sem vazar erro.
- **`rating` nulo** num cartão → omitir a nota (não exibir "sem nota"), como na `review-page`.
- **Livro sem `cover_url`** (todo o seed) → capa **tipográfica** é o caminho normal.
- **Termo com caracteres especiais / curinga `%` `_`** → tratar com segurança (escape/parametrização), sem quebrar o `ilike`.
- **Página além do total** → normalizar para a última válida (ou vazio recuperável), nunca erro.
- **Cliente anônimo tenta ler `draft`** via manipulação → filtrado (invisível), como na `review-page`.
- **Sem JavaScript** → busca/filtros/ordenação/paginação funcionam por navegação de `searchParams` (form GET + links).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| LST-01 | Home grid SSR | Specify | Pending |
| LST-02 | ReviewCard (capa/título/autor/nota/trecho) linkável | Specify | Pending |
| LST-03 | Contagem total de resultados | Specify | Pending |
| LST-04 | Home sem resenhas → estado informativo | Specify | Pending |
| LST-05 | Campo + botão de busca por título | Specify | Pending |
| LST-06 | Busca `ilike` case-insensitive/parcial | Specify | Pending |
| LST-07 | Termo de busca na URL (`?q=`) | Specify | Pending |
| LST-08 | Filtro Gênero | Specify | Pending |
| LST-09 | Filtro Autor | Specify | Pending |
| LST-10 | Filtro Nota mínima | Specify | Pending |
| LST-11 | Busca+filtros combináveis, na URL, sem perder contexto | Specify | Pending |
| LST-12 | Ordenação (recentes/nota/título) na URL | Specify | Pending |
| LST-13 | Paginação com `aria-current="page"` na URL | Specify | Pending |
| LST-14 | Query lê fatia (`range`) + contagem total | Specify | Pending |
| LST-15 | Estado vazio `role="status"` + recuperação | Specify | Pending |
| LST-16 | Carrossel sem giro automático, setas focáveis | Specify | Pending |
| LST-17 | Slides como links + indicadores de posição | Specify | Pending |
| LST-18 | Destaque derivado (sem schema novo) | Specify | Pending |
| LST-19 | Leitura anon reusa 0004/0005; sem service_role (TD-04); sem migration nova | Specify | Pending |
| LST-20 | Filtro `status='published'` explícito; drafts invisíveis | Specify | Pending |
| LST-21 | Ordem de leitura/foco da Tela 1 + skip link | Specify | Pending |
| LST-22 | Todos os controles por teclado, foco visível | Specify | Pending |
| LST-23 | Mudança de resultados anunciável sem roubar foco | Specify | Pending |
| LST-24 | Único `<h1>`, headings hierárquicos, sob `<main>` do layout | Specify | Pending |
| LST-25 | axe 0 críticos + contraste AA + sem-JS (SSR) | Specify | Pending |
| LST-26 | `ReviewCard` compartilhado, só tokens, reusa BookCover/Rating | Specify | Pending |
| LST-27 | `listPublishedReviews(params)` tipada (padrão queries.ts) | Specify | Pending |

**Coverage:** 27 requisitos · **0/27 implementados** (fase Specify).

---

## Success Criteria

- [ ] `/` lista via SSR as resenhas publicadas em grid de `ReviewCard`; drafts ausentes; cada cartão abre `/resenha/[slug]`.
- [ ] Busca por título (`ilike`) + filtros (gênero/autor/nota) + ordenação **combináveis**, refletidos na **URL** e funcionando **sem JS**.
- [ ] Paginação com fatia por `range` + contagem total; `aria-current="page"`.
- [ ] Estado vazio com `role="status"` e recuperação; URL/filtros inválidos degradam sem 500.
- [ ] Carrossel de destaque sem giro automático, teclado-acessível; slides como links; fonte derivada (sem schema novo).
- [ ] Leitura só via **anon** reusando `0004/0005` (sem `service_role`, TD-04); **sem migration nova**.
- [ ] `ReviewCard` compartilhado consumindo `BookCover`/`Rating` e só tokens; consistência com a `review-page`.
- [ ] axe 0 críticos + contraste AA na `/`; único `<h1>`; ordem de foco da Tela 1.

---

## Notas para o Design (não decididas aqui)

- **Estado via `searchParams` (D-04)**: a home é Server Component que lê `searchParams` (`q`, `genero`, `autor`, `nota`, `ordem`, `pagina`) e re-consulta. Progressive enhancement: form GET + links de filtro/paginação (funciona sem JS); enriquecer com JS depois é opcional. Definir se filtros submetem via form GET ou navegação por `<Link>`.
- **Camada de query**: `listPublishedReviews({ q, genre, author, minRating, sort, page, pageSize })` → `{ rows: ReviewListItem[], total }`, usando `.ilike`, `.eq`/`.gte`, `.order`, `.range` e `count: 'exact'`. Definir o tipo `ReviewListItem` (subset do `ReviewView` + campos do `book`/`genre` que o cartão usa) e o `pageSize`.
- **Índice de performance (opcional)**: `ilike '%…%'` não usa índice B-tree comum; para o volume do MVP é irrelevante. Se quiser, avaliar `pg_trgm`/índice funcional numa migration **aditiva** — mas fora do necessário agora (LST-19).
- **`ReviewCard`**: extrair do padrão dos cartões do styleguide/`lia-card`; decidir props (`slug`, `title`, `author`, `rating`, `excerpt`) e como derivar o **trecho** do `body` (primeiras N palavras/caracteres, sem cortar no meio de palavra).
- **Origem dos selects de filtro**: Gênero/Autor como listas **derivadas do acervo publicado** (distintos) vs. estáticas — definir na Design (idealmente derivadas, para não listar valor sem resultado).
- **Carrossel**: componente client mínimo (estado de slide) OU CSS scroll-snap + âncoras; garantir teclado + `aria` sem depender de JS pesado. Decidir o número de slides e a fonte derivada (ver C-5).
- **Gray areas em aberto** (ver [context.md](context.md)): **C-1** alvo da busca (título da resenha vs. também livro/autor), **C-2** escopo do header/nav, **C-3** grid-only vs. toggle, **C-4** `/genero/[slug]` dentro ou fora, **C-5** fonte do destaque. Confirmar na revisão antes do Design.
