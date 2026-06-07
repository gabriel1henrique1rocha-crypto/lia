# ROADMAP — Projeto LIA

> Execução faseada para o fluxo TLC Spec-Driven · cada milestone agrupa features que viram pastas em `.specs/features/`.
> **Regra transversal:** acessibilidade WCAG 2.1 AA é Definition of Done de **toda** feature, em **todo** milestone. O milestone M4 é só a auditoria formal final.

---

## Definition of Done (vale para toda feature)

- [ ] Funcionalidade atende aos critérios de aceitação do PRD
- [ ] HTML semântico + navegação por teclado + leitor de tela OK
- [ ] Contraste 4.5:1 e tipografia escalável
- [ ] axe/Lighthouse sem erros críticos no CI
- [ ] Testes da feature passando
- [ ] Commit atômico com rastreabilidade ao requisito

---

## M0 — Fundação (`infra-foundation`)
**Meta:** repositório pronto para desenvolver com qualidade desde o primeiro commit.

- Projeto Next.js (App Router) + React
- Projeto Supabase (PostgreSQL + Auth + Storage) e variáveis de ambiente
- Schema base e migrations das entidades núcleo (`book`, `review`, `comment`, `editor`, `recommendation`, `genre`)
- Design tokens base + estilos de foco visível + tipografia escalável
- CI/CD via GitHub Actions: lint, testes, **axe/Lighthouse**
- Deploy inicial na Vercel
- ADRs iniciais: D-05 (hospedagem), D-06 (TypeScript)

**Dependências:** nenhuma. **Saída:** pipeline verde + página placeholder acessível no ar.

---

## M1 — Núcleo de leitura pública
**Meta:** o público consegue **encontrar e ler** resenhas.

- `book-data` — ficha técnica do livro
- `review-page` — página de resenha (SSR/SSG, semântica, comentários aprovados)
- `review-listing-search` — listagem, filtros, busca por título, ordenação
- `seo-core` — meta tags, Open Graph, schema.org Book/Review, sitemap
- `storage-covers` — upload e exibição de capas (políticas de acesso)
- Conteúdo de *seed* para validar as telas antes do painel existir

**Dependências:** M0. **Decisões:** D-04 (busca). **Saída:** site público navegável com resenhas reais via seed.

---

## M2 — Painel administrativo
**Meta:** editores e admin gerenciam conteúdo sem tocar no banco.

- `admin-auth-editors` — login, papéis `admin`/`editor`, RBAC via Supabase RLS
- `reviews-crud` — formulário completo de cadastro/edição
- `admin-reviews` — criar, editar, publicar, despublicar, excluir
- Políticas de Storage por papel de editor

**Dependências:** M0, M1 (modelo de conteúdo). **Saída:** ciclo editorial completo, do rascunho à publicação.

---

## M3 — Interação do público
**Meta:** o público participa, com moderação.

- `public-comments` — comentar sem login (status `pending`), anti-spam acessível
- `admin-comment-moderation` — fila de pendentes, aprovar/rejeitar/excluir
- `recommendations` — votação/indicação em resenhas

**Dependências:** M1 (página de resenha), M2 (moderação no painel). **Decisões:** D-02 (anti-spam), D-03 (modelo de indicação). **Saída:** comentários moderados e recomendações funcionando.

---

## M4 — Acessibilidade e qualidade (hardening)
**Meta:** auditoria formal e fechamento de conformidade.

- Auditoria WCAG 2.1 AA completa com checklist versionado
- Testes manuais com NVDA e VoiceOver em todos os fluxos
- Revisão final de SEO (Rich Results Book/Review) e Core Web Vitals
- Correções de contraste, foco, mensagens de erro

**Dependências:** M1–M3. **Saída:** metas da seção 3 do PRD atingidas → MVP pronto para lançamento.

---

## Fase futura (pós-MVP)

- `sections-extra` — listas, desafios, clubes do livro, enquetes
- `analytics-reports` — resenhas mais vistas, comentários por período, buscas populares
- `monitoring` — Sentry (erros) + Vercel Analytics ou Plausible (métricas)

---

## Ordem de dependências (resumo)

```
M0 ─► M1 ─► M2 ─► M3 ─► M4 ─► (lançamento) ─► Fase futura
       │
       └─ seed data faz a ponte até o painel (M2) existir
```
