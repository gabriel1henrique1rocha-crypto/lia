# LIA

**Visão:** Site público de resenhas literárias onde editores publicam resenhas curadas e o público lê, busca, comenta e recomenda — **sem login** — com acessibilidade WCAG 2.1 AA como requisito de primeira classe.
**Para:** leitores em geral (incluindo usuários de leitor de tela e navegação só por teclado, tratados como caminho principal), editores/resenhistas e administradores.
**Resolve:** sites de resenhas exigem cadastro para interagir, ignoram acessibilidade e têm busca fraca. O LIA entrega conteúdo editorial curado, interação aberta com moderação, acessibilidade real e SEO forte para descoberta orgânica.

> Documentação em português; nomes de feature, schema, identificadores e código em inglês.

## Goals

- **Acessibilidade real:** Lighthouse Accessibility 100 / 0 issues críticos no axe; 100% do checklist WCAG 2.1 AA nos fluxos núcleo.
- **Performance:** Core Web Vitals — LCP < 2,5s e CLS < 0,1.
- **Descoberta:** Rich Results válidos (schema.org Book + Review) em 100% das páginas de resenha.
- **Operação editorial:** publicar uma resenha do rascunho à publicação sem fricção, em fluxo único no painel.
- **Moderação:** comentário só aparece após aprovação (gate obrigatório, 100%).

## Tech Stack

**Core:**

- Framework: Next.js (App Router)
- Linguagem: TypeScript sobre base JavaScript / Node.js (ver [DECISIONS.md](DECISIONS.md) D-06)
- UI: React
- Backend/DB: Supabase (PostgreSQL + Auth + Storage)

**Dependências-chave:** Supabase Storage (capas), schema.org JSON-LD (Book/Review), axe + Lighthouse (gate de a11y), Supabase RLS (RBAC).

**Infra:**

- Hospedagem: Vercel (ver [DECISIONS.md](DECISIONS.md) D-05)
- CI/CD: GitHub Actions (lint, testes, axe/Lighthouse, deploy)

## Scope

**v1 inclui (MVP completo + admin):**

- Resenhas: ficha técnica do livro (`book-data`), página de resenha SSR/SSG (`review-page`), listagem/busca/filtros (`review-listing-search`), CRUD de resenha (`reviews-crud`).
- Interação pública sem login: comentários moderados (`public-comments`) e recomendações/votação (`recommendations`).
- Painel administrativo: auth e papéis de editor (`admin-auth-editors`), gestão de resenhas (`admin-reviews`), moderação de comentários (`admin-comment-moderation`).
- Transversais: acessibilidade WCAG 2.1 AA (`accessibility-wcag`), SEO (`seo-core`), Storage de capas (`storage-covers`), fundação de infra/CI/deploy (`infra-foundation`).

**Explicitamente fora de escopo (fase futura):**

- `sections-extra` — listas, desafios, clubes do livro, enquetes.
- `analytics-reports` — resenhas mais vistas, comentários por período, buscas populares.
- `monitoring` — Sentry (erros) + Vercel Analytics / Plausible (métricas).

> O modelo de dados deve ser desenhado sem bloquear a adoção futura desses itens.

## Constraints

- **Acessibilidade:** WCAG 2.1 AA é Definition of Done de **toda** feature — não uma fase isolada. Gate de CI com axe/Lighthouse.
- **Privacidade:** sem coleta de dados pessoais do público além do nome opcional no comentário; armazenar apenas hash de IP para rate-limit/moderação.
- **Segurança:** RBAC via Supabase RLS; políticas de Storage por papel de editor; sanitização de entrada nos comentários.
- **SEO:** SSR/SSG desde o início para evitar o problema de SEO de SPA.
