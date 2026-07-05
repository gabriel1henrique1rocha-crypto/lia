# review-page — Especificação

> Milestone **M1 — Núcleo de leitura pública**. **Primeira página pública navegável do LIA.**
> Fonte de verdade: [PRD](../../../docs/PRD-LIA.md) (seção 6.1 `review-page`, seção 9 modelo de dados) e a tela final em [docs/design/telas-finais.html](../../../docs/design/telas-finais.html) (linguagem visual: capa tipográfica, cartão, rota `/resenha/<slug>`).
> Reusa o componente [BookDetails](../../../src/components/book/BookDetails.tsx) e os tokens criados na `book-data`.
> Decisões de gray areas em [context.md](context.md) (C-1 nota só número; C-2 placeholders com aviso "em breve").
> Documentação em português; nomes de feature, schema, identificadores e código em inglês.

## Problem Statement

A entidade `review` e sua ficha de livro (`book`) já existem no banco e há um componente acessível de ficha técnica (`BookDetails`), mas **nenhuma página exibe uma resenha**. Sem ela, o seed do M1 não tem como ser validado nas telas, não há a primeira URL pública navegável e o site não cumpre seu propósito central — ler resenhas. Além disso, o M0 deixou `review` em RLS *deny-by-default* e a TD-03 documenta que, pós-2026-05-30, policies RLS **não bastam** sem `GRANT` de tabela. Esta feature entrega a rota dinâmica `/resenha/[slug]` (SSR), monta a resenha completa (título, ficha via `BookDetails`, nota e texto), abre a **leitura pública de `review` filtrada por `status='published'`** (RLS + GRANT) para que o público nunca veja rascunhos, semeia resenhas plausíveis nos 4 livros existentes e deixa âncoras estruturais para a interação do M3.

## Goals

- [ ] Entregar a rota dinâmica **`/resenha/[slug]`** (App Router, SSR), com **404** para slug inexistente ou não publicado.
- [ ] Exibir a resenha completa: **título**, **ficha técnica** (via `BookDetails`), **nota** (numérica, só exibição) e **texto** da resenha.
- [ ] Abrir **leitura pública de `review` via RLS + GRANT, filtrada por `status='published'`** — o público anônimo nunca vê rascunhos (atenção à **TD-03**: grants explícitos pós-2026-05-30).
- [ ] Emitir **SEO básico** da página: `title`, meta description e Open Graph (schema.org Book/Review fica em `seo-core`).
- [ ] Semear **resenhas plausíveis** vinculadas aos 4 livros de domínio público já existentes (Dom Casmurro, O Crime do Padre Amaro, Iracema, O Cortiço).
- [ ] Renderizar **placeholders estruturais** (sem lógica) para a seção de comentários e o botão "Recomendar" (funcionalidade vem no M3), com aviso acessível "em breve" (C-2).
- [ ] Usar **capa tipográfica como fallback** (sem pipeline de imagem — isso é `storage-covers`).
- [ ] **Acessibilidade WCAG 2.1 AA** como Definition of Done: `article` semântico, hierarquia de headings, SSR.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Formulário de novo comentário / envio sem login | M3 (`public-comments`) — aqui só a âncora estrutural + aviso "em breve" (C-2) |
| Lógica de recomendação / votação / contagem | M3 (`recommendations`) — aqui só o botão desabilitado, sem ação nem contador real |
| Listagem, filtros, busca e ordenação de resenhas | M1 (`review-listing-search`, D-04) — esta feature entrega só a página individual |
| schema.org `Book`/`Review` (JSON-LD), sitemap | M1 (`seo-core`) — aqui só `title`/meta/OG básicos da página |
| Upload e exibição de **imagem** de capa | M1 (`storage-covers`) — aqui apenas a **capa tipográfica** de fallback |
| Escala/UX de **entrada** da nota (estrelas, meia-estrela) | M2 (`reviews-crud`, D-01) — aqui só **exibição numérica** (C-1) |
| CRUD/admin de resenhas (criar, editar, publicar) | M2 (`reviews-crud`, `admin-reviews`) — aqui leitura pública e seed |
| GRANTs de `comment`, `recommendation`, `editor` e do `service_role`/Data API | Frente de infra dedicada (TD-03) — aqui apenas o GRANT de leitura de `review` |

