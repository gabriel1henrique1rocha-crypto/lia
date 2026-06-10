# State — LIA

**Last Updated:** 2026-06-10
**Current Work:** `infra-foundation` (M0) — fase **Tasks** concluída ([tasks.md](../features/infra-foundation/tasks.md), 10 tasks · 17/17 requisitos mapeados), pronta para **Execute**

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
- [ ] Próximo passo: executar T-01 → iniciar implementação de `infra-foundation`
- [ ] Handoff M1: adicionar RLS policies de leitura (`status='published'`) — M0 entrega RLS deny-by-default

---

## Preferences

**Model Guidance Shown:** 2026-06-07
