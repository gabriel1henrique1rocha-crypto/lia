# Roadmap — LIA

**Current Milestone:** M2 — Painel administrativo (1ª feature: `security-foundation`, em Execute — T1–T18 commitadas, T19 + revisão final pendentes)
**Status:** M0–M1 entregues (público no ar); M2 em andamento pela fundação de segurança

> Cada feature vira uma pasta em `.specs/features/<id>/`.
> **Regra transversal:** acessibilidade WCAG 2.1 AA (`accessibility-wcag`) é Definition of Done de **toda** feature, em **todo** milestone. M4 é apenas a auditoria formal final.

## Definition of Done (toda feature)

- [ ] Atende aos critérios de aceitação do PRD
- [ ] HTML semântico + navegação por teclado + leitor de tela OK
- [ ] Contraste 4.5:1 e tipografia escalável
- [ ] axe/Lighthouse sem erros críticos no CI
- [ ] Testes da feature passando
- [ ] Commit atômico com rastreabilidade ao requisito

---

## M0 — Fundação (`infra-foundation`)

**Goal:** repositório pronto para desenvolver com qualidade desde o primeiro commit — pipeline verde + página placeholder acessível no ar.
**Dependências:** nenhuma. **Decisões:** D-05 e D-06 (resolvidas, ver [DECISIONS.md](DECISIONS.md)).

### Features

**`infra-foundation`** — PLANNED

- Projeto Next.js (App Router) + React + TypeScript
- Projeto Supabase (PostgreSQL + Auth + Storage) e variáveis de ambiente
- Schema base e migrations das entidades núcleo (`book`, `review`, `comment`, `editor`, `recommendation`, `genre`)
- Design tokens base + foco visível + tipografia escalável
- CI/CD via GitHub Actions: lint, testes, axe/Lighthouse
- Deploy inicial na Vercel
- ADRs iniciais registrados: D-05 (Vercel), D-06 (TypeScript)

---

## M1 — Núcleo de leitura pública

**Goal:** o público consegue encontrar e ler resenhas — site público navegável com resenhas reais via seed.
**Dependências:** M0. **Decisões:** D-04 (busca) a resolver em `review-listing-search`.

### Features

**`book-data`** — PLANNED — ficha técnica do livro
**`review-page`** — PLANNED — página de resenha (SSR/SSG, semântica, comentários aprovados)
**`review-listing-search`** — PLANNED — listagem, filtros, busca por título, ordenação (D-04)
**`seo-core`** — PLANNED — meta tags, Open Graph, schema.org Book/Review, sitemap
**`storage-covers`** — PLANNED — upload e exibição de capas (políticas de acesso)

> Conteúdo de *seed* faz a ponte para validar as telas antes do painel (M2) existir.

---

## M2 — Painel administrativo

**Goal:** editores e admin gerenciam conteúdo sem tocar no banco — ciclo editorial completo, do rascunho à publicação.
**Dependências:** M0, M1 (modelo de conteúdo). **Decisões:** D-01 (escala da nota) a resolver em `reviews-crud`.

### Features

**`security-foundation`** — EXECUTE (1ª do M2, T1–T18 commitadas em `feat/security-foundation`; T19 + revisão final pendentes; sem push) — fundação de segurança **antes** de qualquer painel/CRUD. Inclui **a autenticação de editores** (a antiga `admin-auth-editors` foi **fundida** aqui — C-5): separação de clients Supabase (público anon sem fallback · autenticado JWT · admin `service_role` server-only), remoção do fallback `??` (fecha TD-04), **auth de editor via Supabase Auth (magic link) + RBAC (papéis `admin`/`editor`)**, GRANTs/policies das tabelas do M2 (reduz TD-03), teste de regressão de RLS. Escrita padrão = autenticado+RLS; `service_role` só exceção documentada. Gate: nenhuma `service_role` em Production até uma exceção real existir (nunca antes do merge).
**`reviews-crud`** — PLANNED — formulário completo de cadastro/edição (D-01), sobre a fundação
**`admin-reviews`** — PLANNED — painel: listar, criar, editar, publicar, despublicar, excluir (UI)
**Políticas de Storage por papel de editor** — PLANNED

> *`admin-auth-editors` (login/papéis/RBAC) foi absorvida por `security-foundation` (C-5) — não é mais uma feature separada.*

---

## M3 — Interação do público

**Goal:** o público participa, com moderação — comentários moderados e recomendações funcionando.
**Dependências:** M1 (página de resenha), M2 (moderação no painel). **Decisões:** D-02 (anti-spam) em `public-comments`; D-03 (modelo de indicação) em `recommendations`.

### Features

**`public-comments`** — PLANNED — comentar sem login (status `pending`), anti-spam acessível (D-02)
**`admin-comment-moderation`** — PLANNED — fila de pendentes, aprovar/rejeitar/excluir
**`recommendations`** — PLANNED — votação/indicação em resenhas (D-03)

---

## M4 — Acessibilidade e qualidade (hardening)

**Goal:** auditoria formal e fechamento de conformidade → metas da seção 3 do PRD atingidas, MVP pronto para lançamento.
**Dependências:** M1–M3.

### Features

**Auditoria WCAG 2.1 AA completa** — PLANNED — checklist versionado
**Testes manuais NVDA + VoiceOver** — PLANNED — todos os fluxos
**Revisão final de SEO + Core Web Vitals** — PLANNED — Rich Results Book/Review
**Correções de contraste, foco e mensagens de erro** — PLANNED

---

## Future Considerations (pós-MVP)

- `sections-extra` — listas, desafios, clubes do livro, enquetes
- `analytics-reports` — resenhas mais vistas, comentários por período, buscas populares
- `monitoring` — Sentry (erros) + Vercel Analytics ou Plausible (métricas)

---

## Ordem de dependências

```
M0 ─► M1 ─► M2 ─► M3 ─► M4 ─► (lançamento) ─► Fase futura
       │
       └─ seed data faz a ponte até o painel (M2) existir
```
