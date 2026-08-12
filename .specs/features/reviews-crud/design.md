# reviews-crud — Design

> Milestone **M3 · Painel administrativo** · Fase **Design** · Branch alvo `feat/reviews-crud` (a criar).
> Fonte de verdade: [spec.md](spec.md) (REV-01..24 + REV-07-schema) + [context.md](context.md) (gray areas resolvidas) · precedente de segurança: [security-foundation/design.md](../security-foundation/design.md) (D-09/D-10, matriz own-or-admin 0008).
> **NATUREZA DESTE DOCUMENTO: somente design.** Nenhum SQL executado, nenhuma migration aplicada, nenhuma dependência instalada, nenhum arquivo de código criado. Todo DDL/TSX é **ILUSTRATIVO — NÃO APLICAR** até a fase Execute (o `db push` da 0009 tem STOP humano próprio, §12 / A-11 herdado).
> **Mudança desde o Specify (aplicada aqui):** resenhista **DENORMALIZADO** em `review.reviewer_name` (não derivado de `editor.name` em exibição) — motivo e semântica em §5. A RLS de `editor` (0007) **não é tocada**.
> Estado do repo verificado 2026-07-10, **reconfirmado 2026-08-09**: maior migration = **0008** (`0008_review_editor_write.sql` — logo a numeração **0009** deste design segue válida); `review` já tem GRANT `insert/update/delete` a `authenticated` + policies own-or-admin (0008); `book` só tem **leitura pública** (0003/0004), **sem escrita**; `@supabase/ssr` e `server-only` já instalados (M2); `Field`/`Button` a11y prontos; a rota `/admin/(protected)` e o gate `requireEditor()` já existem.

---

## §1. Visão e arquitetura

O formulário é **uma submissão que escreve duas tabelas** (`book` = ficha; `review` = resenha), sob o **client autenticado + RLS own-or-admin** já provado no M2. O ponto crítico é a **atomicidade** book+review — resolvido por **uma função Postgres transacional (RPC) `SECURITY INVOKER`** (mantém a RLS como gate). Os campos novos entram por **migration 0009 aditiva**; a escrita de `book` é **provisionada aqui** (GRANT+policies own-or-admin), espelhando a 0008.

```mermaid
graph TD
    subgraph Browser [Editor · /admin/(protected)]
      F[ReviewForm client component<br/>useActionState + Field/Button]
    end
    subgraph Server [Server actions — server-only]
      A[actions.ts<br/>requireEditor + Zod draft/publish]
    end
    subgraph DB [Supabase · sob RLS authenticated]
      R[RPC create/update_review_with_book<br/>SECURITY INVOKER · 1 transação]
      B[(book)]:::t
      V[(review)]:::t
      E[(editor · self-read)]:::t
    end
    F -->|FormData| A
    A -->|createAuthenticatedClient .rpc| R
    R -->|INSERT own-or-admin| B
    R -->|INSERT own + reviewer_name congelado| V
    R -.self-read RLS.-> E
    A -->|publish/unpublish = UPDATE só-status| V
    P[/resenha/slug · público anon/] -->|review_public_read published| V
    classDef t fill:#eef,stroke:#88a;
```

**Fluxos:**
- **Criar** → `ReviewForm` → `createReview` (action) → RPC `create_review_with_book` (book+review numa transação).
- **Editar conteúdo** → `updateReview` → RPC `update_review_with_book` (book+review, sem mexer slug/reviewer_name/editor_id). **CORTADO do Execute** (§13) — desenhado e provisionado na 0009, exercido em follow-up.
- **Publicar/Despublicar** → `publishReview`/`unpublishReview` → UPDATE **só de `review.status`** (uma tabela, sem RPC — não há escrita de book). O **gate de publicação** (todos os campos) roda **no server action** (§5.4).
- **Ler no painel** (lista/edição) → client **autenticado** (drafts próprios visíveis sob RLS own; admin vê todos).
- **Exibir no público** → a `review-page`/home já leem por `*` (as colunas novas entram sozinhas após regen de tipos, §7).

---

## §2. Migration `0009_reviews_crud.sql` (TD-03) — schema, GRANTs, policies

Aditiva e idempotente no padrão da casa (`add column if not exists`, `drop policy if exists`+`create`, `create or replace`, `drop constraint if exists`+`add`). **STOP:** não aplicar aqui; `db push` (local e produção) é passo humano pós-merge (A-11 herdado do M2).

### 2.1 Colunas novas (DD-1, DD-2)

```sql
-- ILUSTRATIVO — NÃO APLICAR · 0009 (1) colunas aditivas
alter table public.book   add column if not exists publication_city text;
alter table public.review add column if not exists reviewer_name    text;        -- denormalizado (§5)
alter table public.review add column if not exists tags             text[] not null default '{}';
alter table public.review add column if not exists keywords         text[] not null default '{}';
alter table public.review add column if not exists highlight_quote  text;
alter table public.review add column if not exists further_reading  jsonb  not null default '[]'::jsonb;

-- further_reading é um ARRAY json (defesa; a FORMA dos itens {label,url} é validada no app/Zod §5.3)
alter table public.review drop constraint if exists review_further_reading_is_array;
alter table public.review add  constraint review_further_reading_is_array
  check (jsonb_typeof(further_reading) = 'array');
```

**DD-2 — formas escolhidas:** `tags`/`keywords` = **`text[]`** (nativo, aditivo; um filtro futuro por tag adiciona índice GIN sem mudar a coluna — a filtragem está CORTADA por prazo, TAGS=c). `further_reading` = **`jsonb`** array de `{label,url}` (estrutura variável, 0..N itens). `publication_city`/`reviewer_name`/`highlight_quote` = `text`. Tabela `tag`+join foi **rejeitada** (overkill sem filtragem; custo de prazo).

### 2.2 Nota inteira 0–5 — CHECK no banco + Zod no app (DD-3, resolve decisão 2 do Specify)

**Decisão: defesa em profundidade** — CHECK no banco como **fonte de verdade** + validação acessível no form (Zod). Justificativa: espelha exatamente o precedente `book-data` (CHECKs da 0002 + `bookInputSchema`) — a regra não depende de lembrar de validar no app.

