# PRD — Projeto LIA

> **Product Requirements Document** · Site de resenhas literárias
> Versão 1.0 · Junho 2026 · Stack: JavaScript · Node.js · React · Next.js · Supabase
> Documento em português · identificadores técnicos (features, specs, schema) em inglês

---

## 1. Resumo executivo

O **LIA** é um site público de resenhas literárias voltado para leitores em geral. Editores cadastram e publicam resenhas detalhadas de livros; o público lê, busca, comenta (sem necessidade de login) e recomenda títulos. Acessibilidade **WCAG 2.1 AA** é requisito de primeira classe — critério de "pronto" (Definition of Done) em **toda** entrega, não uma fase isolada.

Este PRD é a fonte de verdade para a fase **Specify** do fluxo TLC Spec-Driven. Cada *feature* listada na seção 6 vira uma pasta de feature em `.specs/` no Claude Code.

---

## 2. Problema e oportunidade

Leitores buscam resenhas confiáveis, legíveis e acessíveis, mas grande parte dos sites do gênero exige cadastro para interagir, ignora acessibilidade e tem busca fraca. O LIA resolve isso com:

- Conteúdo editorial curado, com ficha técnica completa do livro.
- Interação aberta (comentários e recomendações **sem login**), com moderação.
- Acessibilidade real (não cosmética) como diferencial central.
- SEO forte (schema.org Book/Review) para descoberta orgânica.

---

## 3. Objetivos e métricas de sucesso

| Objetivo | Métrica | Meta MVP |
|---|---|---|
| Acessibilidade real | Lighthouse Accessibility / axe critical issues | 100 / 0 críticos |
| Conformidade | Checklist WCAG 2.1 AA nos fluxos núcleo | 100% |
| Performance | Core Web Vitals (LCP / CLS) | < 2,5s / < 0,1 |
| Descoberta | Rich Results válidos (Book + Review) | 100% das páginas de resenha |
| Operação editorial | Publicar uma resenha do rascunho à publicação | sem fricção, fluxo único no painel |
| Moderação | Comentário só aparece após aprovação | 100% (gate obrigatório) |

> Métricas de engajamento (visitas, comentários por período, buscas populares) ficam para a fase de `analytics-reports` (fase futura).

---

## 4. Personas

- **Leitor geral (público)** — descobre, busca e lê resenhas; comenta e recomenda sem criar conta. **Inclui usuários de leitores de tela e navegação só por teclado** — tratados como caminho principal, não exceção.
- **Editor / resenhista** — autentica no painel, cria e gerencia suas resenhas e fichas de livro.
- **Admin** — gerencia editores e controle de acesso, modera a fila de comentários.

---

## 5. Escopo

### 5.1 Dentro do escopo (MVP completo + admin)
Tudo marcado como *obrigatório* no mapa de requisitos, mais o painel administrativo completo, acessibilidade WCAG 2.1 AA, SEO e infraestrutura de deploy.

### 5.2 Fora do escopo (fase futura)
- `sections-extra` — listas, desafios, clubes do livro, enquetes.
- `analytics-reports` — resenhas mais vistas, comentários por período, buscas populares.
- `monitoring` — Sentry (erros) e Vercel Analytics / Plausible (métricas).

Esses itens entram no roadmap como milestones posteriores, mas o **modelo de dados já deve ser desenhado sem bloquear** sua adoção futura.

---

## 6. Requisitos funcionais

Cada item tem um **ID** (vira pasta de feature no TLC), descrição e critérios de aceitação. Prioridade: `P0` = MVP obrigatório, `P1` = admin/MVP, `Pf` = fase futura.

### 6.1 Resenhas

#### `book-data` (P0) — Ficha técnica do livro
Dados do livro associados à resenha: ano, número de páginas, idioma original, tradução (tradutor / idioma de origem), além de título, autor, gênero, editora, ISBN e capa.
- **Aceitação:** toda resenha está vinculada a exatamente um livro; campos obrigatórios validados; ISBN aceita ISBN-10 e ISBN-13; idioma original e dados de tradução opcionais mas estruturados.

