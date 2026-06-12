# book-data — Especificação

> Milestone **M1 — Núcleo de leitura pública**. Primeira feature de produto.
> Fonte de verdade: [PRD](../../../docs/PRD-LIA.md) (seção 6.1 `book-data`, seção 9 modelo de dados) e o schema do M0 ([0001_core_schema.sql](../../../supabase/migrations/0001_core_schema.sql), tabela `book`).
> Documentação em português; nomes de feature, schema, identificadores e código em inglês.

## Problem Statement

A entidade `book` já existe no banco (criada no M0), mas hoje é apenas uma tabela permissiva: `genre_id` é nullable, não há validação de ISBN, os campos de tradução não têm contrato definido e nada exibe a ficha técnica na aplicação. Sem endurecer e estruturar esse modelo, as resenhas (que dependem 1—1 de um livro) seriam construídas sobre dados inconsistentes, e a ficha — base factual de toda resenha — não teria como ser apresentada de forma acessível. Esta feature transforma a tabela `book` em uma ficha técnica validada, semanticamente exibível e populada por seed, pronta para as features de resenha consumirem.

## Goals

- [ ] Definir o contrato da ficha do livro: todos os campos do PRD (seção 9), com obrigatórios e opcionais explícitos.
- [ ] Endurecer o schema do M0 onde ficou permissivo: `genre_id` passa a **NOT NULL** (gênero obrigatório na aplicação).
- [ ] Validar ISBN aceitando **ISBN-10 e ISBN-13** (dígito verificador), opcional mas correto quando presente; armazenado normalizado e exibido formatado.
- [ ] Estruturar os dados de tradução (tradutor, idioma de origem, idioma original) como opcionais porém consistentes.
- [ ] Garantir e documentar a relação **`book` 1—1 `review`**.
- [ ] Entregar um componente de **exibição acessível** da ficha (marcação semântica), demonstrável no styleguide de auditoria do M0.
- [ ] Popular o banco com **seed de domínio público** (Machado de Assis, Eça de Queirós, José de Alencar, Aluísio Azevedo) para validar telas antes do painel (M2).
- [ ] Abrir **leitura pública** de `book` via RLS (apenas `SELECT`), mantendo escrita fechada — a ficha precisa ser legível pelo público anônimo.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Formulário de cadastro/edição da ficha (admin) | M2 (`reviews-crud`) — aqui só modelo, validação e exibição |
| Página de resenha que consome a ficha | M1 (`review-page`) — esta feature entrega o componente; a página o monta |
| Upload e exibição de capa (imagem) | M1 (`storage-covers`) — `cover_url` permanece como referência textual; sem pipeline de imagem aqui |
| Seed de **resenhas** | Semeadas nas features de resenha (`review-page`/`review-listing-search`); aqui só `book` + `genre` |
| Busca/listagem/filtros por livro | M1 (`review-listing-search`, D-04) |
| schema.org `Book` (JSON-LD) | M1 (`seo-core`) — aqui só a exibição HTML semântica |
| RLS de **escrita** em `book` (insert/update/delete) | M2 (`admin-auth-editors`/`reviews-crud`) — escrita continua fechada (deny-by-default do M0); aqui só leitura pública |

---

## User Stories

### P1: Contrato da ficha — campos obrigatórios e opcionais ⭐ MVP

**User Story**: Como desenvolvedor das features de resenha, quero a ficha do livro com campos obrigatórios e opcionais bem definidos, para construir resenhas sobre dados consistentes.

**Why P1**: Toda resenha vincula-se 1—1 a um livro; o contrato de campos é o alicerce factual de M1–M3.

**Acceptance Criteria**:

1. QUANDO a ficha é modelada ENTÃO o sistema DEVE contemplar todos os campos do PRD (seção 9): `title`, `author`, `genre_id`, `publisher`, `isbn`, `cover_url`, `year`, `pages`, `original_language`, `translator`, `translated_from`.
2. QUANDO uma ficha é validada ENTÃO `title`, `author` e `genre` (via `genre_id`) DEVEM ser **obrigatórios**; `publisher`, `isbn`, `cover_url`, `year`, `pages`, `original_language`, `translator`, `translated_from` DEVEM ser **opcionais**.
3. QUANDO `year` é informado ENTÃO DEVE ser um ano plausível (inteiro, não futuro além do ano corrente, não negativo).
4. QUANDO `pages` é informado ENTÃO DEVE ser inteiro positivo (> 0).
5. QUANDO um campo opcional é omitido ENTÃO o sistema DEVE aceitá-lo como ausente (não exigir string vazia nem placeholder).