```sql
-- ILUSTRATIVO — NÃO APLICAR · 0009 (2) nota inteira (D-01)
-- Normaliza legado ANTES do CHECK: o dado de produção tem meio-ponto, então sem
-- isto o CHECK falharia na aplicação.
--
-- NORMALIZAÇÃO EDITORIAL EXPLÍCITA (A-3 — verificado em produção 2026-08-09):
-- dom-casmurro = 4,5 e iracema = 4,5; as outras duas resenhas já são inteiras
-- (4,0 e 5,0). Os valores 5 e 4 abaixo são ESCOLHA EDITORIAL do autor — NÃO
-- resultado de arredondamento (ver §13/A-3 para por que round() foi rejeitado
-- como estratégia).
update public.review set rating = 5 where slug = 'dom-casmurro';
update public.review set rating = 4 where slug = 'iracema';

-- REDE RESIDUAL para qualquer não-inteiro remanescente (linha nova criada entre
-- a verificação e o push, ou ambiente cujo dado divirja do de produção).
-- Idempotente: após os dois UPDATEs acima não casa com nada no dado conhecido.
update public.review set rating = round(rating)
  where rating is not null and rating <> trunc(rating);

alter table public.review drop constraint if exists review_rating_integer;
alter table public.review add  constraint review_rating_integer
  check (rating is null or (rating >= 0 and rating <= 5 and rating = trunc(rating)));
```

A coluna permanece `numeric(2,1)` (não recriada — reversível/aditivo; afrouxar para meio-ponto no futuro é só trocar o CHECK). O CHECK 0–5 original da 0001 continua; este acrescenta a integralidade.

**A-3 RESOLVIDO por verificação empírica (2026-08-09).** O `round()` cego que este bloco continha foi rejeitado **como estratégia** para as duas linhas conhecidas: em `numeric`, o Postgres arredonda meio **para longe do zero**, então `4,5` → `5` nas duas — deixando **3 das 4 resenhas com nota 5**, o que achata a listagem e torna a ordenação "Melhor nota" inútil. A escolha por slug (`dom-casmurro`→5, `iracema`→4) é editorial e preserva a dispersão das notas.

### 2.3 GRANTs de escrita de `book` (TD-03 — resolve REV-07-schema)

```sql
-- ILUSTRATIVO — NÃO APLICAR · 0009 (3) GRANTs de book
-- SELECT já veio de 0003/0004 (leitura pública). Pós-2026-05-30 não há grant
-- automático: sem isto a escrita autenticada morre em 42501. anon NÃO recebe escrita.
grant insert, update, delete on table public.book to authenticated;
-- review já tem insert/update/delete a authenticated (0008, TABLE-level) → as
-- colunas novas (§2.1) são cobertas automaticamente, sem grant por coluna.
```

### 2.4 Posse de `book` sob RLS — own-or-admin transitivo (DD-4, resolve decisão 1 do Specify)

