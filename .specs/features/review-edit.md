# REV-19 — `review-edit`

**Status:** SPECIFY — P-1, P-2 e P-3 aprovados em 2026-08-31.
**Marco:** unidade independente, anterior a M4. Não desbloqueia nem depende de D-12.
**Ramo:** `feat/review-edit` (single-track — nenhum outro ramo aberto).

---

## ALOCAÇÃO DE MODELO (Claude Code) — LER ANTES DE EXECUTAR

| Task | Modelo | Motivo |
|---|---|---|
| T1 | **Opus** | Migration 0012: DROP/CREATE de RPC, RLS, concorrência |
| T2 | **Sonnet** | Extração mecânica de componente, sem mudança de comportamento |
| T3 | **Opus** | Query sob RLS + semântica de `notFound()` |
| T4 | **Opus** | Server action: publish gate, validação, tradução de erros |
| T5 | **Sonnet** | Rota e link — scaffolding |
| T6 | **Opus** | Suíte RLS com oráculo superusuário |
| T7 | **Opus** | Atomicidade, preservação de tags, conflito otimista |
| T8 | **Opus** | Roteiro de leitor de tela |

Se um prompt cobrir mais de uma task, indicar o modelo por task.

---

## 1. Problema

Não existe rota de edição. Qualquer correção de dado em resenha já criada exige SQL
direto em produção. Isso não é só inconveniência: é a fonte estrutural de mutações
sem rastro. O rascunho `marquez-gabriel-garcia-cem-anos-de-solidao-rio-de-janeiro-record-2012`
existia em produção sem registro em nenhum documento do projeto até ser descoberto por
consulta ao banco em 2026-08-31.

O `update_review_with_book` já existe (migration 0011), completo e documentado, mas
nunca foi exercido — a própria migration declara: *"CRIADA E PROVISIONADA, MAS NÃO
EXERCIDA nesta milestone"*.

## 2. Escopo

**Dentro:** rota autenticada de edição de resenha existente (campos da resenha + ficha
técnica do livro), transição de status pelo publish gate existente, link de entrada em
`/admin/resenhas`.

**Fora:** exclusão de resenha (semântica própria — URL pública indexada, `ON DELETE
CASCADE` no book); taxonomia controlada (bloqueada por D-12); upload/troca de capa;
histórico de versões.

---

## 3. Estado verificado do schema (2026-08-31, produção)

Tudo abaixo foi confirmado por consulta direta ao banco linkado, não por leitura de
arquivo.

### 3.1 Tabela `review`

| Coluna | Tipo | Nulo |
|---|---|---|
| `id` | uuid | NO |
| `book_id` | uuid | NO |
| `title` | text | NO |
| `slug` | text | NO |
| `body` | text | YES |
| `status` | enum `review_status` | NO |
| `editor_id` | uuid | YES |
| `published_at` | timestamptz | YES |
| `created_at` | timestamptz | NO |
| `updated_at` | timestamptz | NO |
| `reviewer_name` | text | YES |
| `tags` | text[] | **NO** |
| `keywords` | text[] | **NO** |
| `highlight_quote` | text | YES |
| `further_reading` | jsonb | **NO** |

### 3.2 Constraints

```
review_pkey                    PRIMARY KEY (id)
review_slug_key                UNIQUE (slug)
review_book_id_key             UNIQUE (book_id)
review_book_id_fkey            FK (book_id) → book(id) ON DELETE CASCADE
review_editor_id_fkey          FK (editor_id) → editor(id) ON DELETE SET NULL
review_further_reading_is_array CHECK (jsonb_typeof(further_reading) = 'array')
```

`UNIQUE (book_id)` **confirma o 1:1 no nível do schema**, não só como intenção de
produto. Editar a ficha técnica de um livro não tem efeito colateral em outra resenha.

`ON DELETE SET NULL` em `editor_id` explica a nulidade da coluna: resenha de editor
removido continua viva, sem dono.

### 3.3 Tabelas existentes

`book`, `comment`, `editor`, `genre`, `recommendation`, `review`.

**Não existe nenhuma join table de taxonomia.** D-12 não está implementado em lugar
nenhum. As tags de hoje são `text[]` livre, sem vocabulário e sem integridade
referencial.