---

## User Stories

### P1: Rota dinâmica `/resenha/[slug]` (SSR) com 404 ⭐ MVP

**User Story**: Como leitor, quero abrir `/resenha/<slug>` e ver a resenha renderizada pelo servidor, para ler o conteúdo com URL limpa, compartilhável e indexável.

**Why P1**: É a primeira página pública navegável do LIA e o contêiner de toda a feature; sem a rota, nada se exibe.

**Acceptance Criteria**:

1. QUANDO o usuário acessa `/resenha/<slug>` de uma resenha **publicada** ENTÃO o sistema DEVE renderizar a página **no servidor (SSR)**, com todo o conteúdo factual presente no HTML inicial (sem depender de hidratação).
2. QUANDO o `slug` **não corresponde** a nenhuma resenha ENTÃO o sistema DEVE responder **404** (via `notFound()` do App Router), com página de erro acessível.
3. QUANDO o `slug` corresponde a uma resenha com `status='draft'` (não publicada) ENTÃO o sistema DEVE responder **404** — rascunho é indistinguível de inexistente para o público.
4. QUANDO a página é resolvida ENTÃO a resenha DEVE ser buscada pelo **`review.slug`** (único), trazendo junto a ficha do livro (`book` + `genre`) numa única leitura tipada.
5. QUANDO a página é servida ENTÃO ela DEVE viver sob o landmark `<main id="main">` já provido pelo layout raiz (a página fornece o `<article>`, não outro `<main>`).

**Independent Test**: acessar o slug de uma resenha do seed → página renderiza via SSR (conteúdo no "view source"); acessar slug inexistente → 404; marcar a resenha como `draft` → 404.

---

### P1: Exibição da resenha — título, ficha, nota e texto ⭐ MVP

**User Story**: Como leitor, quero ver a resenha completa — título, ficha técnica do livro, a nota e o texto — para entender a obra e a opinião do resenhista de forma clara.

**Why P1**: É o conteúdo central da página; sem ele a rota está vazia.

**Acceptance Criteria**:

1. QUANDO a página renderiza ENTÃO o sistema DEVE exibir o **título da resenha** (`review.title`) como heading principal (`<h1>`).
2. QUANDO a página renderiza ENTÃO o sistema DEVE exibir a **ficha técnica** reusando o componente **`BookDetails`** (`book` + `genre`), respeitando seu `headingLevel` para manter a hierarquia da página.
3. QUANDO `review.rating` está presente ENTÃO o sistema DEVE exibir a **nota como valor numérico** localizado em pt-BR (ex.: `4,5 / 5`), com texto acessível ao leitor de tela (ver C-1) — **sem** componente de estrelas.
4. QUANDO `review.rating` é **nulo** ENTÃO o sistema NÃO DEVE exibir bloco de nota (sem "sem nota" nem valor vazio).
5. QUANDO a página renderiza ENTÃO o sistema DEVE exibir o **texto da resenha** (`review.body`) preservando os parágrafos de forma legível e semântica.
6. QUANDO `review.body` está vazio/ausente ENTÃO o sistema DEVE tratar o caso graciosamente (sem quebra; a feature de seed garante texto plausível).

**Independent Test**: abrir uma resenha do seed → vê título (h1), ficha (BookDetails), `4,x / 5` e o texto em parágrafos; forçar `rating` nulo → bloco de nota some, resto intacto.

---

### P1: Capa tipográfica como fallback ⭐ MVP

**User Story**: Como leitor, quero ver uma capa do livro mesmo sem imagem cadastrada, para reconhecer a obra — usando o tratamento tipográfico do design system.

**Why P1**: O seed (livros pré-1970) não tem imagem de capa; sem fallback a página fica visualmente quebrada. O pipeline de imagem é de `storage-covers`.

**Acceptance Criteria**:

1. QUANDO o livro **não tem imagem** de capa (`cover_url` ausente — estado de todo o seed) ENTÃO o sistema DEVE renderizar uma **capa tipográfica** (título do livro sobre fundo de marca), seguindo a linguagem do styleguide (`lia-card__media`, fundo `--oxblood-700`).
2. QUANDO a capa tipográfica é renderizada ENTÃO ela DEVE ter **alternativa textual acessível** (ex.: `role="img"` + `aria-label="Capa de <título>"`) e não embutir o texto apenas como imagem.
3. QUANDO `cover_url` **existe** ENTÃO esta feature NÃO DEVE processar a imagem (renderização de imagem real fica em `storage-covers`) — o fallback tipográfico é o caminho desta feature.