#### `reviews-crud` (P0/P1) — Cadastro de resenha
Formulário de criação/edição: título, autor, gênero, editora, ISBN, capa, nota e texto.
- **Aceitação:** editor cria, salva como rascunho e edita; upload de capa funcional; nota dentro da escala definida (ver Decisão D-01); texto suporta formatação básica; slug gerado automaticamente e único.

#### `review-listing-search` (P0) — Listagem e busca
Lista de resenhas com filtros por gênero, autor e nota; busca por título; ordenação.
- **Aceitação:** filtros combináveis; busca por título retorna resultados relevantes; ordenação por data e por nota; paginação acessível; estado vazio tratado.

#### `review-page` (P0) — Página de resenha
Exibição completa: capa, ficha técnica, texto, nota e comentários aprovados.
- **Aceitação:** renderizada via SSR/SSG; estrutura semântica (`article`, headings hierárquicos); metadados SEO e schema.org presentes; comentários aprovados visíveis, formulário de novo comentário acessível.

### 6.2 Interação do público

#### `public-comments` (P0) — Comentários abertos
Comentar **sem login**; todo comentário entra como *pendente* e só é publicado após moderação do admin.
- **Aceitação:** envio sem autenticação; campos nome + texto; comentário nasce com status `pending`; proteção anti-spam acessível (ver Decisão D-02); confirmação de envio comunicada de forma acessível; comentário nunca aparece antes da aprovação.

#### `recommendations` (P0) — Indicações
Seção "leitores recomendam" **ou** votação em resenhas existentes (ver Decisão D-03).
- **Aceitação (proposta: votação):** público vota/recomenda uma resenha sem login; contagem exibida; uma indicação por visitante (controle por rate-limit/fingerprint, não por conta); resistente a abuso básico.

### 6.3 Painel administrativo

#### `admin-auth-editors` (P1) — Usuários / editores
Cadastro e controle de acesso dos editores ao painel (auth via Supabase).
- **Aceitação:** login de editor; papéis `admin` e `editor`; RBAC aplicado via Supabase RLS; admin cria/desativa editores; rotas do painel protegidas.

#### `admin-reviews` (P1) — Gestão de resenhas
Criar, editar, publicar, despublicar e excluir resenhas.
- **Aceitação:** editor gerencia as próprias resenhas; admin gerencia todas; publicar/despublicar muda visibilidade pública; exclusão confirmada; ações refletem imediatamente no site.

#### `admin-comment-moderation` (P1) — Moderação de comentários
Aprovar, rejeitar ou excluir comentários; fila de pendentes.
- **Aceitação:** fila de `pending` visível; aprovar publica; rejeitar/excluir remove da fila; ações auditáveis; contador de pendentes no painel.

---

## 7. Requisitos não-funcionais

### 7.1 Acessibilidade — WCAG 2.1 AA (`accessibility-wcag`, transversal)
Critério de Definition of Done em **todas** as features. Auditoria formal completa no milestone de hardening.
- **HTML semântico:** landmarks, headings hierárquicos, `role` e `aria-label` corretos.
- **Teclado:** foco visível, skip links, tab order lógico em todos os fluxos.
- **Leitores de tela:** alt text, labels associados a campos, mensagens de erro acessíveis.
- **Contraste e tipografia:** contraste mínimo 4.5:1; fonte escalável; sem texto embutido em imagem.
- **Formulários acessíveis:** labels explícitos, validação acessível, alternativa de CAPTCHA não dependente de visão (ver D-02).
- **Testes:** axe + Lighthouse no CI; testes manuais com NVDA e VoiceOver; checklist WCAG 2.1 AA versionado no repositório.

### 7.2 SEO (`seo-core`, P0)
Meta tags, Open Graph, schema.org **Book** e **Review**, sitemap automático.
- **Aceitação:** cada página de resenha emite JSON-LD válido para Book + Review; OG completo (título, descrição, imagem da capa); sitemap gerado no build; URLs limpas via slug.