### 3.4 `update_review_with_book` (0011) — comportamento confirmado

- `security invoker`, `search_path = ''` — verificados em produção via `prosecdef` e
  `proconfig`, não apenas no arquivo de migration.
- **Não toca em `slug`** (REV-23: slug estável no edit — decisão, não omissão).
- **Não toca em `reviewer_name`** (DD-6: congelado).
- **Não toca em `editor_id`** (posse não se transfere por edição).
- `published_at` com `coalesce` nos dois ramos: nunca volta a `null` depois da
  primeira publicação.
- 0 linhas afetadas → `raise exception ... errcode '42501'`, o mesmo código para "não
  existe" e "não é seu", deliberadamente, para não vazar existência de rascunho alheio.
- 16 parâmetros; **nenhum de versão/concorrência**.

### 3.5 Dados em produção

| slug | status | criada em | tags |
|---|---|---|---|
| `dom-casmurro` | published | 2026-07-05 15:26:05.316319 | 0 |
| `o-crime-do-padre-amaro` | published | 2026-07-05 15:26:05.316319 | 0 |
| `iracema` | published | 2026-07-05 15:26:05.316319 | 0 |
| `o-cortico` | published | 2026-07-05 15:26:05.316319 | 0 |
| `memorias-postumas-rascunho` | draft | 2026-07-05 15:26:05.316319 | 0 |
| `o-projeto-rosie` | published | 2026-08-26 18:18:44 | 15 |
| `marquez-...-record-2012` | draft | 2026-08-26 21:35:46 | 6 |

Timestamp idêntico ao microssegundo nas cinco primeiras + `reviewer_name` nulo =
inserção de seed. **Quatro resenhas de seed estão publicadas no ar.**

---

## 4. Decisões de design

### DR-1 — Rota por `id`, não por `slug`
`/admin/resenhas/[id]/editar`. UUID é estável; o slug é público e (sob P-2) mutável em
rascunho. Rota administrativa não se acopla a identificador que a própria tela altera.

### DR-2 — Formulário único em dois modos
Extrair `ReviewForm` recebendo `mode: 'create' | 'edit'`, `defaultValues` e a server
action como prop. **Não duplicar.** O formulário do M3 passou pelo gate axe/Lighthouse;
uma cópia significa que a próxima correção de acessibilidade será aplicada em um lugar
só, sem ninguém perceber. Benefício colateral: quando a seleção de taxonomia chegar,
ela nasce funcionando em criação e edição de uma vez.

### DR-3 — Tags e keywords devem ser reenviadas intactas
**Este é o risco número um da feature.** O RPC faz:

```sql
tags     = coalesce(p_tags, '{}')
keywords = coalesce(p_keywords, '{}')
```

Passar `NULL` **não preserva** — grava array vazio. Um formulário de edição que não
envie as tags **apaga as 15 de `o-projeto-rosie` silenciosamente**. `NOT NULL` não
protege contra `'{}'`.

Decisão: enquanto D-12 estiver `[PREENCHER]`, a UI **não expõe** tags/keywords para
edição, mas o formulário as carrega e as devolve inalteradas. Mesmo tratamento para
`further_reading`.

### DR-4 — Slug preservado (já implementado)
Nenhuma ação necessária para resenha publicada. REV-23 já garante que trocar o título
não muda a URL. `published_at IS NOT NULL` já funciona como marcador determinístico da
primeira publicação, graças ao `coalesce` nos dois ramos — **não é necessário criar
`first_published_at`**.

### DR-5 — RLS é o portão; ausência retorna 404
Carregamento via cliente autenticado do editor. Linha não visível → `notFound()`. Não
distinguir "não existe" de "não é sua", em coerência com a escolha já feita no RPC.
`service_role` permanece dormente (C-2 / D-09).

### DR-6 — Publish gate reutilizado
A transição de status usa a mesma função validada do M3, ramificando pelo enum
validado, nunca pelo botão clicado. Inclui despublicar. Não reimplementar na action de
update.

### DR-7 — Link de edição com nome acessível completo
Uma lista de sete links "Editar" é inútil em navegação por links de leitor de tela.
Título dentro do link, ou `aria-label` composto: `Editar resenha: O Projeto Rosie`.