**Independent Test**: validar uma ficha mínima (só `title`, `author`, `genre`) → aceita; remover o gênero → rejeitada; informar `pages = 0` ou `year` futuro → rejeitada com mensagem clara.

---

### P1: Endurecer `genre_id` para obrigatório (NOT NULL) ⭐ MVP

**User Story**: Como mantenedor do modelo de dados, quero `genre` obrigatório no banco, para que nenhuma ficha exista sem classificação (necessária para filtros e navegação de M1).

**Why P1**: No M0 `book.genre_id` ficou `nullable` (decisão de não bloquear o schema base). O PRD trata gênero como dado essencial da ficha; é o ponto a endurecer aqui.

**Acceptance Criteria**:

1. QUANDO a migration desta feature é aplicada ENTÃO `book.genre_id` DEVE passar a **NOT NULL** (mantendo `references genre(id) on delete restrict`).
2. QUANDO a migration roda em um banco com `book` vazio (estado pós-M0) ENTÃO DEVE concluir sem erro; o seed (BOOK-12/13) garante gêneros antes ou junto da inserção de livros.
3. QUANDO a migration é reaplicada ENTÃO DEVE ser idempotente/segura (guardas de existência, como no padrão do M0).
4. QUANDO uma inserção de `book` sem `genre_id` é tentada ENTÃO o banco DEVE rejeitá-la.

**Independent Test**: aplicar a migration; inspecionar o schema (`genre_id NOT NULL`); tentar inserir `book` sem gênero → rejeitado pela constraint.

---

### P1: Validação de ISBN (ISBN-10 e ISBN-13) ⭐ MVP

**User Story**: Como mantenedor da ficha, quero que o ISBN, quando informado, seja sempre válido, para que o identificador do livro seja confiável e exibível de forma consistente.

**Why P1**: O PRD exige explicitamente aceitar ISBN-10 e ISBN-13 com validação; ISBN inválido contamina SEO (`seo-core`) e a confiança da ficha.

**Decisão de produto (capturada no Specify)**: ISBN é **opcional** — vários clássicos de domínio público (alvo do seed) precedem o ISBN (criado em 1970). Quando presente, é validado por dígito verificador, armazenado normalizado e exibido formatado.

**Acceptance Criteria**:

1. QUANDO um ISBN é informado ENTÃO o sistema DEVE aceitá-lo como **ISBN-13** (13 dígitos, validação do dígito verificador mód-10) ou **ISBN-10** (10 caracteres, último podendo ser `X`, validação mód-11).
2. QUANDO um ISBN chega com hífens ou espaços ENTÃO o sistema DEVE **normalizar** para apenas os dígitos (com `X` final preservado no caso ISBN-10) antes de validar e armazenar.
3. QUANDO o dígito verificador não confere ou o comprimento é inválido ENTÃO o sistema DEVE **rejeitar** com mensagem de erro acessível (texto, não só cor).
4. QUANDO o campo ISBN é omitido (vazio) ENTÃO o sistema DEVE aceitá-lo (opcional) e não disparar erro.
5. QUANDO um ISBN válido é exibido na ficha ENTÃO DEVE ser apresentado **formatado** (hifenizado de forma legível), preservando o valor normalizado no armazenamento.

**Independent Test**: validar `978-85-359-0277-5` (ISBN-13 válido) → aceito e normalizado para `9788535902775`; `85-359-0277-0` (ISBN-10) → aceito; alterar um dígito → rejeitado; campo vazio → aceito; exibição mostra a forma hifenizada.

---

### P1: Dados de tradução estruturados e opcionais ⭐ MVP

**User Story**: Como leitor, quero saber quando um livro é tradução — quem traduziu e de qual idioma — para entender a procedência da edição; e quero que isso não apareça quando não se aplica.

**Why P1**: O PRD pede dados de tradução "opcionais mas **estruturados**"; sem contrato, vira texto livre inconsistente. É um diferencial editorial da LIA.

**Acceptance Criteria**:

1. QUANDO um livro é traduzido ENTÃO o sistema DEVE registrar de forma estruturada `translator` (tradutor) e `translated_from` (idioma de origem); `original_language` registra o idioma original da obra.
2. QUANDO os dados de tradução são fornecidos ENTÃO DEVEM ser **consistentes**: informar `translator` implica informar `translated_from` (não se registra tradutor sem idioma de origem).
3. QUANDO o livro é um original (não traduzido) ENTÃO `translator` e `translated_from` DEVEM poder ficar **ausentes**, e a ficha NÃO DEVE exibir bloco de tradução.
4. QUANDO `original_language` ou `translated_from` são exibidos ENTÃO o idioma DEVE ser apresentado em forma legível ao leitor (rótulo em português).

**Independent Test**: cadastrar uma obra traduzida (tradutor + idioma de origem) → ficha mostra bloco de tradução; cadastrar um clássico do seed (original em português) → sem bloco de tradução; informar tradutor sem idioma de origem → rejeitado.

---

### P1: Relação `book` 1—1 `review` garantida ⭐ MVP

**User Story**: Como mantenedor do modelo, quero a regra "uma ficha tem no máximo uma resenha" garantida e documentada, para que a página de resenha possa assumir essa cardinalidade com segurança.

**Why P1**: O PRD afirma "toda resenha está vinculada a exatamente um livro". A página de resenha (M1) e o SEO dependem dessa unicidade.

**Acceptance Criteria**:

1. QUANDO o schema é inspecionado ENTÃO a relação `book` 1—1 `review` DEVE estar garantida pela FK **única** `review.book_id` (já criada no M0) — esta feature a **documenta e cobre por teste**, sem recriá-la.
2. QUANDO uma segunda `review` para o mesmo `book` é tentada ENTÃO o banco DEVE rejeitá-la pela constraint `unique`.
3. QUANDO uma ficha ainda não tem resenha ENTÃO o modelo DEVE permitir o livro existir sem `review` (o seed cria fichas antes das resenhas — relação 1—**0..1** do lado do livro).

**Independent Test**: inserir uma `review` para um `book`; tentar inserir uma segunda para o mesmo `book` → rejeitada; confirmar que um `book` sem `review` é válido.

---

### P1: Exibição acessível da ficha técnica ⭐ MVP

**User Story**: Como leitor (inclusive usuário de leitor de tela), quero a ficha técnica do livro apresentada com marcação semântica, para entender os dados do livro de forma clara e navegável.

**Why P1**: É a parte "exibida na aplicação" da feature e a Definition of Done de acessibilidade (WCAG 2.1 AA). A página de resenha (M1) vai consumir este componente.

**Acceptance Criteria**:

1. QUANDO a ficha é renderizada ENTÃO o sistema DEVE usar marcação semântica de pares rótulo/valor (lista de descrição `dl`/`dt`/`dd` ou equivalente semântico), consumindo apenas os design tokens do M0.
2. QUANDO um campo opcional está ausente ENTÃO a ficha NÃO DEVE renderizar rótulo órfão nem valor vazio — o par é **omitido**.
3. QUANDO a ficha contém dados de tradução ENTÃO DEVEM ser apresentados como um agrupamento identificável (ex.: subgrupo "Tradução") com hierarquia/headings coerente.
4. QUANDO a ficha é renderizada via SSR ENTÃO DEVE produzir conteúdo e estrutura mesmo sem JavaScript (componente sem dependência de hidratação para o conteúdo factual).
5. QUANDO a ficha é navegada por teclado e leitor de tela ENTÃO a ordem de leitura DEVE ser lógica e os rótulos DEVEM ser associados aos valores.
6. QUANDO a ficha é auditada ENTÃO DEVE passar **axe sem issues críticos** e atender contraste AA (≥ 4.5:1), conforme o gate de CI do M0.
7. QUANDO o componente é demonstrado ENTÃO DEVE aparecer no **styleguide de auditoria** do M0 (rota protegida `noindex`/`force-dynamic`) com casos: ficha completa, ficha mínima (só obrigatórios) e ficha com tradução.

**Independent Test**: renderizar o componente no styleguide com os 3 casos; navegar por teclado e leitor de tela; rodar axe (0 críticos); confirmar que campos ausentes não geram `dt` órfão.

---

### P1: Seed de gêneros e livros de domínio público ⭐ MVP