**Independent Test**: abrir resenha de livro do seed (sem `cover_url`) → capa tipográfica com o título e `aria-label` correto; navegar por leitor de tela → anuncia "Capa de <título>".

---

### P1: Leitura pública de `review` via RLS + GRANT, filtrada por `status='published'` ⭐ MVP

**User Story**: Como visitante anônimo, quero ler resenhas **publicadas** no site público, sem login, sem nunca enxergar rascunhos — mantendo a escrita restrita ao admin.

**Why P1**: O M0 deixou `review` em *deny-by-default*; sem policy + GRANT de leitura, o cliente `anon` não carrega a resenha e a página não tem dados em produção. O filtro por `status` é o gate que protege rascunhos do público.

**Acceptance Criteria**:

1. QUANDO a migration desta feature é aplicada ENTÃO o sistema DEVE criar uma policy de RLS em `review` que permita **`SELECT`** a `anon`/`authenticated` **apenas para linhas com `status='published'`** (`using (status = 'published')`).
2. QUANDO a migration é aplicada ENTÃO o sistema DEVE conceder **`GRANT SELECT ON TABLE review`** a `anon, authenticated` (TD-03: pós-2026-05-30 a policy não basta sem o GRANT de tabela — senão o Data API retorna `42501`).
3. QUANDO um cliente anônimo consulta `review` ENTÃO DEVE **ler apenas as publicadas**; resenhas `draft` **não** retornam (nem como linha vazia).
4. QUANDO um cliente anônimo tenta `INSERT`, `UPDATE` ou `DELETE` em `review` ENTÃO o banco DEVE **rejeitar** (sem policy de escrita; permanece *deny-by-default* até M2).
5. QUANDO a migration é reaplicada ENTÃO DEVE ser **idempotente/segura** (guarda de existência da policy via `pg_policies`; `GRANT` é no-op ao reconceder — padrão das migrations 0003/0004).
6. QUANDO o RLS de `review` é verificado ENTÃO o Row Level Security DEVE permanecer **habilitado** (a feature adiciona policy de leitura filtrada, não desliga RLS).

**Independent Test** (local, padrão TD-02): com o cliente `anon`, `select` em `review` retorna só publicadas; uma resenha `draft` semeada não aparece; `insert`/`update`/`delete` falham; RLS continua `enabled`.

---

### P1: Seed de resenhas plausíveis vinculadas aos 4 livros ⭐ MVP

**User Story**: Como time, quero resenhas reais nos 4 clássicos já semeados, para validar a página pública (e a listagem/SEO seguintes) antes do painel (M2) existir.

**Why P1**: Sem resenhas, a rota `/resenha/[slug]` não tem o que exibir; o seed é a ponte do roadmap até o admin do M2.

**Acceptance Criteria**:

1. QUANDO o seed é executado ENTÃO o sistema DEVE inserir **uma resenha publicada por livro** para os 4 livros de domínio público existentes (Dom Casmurro, O Crime do Padre Amaro, Iracema, O Cortiço), respeitando a relação **`book` 1—1 `review`** (`book_id` único).
2. QUANDO uma resenha é semeada ENTÃO ela DEVE ter `title`, `slug` **único** (legível, ex.: derivado do título), `rating` plausível (0.0–5.0, dentro do `check`), `body` com **texto plausível em parágrafos** e `status='published'` com `published_at` definido.
3. QUANDO o seed insere resenhas ENTÃO DEVE ser **idempotente** (UUIDs fixos + `on conflict do nothing`, padrão do `seed.sql` atual) — reexecutar não duplica.
4. QUANDO `editor_id` não se aplica (sem editores semeados no M1) ENTÃO a resenha DEVE poder ser inserida com `editor_id` **nulo** (FK `on delete set null`, nullable).
5. QUANDO o seed termina ENTÃO os 4 slugs DEVEM resolver na rota `/resenha/[slug]` com conteúdo completo.
6. *(Opcional, recomendado para teste de RLS)* QUANDO o seed inclui **uma resenha `draft`** ENTÃO ela serve para verificar que o público **não** a vê (404 / ausente no `anon`).