### DR-8 — Resenhas sem `editor_id` não são editáveis pela tela
As quatro de seed provavelmente têm `editor_id` nulo. A RLS as tornará não editáveis —
isso é a RLS funcionando, não bug. O T6 cobre o caso explicitamente, para que falhe com
mensagem clara.

---

## 5. Propostas pendentes de aprovação

### P-1 — Concorrência otimista (`p_expected_updated_at`)

**Problema:** dois admins hoje, um terceiro editor no horizonte. Editor A abre a tela às
14h; editor B corrige o texto às 14h20; A salva às 15h e sobrescreve a correção de B.
Ninguém recebe erro. Falha silenciosa com perda de trabalho.

**Proposta:** `updated_at` viaja em campo oculto e entra no `WHERE` do UPDATE. Zero
linhas → exceção com `errcode = '40001'` (serialization failure), **distinto do 42501**
para que a action traduza em "esta resenha foi alterada por outra pessoa — recarregue"
em vez de "sem permissão". Conteúdo digitado preservado na tela.

**Custo:** acrescentar parâmetro cria *overload*, não substituição. Exige `DROP
FUNCTION` explícito da assinatura antiga antes do `CREATE`, senão ficam duas funções e o
PostgREST resolve pela que casar. `db push` obrigatoriamente antes do merge.

**Alternativa:** cortar para DIFERIDOS com gatilho no onboarding do terceiro editor.
Defensável, mas registrar que a falha é silenciosa.

### P-2 — `p_slug_base` opcional, aplicado só quando `published_at IS NULL`

**Problema:** REV-23 congela o slug sempre, inclusive em rascunho nunca publicado. O
rascunho `marquez-gabriel-garcia-cem-anos-de-solidao-rio-de-janeiro-record-2012` tem
slug derivado de uma referência ABNT colada no campo título. Pela regra atual, **nem a
REV-19 conserta** — só SQL, que é exatamente o que esta feature existe para eliminar.

**Proposta:** `p_slug_base text default null` no update, aplicado via
`unique_review_slug()` **apenas** se `published_at IS NULL`. Determinístico pelo schema,
coerente com REV-23 (nenhuma URL pública jamais quebra), e resolve o caso concreto que
está no banco agora.

### P-3 — Campos de ficha técnica ausentes do MVP

`pages`, `original_language`, `translator`, `translated_from` existem na tabela `book`
desde a 0001 mas **não entram em nenhum dos dois RPCs**. A migration 0011 documenta a
escolha: *"assinatura de função é contrato — muda quando a UI mudar, não antes"*. O
raciocínio está correto.

Mas o mapa de requisitos v1.0 lista **"Dados do livro — ficha técnica: ano, páginas,
idioma original, tradução"** como OBRIGATÓRIO MVP. Hoje o produto entrega ano e cidade
de publicação; páginas, idioma original e tradução não são preenchíveis por via alguma.

**Proposta:** incluir os quatro campos na REV-19, já que o formulário e a assinatura
serão tocados de qualquer forma. **Alternativa:** unidade própria, registrada em
DIFERIDOS com o gap contra o mapa explicitado.

---

## 6. Migration 0012 — escopo

`DROP FUNCTION` + `CREATE` de `update_review_with_book`.

**Acrescenta** (conforme aprovação): `p_expected_updated_at` (P-1), `p_slug_base` (P-2),
os quatro campos de ficha técnica (P-3).

**Preserva integralmente:** `security invoker`; `search_path = ''` (string vazia);
`revoke all ... from public` antes de `grant execute ... to authenticated`; congelamento
de `reviewer_name` e `editor_id`; semântica de `published_at` com `coalesce` nos dois
ramos; `42501` como código único para "não existe" e "não é seu".

**Re-documenta no cabeçalho** o contrato anti-recursão da 0007/0009: a função continua
dependendo da policy `book_editor_update`, que chama o definer mínimo
`owns_book_via_review`.

**Ordem de deploy:** `db push` em produção **antes** do merge (STOP A-11 — passo humano
pós-review). O `DROP` cria janela em que a função não existe; como ela nunca foi
exercida por código em produção, a janela é inofensiva — mas a ordem não muda.

---

## 7. Tasks