**User Story**: Como time, quero o banco populado com clássicos de domínio público, para validar as telas públicas de M1 antes do painel administrativo (M2) existir.

**Why P1**: Sem seed, não há como exercitar ficha, resenha, listagem e SEO antes do admin. O seed é a ponte explícita do roadmap até M2.

**Acceptance Criteria**:

1. QUANDO o seed é executado ENTÃO o sistema DEVE inserir os **gêneros** necessários (com `name` e `slug` únicos) antes dos livros que os referenciam.
2. QUANDO o seed é executado ENTÃO o sistema DEVE inserir fichas dos quatro autores: **Machado de Assis, Eça de Queirós, José de Alencar e Aluísio Azevedo**, cada uma com `title`, `author` e `genre` obrigatórios preenchidos.
3. QUANDO uma ficha do seed tem ISBN ENTÃO o ISBN DEVE ser **válido** (passa pela validação de BOOK-04); fichas de edições sem ISBN ficam com o campo ausente.
4. QUANDO o seed é reexecutado ENTÃO DEVE ser **idempotente** (sem duplicar livros/gêneros — upsert por chave estável, ex.: `slug` do gênero e identidade do livro).
5. QUANDO o seed termina ENTÃO os dados DEVEM ser suficientes para popular a exibição da ficha (e servir de base às resenhas semeadas nas features seguintes).

**Independent Test**: rodar o seed em banco limpo → 4+ livros e seus gêneros presentes, todos com gênero obrigatório; rodar de novo → sem duplicatas; inspecionar um livro com ISBN → válido.

---

### P1: Leitura pública de `book` via RLS (somente SELECT) ⭐ MVP

**User Story**: Como visitante anônimo, quero que a ficha do livro seja legível no site público, para ler os dados do livro sem precisar de login — mantendo a escrita restrita ao admin.

**Why P1**: O M0 deixou `book` com RLS **deny-by-default**; sem uma policy de leitura, o público (cliente `anon` do Supabase) não consegue carregar a ficha, e a story de exibição (BOOK-12) não tem dados para renderizar em produção. A escrita permanece fechada até o M2.

**Acceptance Criteria**:

1. QUANDO a migration desta feature é aplicada ENTÃO o sistema DEVE criar uma policy de RLS em `book` que permita **`SELECT`** ao papel anônimo/público (`anon`, e por extensão `authenticated`).
2. QUANDO um cliente anônimo consulta `book` ENTÃO DEVE conseguir **ler** as fichas (todas as linhas, já que `book` não tem rascunho — a visibilidade editorial é controlada em `review.status`).
3. QUANDO um cliente anônimo tenta `INSERT`, `UPDATE` ou `DELETE` em `book` ENTÃO o banco DEVE **rejeitar** (sem policy de escrita; permanece deny-by-default até M2).
4. QUANDO a migration é reaplicada ENTÃO DEVE ser idempotente/segura (guarda de existência da policy, padrão do M0).
5. QUANDO o RLS de `book` é verificado ENTÃO o Row Level Security DEVE continuar **habilitado** (a feature adiciona a policy de leitura, não desliga o RLS).

**Independent Test**: com o cliente `anon` do Supabase, `select` em `book` retorna as fichas do seed; `insert`/`update`/`delete` falham por ausência de policy; RLS continua `enabled`.

> Nota de escopo: a leitura pública aqui cobre **apenas `book`**. A visibilidade de `review` (`status='published'`) e demais tabelas é tratada nas features de resenha (handoff M1 da STATE permanece para `review`).

---

## Edge Cases

