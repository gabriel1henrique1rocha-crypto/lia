# State — LIA

**Last Updated:** 2026-07-07
**Current Work:** **M1 CONCLUÍDO** — `review-listing-search` **mergeado em `main`** (PR #3, `b127316`; CI verde: lint/vitest/axe); a home `/` (listagem/busca/filtros/paginação/destaque) está no código de produção. **M2 ABERTO** — 1ª feature `security-foundation` com **Execute EM ANDAMENTO** (branch `feat/security-foundation`, sem push): **T1–T18 implementadas e commitadas, gate verde por commit**; falta a **T19** (verificação end-to-end com Mailpit local) + checklist de merge + revisão final humana. Entregue até aqui: 3 clients isolados (public/authenticated/admin) com fallback `??` extinto (server.ts/client.ts removidos), env por client (admin lazy), fronteira estrutural em 3 camadas (server-only + env sem NEXT_PUBLIC + lint allowlist vazia), magic link token_hash via @supabase/ssr (login a11y + callback + signout + guards requireEditor/requireAdmin + route group protected), migrations **0007** (RBAC editor: funções security definer anti-recursão + GRANTs + policies) e **0008** (review own-or-admin) aplicadas SÓ local (db reset limpo; **db push produção é passo humano — refinamento do A-11: PRÉ-merge, a partir do checkout da branch, verificando pg_policies antes de mergear; migrations aditivas/idempotentes só tocam papel `authenticated` que o código antigo não exerce**), e as PROVAS: SEC-14 (anon ≠ bypass com service_role no ambiente), fronteira de build (server-only quebra o build), e a **matriz RLS comportamental via API 17/17** (A×B, WITH CHECK, comment/recommendation deny-by-default). D-09 e D-10 registradas. **Design (§1–§9) e Tasks (19 tasks) concluídos em 2026-07-07.** Auditoria do Design (§9): defaults **A-2** (anon sem GRANT em `editor`/`comment`/`recommendation`; deny = vazio OU 42501) e **A-4** (escrita de `review` own-or-admin, editor publica a própria — PRD §4/§6.3) aprovados na revisão; armadilhas registradas: **A-3** `shouldCreateUser:false` obrigatório (senão magic link vira auto-cadastro), **A-5** Next 16 usa `proxy.ts` (não `middleware.ts`; runtime Node), **A-6** SMTP custom é pré-requisito de produção do magic link. Specify aprovado antes (SEC-01..19; **C-1..6 RESOLVIDAS** na revisão de 2026-07-07 — magic link, autenticado+RLS com `service_role` só exceção, bootstrap manual do 1º admin, `admin-auth-editors` fundida aqui, moderação fora). **0006 APLICADA em produção** (2026-07-07): `db push` executado, policy `genre_public_read` confirmada em `pg_policies` (LIA `gcfsiaxyvfmoyasxjflx`); efeitos validados (filtro de gênero na home + gênero de volta na ficha da review-page). **Sem pendência de push.** **GATE DE ROLLOUT M2:** nenhuma `SUPABASE_SERVICE_ROLE_KEY` em Production até `security-foundation` mergear (TD-04). --- *(histórico M1)* `book-data`+`review-page` mergeadas em `main` (`738bd49`). Site servido pelo alias de produção canônico **https://lia-kappa.vercel.app** (Valid Configuration); a rota pública é **https://lia-kappa.vercel.app/resenha/[slug]**. **Banco de produção populado** (LIA / `gcfsiaxyvfmoyasxjflx`): migration `0005` aplicada (`supabase db push`) + seed rodado (`npm run db:seed`) → **4 resenhas `published` + 1 `draft`** + 5 livros. **RLS validada end-to-end em produção via anon** (2026-07-05): o público vê as **4 publicadas** (`dom-casmurro`, `iracema`, `o-cortico`, `o-crime-do-padre-amaro`); o **draft `memorias-postumas-rascunho` é invisível** (retorna vazio) — deny-by-default confirmada na nuvem. Como o Production **não tem `SUPABASE_SERVICE_ROLE_KEY`** (ver TD-04), a leitura usa anon e a **RLS é o gate real**. **LACUNA DE DESIGN RESOLVIDA** (2026-07-05, commit `45b90c4`): os artefatos gerados no Claude Design foram versionados em `docs/design/` — a `/resenha/[slug]` fora construída SEM alvo visual (o design vivia só no Claude Design, fora do repo), e agora o alvo está no repositório. **Próxima feature:** M1 `review-listing-search` (listagem/busca da home `/`) pelo fluxo TLC completo (ver Todos). Pendências pré-aplicação de design em backlog (cores sálvia, rota admin `novo`/`nova`). Ainda em aberto: domínio final `www.literaturainclusiva.com.br` (DNS — D-08) e polish de UI (bloco vinho da capa — backlog). | Gates de código verdes: typecheck/build/lint + Vitest 93 passed / 8 skipped.

---

## Recent Decisions (Last 60 days)

> ADRs completos em [DECISIONS.md](DECISIONS.md). Resumo das resolvidas:

### D-05: Hospedagem na Vercel (2026-06-07)

**Decision:** hospedar na Vercel.
**Reason:** suporte first-class a Next.js (App Router/SSR/SSG), CDN global, deploy contínuo.
**Trade-off:** acoplamento ao ecossistema Vercel.
**Impact:** pipeline de deploy do M0 mira a Vercel.

### D-06: TypeScript sobre base JavaScript (2026-06-07)

**Decision:** adotar TypeScript.
**Reason:** tipar modelo de dados e contratos reduz bugs; respeita a stack "JavaScript".
**Trade-off:** passo de build/tipagem adicional.
**Impact:** projeto inicializado em TypeScript no M0; tipos derivados do schema.

### D-07: Tailwind v4 (@theme) + escala numérica de spacing (2026-06-07)

**Decision:** Tailwind **v4**, tokens em `@theme` como fonte única; spacing via `--spacing: initial` + chaves `1–9`.
**Reason:** CSS-first satisfaz INFRA-07 nativamente; reset + chaves explícitas resolvem a colisão da INFRA-08.
**Trade-off:** v4 mais novo; `p-8`=64px diverge da convenção numérica do Tailwind (documentado).
**Impact:** sem `tailwind.config.js`; componentes consomem só tokens. ADR completa em [DECISIONS.md](DECISIONS.md) D-07.

### D-08: Domínio de produção — www.literaturainclusiva.com.br (2026-07-05) · *decisão de domínio (#6)*

**Decision:** domínio de produção **`www.literaturainclusiva.com.br`**, registrado na Vercel (escopo Production).
**Status:** ⚠️ **Invalid Configuration** — o **DNS ainda não aponta para a Vercel** (provável zona no **Registro.br**). Enquanto não valida, o site é servido por **`lia-kappa.vercel.app`**.
**Pendência:** configurar os registros DNS que a Vercel indica em **Domains > Edit** (ver backlog).
**Impact:** quando o DNS validar, **revisar `NEXT_PUBLIC_SITE_URL`** para o domínio final — impacta `og:url`/canonical (via `metadataBase`) e o futuro sitemap (`seo-core`).

---

## Technical Debt

| ID | Descrição | Severidade | Milestone sugerido |
| --- | --- | --- | --- |
| TD-01 | T-06/T-07 marcou os 4 componentes base como `'use client'` por causa do `useId` no `Field`. `Button`, `Link` e `Card` são candidatos a Server Component (sem hooks); separar reduz JS enviado ao cliente e melhora Core Web Vitals (TBT/INP). | Leve | M4 |
| TD-02 | Testes de integração/e2e de RLS rodam **apenas localmente** (Supabase local), guardados por `RUN_RLS_INTEGRATION=1` + `describe.skipIf` (PULAM no CI). Hoje cobrem: `rls.integration` (book), `listing.integration`, `public-no-bypass` (SEC-14) e a **matriz A×B** (`rbac-matrix`, SEC-10/11/12/19) + o e2e Mailpit (`scripts/e2e-magic-link.mjs`). Credenciais só de env (`SUPABASE_LOCAL_*`, gitignored — nunca hardcoded). **GATILHO (substitui o defer passivo "M4"):** subir Supabase no CI e mover estas suítes para os **required checks da branch protection ANTES da entrada do 2º editor REAL** — i.e., condição ligada ao **onboarding de editores** (quando a RLS-por-papel passa a proteger dados de mais de uma pessoa), não a um número de milestone. Inclui as matrizes futuras de `comment`/`recommendation` (M3). Até lá, rodar local antes de cada `db push` que toque policies. | Média | gatilho: pré-2º-editor |
| TD-03 | **Pós-2026-05-30, o Supabase não auto-concede GRANTs a tabelas novas** do schema public. Policies RLS **não bastam** sem GRANT de tabela — o Data API retorna 42501. **REDUZIDA em `security-foundation`** (2026-07-08): 0007 concede `select/insert/update` de `editor` a `authenticated` (+ policies RBAC); 0008 concede `insert/update/delete` de `review` a `authenticated` (+ policies own-or-admin). **Remanescentes (AINDA ABERTOS):** (1) `comment` — GRANTs/policies de escrita+moderação → `public-comments`/`admin-comment-moderation` (M3); (2) `recommendation` → `recommendations` (M3); (3) **GRANTs de `service_role`/Data API** — deliberadamente AUSENTES (dormência C-2/D-09; provado por T16: service_role toma 42501 em editor/review); só com a 1ª exceção real de bypass, com GRANT MÍNIMO + ADR (ver [runbook §4](../../docs/runbook-admin-bootstrap.md)); (4) DELETE de `review` a editor (hoje admin-only) se o produto exigir → `admin-reviews`; (5) policies de Storage por papel → feature de Storage (M2). O caso (3) `it.skip` do rls.integration antigo segue skip por isto (service_role sem grant é o estado projetado). | **Média** (reduzida de Alta) | M3 / conforme feature |
| TD-04 | **FECHADA em `security-foundation`** (2026-07-08, aguardando merge). O fallback `SUPABASE_SERVICE_ROLE_KEY ?? PUBLISHABLE_KEY` do antigo `server.ts` deixou de existir (arquivo removido); o caminho público usa `createPublicClient` (anon, só publishable) sem rota de import até a service_role (grafo de imports + `server-only` + lint allowlist vazia + tripwire estático). Regressão SEC-14 prova em runtime que, **mesmo com `SUPABASE_SERVICE_ROLE_KEY` presente no ambiente**, o caminho público lê só `published` (prova de vermelhidão executada). Gate SEC-17 mantém a chave fora de Production. **Fecha de fato no merge do PR + confirmação do checklist Vercel.** | ~~Média~~ **fechada** | M2 (fechada) |

---

## Active Blockers

**Nenhum bloqueador.** ✅ *(Deploy da `review-page` RESOLVIDO em 2026-07-05 — `0005` aplicada ao banco de produção LIA + seed rodado; `/resenha/[slug]` responde em produção com as 4 publicadas, draft invisível.)*

### Backlog / polish (não-bloqueante)

- [ ] **UI — bloco vinho na página de resenha (prod):** um bloco de cor vinho ocupa grande parte da página em produção — provável **placeholder do `BookCover` (D-05)** com altura/cor exageradas, ou o container de capa sem imagem esticando. Afeta as **4 resenhas** (seeds sem `cover_url`). Investigar no polish de UI (ajustar `.lia-card__media--type`/layout da capa tipográfica).
- [ ] **DNS — validar `www.literaturainclusiva.com.br`:** configurar no **Registro.br** os registros que a Vercel indica em **Domains > Edit** (hoje *Invalid Configuration*). Ao validar, atualizar `NEXT_PUBLIC_SITE_URL` (ver D-08 — impacta OG/canonical/sitemap).

### Pendências de design a decidir (backlog — não bloqueiam telas públicas, resolver ANTES de aplicar o design)

- [ ] **Cores sálvia (`#4f5c47` e `#dce5d3`) — decisão pendente.** Aparecem no `docs/design/LIA Marca.html` mas **NÃO existem** em `lia-tokens.css` (o par verde dos tokens é semântico: `#1f6b3b`/`#e8f1ea`). Decidir: **adotar como acento novo da marca** (viram tokens nomeados no design system) **ou descartar**. **Resolver antes de a listagem (`review-listing-search`) consumir tokens**, para não espalhar cor hard-coded fora do sistema.
- [ ] **Divergência de rota admin entre os artefatos.** O **wireframe** diz `/admin/resenhas/novo`; o **sitemap** diz `/admin/resenhas/nova`. Alinhar nomenclatura **antes do M2 (admin)**. Provável correto: **`nova`** (concordância com "resenha"). **Não bloqueia** as telas públicas do M1.

---

## Lessons Learned

- **Oráculo de verificação de RLS: leia o resultado por SUPERUSER (psql-postgres), NUNCA pelo mesmo role sob teste** (2026-07-08, descoberto na matriz T16 de `security-foundation`). Ao provar "editor A NÃO deletou/editou o recurso de B", a asserção de "linha intacta" precisa **ler a verdade do banco por um caminho privilegiado**. Ler via o próprio client sob RLS (ou via `service_role`, que **também** não tem GRANT nessas tabelas do M2 — 42501) devolve `null`/vazio **independentemente** de a operação ter sido negada → o teste passa por **falso-verde** (o oráculo confunde "negado" com "não-encontrado"). Aconteceu: a verificação de admin-delete "passou" antes de a linha ser realmente deletada. **Correção aplicada:** `psqlScalar()` roda `docker exec … psql -U postgres` (bypassa RLS e grants) para ler o estado real; as **ações** continuam pelos clients autenticados sob RLS. **Aplicar nas matrizes futuras** de `comment`/`recommendation` (M3): setup e verificação por `postgres`; ações e negações pelo role real. Corolário: `service_role` **não** serve de oráculo aqui (dormência C-2/D-09 — sem GRANT de tabela).
- **Testes que importam a cadeia de `queries.ts` (→ `supabase/server` → `env.ts`) devem usar import DINÂMICO dentro do setup (`beforeAll`)** (2026-07-06, descoberto no CI do PR #3). `env.ts` valida `process.env` com Zod **no load do módulo** — um import estático detona a validação no job vitest do CI (que não tem vars do Supabase) ANTES de o `describe.skipIf` pular a suíte: o arquivo falha inteiro com ZodError, mesmo com 100% dos testes passando/pulados. **Sorrateiro:** o gate local NÃO reproduz (o `.env.local` existe e o `vitest.config` o carrega via `loadEnv`) — local verde não prova nada aqui; a prova é o CI (ou rodar com `.env.local` renomeado). **Aplicar em qualquer teste futuro que toque `queries.ts`/`env.ts`:** `let queries: typeof import('../queries')` + `queries = await import('../queries')` no `beforeAll` (padrão do `rls.integration.test.ts`, que só importa `createClient` + tipos). NÃO "consertar" pondo placeholders de env no job de teste do CI — mascara o acoplamento.
- **Gate de código DEVE incluir `npm run format:check` (Prettier), não só typecheck+lint** (2026-07-05, descoberto no PR #2 da `review-page`). No Execute rodei `typecheck` e `eslint` por task, mas **não** o `format:check`; o CI (job `lint + format + types`) reprovou `prettier --check` em 3 arquivos (`page.tsx`, `queries.ts`, `rls.integration.test.ts`) — só formatação, corrigido com `prettier --write` (commit `a150297`). **Aplicar sempre:** o gate quick/full local deve ser `npm run typecheck && npm run lint && npm run format:check && npm test`, espelhando o job do CI. eslint e prettier são gates independentes.
- **ISBNs de exemplo nos specs têm checksum inválido** (2026-06-10, descoberto no T-11). Os ISBNs citados nas tasks/design (`9788535902775`, `8535902770`) e no seed (`9788520932051` para O Cortiço) **não passam** na validação de checksum — foram escritos sem calcular o dígito verificador. A implementação do `isbn.ts` é correta e os rejeita. **Aplicar em T-16 e T-21:** usar ISBNs com checksum verificado (ex.: `9783161484100`, `0306406152`, `080442957X`) ou recalcular o dígito verificador dos ISBNs reais antes de usá-los no seed/schema; não copiar os exemplos do spec verbatim.

---

## Quick Tasks Completed

| #   | Description | Date | Commit | Status |
| --- | ----------- | ---- | ------ | ------ |
| —   | —           | —    | —      | —      |

---

## Deferred Ideas

Itens fora de escopo do MVP, preservados para fases futuras (não bloquear o modelo de dados):

- [ ] `sections-extra` — listas, desafios, clubes do livro, enquetes — Captured during: PRD
- [ ] `analytics-reports` — resenhas mais vistas, comentários por período, buscas populares — Captured during: PRD
- [ ] `monitoring` — Sentry (erros) + Vercel Analytics ou Plausible (métricas) — Captured during: PRD

---

## Todos

Decisões em aberto a resolver na feature correspondente (ver [DECISIONS.md](DECISIONS.md)):

- [x] D-04 (busca) — **RESOLVIDA (Aceita, 2026-07-06)**: server-side no Supabase via `ilike` sobre `review.title` (C-1), full-text/pg_trgm adiado para quando o volume justificar. ADR completa em DECISIONS.md
- [ ] D-01 (escala da nota) — resolver em `reviews-crud` (M2)
- [ ] D-02 (anti-spam) — resolver em `public-comments` (M3)
- [ ] D-03 (modelo de indicação) — resolver em `recommendations` (M3)
- [x] Especificar a feature `infra-foundation` (M0) — spec.md criado
- [x] Versão do Tailwind confirmada: **v4 (`@theme`)** — ADR D-07 (alimenta INFRA-07)
- [x] Desenhar a feature `infra-foundation` (M0) — design.md criado
- [x] Fase Tasks de `infra-foundation` concluída — 10 tasks, 17/17 reqs mapeados
- [x] T-01 → T-09: implementação de `infra-foundation` concluída
- [x] T-10: migration aplicada no Supabase remoto (deploy M0 done)
- [x] M0 `infra-foundation` **concluído** — CI verde, RLS deny-by-default ativo na nuvem
- [ ] Handoff M1: adicionar RLS policies de leitura (`status='published'`) — M0 entrega RLS deny-by-default
- [x] Iniciar M1 pela feature `book-data` (ficha técnica) — spec.md criado
- [ ] book-data: decisões do Specify registradas — ISBN **opcional, validado se presente** (checksum ISBN-10/13, armazenado normalizado, exibido formatado); seed popula **só livros + gêneros** (resenhas nas features de resenha); `genre_id` endurecido para NOT NULL
- [x] Revisar spec de `book-data` — aprovado; ajuste: RLS de **leitura pública (SELECT) de `book`** entra nesta feature (BOOK-17), escrita fica no M2; `cover_url` confirmado como referência textual (imagem em `storage-covers`)
- [x] Desenhar a feature `book-data` (design.md) — 12 componentes, 8 decisões (DD-1..8); 17/17 reqs endereçados
- [x] Revisar design de `book-data` — aprovado (DD-1..8 ok, TD-02 registrado)
- [x] Fase Tasks de `book-data` concluída — 12 tasks (T-11..T-22), 17/17 reqs mapeados
- [x] **Execute `book-data` concluído** — 12/12 tasks, 7 fases; build/typecheck/test/axe/Lighthouse verdes; RLS local 4/4. Pronto para PR (branch `feat/book-data`)
- [ ] Handoff M1: RLS de leitura de `review` (`status='published'`) — **endereçado na spec de `review-page`** (RVW-13/14/15: policy filtrada + GRANT TD-03); a implementar no Execute
- [x] Especificar a feature `review-page` (M1) — spec.md + context.md criados; gray areas C-1 (nota só número) e C-2 (placeholders "em breve") resolvidas; **aguardando revisão antes do Design**
- [x] Desenhar a feature `review-page` (design.md) — **aprovado** 2026-06-12; 27/27 reqs mapeados a componentes; 3 pontos da revisão resolvidos (draft via 5º book; `<h2>Resenha`; `metadataBase`)
- [x] Fase Tasks de `review-page` concluída — **9 tasks (T-23..T-31), 27/27 reqs mapeados**, alocação de modelo definida; `tasks.md` criado
- [x] Execute `review-page` — **10/10 tasks (T-23..T-32) implementadas e commitadas**; gates de código verdes (typecheck/build/lint + 93 passed/8 skipped). Verificação local Supabase (T-23/24/31/32) pendente (TD-02)
- [x] Ajuste pré-Execute `review-page` — T-26 dividida (formatRating util + Rating componente), renumeração T-27..T-32, dependency graph corrigido (T-23→T-24 sequencial); código realinhado (`rating.ts`→`formatRating.ts`, commit `7f0d925`)
- [x] `review-page`: branch pushada para o origin (CI rodando no push)
- [x] `review-page`: **PR #2 aberto** para `main` (https://github.com/gabriel1henrique1rocha-crypto/lia/pull/2) via `gh` (instalado 2.96.0 + autenticado). CI **verde** após fix de Prettier (`a150297`): lint+format+types, vitest (93/8), axe+lighthouse (`/`+`/styleguide`), Vercel. **Sem merge — aberto para revisão.**
- [ ] `review-page`: rodar verificação local dos gates de banco (`supabase start && db reset`; axe da rota `/resenha/[slug]`; `RUN_RLS_INTEGRATION=1`)
- [ ] **TD-03 (Alta, pré-M2):** a migration 0005 (T-23) concede GRANT só a `review`; abrir frente de infra para GRANTs de `comment`/`recommendation`/`editor` + `service_role`/Data API **antes do M2 (`reviews-crud`)**
- [x] **Lacuna de design RESOLVIDA** (2026-07-05, commit `45b90c4`) — artefatos versionados em `docs/design/`: `LIA Marca.html` (design system/marca), `Wireframes LIA (standalone).html` (wireframe lo-fi de 4 telas + estados), `LIA — Sitemap da aplicação.pdf` (rotas públicas e admin). Cobertura confirmada: wireframe cobre a **página de resenha individual (Tela 2)** E a **listagem/home (Tela 1)**. Design system é **evolução coerente** com `lia-tokens.css`/`lia-components.css` (mesma paleta e tipografia, sem conflito estrutural; só as 2 cores sálvia divergem — ver backlog)
- [x] **Especificar `review-listing-search` (M1)** — spec.md (27 reqs `LST-01..27`) + context.md **APROVADOS** (2026-07-06): C-1 busca só em `review.title`, C-2 header mínimo semântico, C-4 `/genero/[slug]` adiado, D-04 server-side `ilike` (Aceita). Escopo: **entra** home `/` (grid, busca, filtros gênero/autor/nota, ordenação, paginação, estado vazio, carrossel manual, `ReviewCard` compartilhado, leitura anon 0004/0005 — sem migration); **fora** `/genero/[slug]`, `/recomendacoes` (M3), toggle grid⇄lista, full-text
- [x] **Desenhar `review-listing-search` (design.md)** — criado 2026-07-06: 10 decisões DD-1..10, **27/27 reqs mapeados**, 6 componentes novos (`ReviewCard`, `ListingControls`, `Pagination`, `EmptyState`, `FeaturedCarousel`, `SiteFooter`) + reuso (BookCover/Rating/excerpt extraído), query única `ilike`+filtros+`range`/`count`, SEO canonical `/`+noindex p/ params, sálvia estreia na seção destaque (DD-7). **Aguardando revisão antes de Tasks**
- [x] **`review-listing-search` — verificação de design + fase Tasks** (2026-07-06): 3 pontos verificados no design.md — **(1) aria-live: COBERTO** (DD-9, reforçado com a mecânica explícita de live region em navegação SSR); **(2) FeaturedCarousel: SEM auto-rotação** (DD-5/§4/LST-16 — nenhum gate WCAG 2.2.2 a resolver, sem parada de decisão); **(3) escapeLike: era VAGO → tornado EXPLÍCITO** (§3: ordem `\`→`\\` primeiro, depois `%`/`_`; + flag de verificação supabase-js/PostgREST na impl). **tasks.md criado** — 14 tasks (T1..T14), **27/27 reqs mapeados sem órfãos**, 3 gates de validação ✅, alocação de modelo por task, leitura anon/sem migration (TD-04/LST-19) registrada. **Aguardando revisão antes de Execute.**
- [x] **Sálvia adotada** (Execute): tokens `--color-sage-100` (#dce5d3) / `--color-sage-700` (#4f5c47) criados no `@theme` (não existiam no repo). Fecha a pendência "cores sálvia".
- [x] **Execute `review-listing-search` CONCLUÍDO** (2026-07-06, branch `feat/review-listing-search`, 19 commits, **sem PR/deploy** — aguardando revisão): 14 tasks (T1–T14) + fix prettierignore + hardening da home + migration 0006 + fix PGRST103. Gates de código VERDES em cada commit (typecheck/lint/format/**155 passed** / 16 skipped). Build ok; `/` agora **dinâmica (ƒ)**. **axe do CI provado local** (`/`+`/styleguide` 0 críticos, contra dados reais e contra o fallback). **Home verificada end-to-end** contra Supabase **local** (4 publicadas, draft ausente, busca `q=dom`→1, filtros de gênero derivados, `pagina=999` normaliza sem 500, robots noindex com params). **Integração T4 8/8** local (anon só lê published; escape %/_→0).
- [x] **`review-listing-search` — PR #3 aberto, CI verde e MERGEADO em `main`** (`b127316`). Revisão do diff conduzida (0006, escapeLike, home resiliente); fix do CI (import dinâmico no teste de integração — ver Lessons). Branch pushada, `main` local sincronizado.
- [x] **0006 APLICADA em produção** (2026-07-07): `supabase db push` executado no projeto LIA (`gcfsiaxyvfmoyasxjflx`); policy `genre_public_read` confirmada em `pg_policies`; efeitos validados no ar — filtro de gênero na home + gênero de volta na ficha `/resenha/dom-casmurro`. **Fecha o achado** (lacuna: `genre` tinha RLS+GRANT mas nenhuma policy de SELECT desde o M1; a review-page em prod exibia gênero null/omitido — agora corrigido).
- [x] **`security-foundation` (Specify) — decisões da revisão APLICADAS** (2026-07-07): spec.md (**SEC-01..19**) + context.md (**C-1..C-6 RESOLVIDAS**). **C-1** magic link (sem senha); **C-2** escrita padrão = client autenticado (JWT) sob RLS, `service_role` só exceção documentada e **dormente** nesta feature (exige policies de escrita p/ o papel autenticado); **C-3** `server-only`+env+lint boundary; **C-4** bootstrap manual do 1º admin (documentado, sem segredo no repo); **C-5** `admin-auth-editors` **fundida** aqui (auth de editor é parte da fundação); **C-6** moderação de `comment` FORA — só garante/testa deny-by-default. Modelo de auth de editor explícito no spec (editor.id = auth.users.id; papel via `editor.role`/`active`; RBAC no app E na RLS). Possível ADR **D-09** (modelo de escrita). **Aguardando revisão antes do Design.**
- [x] **Desenhar `security-foundation` (design.md)** — criado 2026-07-07 (§1–§9, DD-1..19, 19/19 reqs rastreados): 3 clients (`public.ts`/`authenticated.ts`/`admin.ts`; `server.ts`+`client.ts` REMOVIDOS — fallback `??` morre), env dividida por client (`env.admin.ts` lazy), isolamento em 3 camadas (`server-only` + env sem `NEXT_PUBLIC` + lint allowlist VAZIA = dormência C-2 como código), `editor` da 0001 JÁ conforme (sem ALTER), migrations previstas **0007** (RBAC editor + `is_admin`/`is_active_editor` security definer — anti-recursão 42P17) e **0008** (review own-or-admin) NÃO aplicadas, magic link token_hash via `@supabase/ssr ^0.12.0` (a instalar) com `shouldCreateUser:false`, gate = layout `(protected)`+`requireEditor()` autoritativo + `proxy.ts` só refresh (CVE-2025-29927), threat model 13 modos (F-1..F-13), regressão T-a..T-f. §9: A-1..A-11; **A-2/A-4 aprovados com os defaults do design** na revisão.
- [x] **Fase Tasks de `security-foundation` concluída** (2026-07-07) — **19 tasks (T1..T19), 19/19 reqs mapeados sem órfãos**, 3 gates de validação ✅ (granularidade, diagrama×deps, co-locação de testes), alocação de modelo por task. STOPs explícitos: `db push` produção FORA das tasks (pós-merge, humano); `SUPABASE_SERVICE_ROLE_KEY` não entra na Vercel (SEC-17); SMTP/template = runbook (T17). **Aguardando revisão antes do Execute.**
- [x] **T19 — verificação end-to-end (Mailpit local) VERDE 11/11** (2026-07-08): `scripts/e2e-magic-link.mjs` dirigiu o fluxo real (login → magic link no Mailpit → `/auth/confirm` token_hash → sessão → gate `/admin`). **D-10 confirmado empiricamente**: todos os cookies de auth são **HttpOnly + SameSite=Lax** (A-10 fechado). Gate: `/admin` com sessão → 200 (papel admin resolvido); sem sessão → 307 `/admin/login`; refresh do proxy sobrevive. Bootstrap do admin de teste pelo caminho privilegiado (GoTrue admin + psql), não service_role.
- [x] **Execute `security-foundation` T1–T18** (2026-07-08, branch `feat/security-foundation`, sem push): fundação de clients (T1–T7), fluxo de auth magic link (T8–T11), migrations 0007/0008 local (T12–T13), provas SEC-14/build-boundary/matriz-RLS-17-17 (T14–T16), runbook + D-09/D-10 + TD-04 fechada/TD-03 reduzida (T17–T18). Gate verde por commit; revisões por grupo aprovadas (Fundação/Auth/Migrations/Provas). Defaults A-2 (anon sem GRANT; deny=vazio OU 42501) e A-4 (review own-or-admin, editor publica own) aprovados. Decisões da sessão: callback token_hash (não PKCE, cross-device), D-10 (sessão server-only + cookies httpOnly nos 3 pontos de escrita), contrato anti-recursão da 0007 (self direto + admin via definer, editor NO FORCE).
- [ ] **PRÓXIMO PASSO — abrir o PR humano.** Ordem de rollout (refinamento A-11, PRÉ-merge): `db push` das 0007/0008 a partir do checkout da branch → verificar `pg_policies` → **então** mergear → SMTP/template → bootstrap do 1º admin → verificar login (ver [runbook §5](../../docs/runbook-admin-bootstrap.md)). Gate SEC-17: NÃO configurar `SUPABASE_SERVICE_ROLE_KEY` na Vercel. **Gatilho TD-02:** mover as suítes RLS/e2e para os required checks do CI antes do 2º editor real.

---

## Preferences

**Model Guidance Shown:** 2026-06-07
