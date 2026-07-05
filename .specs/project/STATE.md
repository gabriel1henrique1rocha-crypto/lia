# State — LIA

**Last Updated:** 2026-07-05
**Current Work:** M1 `review-page` — **fase Tasks CONCLUÍDA** (tasks.md em `.specs/features/review-page/`, branch `feat/review-page`). 9 tasks atômicas `T-23..T-31`, **27/27 reqs mapeados** (0 órfão); 3 tabelas de validação pré-aprovação passam. Fase 1 paralela (T-23..T-29, 7 arquivos independentes) → Fase 2 (T-30 page.tsx ← 25/26/27/28/29; T-31 teste RLS ← 23/24). Alocação de modelo: **Opus** na migration 0005 (T-23), teste RLS anon (T-31) e componentes com carga de a11y (T-26 Rating/formatRating, T-27 BookCover); Sonnet/Haiku no scaffolding (T-24 seed, T-25 queries+cache, T-28 not-found, T-29 metadataBase, T-30 page). WCAG 2.1 AA embutido no `Done when` das tasks de UI (não é task separada, C-2). **⚠️ TD-03 permanece ABERTA:** a T-23 concede GRANT só a `review` — não fecha a TD-03 (demais tabelas + service_role pré-M2). **Próximo: aprovar tasks.md e iniciar a fase Execute.** Design aprovado (2026-06-12); Specify concluído (C-1 nota só número; C-2 placeholders "em breve"). | `book-data` (M1 anterior) — ✅ COMPLETA, mergeada (PR #1).

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

---

## Technical Debt

| ID | Descrição | Severidade | Milestone sugerido |
| --- | --- | --- | --- |
| TD-01 | T-06/T-07 marcou os 4 componentes base como `'use client'` por causa do `useId` no `Field`. `Button`, `Link` e `Card` são candidatos a Server Component (sem hooks); separar reduz JS enviado ao cliente e melhora Core Web Vitals (TBT/INP). | Leve | M4 |
| TD-02 | Testes de integração de RLS (`BOOK-11`, `BOOK-17`) rodam **apenas localmente** (Supabase local). Implementado em `src/lib/book/__tests__/rls.integration.test.ts`, guardado por `RUN_RLS_INTEGRATION=1` + `describe.skipIf` (PULA no CI). Credenciais lidas só de env (`SUPABASE_LOCAL_*` no `.env.local`, gitignored — **nunca hardcoded**; `vitest.config` carrega via `loadEnv`). Rodar: `npx supabase start && npx supabase db reset`, depois `$env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/book/__tests__/rls.integration.test.ts`. Mover para o CI (subir Supabase no pipeline) avaliado no M4. | Média | M4 |
| TD-03 | **Pós-2026-05-30, o Supabase não auto-concede GRANTs a tabelas novas** do schema public (`auto_expose_new_tables` → `false` por padrão; campo removido em out/2026). Policies RLS **não bastam** sem GRANT de tabela — o Data API retorna 42501. A migration 0004 cobriu **só** a leitura pública da ficha (`select on book` + `genre`, o join exibido — BOOK-17). **Revisar os GRANTs das demais tabelas** (`review`, `comment`, `recommendation`, `editor`) **e do `service_role`/Data API** numa frente de infra dedicada. Bloqueia o caso (3) do teste RLS (insert de `review` via service_role), hoje `it.skip`. | **Alta** | pré-M2 |

---

## Active Blockers

Nenhum.

---

## Lessons Learned

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

- [ ] D-04 (busca) — resolver em `review-listing-search` (M1)
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
- [ ] Execute `review-page` — implementar T-23..T-31 (aguardando aprovação do tasks.md)
- [ ] **TD-03 (Alta, pré-M2):** a migration 0005 (T-23) concede GRANT só a `review`; abrir frente de infra para GRANTs de `comment`/`recommendation`/`editor` + `service_role`/Data API **antes do M2 (`reviews-crud`)**

---

## Preferences

**Model Guidance Shown:** 2026-06-07
