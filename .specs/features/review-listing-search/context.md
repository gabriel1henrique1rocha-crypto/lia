# review-listing-search — Contexto (decisões do Specify)

> Gray areas detectadas na fase Specify + a decisão **D-04**. Alimentam a fase Design.
> **Status:** as decisões abaixo são **recomendações propostas**, marcadas 🟡 quando dependem do seu OK na revisão e 🟢 quando já seguem precedente firme do projeto.
> Documentação em português; identificadores em inglês.

---

## D-04 — Estratégia de busca: **server-side no Supabase (`ilike`)** 🟢

**Pergunta:** a busca por título e os filtros devem rodar **client-side** (sobre dados já carregados) ou **server-side** (query no Supabase — `ilike`/full-text)?

**Trade-offs:**

| Critério | Client-side (carrega tudo, filtra no browser) | **Server-side (query Supabase)** ✅ |
| --- | --- | --- |
| Sem-JavaScript / SSR | ❌ depende de JS para filtrar | ✅ funciona por `searchParams` (DoD de a11y) |
| Escala do acervo | ❌ baixa todas as linhas ao cliente | ✅ baixa só a página (`range`) + `count` |
| RLS/segurança | ⚠️ pressiona trazer tudo (inclui risco de expor campos) | ✅ filtro `status='published'` na origem, anon |
| Paginação real | ❌ falsa (tudo no cliente) | ✅ real (`range` + total) |
| URL compartilhável | ⚠️ exige sincronizar estado→URL | ✅ natural (`searchParams`) |
| Complexidade inicial | baixa (com acervo minúsculo) | média (uma função de query) |

**Decisão (proposta):** **server-side no Supabase** — `.ilike('%termo%')` para a busca por título, `.eq/.gte` para filtros, `.order` para ordenação e `.range` + `count:'exact'` para paginação, tudo via **cliente anon** lendo só `status='published'`. **Full-text (tsvector/ranking/acentos) fica para fase futura** — o `ilike` cobre o MVP.

**Por quê:** é a recomendação do PRD/[DECISIONS.md](../../project/DECISIONS.md) D-04; é a **única** que honra o DoD de a11y (busca/filtros **sem JS**, via URL) e a paginação real; e mantém a RLS como gate na origem (coerente com `getPublishedReviewBySlug`). Client-side só ganharia com acervo minúsculo — vantagem que evapora quando o conteúdo cresce.

**Como aplica no Design:** `listPublishedReviews(params)` em `src/lib/review/queries.ts`; a home (Server Component) lê `searchParams` e chama a função; controles como form GET + links (progressive enhancement).

**Registrar em DECISIONS.md:** marcar D-04 como **Aceita** (server-side `ilike`, full-text adiado) **após o seu OK**.

---

## C-1 — Alvo da busca "por título": **título da resenha** (MVP) 🟡

**Pergunta:** "Buscar por título…" busca no **título da resenha**, no **título do livro**, ou também no **autor**?

**Decisão (proposta):** MVP busca no **`review.title`** (o título exibido nos cartões). Como no seed `review.title` ≈ título do livro, o resultado é intuitivo. **Autor** já tem **filtro próprio** (LST-09), então não precisa entrar na busca textual.

**Alternativa (fácil de acomodar):** `ilike` combinado em `review.title` **OU** `book.title` **OU** `book.author` — mais tolerante, custo baixo. Se você preferir "busca ampla", adotamos esta.

**Por quê propor o mais estreito:** casa com o rótulo literal ("por título"), evita surpresa (resultado por autor com filtro de autor separado) e é trivial de ampliar depois. **Confirmar na revisão.**

---

## C-2 — Escopo do header/nav global: **cabeçalho mínimo, links só para rotas existentes** 🟡

**Pergunta:** a Tela 1 mostra `header` com wordmark + nav (Início, Resenhas, Gêneros, Sobre) e um `footer`. Isso entra **completo** nesta feature?

**Decisão (proposta):** entregar um **cabeçalho mínimo** (wordmark "LIA." + o skip link já provido pelo layout) e um **rodapé simples**, com **links apenas para rotas que existem** (`/`). Itens como **Gêneros**/**Sobre**/**Resenhas** **não viram links mortos**: ou saem do MVP, ou apontam para `/` até as rotas existirem. A nav completa acompanha as respectivas rotas quando forem criadas.

**Por quê:** evita links quebrados (falha de a11y/SEO e UX ruim), mantém o foco da feature na listagem/busca e não antecipa `/genero/[slug]`/`/sobre`. **Confirmar** se você quer já um header/rodapé mais completos ou o mínimo.

---

## C-3 — Grid vs. lista: **só grid no MVP** 🟢

**Pergunta:** o wireframe mostra **grid (1A)** e **lista (1B)** "para comparar". Entregar as duas com um toggle?

**Decisão (proposta):** MVP entrega **só o grid**. O toggle de visualização (grid ⇄ lista) fica como **P2/futuro**.

**Por quê:** as duas variações no wireframe são para **comparação de design**, não requisito duplo; o toggle adiciona estado/persistência (e mais superfície de a11y) sem valor essencial no MVP. Grid é a escolha padrão. Segue o princípio de auto-sizing (não construir o que não é necessário agora).

---

## C-4 — Rota `/genero/[slug]`: **adiada (fora desta feature)** 🟡

**Pergunta:** a rota dedicada de gênero (`/genero/[slug]`) do sitemap entra aqui?

**Decisão (proposta):** **fora** desta feature. O **filtro de Gênero em `/`** (LST-08) já cobre a descoberta por gênero no MVP. A rota dedicada vira um **follow-up trivial** que reusa `listPublishedReviews({ genre })` + `ReviewCard` (basicamente a home pré-filtrada com `<h1>` do gênero) — melhor entregar depois que a listagem e o `ReviewCard` estiverem firmados.

**Por quê:** mantém a feature focada em firmar os componentes compartilhados; não há custo em adiar, porque a base fica pronta. **Confirmar** — se você quiser incluí-la já, é incremento pequeno e eu adiciono requisitos `LST-` para ela.

`/recomendacoes` **não** é gray area: é **M3** (`recommendations`, D-03), fora do M1.

---

## C-5 — Fonte do "destaque": **derivada, sem coluna nova** 🟢

**Pergunta:** o que alimenta o carrossel "Em destaque"? Não existe coluna `featured` no schema.

**Decisão (proposta):** destaque **derivado** das publicadas — ex.: as **N mais recentes** (`published_at desc`) ou as **N de maior nota**. **Sem** coluna/flag nova no `review` (isso seria curadoria editorial do M2/admin).

**Por quê:** evita mudança de schema e curadoria manual antes do painel existir; entrega uma porta de entrada curada "de graça" a partir dos dados. A regra exata (recentes vs. melhor avaliadas, e N) fecha na Design. Quando o admin (M2) chegar, um "destaque manual" pode substituir a heurística.