**Independent Test**: rodar `supabase db reset` → 4 resenhas publicadas, uma por livro; reexecutar → sem duplicatas; cada slug abre a página; a resenha `draft` (se semeada) dá 404 público.

---

### P1: SEO básico da página (title, meta, OG) ⭐ MVP

**User Story**: Como leitor que chega via busca ou link compartilhado, quero que a página de resenha tenha título, descrição e prévia social corretos, para encontrá-la e reconhecê-la antes de abrir.

**Why P1**: Descoberta orgânica é objetivo do PRD; o básico (title/meta/OG) por página é pré-requisito do `seo-core` (que adiciona JSON-LD/sitemap depois).

**Acceptance Criteria**:

1. QUANDO a página de uma resenha publicada é resolvida ENTÃO o sistema DEVE gerar metadados **por requisição** (`generateMetadata` do App Router) a partir dos dados da resenha/livro.
2. QUANDO os metadados são gerados ENTÃO o **`<title>`** DEVE refletir a resenha (ex.: `<Título da resenha> · LIA`) e a **meta description** DEVE derivar de um resumo/início do texto da resenha.
3. QUANDO os metadados são gerados ENTÃO o sistema DEVE emitir **Open Graph** básico: `og:title`, `og:description`, `og:type` e `og:url` (imagem OG dedicada/derivada da capa fica para `seo-core`/`storage-covers`).
4. QUANDO o `slug` resulta em 404 ENTÃO `generateMetadata` NÃO DEVE vazar dados (sem metadados de resenha inexistente).
5. QUANDO `seo-core` chegar ENTÃO ele DEVE poder estender (não reescrever) estes metadados com JSON-LD `Book`/`Review` e sitemap — esta feature não os implementa.

**Independent Test**: inspecionar o `<head>` de uma resenha do seed → title/description/OG coerentes com a resenha; slug inexistente → sem metadados da resenha.

---

### P1: Placeholders estruturais para comentários e "Recomendar" (M3) ⭐ MVP

**User Story**: Como leitor, quero perceber que existirão comentários e a possibilidade de recomendar, mesmo antes desses recursos funcionarem, para entender o que a página oferecerá — e como time, quero as âncoras semânticas prontas para o M3 plugar.

**Why P1**: O PRD lista comentários aprovados e recomendação como parte da página; a estrutura semântica (landmarks/headings) precisa existir desde já para a a11y e para o M3 acoplar sem retrabalho.

**Acceptance Criteria** (ver C-2):

1. QUANDO a página renderiza ENTÃO o sistema DEVE incluir uma **seção de comentários** semântica (`<section>` com heading, ex.: "Comentários") contendo um **aviso acessível "em breve"** (texto, não só cor), **sem lógica** (sem fetch, sem formulário funcional).
2. QUANDO a página renderiza ENTÃO o sistema DEVE incluir um **botão "Recomendar"** **desabilitado**, com o estado comunicado de forma acessível (não dispara ação; sem contador real).
3. QUANDO os placeholders são renderizados ENTÃO eles NÃO DEVEM conter lógica de negócio (sem POST de comentário/voto, sem contagem) — são apenas estrutura + cópia.
4. QUANDO os placeholders são auditados ENTÃO DEVEM preservar a hierarquia de headings da página e passar no gate de a11y (sem heading órfão, sem botão sem nome acessível).

**Independent Test**: abrir a página → seção "Comentários" com aviso "em breve"; botão "Recomendar" visível porém desabilitado e anunciado como indisponível; nenhuma requisição de rede de comentário/voto disparada.

---

### P1: Acessibilidade WCAG 2.1 AA da página (DoD) ⭐ MVP

**User Story**: Como leitor de tela / usuário de teclado, quero a página de resenha estruturada semanticamente e operável sem mouse, para ler a resenha sem barreiras.

**Why P1**: A11y WCAG 2.1 AA é Definition of Done de toda feature (PRD seção 7.1; Roadmap DoD) e a resenha é o conteúdo público central.

**Acceptance Criteria**:

1. QUANDO a página renderiza ENTÃO o conteúdo da resenha DEVE estar num **`<article>`** semântico, com **um único `<h1>`** (título da resenha) e **headings hierárquicos coerentes** (ficha, nota, texto, comentários como subníveis).
2. QUANDO a página é navegada por teclado ENTÃO a ordem de tabulação DEVE ser **lógica**, com **foco visível** (tokens do M0) e o skip link do layout funcionando.
3. QUANDO a página é lida por leitor de tela ENTÃO rótulos, alternativas textuais (capa tipográfica) e a nota numérica DEVEM ser anunciados de forma compreensível.
4. QUANDO a página é renderizada via **SSR** ENTÃO todo o conteúdo factual e a estrutura DEVEM existir **sem JavaScript**.
5. QUANDO a página é auditada ENTÃO DEVE passar **axe sem issues críticos** e atender **contraste ≥ 4.5:1**, conforme o gate de CI do M0.

**Independent Test**: rodar axe na página (0 críticos); navegar só por teclado (foco visível, tab lógico); desligar JS (conteúdo presente); verificar único `<h1>` e ordem de headings.

---

## Edge Cases

- QUANDO o `slug` existe mas a resenha é `draft` ENTÃO a página DEVE dar **404** (público nunca vê rascunho).
- QUANDO o `slug` tem caracteres inesperados / não existe ENTÃO a página DEVE dar **404** sem erro 500.
- QUANDO `review.rating` é **nulo** ENTÃO a página DEVE **omitir** o bloco de nota.
- QUANDO `review.body` está vazio ENTÃO a página NÃO DEVE quebrar (degradação graciosa).
- QUANDO o livro **não tem** `cover_url` (todo o seed) ENTÃO a capa **tipográfica** é o caminho normal, não uma exceção.
- QUANDO o livro tem dados de tradução ENTÃO a ficha (`BookDetails`) DEVE exibir o bloco "Tradução" com heading coerente ao nível da página.
- QUANDO um cliente anônimo tenta **escrever** em `review` ENTÃO o RLS DEVE rejeitar (só `SELECT` de publicadas é liberado).
- QUANDO um cliente anônimo consulta uma resenha `draft` diretamente ENTÃO a RLS DEVE retorná-la como **inexistente** (linha filtrada), não como erro de permissão.
- QUANDO o JavaScript está desabilitado ENTÃO a resenha (SSR) DEVE renderizar todo o conteúdo e a estrutura semântica.
- QUANDO `seo-core` ainda não existe ENTÃO a ausência de JSON-LD/sitemap NÃO é defeito desta feature (escopo).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RVW-01 | Rota dinâmica `/resenha/[slug]` SSR | Tasks | Mapped |
| RVW-02 | 404 para slug inexistente | Tasks | Mapped |
| RVW-03 | 404 para resenha `draft` (não publicada) | Tasks | Mapped |
| RVW-04 | Busca por `review.slug` com join `book`+`genre` (tipada) | Tasks | Mapped |
| RVW-05 | Página sob `<main>` do layout; fornece o `<article>` | Tasks | Mapped |
| RVW-06 | Título da resenha como `<h1>` | Tasks | Mapped |
| RVW-07 | Ficha técnica reusando `BookDetails` (headingLevel coerente) | Tasks | Mapped |
| RVW-08 | Nota como valor numérico pt-BR, só exibição, acessível (C-1) | Tasks | Mapped |
| RVW-09 | Nota nula → bloco omitido | Tasks | Mapped |
| RVW-10 | Texto da resenha em parágrafos semânticos | Tasks | Mapped |
| RVW-11 | Capa tipográfica de fallback (sem `cover_url`) com alt acessível | Tasks | Mapped |
| RVW-12 | Não processar imagem real de capa (escopo `storage-covers`) | Tasks | Mapped |
| RVW-13 | RLS: policy `SELECT` em `review` filtrada por `status='published'` | Tasks | Mapped |
| RVW-14 | GRANT SELECT em `review` a `anon`/`authenticated` (TD-03) | Tasks | Mapped |
| RVW-15 | Escrita em `review` fechada; RLS permanece habilitado; migration idempotente | Tasks | Mapped |
| RVW-16 | Seed de 1 resenha publicada por livro (4), 1—1 com `book` | Tasks | Mapped |
| RVW-17 | Seed: slug único, rating plausível, body em parágrafos, idempotente, editor_id nulo | Tasks | Mapped |
| RVW-18 | (Opcional) Seed de 1 resenha `draft` para teste de visibilidade | Tasks | Mapped |
| RVW-19 | SEO: `generateMetadata` por requisição (title + meta description) | Tasks | Mapped |
| RVW-20 | SEO: Open Graph básico (title/description/type/url) | Tasks | Mapped |
| RVW-21 | SEO: 404 não vaza metadados de resenha inexistente | Tasks | Mapped |
| RVW-22 | Placeholder estrutural de comentários + aviso "em breve" (C-2) | Tasks | Mapped |
| RVW-23 | Botão "Recomendar" desabilitado e acessível, sem lógica (C-2) | Tasks | Mapped |
| RVW-24 | `<article>` semântico, único `<h1>`, headings hierárquicos | Tasks | Mapped |
| RVW-25 | Teclado: foco visível, tab order lógico, skip link | Tasks | Mapped |
| RVW-26 | SSR sem JS: conteúdo e estrutura presentes | Tasks | Mapped |
| RVW-27 | axe 0 críticos + contraste AA (gate de CI do M0) | Tasks | Mapped |