### 7.3 Performance
SSR/SSG via Next.js (App Router); otimização de imagens das capas; CDN global. Metas: Core Web Vitals na seção 3.

### 7.4 Segurança e privacidade
RBAC via Supabase RLS; políticas de Storage por papel de editor; sanitização de entrada nos comentários; proteção anti-spam; sem coleta de dados pessoais do público além do nome opcional do comentário (armazenar hash de IP apenas para rate-limit/moderação).

---

## 8. Arquitetura e stack

| Camada | Tecnologia | Papel |
|---|---|---|
| Linguagem | JavaScript | Base de toda a aplicação (front e back) |
| Runtime | Node.js | Server-side, API routes, build pipeline |
| UI | React | Componentes reutilizáveis e acessíveis |
| Framework | Next.js (App Router) | SSR/SSG, roteamento, SEO, performance |
| Backend | Supabase | PostgreSQL, auth de editores, Storage |
| Storage | Supabase Storage | Capas dos livros, políticas por papel |
| Hospedagem | Vercel (recomendado) | JAMstack, CDN global |
| CI/CD | GitHub Actions | Lint, testes, axe/Lighthouse, deploy |

> **Decisão recomendada (não bloqueante):** adotar TypeScript sobre a base JavaScript para tipar o modelo de dados e contratos. Respeita a stack "JavaScript" e reduz bugs. Registrar como ADR.

---

## 9. Modelo de dados (alto nível)

Entidades núcleo (campos em inglês para o schema):

- **`book`** — `id, title, author, genre_id, publisher, isbn, cover_url, year, pages, original_language, translator, translated_from, created_at`
- **`review`** — `id, book_id, title, slug, rating, body, status[draft|published], editor_id, published_at, created_at, updated_at`
- **`comment`** — `id, review_id, author_name, body, status[pending|approved|rejected], ip_hash, created_at`
- **`editor`** (auth user) — `id, email, name, role[admin|editor], active, created_at`
- **`recommendation`** — `id, review_id, voter_hash, created_at`
- **`genre`** — `id, name, slug`

Relações: `review` 1—1 `book`; `review` 1—N `comment`; `review` 1—N `recommendation`; `editor` 1—N `review`; `genre` 1—N `book`.

---

## 10. Decisões em aberto (alimentam DECISIONS.md / ADRs)

| ID | Decisão | Recomendação para o MVP |
|---|---|---|
| **D-01** | Escala da nota | 0–5 estrelas, com meia estrela; armazenar como número (0.0–5.0) |
| **D-02** | Anti-spam de comentários sem login (precisa ser acessível) | Honeypot + rate-limit por hash de IP + moderação obrigatória; evitar CAPTCHA visual; se necessário, desafio acessível |
| **D-03** | Indicações: "leitores recomendam" vs votação | Votação/recomendação em resenhas existentes no MVP (mais simples, menos moderação); "leitores recomendam" como submissão fica para fase futura |
| **D-04** | Busca | Postgres full-text / `ilike` no Supabase no MVP; busca avançada depois |
| **D-05** | Hospedagem | Vercel (suporte first-class a Next.js) |
| **D-06** | Linguagem tipada | TypeScript sobre a base JS (recomendado) |

---

## 11. Riscos

- **Acessibilidade vista como "depois"** → mitigação: a11y é Definition of Done de cada feature + gate de CI com axe/Lighthouse.
- **Spam em comentários sem login** → mitigação: moderação obrigatória + rate-limit + honeypot.
- **Abuso em votação anônima** → mitigação: fingerprint/rate-limit; aceitar imprecisão moderada no MVP.
- **SEO de SPA** → mitigação: SSR/SSG no Next.js desde o início.

---

## 12. Mapa para o TLC Spec-Driven

- Este PRD alimenta **PROJECT.md** (visão, objetivos, escopo) e **DISCOVERY.md**.
- A seção 10 vira entradas em **DECISIONS.md** (ADRs).
- Cada feature da seção 6/7 vira uma pasta `.specs/features/<id>/` com `discovery → spec → design → tasks → stories`.
- O roadmap detalhado está em **ROADMAP.md**.
