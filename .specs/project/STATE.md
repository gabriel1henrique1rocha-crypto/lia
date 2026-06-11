# State — LIA

**Last Updated:** 2026-06-10
**Current Work:** M1 `book-data` — **Tasks** criadas (T-11..T-22, 12 tasks, 17/17 reqs mapeados). Pronto para execução. Branch `feat/book-data`.

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
| TD-02 | Testes de integração de RLS (`BOOK-11`, `BOOK-17`) rodam **apenas localmente** (Supabase local). O CI não tem Supabase/Postgres; adicionar o serviço ao pipeline e mover esses testes para o CI. | Média | M4 |

---

## Active Blockers

Nenhum.

---

## Lessons Learned

Nenhuma registrada ainda.

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
- [ ] Handoff M1: RLS de leitura de `review` (`status='published'`) — segue para as features de resenha (book-data cobre só `book`)

---

## Preferences

**Model Guidance Shown:** 2026-06-07