**Coverage:** 27 requisitos · **27/27 mapeados para tasks** (T-23..T-31, ver [tasks.md](tasks.md)) ✅

---

## Success Criteria

- [ ] `/resenha/[slug]` renderiza via SSR a resenha publicada; slug inexistente e resenha `draft` dão 404.
- [ ] Página exibe título (`<h1>`), ficha via `BookDetails`, nota numérica (pt-BR, só exibição, omitida se nula) e texto em parágrafos.
- [ ] Capa tipográfica de fallback com alternativa textual acessível para livros sem `cover_url`.
- [ ] Cliente anônimo lê só resenhas publicadas (RLS `status='published'` + GRANT); rascunho invisível; escrita fechada; RLS habilitado; migration idempotente.
- [ ] Seed idempotente cria 1 resenha publicada por livro (4) com slug único, rating e texto plausíveis; cada slug abre a página.
- [ ] `<head>` traz title, meta description e OG coerentes por requisição; 404 não vaza metadados.
- [ ] Seção de comentários (aviso "em breve") e botão "Recomendar" desabilitado presentes, sem lógica, acessíveis.
- [ ] `<article>` semântico, único `<h1>`, headings hierárquicos; teclado e leitor de tela OK; axe 0 críticos + contraste AA.

---

## Notas para o Design (não decididas aqui)

- **Camada de query**: criar `getPublishedReviewBySlug(slug)` (tipada, join `book`+`genre`, filtra `status='published'`) — reusar/estender o padrão de `src/lib/book/queries.ts`. Definir o módulo (`src/lib/review/queries.ts`) e o tipo `ReviewView` na Design.
- **Formatação da nota**: helper de formatação numérica pt-BR (vírgula decimal) + texto acessível — decidir se vira componente `Rating`/`RatingDisplay` ou util puro (C-1: só número).
- **Capa tipográfica**: decidir se generaliza um componente `BookCover` (fallback) reutilizável por `review-listing-search`/`storage-covers`, ou inline na página — alinhar à classe `lia-card__media` do styleguide.
- **Renderização do `body`**: o `review.body` é texto puro (quebras em parágrafos) no M1; formatação rica (markdown/HTML) é de `reviews-crud` (M2). Definir a estratégia de quebra de parágrafos na Design (split por linha em branco vs. `white-space`).
- **Ordem dos blocos** na página (capa, ficha, nota, texto, comentários, recomendar) e níveis de heading — fechar o esqueleto semântico na Design, coerente com `BookDetails.headingLevel`.
- **RLS/GRANT**: migration nova (`0005_review_public_read.sql`?) seguindo o par 0003 (policy idempotente via `pg_policies`) + 0004 (GRANT explícito) — confirmar numeração/nome na Design. Teste de integração segue o padrão **local-only** da TD-02.
- **Verificação de a11y**: além do gate de CI (axe/Lighthouse), decidir se a página entra também em alguma rota de auditoria/teste, à semelhança do styleguide do M0.