- QUANDO o ISBN-10 termina em `X` (dígito verificador 10) ENTÃO a validação mód-11 DEVE aceitá-lo.
- QUANDO o ISBN tem comprimento 10 ou 13 mas o dígito verificador não confere ENTÃO DEVE ser rejeitado (não basta o comprimento).
- QUANDO o ISBN vem com prefixo "ISBN", hífens e espaços misturados ENTÃO a normalização DEVE extrair somente os dígitos válidos (+`X` final) antes de validar.
- QUANDO `genre_id` aponta para um gênero inexistente ENTÃO a FK DEVE rejeitar a inserção.
- QUANDO se tenta excluir um `genre` ainda referenciado por algum `book` ENTÃO o `on delete restrict` DEVE impedir a exclusão.
- QUANDO `translator` é informado sem `translated_from` ENTÃO a validação de consistência DEVE rejeitar.
- QUANDO `year` é maior que o ano corrente (2026) ou `pages` ≤ 0 ENTÃO a validação DEVE rejeitar com mensagem acessível.
- QUANDO uma ficha tem todos os opcionais vazios ENTÃO a exibição DEVE mostrar apenas título, autor e gênero, sem rótulos órfãos.
- QUANDO o JavaScript está desabilitado ENTÃO a ficha (SSR) DEVE renderizar todo o conteúdo factual e a estrutura semântica.
- QUANDO um cliente anônimo tenta escrever em `book` (insert/update/delete) ENTÃO o RLS DEVE rejeitar — só `SELECT` é liberado nesta feature.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BOOK-01 | Contrato de campos da ficha (todos os campos do PRD) | Design | Pending |
| BOOK-02 | Obrigatórios (title, author, genre) vs opcionais | Design | Pending |
| BOOK-03 | Validação de range: `year` plausível, `pages` > 0 | Design | Pending |
| BOOK-04 | Endurecer `book.genre_id` → NOT NULL (migration idempotente) | Design | Pending |
| BOOK-05 | Validação de ISBN-13 (mód-10) e ISBN-10 (mód-11, `X`) | Design | Pending |
| BOOK-06 | Normalização do ISBN no armazenamento (só dígitos +`X`) | Design | Pending |
| BOOK-07 | ISBN opcional (aceita ausência) | Design | Pending |
| BOOK-08 | Exibição formatada (hifenizada) do ISBN | Design | Pending |
| BOOK-09 | Tradução estruturada e opcional (translator/translated_from/original_language) | Design | Pending |
| BOOK-10 | Consistência de tradução (translator ⇒ translated_from) | Design | Pending |
| BOOK-11 | Relação `book` 1—1 `review` documentada e coberta por teste | Design | Pending |
| BOOK-12 | Componente de exibição acessível (dl/dt/dd, omissão de opcionais, SSR) | Design | Pending |
| BOOK-13 | Agrupamento semântico do bloco de tradução | Design | Pending |
| BOOK-14 | Demonstração no styleguide (3 casos) + axe 0 críticos + contraste AA | Design | Pending |
| BOOK-15 | Seed de gêneros (slug único, antes dos livros) | Design | Pending |
| BOOK-16 | Seed dos 4 autores de domínio público (idempotente, gênero obrigatório) | Design | Pending |
| BOOK-17 | RLS: policy de leitura pública (`SELECT`) em `book`; escrita fechada; RLS permanece habilitado | Design | Pending |

**Coverage:** 17 requisitos · 0 mapeados para tasks (Tasks pendente) ⚠️

---

## Success Criteria

- [ ] `book.genre_id` é NOT NULL no banco; inserir livro sem gênero é rejeitado; migration idempotente.
- [ ] ISBN-10 e ISBN-13 validados por dígito verificador; entrada hifenizada normalizada; inválido rejeitado com erro acessível; vazio aceito.
- [ ] Dados de tradução opcionais e consistentes; original sem bloco de tradução; tradutor sem idioma de origem rejeitado.
- [ ] Segunda resenha para o mesmo livro é rejeitada; livro sem resenha é válido (1—0..1).
- [ ] Componente de ficha com marcação semântica, omitindo opcionais ausentes, renderizado via SSR, passando axe (0 críticos) e contraste AA; demonstrado no styleguide com 3 casos.
- [ ] Seed idempotente popula gêneros + fichas de Machado, Eça, Alencar e Aluísio Azevedo, com gênero obrigatório preenchido.
- [ ] Cliente anônimo lê `book` (SELECT) mas não escreve; RLS permanece habilitado.

---

## Notas para o Design (não decididas aqui)

- **Camada de validação**: onde mora a validação de ISBN/range/consistência (ex.: schema de validação tipado reutilizável vs. checks no banco vs. ambos) — definir na fase Design.
- **Representação de idioma**: `original_language`/`translated_from` como nome legível vs. código ISO 639-1 — escolher na Design (impacta exibição e futura i18n).
- **CHECK constraints vs. validação de app**: decidir quais regras (range de `year`/`pages`, consistência de tradução, formato de ISBN) viram `CHECK` no Postgres e quais ficam na aplicação.
- **Identidade estável do seed** para idempotência (slug derivado de título+autor?) — detalhar na Design.