| # | Task | Modelo |
|---|---|---|
| T1 | Migration 0012 conforme §6, com red-test da ordenação | Opus |
| T2 | Extração de `ReviewForm` em modo duplo, sem mudança de comportamento no create | Sonnet |
| T3 | `getReviewForEdit` sob RLS, com `notFound()` | Opus |
| T4 | Server action de update: Zod, publish gate reutilizado, tradução de 42501 e 40001 | Opus |
| T5 | Rota `/admin/resenhas/[id]/editar` + link acessível na listagem (DR-7) | Sonnet |
| T6 | Suíte RLS do update com oráculo superusuário | Opus |
| T7 | Testes de atomicidade, preservação de tags e conflito otimista | Opus |
| T8 | Roteiro de leitor de tela do fluxo de edição, versionado | Opus |

T2 fecha em commit isolado com o gate verde antes de seguir: se a extração quebrar algo
no create, o sinal precisa aparecer limpo, não misturado com lógica nova.

---

## 8. Done when

- [ ] Editor edita a própria resenha (campos da resenha e do livro) e as alterações
      persistem.
- [ ] **Salvar sem tocar em tags deixa as 15 de `o-projeto-rosie` intactas** (DR-3).
- [ ] Editar título de resenha publicada não altera o slug (DR-4).
- [ ] Editor A não edita resenha de Editor B — review e book — verificado por **oráculo
      superusuário**, nunca pelo papel sob teste.
- [ ] `anon` não edita nada.
- [ ] Falha na atualização do book reverte a do review, e vice-versa.
- [ ] Resenha inexistente ou fora de alcance → 404, sem distinção entre os dois casos.
- [ ] Resenha sem `editor_id` falha com mensagem clara (DR-8).
- [ ] (P-1) `updated_at` desatualizado devolve erro de conflito, não sobrescreve.
- [ ] (P-2) Slug de rascunho nunca publicado é editável; de publicada, não.
- [ ] Confirmação de salvamento anunciada a leitor de tela (redirect com mensagem no
      destino, não toast visual).
- [ ] Erro de conflito tratado como erro de formulário, com foco no resumo de erros —
      mesmo padrão do create.
- [ ] Gate completo verde: `typecheck && lint && format:check && test && test:a11y`.
- [ ] Roteiro de leitor de tela executado e registrado em arquivo versionado.
- [ ] Confirmação humana antes do merge e antes do `db push`.

---

## 9. Diferidos desta unidade

- **Guard de navegação para alterações não salvas.** `beforeunload` cobre saída do
  browser; navegação interna do App Router escapa dele. v1 aceita a limitação.
- **Exclusão de resenha.** Semântica própria: URL pública indexada, `ON DELETE CASCADE`
  no book.
- **`highlight_source`** como campo de atribuição separado (já em DIFERIDOS do projeto).

---

## 10. Fora desta spec, mas registrado aqui por ter sido descoberto na investigação

1. **Quatro resenhas de seed publicadas em produção** — `dom-casmurro`,
   `o-crime-do-padre-amaro`, `iracema`, `o-cortico`. Sem resenhista, sem tags,
   indexáveis, com `schema.org/Review`, num observatório com componente de divulgação
   científica. **Anterior e independente da REV-19; causa dano enquanto não resolvido.**
   Recomendação: despublicar (reversível) em vez de excluir.
2. **`marquez-...` é trabalho real não registrado**, não achado de integridade. Tem 6
   tags e conteúdo, criado 3h depois de `o-projeto-rosie` na mesma sessão. Precisa de
   destino decidido e de correção do título (referência ABNT no lugar do título).
3. **T13 do M3 permanece não concluída** — roteiro NVDA sem registro. Executar ou cortar
   com gatilho explícito.
4. **`comment` e `recommendation` existem no schema sem produto correspondente.**
   Registrar como schema-à-frente-do-produto no `STATE.md` para não virar premissa não
   marcada.

---

## 11. Nota de procedência

Convenção proposta para o `STATE.md`, motivada pela divergência de branch protection
desta sessão: toda afirmação de estado carrega marcador — `[V]` com o comando que a
comprovou, ou `[A]` para afirmado sem verificação independente. Premissa não marcada
vira base para turnos seguintes sem que ninguém perceba.

Tudo em §3 desta spec é `[V]`. A configuração de SMTP/Resend/DNS permanece `[A]`.