**O schema já responde "um livro pode ter várias resenhas?": NÃO.** `review.book_id` é **UNIQUE** ([0001:53](../../../supabase/migrations/0001_core_schema.sql#L53)) → relação **1—1**. Logo a posse do `book` é, sem ambiguidade, **a posse da sua única `review`**. Modelo:

- **INSERT** → **qualquer editor ativo** (`is_active_editor()`). No instante do INSERT ainda **não existe** a `review` (ordem livro→resenha), então não há posse a verificar; a posse se estabelece na `review` da **mesma transação** (RPC §3). Um `book` órfão (sem review) é **invisível ao público** e inócuo (o `book` já é catálogo de leitura pública — nada novo vaza). Admin entra por ser editor ativo.
- **UPDATE** → **admin** (todas) **ou** editor **dono da review** do book (`owns_book_via_review(id)`).
- **DELETE** → **admin-only** (espelha o DELETE de `review` da 0008; o form não deleta).

```sql
-- ILUSTRATIVO — NÃO APLICAR · 0009 (4) helper definer + policies de book
-- Helper "o editor é dono do book via a review 1-1?" — mesmo hardening da 0007
-- (stable, security definer, dono=postgres, search_path vazio, execute restrito).
-- book→review NÃO é recursivo (tabelas distintas), mas o definer evita a RLS de
-- review reentrar na avaliação da policy de book.
create or replace function public.owns_book_via_review(p_book_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.review r
    where r.book_id = p_book_id and r.editor_id = auth.uid()
  )
$$;
revoke all on function public.owns_book_via_review(uuid) from public;
grant execute on function public.owns_book_via_review(uuid) to authenticated;

drop policy if exists book_editor_insert on public.book;
create policy book_editor_insert on public.book
  for insert to authenticated
  with check (public.is_active_editor());

drop policy if exists book_editor_update on public.book;
create policy book_editor_update on public.book
  for update to authenticated
  using      (public.is_admin() or public.owns_book_via_review(id))
  with check (public.is_admin() or public.owns_book_via_review(id));

drop policy if exists book_admin_delete on public.book;
create policy book_admin_delete on public.book
  for delete to authenticated
  using (public.is_admin());
-- book_public_read (0003) permanece INTACTA ao lado (SELECT anon) — SEC-13.
```

Matriz resultante de `book`: **anon** → SELECT público, zero escrita (sem GRANT); **authenticated sem editor** → SELECT público, INSERT/UPDATE barrados (`is_active_editor()`=false); **editor ativo** → INSERT; UPDATE só do book cuja review é dele; **admin** → tudo, sob RLS.

---

## §3. Escrita atômica book + review — RPC transacional (DD-5)

**O maior risco da feature.** Requisito REV-04: se a `review` falha, o `book` não pode ficar órfão (e vice-versa). O `supabase-js`/PostgREST **não** faz transação multi-tabela numa chamada; cada request PostgREST — **incluindo `.rpc()`** — roda **numa única transação**. Portanto:

**Decisão: uma função `plpgsql` `create_review_with_book` (e `update_review_with_book`), `SECURITY INVOKER`, chamada via `.rpc()` pelo client autenticado.** Uma chamada = uma transação = atômica: se o INSERT de `review` viola policy/constraint, **toda a transação faz rollback** — nenhum `book` órfão.

**Por que `SECURITY INVOKER` (não `DEFINER`):** INVOKER roda **como o editor chamador** → as policies `book_editor_insert` e `review_editor_insert` avaliam cada INSERT, e `auth.uid()` resolve o editor. **A RLS continua sendo o gate (D-09).** `DEFINER` bypassaria a RLS e exigiria reimplementar a posse na função — viola o modelo do M2. (Exceção pontual: a unicidade de slug precisa **ler além da RLS** — helper definer isolado, §4.)

```sql
-- ILUSTRATIVO — NÃO APLICAR · 0009 (5) RPC de criação atômica
create or replace function public.create_review_with_book(
  -- book (ficha)
  p_book_title text, p_author text, p_genre_id uuid, p_publisher text,
  p_isbn text, p_cover_url text, p_year smallint, p_publication_city text,
  -- review (conteúdo/classificação/estado)
  p_review_title text, p_body text, p_rating numeric,
  p_tags text[], p_keywords text[], p_highlight_quote text, p_further_reading jsonb,
  p_status public.review_status, p_slug_base text
) returns public.review
language plpgsql security invoker set search_path = ''
as $$
declare
  v_book_id uuid;
  v_name    text;
  v_slug    text;
  v_review  public.review;
begin
  -- resenhista CONGELADO: nome do próprio editor, lido sob RLS self-read (§5)
  select e.name into v_name from public.editor e where e.id = auth.uid();

  insert into public.book
    (title, author, genre_id, publisher, isbn, cover_url, year, publication_city)
  values
    (p_book_title, p_author, p_genre_id, p_publisher, p_isbn, p_cover_url, p_year, p_publication_city)
  returning id into v_book_id;

  v_slug := public.unique_review_slug(p_slug_base);   -- §4 (definer)

  insert into public.review
    (book_id, title, slug, body, rating, status, editor_id, reviewer_name,
     tags, keywords, highlight_quote, further_reading, published_at)
  values
    (v_book_id, p_review_title, v_slug, p_body, p_rating, p_status, auth.uid(), v_name,
     coalesce(p_tags, '{}'), coalesce(p_keywords, '{}'), p_highlight_quote,
     coalesce(p_further_reading, '[]'::jsonb),
     case when p_status = 'published' then now() else null end)
  returning * into v_review;

  return v_review;
end $$;

revoke all on function public.create_review_with_book(
  text,text,uuid,text,text,text,smallint,text,text,text,numeric,text[],text[],text,jsonb,public.review_status,text
) from public;
grant execute on function public.create_review_with_book(
  text,text,uuid,text,text,text,smallint,text,text,text,numeric,text[],text[],text,jsonb,public.review_status,text
) to authenticated;
```

**`search_path = ''` em TODAS as funções da 0009 (padronizado).** O RPC usava `set search_path = public` enquanto os dois helpers definers (`owns_book_via_review`, `unique_review_slug`) já usavam `''` — divergência sem motivo. Como o corpo do RPC **já qualifica tudo** com `public.` (`public.editor`, `public.book`, `public.review`, `public.unique_review_slug`) e `auth.uid()` traz o próprio schema, `''` funciona sem outra alteração e elimina a diferença de postura entre funções da mesma migration. `''` é a forma estrita (nada resolve sem qualificação), coerente com o hardening da 0007.

`update_review_with_book(p_review_id uuid, …mesmos campos…)` é análoga: UPDATE `book` (via join pela review) + UPDATE `review`, na mesma transação, sob `book_editor_update`/`review_editor_update`. **Não** altera `slug`, `reviewer_name` nem `editor_id` (§4/§5). `published_at` só é carimbado numa transição para `published` (§5.4).

**Alternativa rejeitada:** dois INSERTs separados no server action + DELETE compensatório do book se a review falhar. Rejeitada — a compensação **também pode falhar** (rede/permission) deixando o órfão que se queria evitar; a transação do RPC é a única garantia dura.

**Verificação (Knowledge Chain) para o Execute:** confirmar no `@supabase/supabase-js` que `.rpc()` sob JWT `authenticated` propaga `auth.uid()` dentro da função INVOKER e roda numa transação (comportamento documentado do PostgREST). Não fabricar — validar com um teste de integração local (§9/TD-02) antes de confiar.

---

## §4. Slug estável + resenhista congelado (DD-6, DD-7)

### 4.1 Slug (REV-23)
- **Gerado 1× na criação**, a partir do **título da resenha** (`slugify`: minúsculas, sem acento, hífens). **ESTÁVEL no edit** — trocar o título **não** muda o slug (preserva URLs públicas/SEO; sem quebra de link). Decisão de design explícita.
- **Unicidade sob RLS é o ponto sutil:** o editor **não enxerga drafts alheios** (RLS), então um `select ... where slug=` dentro do INVOKER **não veria** uma colisão com o draft de outro editor → o INSERT bateria no UNIQUE e abortaria com erro cru. Solução: helper **`SECURITY DEFINER`** que lê **todos** os slugs (bypassa RLS) e devolve o próximo livre. Slug não é dado sensível (deriva de título; a função retorna só a string), e o **índice UNIQUE é o backstop** final.

```sql
-- ILUSTRATIVO — NÃO APLICAR · 0009 (6) slug único (definer isolado)
create or replace function public.unique_review_slug(p_base text)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare v_slug text := p_base; v_n int := 1;
begin
  while exists (select 1 from public.review where slug = v_slug) loop
    v_n := v_n + 1; v_slug := p_base || '-' || v_n;
  end loop;
  return v_slug;
end $$;
revoke all on function public.unique_review_slug(text) from public;
grant execute on function public.unique_review_slug(text) to authenticated;
```

Corrida concorrente rara (dois creates com o mesmo base no mesmo instante) → uma transação leva 23505 e faz rollback; o server action traduz para "tente novamente" acessível (§9). Aceito no volume do MVP.

### 4.2 Resenhista denormalizado e CONGELADO (DD-6 — mudança desde o Specify)
- `reviewer_name` é **gravado no create** a partir de `editor.name` do editor autenticado (lido dentro do RPC via **self-read RLS** — a policy `editor_self_read` da 0007 permite o editor ler a própria linha; **nenhuma policy nova em `editor`**).
- **Congelado por resenha:** o `update_review_with_book` **não** reescreve `reviewer_name`. Se o editor mudar `editor.name` depois, **resenhas antigas mantêm o nome antigo** — é o resenhista **daquela** resenha. **Comportamento intencional, NÃO é bug** — documentado aqui para ninguém "corrigir". Admin editando resenha alheia **não** vira o resenhista (o campo não é tocado no update).
- **Ganho:** a página pública (**anon**) lê `reviewer_name` pela `review_public_read` **já provada** — a fronteira de `editor` (a tabela mais sensível da fundação) **permanece intacta** (self-read + admin).

---

## §5. Server actions, validação e ciclo de estado

### 5.1 Localização e gate
`src/app/admin/(protected)/resenhas/actions.ts` (`'use server'`). Cada action chama **`requireEditor()`/`getAuthenticatedEditor()` ANTES de qualquer escrita** (SEC-08 — o layout protege páginas, não substitui o gate por operação), valida com Zod, e escreve via `createAuthenticatedClient()` (`.rpc()` ou `.update()`). Padrão idêntico ao [login/actions.ts](../../../src/app/admin/login/actions.ts).

### 5.2 Assinaturas (DD-10)

```ts
// ILUSTRATIVO — NÃO APLICAR · contrato das actions
export type ReviewFormState = {
  status: 'idle' | 'saved' | 'error'
  message: string                       // erro/sucesso de formulário (aria-live)
  fieldErrors?: Record<string, string>  // erros por campo (Field.error)
  values?: ReviewFormValues            // eco dos valores p/ repopular (sem perder digitação)
}
export async function createReview(prev: ReviewFormState, form: FormData): Promise<ReviewFormState>
export async function updateReview(id: string, prev: ReviewFormState, form: FormData): Promise<ReviewFormState>  // CORTADA do Execute (§13)
export async function publishReview(id: string): Promise<ReviewFormState>    // gate §5.4
export async function unpublishReview(id: string): Promise<ReviewFormState>
```

**REQUISITO — o schema é escolhido pelo STATUS VALIDADO, nunca pelo botão (§5.4).** `createReview` lê `status` do `FormData`, **valida contra um enum** (`z.enum(['draft','published'])`) e **deriva dele** qual schema aplicar — `reviewDraftSchema` para `draft`, `reviewPublishSchema` para `published`. Não existe caminho em que o `p_status` enviado ao RPC divirja do schema que validou o payload:

```ts
// ILUSTRATIVO — NÃO APLICAR · o status decide o schema (não o botão)
const parsedStatus = reviewStatusSchema.safeParse(form.get('status'))
if (!parsedStatus.success) return { status: 'error', message: 'Ação inválida.', /* … */ }
const schema = parsedStatus.data === 'published' ? reviewPublishSchema : reviewDraftSchema
// …parse com `schema`, e o MESMO `parsedStatus.data` vai como p_status ao RPC
```

Por que é requisito e não detalhe: os dois botões são apenas UI. Uma `FormData` forjada com `status=published` (curl, DevTools, extensão) chega pelo **caminho normal do app** — se o schema viesse do botão, ela publicaria incompleta sem nunca tocar a API direta. Derivar do status validado fecha esse furo; sobra só o residual de API direta (A-1), que é outra coisa. `updateReview` segue a mesma regra. **Teste obrigatório:** `FormData` com `status=published` e corpo/nota ausentes **falha** no `reviewPublishSchema` (§9, §10).

Sucesso de create/update → `redirect` para `/admin/resenhas` (ou para o editar) + `revalidatePath` das rotas públicas afetadas quando `published`.

**`revalidatePath` também no `unpublishReview`** (e não só ao publicar): despublicar **remove** a resenha do público, e sem revalidar a `/resenha/[slug]` e a home seguem servindo a versão em cache de uma resenha que não está mais publicada — o efeito visível de "despublicar não despublicou". Regra: **toda transição de status revalida**, nas duas direções.

### 5.3 Validação Zod (DD-9) — reuso de `bookInputSchema`
`src/lib/review/schema.ts` compõe a ficha (reusa/estende [bookInputSchema](../../../src/lib/book/schema.ts) — ISBN checksum via `isbn.ts` já embutido) + os campos da resenha:

```ts
// ILUSTRATIVO — NÃO APLICAR · esboço do schema
const furtherReadingItem = z.object({
  label: z.string().trim().min(1),
  url: z.string().trim().url().refine(u => /^https?:\/\//i.test(u), 'Só http/https'), // anti javascript: (A-4)
})
const reviewBase = bookInputSchema.innerType() /* ficha */ .extend({
  publicationCity: z.string().trim().optional(),
  reviewTitle: z.string().trim().optional(),          // default = título do livro (§6)
  body: z.string().trim().optional(),
  rating: z.number().int().min(0).max(5).optional(),  // inteiro (D-01) — casa com o CHECK §2.2
  tags: z.array(z.string().trim().min(1)).default([]),
  keywords: z.array(z.string().trim().min(1)).default([]),
  highlightQuote: z.string().trim().optional(),
  furtherReading: z.array(furtherReadingItem).default([]),
  coverUrl: z.string().trim().url().optional(),
})
export const reviewDraftSchema   = reviewBase   // rascunho: mínimo estrutural (title/author/genre já obrigatórios pela ficha)
export const reviewPublishSchema = reviewBase.superRefine(/* §5.4 exige body + rating + … */)
```

### 5.4 Ciclo rascunho→publicado e o **gate de publicação** (DD-8)
- **Rascunho** salvável com o mínimo que persiste (a ficha exige `title`/`author`/`genre_id` — NOT NULL de schema; `review.title` default = título do livro).
- **Publicar** exige o conjunto abaixo (via `reviewPublishSchema`, selecionado pelo **status validado** — §5.2):

  | Obrigatório p/ publicar | Origem |
  | --- | --- |
  | `book.title`, `book.author`, `book.genre_id` | ficha (já NOT NULL) |
  | `review.body` (corpo) | REV-10 |
  | `review.rating` (0–5 inteiro) | REV-07 |
  | `review.title` (headline) | default = título do livro se vazio |
  | *(reviewer_name)* | preenchido pelo sistema no create — nunca falta |

  Opcionais mesmo publicando: ISBN, `publication_city`, `publisher`, `year`, `cover_url`, `tags`, `keywords`, `highlight_quote`, `further_reading`.

- **publish/unpublish = UPDATE só de `review`** (status + `published_at`): não tocam `book`, logo **não precisam do RPC** nem de atomicidade multi-tabela. `publishReview` **carrega a review, valida `reviewPublishSchema`**, e só então `update ... set status='published', published_at = coalesce(published_at, now())`. `unpublishReview` → `set status='draft'` (mantém `published_at` — **carimbo da PRIMEIRA publicação**; republicar **não** reescreve, graças ao `coalesce`, logo a resenha **não é empurrada para o topo de "Mais recentes"** ao voltar do rascunho — §11/A-8).
- **Limitação herdada (A-1):** a RLS **não distingue transição de status** de outras edições (mesma limitação registrada no M2, A-4). O gate "todos os campos antes de publicar" é **do app** (server action), não da RLS. Com a emenda do §5.2, o **caminho do app está fechado** (o schema vem do status validado, não do botão) — o residual restante é **só a API direta**, um editor autenticado chamando PostgREST/`.rpc()` sem passar pelo server action. Aceito para editores internos (§11); fechá-lo exigiria um `trigger` de guarda de transição no banco.

---

## §6. Componentes e reuso

### 6.1 Reuso (Code Reuse Analysis)

| Componente/utilitário | Local | Como usa |
| --- | --- | --- |
| `Field` (input/textarea/select, a11y) | [src/components/ui/Field.tsx](../../../src/components/ui/Field.tsx) | Todos os campos do form — já traz `label htmlFor`, `aria-describedby`, `role="alert"`, `aria-invalid` (REV-21 quase de graça) |
| `Button` | [src/components/ui/Button.tsx](../../../src/components/ui/Button.tsx) | Ações salvar/publicar/despublicar |
| `useActionState` + live region | [LoginForm.tsx](../../../src/app/admin/login/LoginForm.tsx) | Padrão de estado assíncrono acessível (status region estável desde o 1º render) |
| `createAuthenticatedClient` | [src/lib/supabase/authenticated.ts](../../../src/lib/supabase/authenticated.ts) | Escrita sob RLS (D-10) |
| `requireEditor`/`getAuthenticatedEditor` | [src/lib/auth/requireEditor.ts](../../../src/lib/auth/requireEditor.ts) | Gate por operação (SEC-08) |
| `bookInputSchema` + `isbn.ts` | [src/lib/book/schema.ts](../../../src/lib/book/schema.ts) | Ficha + checksum de ISBN (REV-13) |
| `(protected)/layout.tsx` | [layout](../../../src/app/admin/(protected)/layout.tsx) | As rotas novas herdam o gate autoritativo |
| `BookDetails` / `Rating` | [components/book](../../../src/components/book/BookDetails.tsx) | Exibição pública (add `publication_city` na ficha; Rating já existe) |

### 6.2 Componentes novos

| Componente | Local | Propósito | Reusa |
| --- | --- | --- | --- |
| **Migration 0009** | `supabase/migrations/0009_reviews_crud.sql` | Colunas + CHECK nota + GRANTs/policies de book + RPCs + helper slug | padrão 0007/0008 |
| **`reviewInputSchema`** | `src/lib/review/schema.ts` | Zod draft/publish (§5.3) | `bookInputSchema`, `isbn.ts` |
| **`slugify`** | `src/lib/review/slug.ts` | base do slug a partir do título (puro, testável) | — |
| **`actions.ts`** | `src/app/admin/(protected)/resenhas/actions.ts` | create/update/publish/unpublish (§5) | authenticated client, requireEditor |
| **`ReviewForm`** | `src/app/admin/(protected)/resenhas/ReviewForm.tsx` | Client component do formulário (DD-11) | Field, Button, useActionState |
| **`RatingInput`** | idem (ou `components/review`) | Nota 0–5 como **radiogroup** `fieldset/legend` (acessível, sem meio-ponto) | — |
| ~~**`RepeatableLinks`**~~ | idem | ~~Lista dinâmica label+url de "para saber mais"~~ — **CORTADO do Execute** (§13); `further_reading` sai da UI, a coluna fica | — |
| **Rotas** | `resenhas/page.tsx` · `resenhas/nova/page.tsx` · ~~`resenhas/[id]/editar/page.tsx`~~ | Lista mínima + criar (DD-13). **Editar CORTADO do Execute** (§13) | layout (protected) |
| **Leitura admin** | `src/lib/review/adminQueries.ts` | `listEditorReviews()` / `getEditorReviewForEdit(id)` via client **autenticado** (drafts sob RLS own) | authenticated client |
| **Exibição pública** | ver §7 | Renderiza campos novos na `review-page` | review-page |

### 6.3 Formulário — client component (DD-11, DD-12)
- **É um client component** (`'use client'`, `useActionState`) — os campos dinâmicos (`tags`, `further_reading`) exigem estado no browser. **Decisão DD-12:** o painel admin **assume JS** (ferramenta interna); o requisito "funciona sem JS" do projeto vale para as **páginas públicas**, que continuam SSR/no-JS. WCAG 2.1 AA é cumprido **com** JS ligado (teclado, labels, aria-live, foco — §8).
- **Estrutura:** `<fieldset>` por seção — *Ficha bibliográfica*, *Classificação*, *Conteúdo* — cada um com `<legend>`. Nota = `RatingInput` (radiogroup). **Tags/keywords = UM input de texto separado por vírgula** (convertido para `text[]` no server action — chips dinâmicos CORTADOS, §13). **`further_reading` não tem campo** (CORTADO do Execute, §13).
- **Serialização:** o client monta o payload (arrays/jsonb) e o envia; o action parseia com Zod. Botões distintos **Salvar rascunho** e **Publicar** (dois `formAction` / dois submit) apenas **enviam `status` diferente** — quem escolhe o schema é o **status validado no server action**, nunca o botão (§5.2). Os botões são UI; a regra é do servidor.

### 6.4 Rota e nomenclatura
`/admin/resenhas` (lista) · `/admin/resenhas/nova` (criar) · ~~`/admin/resenhas/[id]/editar`~~ (**editar CORTADA do Execute** — §13; a nomenclatura fica decidida para quando voltar). Adota **`nova`** — fecha a divergência `novo`/`nova` do backlog do STATE. Tudo dentro de `(protected)`.

---

## §7. Exibição pública dos campos novos (DD-14, DD-15)

Os campos novos existem para **serem vistos** (REV-08/11/12/14) — o design **estende a `review-page`** (senão os campos ficam gravados e invisíveis). Custo pequeno; escopo confirmado em §13/A-7.

- **Query:** `REVIEW_SELECT = '*, book(*, …)'` já traz as colunas novas por `*` — basta **regenerar `database.types.ts`** (DD-16) após a 0009. Sem mudança de query.
- **`review-page` (`/resenha/[slug]/page.tsx`):**
  - **Byline** do resenhista: `review.reviewer_name` no `<header>`.
  - **Frase de destaque:** `<blockquote>` com realce (novo `HighlightQuote`); omitido se vazio (REV-11).
  - ~~**Para saber mais:**~~ **CORTADO do Execute (§13)** — `further_reading` sai da UI e da exibição pública; a coluna e o CHECK ficam na 0009. Quando voltar: `<nav aria-label="Para saber mais">` com `<a>`, **renderizando só URLs `http/https`** (defesa XSS, A-4), omitido se lista vazia (REV-12).
  - **Tags:** lista exibida (REV-08). **Palavras-chave:** entram em `generateMetadata` como `keywords` (SEO, REV-09), não como filtro.
  - **`publication_city`:** nova linha em `BookDetails` (ficha).
- **`cover_url` (DD-15):** guardado como **texto**; a **renderização da imagem** (`<img>`) fica **adiada** (`storage-covers`/polish do "bloco vinho"). `BookCover` segue tipográfico por ora — evita reabrir o bug de layout conhecido. Sinalizado como corte de prazo (§13).

---

## §8. Acessibilidade (DoD WCAG 2.1 AA) — formulário

- **Campos:** todos via `Field` → `<label for>` explícito, `aria-describedby` para erro/ajuda, `aria-invalid`, `role="alert"` no erro (não depende de cor — WCAG 1.4.1). Marcador "(opcional)" onde couber.
- **Nota:** `RatingInput` = `fieldset`+`legend "Nota (0 a 5)"` com `radio`s — rótulo textual por opção (não estrelas-só; WCAG 1.1.1/1.4.1); operável por teclado (setas).
- **Erros de submissão / gate de publicação:** **resumo de erros** numa live region `role="alert"`/`aria-live="assertive"` presente no DOM desde o 1º render, listando os campos que faltam para publicar (REV-16); **foco movido** para o resumo (`tabIndex={-1}`) ao falhar (WCAG 2.4.3/3.3.1). Erros por campo também via `Field.error`.
- **Sucesso:** anunciado em `role="status"`/`aria-live="polite"` antes do redirect (padrão login).
- **Listas dinâmicas** (tags, links): botões *Adicionar*/*Remover* com nome acessível (`aria-label` incluindo o item), foco gerido ao remover.
- Gates de CI axe/Lighthouse cobrem as rotas novas; contraste/foco herdados dos tokens.

---

## §9. Tratamento de erros (DD-17)

| Cenário | Tratamento | Usuário vê |
| --- | --- | --- |
| Validação Zod (campo) | `fieldErrors` → `Field.error` | erro no campo, foco/aria |
| Gate de publicação incompleto | `reviewPublishSchema` falha → resumo | lista acessível do que falta; nada publicado |
| **`status` ausente/forjado no `FormData`** | `z.enum(['draft','published'])` falha → action retorna erro **antes** de qualquer escrita (§5.2) | "Ação inválida."; nada persistido. **Teste:** `status=published` sem corpo/nota cai no `reviewPublishSchema` e é rejeitado |
| RLS/GRANT (42501) | mapear no action → mensagem amigável | "Você não tem permissão para esta ação." (sem stack/500) — REV-22 |
| Slug em corrida (23505) | catch no action | "Não foi possível gerar o endereço; tente novamente." |
| ISBN checksum inválido | Zod (`isbn.ts`) | erro no campo ISBN |
| URL inválida em capa/links | Zod (http/https) | erro no item |
| Sessão perdida no meio | `requireEditor()`=unauth → redirect | volta ao login; valores preservados quando possível (`values` echo) |
| Rollback do RPC (review falha) | transação aborta | nada persistido; mensagem de erro; **sem book órfão** (REV-04) |

---

## §10. Rastreabilidade (DD ↔ REV)

| DD | Decisão | Requisitos |
| --- | --- | --- |
| DD-1 | 0009 aditiva/idempotente — colunas novas | REV-06 |
| DD-2 | `tags`/`keywords` `text[]`; `further_reading` `jsonb`; demais `text` | REV-06, REV-08, REV-09, REV-12 |
| DD-3 | Nota inteira: **CHECK no banco + Zod** (defesa em profundidade); normaliza legado | REV-07, D-01 |
| DD-4 | Posse de `book` own-or-admin transitiva via review 1—1; helper definer `owns_book_via_review` | REV-07-schema, REV-05 |
| DD-5 | Escrita atômica via RPC `SECURITY INVOKER` (transação; RLS é gate) | REV-04, REV-02, REV-03 |
| DD-6 | `reviewer_name` denormalizado no create, **congelado** (self-read RLS; sem tocar RLS de editor) | REV-14 (mudança) |
| DD-7 | Slug gerado 1×, **estável** no edit; unicidade via definer + UNIQUE backstop | REV-23 |
| DD-8 | publish/unpublish = UPDATE só-status; **gate de publicação no app**, com o schema derivado do **status validado como enum** (não do botão) — teste de `FormData` forjada (§5.2/§9) | REV-15, REV-16, REV-17, REV-18 |
| DD-9 | Zod draft/publish reusando `bookInputSchema`+`isbn.ts` | REV-13, REV-16 |
| DD-10 | Server actions gateadas por `requireEditor` + client autenticado | REV-01, REV-02 |
| DD-11 | Form client component (Field/Button/useActionState); fieldsets; RatingInput radiogroup | REV-21, REV-07 |
| DD-12 | Painel assume JS (interno); públicas seguem no-JS | REV-21 (escopo) |
| DD-13 | Rotas `/admin/resenhas`(lista mínima)`/nova`/`[id]/editar`; leitura admin sob RLS own | REV-24, REV-19 |
| DD-14 | Exibição pública dos campos novos na review-page (**menos `further_reading`/REV-12 — cortado do Execute, §13**) | REV-08, REV-09, REV-11, REV-14 (REV-12 adiado) |
| DD-15 | `cover_url` textual guardado; render de imagem adiado | REV-20 |
| DD-16 | Regen de `database.types.ts` pós-0009 | REV-06 |
| DD-17 | Estratégia de erros (42501 amigável, per-field, rollback) | REV-22, REV-04 |
| DD-18 | STOP: 0009 não aplicada aqui; `db push` humano pós-merge | (A-11 herdado) |

Sem requisito órfão: REV-01..24 + REV-07-schema todos mapeados. Nomes de arquivo/`slugify`/`cache()` são materialização idiomática, não decisões de escopo.

---

## §11. Riscos, threat model e dívidas

| # | Modo | Mitigação | Residual |
| --- | --- | --- | --- |
| T-1 | **Book órfão** (review falha após book) | RPC transacional (§3) → rollback | INSERT de book direto na API cria órfão inócuo (invisível; book já é leitura pública) |
| T-2 | **XSS via URL** (`javascript:` em `cover_url`/`further_reading`) | Zod só `http/https`; render público filtra esquema (§7) | com `further_reading` cortado da UI (§13), a defesa fica **exercida só por `cover_url`** — mantida assim mesmo, pois a coluna segue gravável por RPC/API |
| T-3 | **Publicar incompleto** furando o app (API direta) | Gate no server action; RLS own-or-admin ainda exige posse | RLS não distingue transição de status (A-1, herdado M2 A-4) — aceito p/ editores internos |
| T-4 | **CHECK de nota quebra no push** por legado `4.5` | UPDATE editorial explícito por slug + rede residual `round()` antes do CHECK (§2.2); as 4 seeds **já verificadas em produção** 2026-08-09 (A-3 resolvido) | as duas linhas com meio-ponto recebem valor **editorial** (`dom-casmurro`→5, `iracema`→4); a rede só cobre não-inteiro que surja entre a verificação e o push |
| T-5 | **Colisão de slug** entre drafts (RLS esconde) | `unique_review_slug` definer lê todos + UNIQUE backstop | (a) corrida concorrente rara → 23505 → "tente novamente"; (b) **ORÁCULO DE SLUG — residual aceito:** a função é definer e lê *todas* as resenhas, inclusive drafts alheios. Receber `minha-resenha-2` em vez de `minha-resenha` **revela ao editor que existe um draft de outro editor com aquele slug** — um bit de informação que a RLS de `review` esconderia. Vazamento mínimo (existência + título aproximado, nunca o conteúdo) e inerente a qualquer unicidade global sob RLS parcial; **aceito e nomeado** em vez de tratado como não-questão |
| T-6 | **`owns_book_via_review` mal escrita** (escalonamento) | Mesmo hardening da 0007 (definer, search_path vazio, execute restrito); revisão linha a linha + matriz de teste | função é código de segurança — tratar como crítico |
| T-7 | **Admin edita resenha alheia** e vira o resenhista | `reviewer_name`/`editor_id` **não** são tocados no update (§4.2) | — |
| T-8 | **Sessão perde no meio do form longo** | `requireEditor` no action nega; `values` echo repõe digitação | requisição em voo (herdado F-7 do M2) |

**Dívidas / TD-03:** 0009 abre GRANT+policies de **escrita de `book`** e adiciona colunas — **reduz** TD-03. **Remanescentes** (seguem abertos): `comment`/`recommendation` (M3), `service_role`/Data API (dormência C-2), Storage por papel (M2), DELETE de review/book na UI (`admin-reviews`). A matriz de RLS de `book` herda a limitação **local-only** de teste (TD-02) — rodar `RUN_RLS_INTEGRATION=1` antes de cada `db push` que toque policies; **gatilho de CI** (pré-2º-editor) já registrado.

## §12. STOP — aplicação da 0009
A **0009 NÃO é aplicada nesta fase nem automaticamente no Execute.** `supabase db push` (local **e** produção) é passo humano com checklist, **pós-merge**, verificando `pg_policies` (padrão A-11 do M2). Ordem: migrations locais → testes de RLS/atomicidade (§9/TD-02 local) → merge → `db push` produção (STOP) → verificação no ar. A 0009 é segura de aplicar antes do merge (só adiciona privilégio a `authenticated` + colunas nullable/default), mas segue o fluxo de revisão.

---

## §13. Auditoria — decisões questionadas, gaps e cortes de prazo

> **REVISÃO CONCLUÍDA — Design APROVADO com emendas (2026-08-09).** Os quatro pontos que pediam confirmação foram resolvidos: **A-1** confirmado *com emenda* (o schema passa a ser derivado do status validado, não do botão — §5.2); **A-3** resolvido por *verificação empírica* em produção (normalização editorial explícita por slug — §2.2); **A-7** **confirmado como está**, sem emenda (a exibição pública cabe em `reviews-crud`); **A-8** confirmado *com esclarecimento* de prosa (`published_at` = primeira publicação — §5.4). Somou-se um **corte de escopo por prazo** (bloco ao final desta seção). Nenhum BLOCKER para a fase Tasks.

- **A-1 · CONFIRMADO com emenda (2026-08-09) — gate de publicação é do app, não da RLS.** REV-16 ("todos os campos antes de publicar") é enforçado no server action (Zod publish), porque RLS pura não distingue transição de status (mesma limitação do M2, A-4). **Emenda aplicada (§5.2):** o schema de validação é escolhido pelo **status validado como enum**, não pelo botão clicado — antes o design dizia apenas que "os dois botões disparam o schema certo", o que deixava `FormData` forjada com `status=published` publicar incompleto **pelo caminho normal do app**. Com a emenda, esse furo fecha e o residual encolhe para **API direta apenas** (editor autenticado chamando PostgREST fora do server action) — **aceito** para editores internos; `trigger` de guarda de transição segue como alternativa não justificada no MVP.
- **A-2 · Consequência — `book` INSERT liberado a qualquer editor ativo.** É a única forma coerente (não há posse a checar antes da review existir). Books órfãos são possíveis via API direta, mas **inócuos** (invisíveis; book já é leitura pública). Limpeza de órfãos = follow-up (`admin-reviews`). **Aceito** (registrado T-1).
- **A-3 · RESOLVIDO (2026-08-09) — normalização de nota legada.** Verificação empírica em produção: **`dom-casmurro` = 4,5 e `iracema` = 4,5**; as outras duas resenhas já são inteiras (4,0 e 5,0). A 0009 normaliza por **UPDATE editorial explícito por slug** — `dom-casmurro`→**5**, `iracema`→**4** —, valores que são **escolha editorial do autor**, não resultado de arredondamento. **`round()` foi rejeitado como estratégia:** sobre `numeric` o Postgres arredonda meio para longe do zero, logo as duas virariam 5 e **3 das 4 resenhas** ficariam com nota 5, achatando a listagem e inutilizando a ordenação "Melhor nota". O `round()` permanece em §2.2 apenas como **rede residual** idempotente (não casa com nada após os dois UPDATEs), cobrindo linha nova que surja entre a verificação e o `db push`. **Sem pendência de decisão.**
- **A-4 · Materializado — XSS por URL.** `further_reading`/`cover_url` aceitam URL do editor; sem filtro, `javascript:`/`data:` viram vetor ao renderizar `<a>`/`<img>`. Mitigado por Zod (`http/https`) **e** filtro no render público (§7). Tratar como requisito de implementação (teste próprio).
- **A-5 · Sutileza de RLS — unicidade de slug, com oráculo nomeado.** Editor não vê drafts alheios; sem o helper definer, a checagem de slug seria cega e cairia no UNIQUE com erro cru. `unique_review_slug` (definer) resolve; o índice UNIQUE é o backstop. **Residual explícito (T-5):** por ler todos os slugs, a função é um **pequeno oráculo** — o sufixo `-2` denuncia a existência de um draft alheio com aquele slug. É existência, não conteúdo; **aceito e registrado** — a formulação anterior ("slug não é dado sensível") escondia o vazamento em vez de nomeá-lo.
- **A-6 · Divergência de DoD — o form exige JS.** As listas dinâmicas (tags, links) não têm caminho no-JS razoável. Decidi que o **painel interno assume JS** (DD-12), preservando o no-JS das páginas **públicas**. Se você exigir no-JS também no admin, o escopo de tags/links muda (campos estáticos) — **sinalizo**, recomendo manter JS no painel.
- **A-7 · Escopo — a review-page pública é estendida aqui.** Renderizar `reviewer_name`/`highlight_quote`/`further_reading`/tags é **necessário** para os campos novos serem visíveis (REV-11/12 dizem "exibida"). Alternativa: adiar a exibição para uma feature de `review-page v2` — mas aí o cadastro grava campos invisíveis. Incluí a exibição mínima. **Confirmar** que isso cabe em `reviews-crud`.
- **A-8 · CONFIRMADO com esclarecimento (2026-08-09) — `published_at` no unpublish.** Mantenho `published_at` ao despublicar. Semântica correta, agora explícita no §5.4: é o **carimbo da PRIMEIRA publicação**, não da última — o `coalesce(published_at, now())` só preenche quando está nulo, então **republicar não reescreve** e a resenha **não sobe para o topo de "Mais recentes"** ao sair e voltar do rascunho. (A redação anterior dizia "carimbo da última publicação", contradizendo o próprio `coalesce`; era erro de prosa, não de código.) Alternativa descartada: zerar no unpublish — perderia o histórico e faria a ordenação pular.
- **A-9 · VERIFICAR no Execute — `.rpc()` INVOKER + `auth.uid()` + transação.** O modelo inteiro de atomicidade depende de o PostgREST rodar `.rpc()` sob o JWT `authenticated`, propagar `auth.uid()` dentro da função INVOKER e envolver tudo numa transação. É o comportamento documentado, mas **não fabricar** — provar com teste de integração local (matriz de rollback) antes de confiar.
- **A-10 · Corte de prazo — corpo é texto puro.** Sem editor rich-text/WYSIWYG; o corpo é `textarea` e a review-page já quebra parágrafos por linha em branco ([page.tsx:12](../../../src/app/resenha/[slug]/page.tsx#L12)). "Sobre o autor" fica embutido no corpo (travado). Rich text = follow-up.
- **Cortes de prazo sinalizados:** (1) **render da imagem de capa** (guarda `cover_url` texto; `<img>` adiado — DD-15); (2) **filtro por tag** na home (TAGS=c); (3) **rich text** do corpo (A-10); (4) **provisionar editor na UI / admin-on-behalf** (fora). Todos preservados como Deferred Ideas — nenhum bloqueia o cadastro funcional do MVP de agosto.

### Corte de escopo por prazo (2026-08-09) — DECISÕES, não omissões

**Princípio: a 0009 permanece ÍNTEGRA.** Todas as colunas, o CHECK da nota, os GRANTs, as policies de `book`, **ambos** os RPCs e o helper de slug entram na migration exatamente como desenhados acima. Coluna aditiva é barata; componente de UI é caro. O corte incide **só na superfície visível** — assim o schema não fica pela metade e **não existe uma 0010 depois** para completar o que faltou.

| Cortado do Execute | O que sai | O que permanece |
| --- | --- | --- |
| **`further_reading`** | Fora da UI **e** da exibição pública. **`RepeatableLinks` NÃO será construído** — é o componente mais caro do design (lista dinâmica, foco gerido na remoção, Zod por item, filtro XSS no render, `<nav>` público). | Coluna `jsonb` + CHECK `is_array` na 0009. O campo volta em feature futura **sem tocar o schema**. |
| **`tags` / `keywords`** | Deixam de ser **chips dinâmicos** (estado no browser, Enter/vírgula, remoção com foco gerido). | **Um input de texto separado por vírgula**, convertido para `text[]` no server action. Mesmo dado no banco, **zero estado no cliente**. |
| **`update_review_with_book` + rota `/admin/resenhas/[id]/editar`** | **Fora do Execute.** Edição de conteúdo é follow-up. | O RPC **e** as policies de UPDATE de `book` ficam na 0009 — apenas **não são exercidos** por esta feature. |

**MANTIDO integralmente:** `reviewer_name` (denormalizado e congelado), `highlight_quote`, `publication_city`, **nota inteira** (`RatingInput` radiogroup + CHECK), **publish/unpublish**, e a **exibição pública** dos campos mantidos (§7).

**CONSEQUÊNCIA A REGISTRAR — a defesa de XSS por URL perde um exercitador.** Com `further_reading` fora da UI, o filtro `http/https` passa a ser exercido **apenas por `cover_url`**. **Manter o filtro mesmo assim**, no Zod **e** no render público: a coluna continua existindo e gravável por RPC/API, e a feature futura que a trouxer de volta encontra a defesa já montada em vez de ter de redescobri-la. Ver T-2 (§11) e A-4.

---

**Próxima fase:** Tasks — **não iniciada**. Design **APROVADO com emendas em 2026-08-09** (A-1/A-3/A-7/A-8 resolvidos + corte de escopo por prazo, §13); o Tasks parte deste documento já emendado, com o escopo do Execute **já reduzido** (sem `RepeatableLinks`, sem chips dinâmicos, sem `update_review_with_book`/rota de edição).
