-- 0012_review_edit_rpcs.sql
-- REV-19 (`review-edit`, T1): recria `update_review_with_book` para EXERCER o
-- que a 0011 só provisionou, com as três propostas aprovadas do Specify —
-- P-1 (concorrência otimista), P-2 (slug editável em rascunho nunca publicado)
-- e P-3 (ficha técnica completa: páginas/idioma original/tradução). Migration
-- ADITIVA e idempotente (`drop function` + `create` reexecuta sem erro). NÃO
-- aplicar em produção aqui (STOP A-11: `db push` é passo humano, e nesta
-- feature ele vem ANTES do merge — ver nota de ORDEM DE DEPLOY no fim deste
-- cabeçalho, não depois como nas migrations anteriores).
--
-- `create_review_with_book` também é recriada, só para ACRESCENTAR os quatro
-- parâmetros de P-3 no fim com `default null` — corpo e comportamento
-- inalterados fora disso. `unique_review_slug` NÃO é tocada.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE `DROP FUNCTION` EXPLÍCITO, E NÃO SÓ `CREATE OR REPLACE`
--
-- `CREATE OR REPLACE` só substitui quando a lista de PARÂMETROS não muda nem em
-- quantidade nem em tipo — é a mesma função com corpo novo. Aqui a lista MUDA
-- (5 parâmetros novos em `update_review_with_book`; 4 em `create_review_with_book`),
-- então `CREATE OR REPLACE` criaria uma SOBRECARGA (overload) nova ao lado da
-- antiga, não uma substituição. Duas funções `update_review_with_book` coexistindo
-- com listas de parâmetros diferentes tornam uma chamada por nome ambígua para o
-- PostgREST assim que os parâmetros informados casarem com mais de uma — e o erro
-- que o Postgres devolve (`function ... is not unique`) não é algo que a action
-- (T4) sabe traduzir. O `DROP` explícito, com a assinatura ANTIGA completa,
-- elimina essa sobrecarga antes do `CREATE` da assinatura nova.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE OS PARÂMETROS NOVOS VÃO NO FIM, COM `default null` (EXCETO
-- `p_expected_updated_at`, que não pode ter default)
--
-- O PostgREST do Supabase resolve `.rpc()` por NOME de parâmetro, não por
-- posição — então a posição em si não quebraria nada. O motivo real é a JANELA
-- DE DEPLOY: entre o `db push` (que troca a função no banco) e o deploy do
-- código novo (que passa a enviar os campos novos), a `Vercel` ainda está
-- servindo a action ANTIGA, que só conhece os 16 nomes de sempre. Parâmetros
-- novos com `default null` deixam a chamada antiga continuar resolvendo sem
-- alteração nenhuma — o Postgres preenche o que faltar com o default. Se os
-- campos novos fossem obrigatórios (sem default), a mesma chamada antiga
-- quebraria em produção nessa janela com "function does not exist" (PostgREST
-- não acha overload que bata).
--
-- `p_expected_updated_at` é a ÚNICA exceção deliberada — ver a nota de P-1
-- abaixo sobre por que ele não pode ter default e por que isso não reabre o
-- problema da janela: a action antiga não vai chamar a assinatura NOVA de jeito
-- nenhum (ela só conhece 16 nomes), então o parâmetro obrigatório nunca aparece
-- nessa janela — ele só entra em jogo quando o código NOVO (que já sabe enviá-lo)
-- também já estiver no ar.
--
-- Regra do Postgres que a ORDEM abaixo respeita: parâmetros com `default` têm
-- de ser um SUFIXO contíguo da lista — não dá para ter um parâmetro SEM default
-- depois de um COM default. Por isso `p_expected_updated_at` (sem default) vem
-- logo depois dos 16 originais (também sem default), e só então começam os
-- cinco com `default null` (`p_slug_base`, `p_pages`, `p_original_language`,
-- `p_translator`, `p_translated_from`).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- P-1 — CONCORRÊNCIA OTIMISTA: POR QUE `for update` NA LEITURA, NÃO SÓ UM IF
--
-- A checagem SOZINHA ("li X, comparei com o que o cliente mandou, seguem
-- iguais, prossigo") é um clássico check-then-act: sob concorrência,
-- DUAS transações podem fazer a leitura ANTES de qualquer uma commitar, as duas
-- leem o MESMO `updated_at` antigo, as duas passam na comparação, e a segunda a
-- COMMITAR sobrescreve o trabalho da primeira sem erro nenhum — exatamente o
-- cenário que P-1 existe para evitar, só que reintroduzido um degrau abaixo.
--
-- `select ... for update` fecha essa brecha: a PRIMEIRA transação a chegar toma
-- um LOCK DE LINHA; a SEGUNDA, tentando o mesmo `select ... for update` na
-- MESMA linha, BLOQUEIA até a primeira commitar ou dar rollback. Quando a
-- segunda finalmente lê, o trigger `review_set_updated_at` (T0 confirmou:
-- incondicional, `BEFORE UPDATE`) já girou `updated_at` para o valor pós-commit
-- da primeira — então a segunda vê um `updated_at` DIFERENTE do que seu cliente
-- tinha em mãos, e a comparação abaixo corretamente devolve conflito. O lock
-- SERIALIZA a checagem entre concorrentes da MESMA linha; não afeta linhas
-- diferentes, então não é um lock de tabela disfarçado.
--
-- `errcode = '40001'` (serialization_failure) e NÃO `42501`
-- (insufficient_privilege): são erros de NATUREZA diferente e a action (T4)
-- precisa reagir diferente — `42501` vira "você não pode editar isto" (fechar a
-- tela, não adianta tentar de novo); `40001` vira "outra pessoa mexeu nisto
-- enquanto você editava — recarregue" (o CONTEÚDO DIGITADO fica preservado na
-- tela, só o carimbo de versão é que precisa atualizar antes de tentar de novo).
-- Reusar `42501` para os dois casos obrigaria a action a adivinhar qual
-- mensagem mostrar, ou mostrar a errada.
--
-- `p_expected_updated_at` só é comparado DEPOIS da checagem de existência (passo
-- 2) — não faz sentido perguntar "mudou desde que você abriu?" de uma linha que
-- não existe ou que você nunca deveria ter visto; `42501` sai primeiro, sempre.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- P-2 — SLUG EDITÁVEL SÓ EM RASCUNHO NUNCA PUBLICADO
--
-- A checagem usa `v_published_at is null` (o valor JÁ GRAVADO no banco, lido no
-- passo 1), NÃO `p_status = 'draft'` nem o status ATUAL da linha. A diferença
-- importa: uma resenha que já foi publicada e depois DESPUBLICADA continua com
-- `status = 'draft'` mas `published_at` PERMANECE preenchido (é o mesmo
-- `coalesce` que impede a data de sumir, já documentado na 0011 — DR-4/A-8). Se
-- a checagem usasse o status, essa resenha teria o slug reaberto para edição
-- mesmo já tendo tido URL pública — exatamente o que REV-23 existe para
-- impedir. `published_at IS NULL` é o único marcador que responde "esta URL já
-- circulou alguma vez?", não "está publicada agora?".
--
-- GUARDA `p_slug_base <> v_current_slug`: sem ela, salvar um rascunho SEM MUDAR
-- o título (ação mais comum de todas — corrigir o corpo, ajustar uma tag) faria
-- `unique_review_slug` receber a MESMA base de sempre, encontrar a PRÓPRIA
-- linha ocupando aquele slug (a linha ainda não foi atualizada nesta transação)
-- e devolver um sufixo `-2` gratuito a cada save. A guarda faz o caminho comum
-- (nada mudou) custar zero.
--
-- RESIDUAL ACEITO, NÃO CORRIGIDO: resenha com slug atual `x-2` (motivo:
-- colidiu com um `x` de outra resenha no passado) tem o título editado outra
-- vez para uma base que também gera `x`, e `x` segue ocupado por aquela outra
-- resenha → resultado é `x-3`, não `x-2` de novo. Acontece porque
-- `unique_review_slug` enumera a partir da base pura sempre, sem lembrar que
-- ESTA linha já usou um sufixo antes. Sem efeito em produção: o caso só ocorre
-- em rascunho nunca publicado (P-2 restringe a isso), então não há URL pública
-- pulando de sufixo.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- P-3 — FICHA TÉCNICA COMPLETA
--
-- T0 confirmou em produção: `pages integer`, `original_language text`,
-- `translator text`, `translated_from text` — as quatro NULÁVEIS, sem default.
-- Nenhuma validação nova entra NO CORPO da função: os CHECKs de tabela
-- (`book_pages_positive`: pages null ou > 0; `book_translation_consistent`:
-- translator null ou translated_from preenchido) já protegem no nível da
-- coluna, para QUALQUER caminho de escrita, e são preservados intocados por
-- esta migration — não recriados, porque já existem e não mudam. Repetir a
-- checagem aqui seria duplicar uma garantia que o banco já dá, na direção
-- errada (a app teria de ficar sincronizada com o banco, não o contrário).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRATO ANTI-RECURSÃO (0007/0009) — RE-DOCUMENTADO, NÃO REESCRITO
--
-- `update_review_with_book` continua `security invoker`: roda como o editor
-- chamador, e quem decide se o `UPDATE` de `book`/`review` é permitido são as
-- POLICIES já provadas — `book_editor_update` (0009) e `review_editor_update`
-- (0008) —, nunca um `if` dentro desta função. `book_editor_update` por sua vez
-- chama `public.owns_book_via_review(id)`, o definer MÍNIMO e ISOLADO da 0009:
-- ele existe porque um subselect direto em `public.review`, se rodasse sob a
-- RLS de `review`, confundiria "não vejo essa review" (invisibilidade) com "não
-- é minha" (posse) — o mesmo erro de oráculo que a Lesson Learned do M2
-- registrou. Nada nesta migration toca `owns_book_via_review`,
-- `book_editor_update` nem `review_editor_update`: eles já cobrem o caso de
-- UPDATE corretamente, e o NO FORCE ROW LEVEL SECURITY de que o definer depende
-- (declarado na 0009) segue como estava.
--
-- `search_path = ''` (string vazia) nas duas funções: toda referência é
-- qualificada — `public.review`, `public.book`, `public.unique_review_slug`,
-- `pg_catalog.now()`. `coalesce`/`case`/`is distinct from` NÃO são qualificados
-- — são construções do parser SQL, não funções de schema, e por isso IMUNES a
-- shadowing (o mesmo raciocínio já registrado na 0011 para `coalesce`/`nullif`).
--
-- `revoke all ... from public` ANTES de `grant execute ... to authenticated`,
-- NUNCA a `anon` — mesmo padrão da 0007/0009/0011, necessário porque
-- pós-2026-05-30 o Supabase não auto-concede EXECUTE (TD-03).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE ESTA MIGRATION NÃO TOCA (herdado, sem mudança de comportamento)
--
--   · `reviewer_name` — CONGELADO (DD-6). Não entra no SET de `review`.
--   · `editor_id` — a posse não se transfere por edição. Não entra no SET.
--   · `published_at` — `coalesce` nos DOIS ramos, idêntico à 0011: publicar
--     preserva o carimbo da PRIMEIRA publicação; despublicar também preserva,
--     para republicar depois recuperar a data original em vez de inventar uma
--     nova (A-8). Em nenhum caminho o campo volta a `null`.
--   · `updated_at` — NÃO entra em SET nenhum, em nenhuma das duas funções. O
--     trigger `review_set_updated_at` (T0: confirmado incondicional em
--     produção) sobrescreve para `now()` em QUALQUER UPDATE bem-sucedido,
--     inclusive um que não o mencione. Escrevê-lo aqui seria redundante e
--     abriria a possibilidade de a função e o trigger divergirem por engano.
--   · `0 linhas afetadas` continua virando `42501`, não sucesso silencioso —
--     mesmo racional da 0011: sem isso o chamador não distingue "editei" de
--     "não era meu", e RLS que nega um UPDATE não levanta exceção sozinha.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ORDEM DE DEPLOY (diferente das migrations anteriores desta feature)
--
-- `db push` em produção ANTES do merge (STOP A-11 — ainda passo humano, só a
-- ORDEM muda). Motivo: o `DROP FUNCTION` abre uma janela em que
-- `update_review_with_book` não existe nenhuma; como ela nunca foi exercida por
-- código em produção até aqui (a rota de edição não existe — é esta feature que
-- a cria), a janela é inofensiva HOJE. Mas se o código novo (T3/T4, que chamam
-- a assinatura NOVA) fosse ao ar ANTES do `db push`, ele chamaria uma função
-- que ainda não existe no banco — daí a ordem inversa desta vez.
-- ─────────────────────────────────────────────────────────────────────────────


-- 1) DROP das assinaturas antigas -----------------------------------------------
drop function if exists public.create_review_with_book(
  text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, text);

drop function if exists public.update_review_with_book(
  uuid, text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status);


-- 2) create_review_with_book — só ACRESCENTA os 4 campos de P-3 no fim ----------
-- Corpo idêntico ao da 0011 fora do INSERT de `book`, que ganha as 4 colunas
-- novas. Nenhuma outra linha muda: `editor_id`/`reviewer_name`/atomicidade/
-- `published_at` no create seguem exatamente como documentado na 0011.
create or replace function public.create_review_with_book(
  p_book_title         text,
  p_author             text,
  p_genre_id           uuid,
  p_publisher          text,
  p_isbn               text,
  p_cover_url          text,
  p_year               smallint,
  p_publication_city   text,
  p_review_title       text,
  p_body               text,
  p_tags               text[],
  p_keywords           text[],
  p_highlight_quote    text,
  p_further_reading    jsonb,
  p_status             public.review_status,
  p_slug_base          text,
  p_pages              integer default null,
  p_original_language  text    default null,
  p_translator         text    default null,
  p_translated_from    text    default null
)
returns public.review
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_book_id uuid;
  v_name    text;
  v_slug    text;
  v_review  public.review;
begin
  select e.name into v_name
  from public.editor e
  where e.id = auth.uid();

  insert into public.book
    (title, author, genre_id, publisher, isbn, cover_url, year, publication_city,
     pages, original_language, translator, translated_from)
  values
    (p_book_title, p_author, p_genre_id, p_publisher,
     p_isbn, p_cover_url, p_year, p_publication_city,
     p_pages, p_original_language, p_translator, p_translated_from)
  returning id into v_book_id;

  v_slug := public.unique_review_slug(p_slug_base);

  insert into public.review
    (book_id, title, slug, body, status, editor_id, reviewer_name,
     tags, keywords, highlight_quote, further_reading, published_at)
  values
    (v_book_id, p_review_title, v_slug, p_body, p_status, auth.uid(), v_name,
     coalesce(p_tags, '{}'),
     coalesce(p_keywords, '{}'),
     p_highlight_quote,
     coalesce(p_further_reading, '[]'::jsonb),
     case when p_status = 'published' then pg_catalog.now() else null end)
  returning * into v_review;

  return v_review;
end $$;

revoke all on function public.create_review_with_book(
  text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, text,
  integer, text, text, text
) from public;
grant execute on function public.create_review_with_book(
  text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, text,
  integer, text, text, text
) to authenticated;


-- 3) update_review_with_book — reescrita completa (P-1 + P-2 + P-3) ------------
create or replace function public.update_review_with_book(
  p_review_id            uuid,
  p_book_title           text,
  p_author               text,
  p_genre_id             uuid,
  p_publisher            text,
  p_isbn                 text,
  p_cover_url            text,
  p_year                 smallint,
  p_publication_city     text,
  p_review_title         text,
  p_body                 text,
  p_tags                 text[],
  p_keywords             text[],
  p_highlight_quote      text,
  p_further_reading      jsonb,
  p_status               public.review_status,
  p_expected_updated_at  timestamptz,
  p_slug_base            text    default null,
  p_pages                integer default null,
  p_original_language    text    default null,
  p_translator           text    default null,
  p_translated_from      text    default null
)
returns public.review
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_book_id             uuid;
  v_current_updated_at  timestamptz;
  v_published_at        timestamptz;
  v_current_slug        text;
  v_slug                text;
  v_review              public.review;
begin
  -- Passo 1: lê o estado atual E TRAVA A LINHA (SECURITY INVOKER, sob RLS).
  --
  -- ACHADO EMPÍRICO (verificado no banco local antes de aplicar em produção):
  -- este `select ... for update` é MAIS restritivo do que um `select` simples
  -- teria sido. A nota da 0011 sobre "ler o book_id de uma resenha publicada
  -- alheia é inofensivo" valia para o SELECT sem lock que a função tinha até a
  -- 0011 — aqui NÃO é o caso. Sob `FOR UPDATE`/`FOR SHARE`, o Postgres exige
  -- que a linha passe TAMBÉM pelo `USING` de uma policy de UPDATE aplicável,
  -- não só pelo de uma policy de SELECT — um lock de escrita implica intenção
  -- de escrever. Provado: com Editor B autenticado, uma resenha PUBLICADA de
  -- Editor A é visível a um `select` comum (via `review_public_read`), mas o
  -- MESMO `select ... for update` devolve ZERO linhas para B, porque
  -- `review_editor_update` (own-or-admin) não o autoriza. B recebe 42501 já no
  -- passo 2 (linha inexistente/fora de alcance), nunca chega ao passo 5/6. É
  -- estritamente mais seguro que o desenho original supunha — não corrigido
  -- porque não havia nada errado, só documentado aqui para quem for alterar
  -- esta função não presumir o comportamento do SELECT simples da 0011.
  --
  -- `for update`: ver a nota de P-1 no cabeçalho — sem o lock, a checagem do
  -- passo 3 seria decorativa sob concorrência.
  select r.book_id, r.updated_at, r.published_at, r.slug
    into v_book_id, v_current_updated_at, v_published_at, v_current_slug
  from public.review r
  where r.id = p_review_id
  for update;

  -- Passo 2: existência/alcance vem ANTES de qualquer outra checagem — inclusive
  -- da de conflito (passo 3). Não faz sentido perguntar "mudou desde que você
  -- abriu?" de uma linha que não existe ou nunca deveria ter sido vista.
  if v_book_id is null then
    raise exception 'Resenha inexistente ou fora do seu alcance.'
      using errcode = '42501';
  end if;

  -- Passo 3: conflito de edição concorrente (P-1). `is distinct from` trata
  -- NULL corretamente, embora `p_expected_updated_at` não tenha default e a
  -- action sempre deva enviá-lo.
  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'Esta resenha foi alterada por outra pessoa desde que você abriu o formulário.'
      using errcode = '40001';
  end if;

  -- Passo 4: slug (P-2). Só regenera se (a) o chamador pediu uma base nova, (b)
  -- a resenha NUNCA foi publicada (published_at, não status — ver nota do
  -- cabeçalho) e (c) a base pedida realmente difere do slug atual (evita
  -- sufixo `-2` gratuito ao salvar sem mudar o título — a própria linha ainda
  -- ocupa `v_current_slug` nesta transação).
  if p_slug_base is not null
     and v_published_at is null
     and p_slug_base <> v_current_slug
  then
    v_slug := public.unique_review_slug(p_slug_base);
  else
    v_slug := null;
  end if;

  -- Passo 5: ficha do livro. `not found` só ocorre se `book_editor_update`
  -- negar (não é o dono, ou não é admin) — a posse é transitiva via
  -- `owns_book_via_review` (0009), não recalculada aqui.
  update public.book b set
    title              = p_book_title,
    author             = p_author,
    genre_id           = p_genre_id,
    publisher          = p_publisher,
    isbn               = p_isbn,
    cover_url          = p_cover_url,
    year               = p_year,
    publication_city   = p_publication_city,
    pages              = p_pages,
    original_language  = p_original_language,
    translator         = p_translator,
    translated_from    = p_translated_from
  where b.id = v_book_id;

  if not found then
    raise exception 'Sem permissão para editar a ficha deste livro.'
      using errcode = '42501';
  end if;

  -- Passo 6: a resenha. `slug` só muda quando o passo 4 calculou um novo (P-2);
  -- `reviewer_name`/`editor_id`/`updated_at` continuam de fora do SET (ver
  -- cabeçalho). `published_at` com o MESMO `coalesce` nos dois ramos da 0011.
  update public.review r set
    title           = p_review_title,
    slug            = coalesce(v_slug, r.slug),
    body            = p_body,
    status          = p_status,
    tags            = coalesce(p_tags, '{}'),
    keywords        = coalesce(p_keywords, '{}'),
    highlight_quote = p_highlight_quote,
    further_reading = coalesce(p_further_reading, '[]'::jsonb),
    published_at    = case
                        when p_status = 'published'
                          then coalesce(r.published_at, pg_catalog.now())
                        else r.published_at
                      end
  where r.id = p_review_id
  returning * into v_review;

  if not found then
    raise exception 'Sem permissão para editar esta resenha.'
      using errcode = '42501';
  end if;

  return v_review;
end $$;

revoke all on function public.update_review_with_book(
  uuid, text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, timestamptz,
  text, integer, text, text, text
) from public;
grant execute on function public.update_review_with_book(
  uuid, text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, timestamptz,
  text, integer, text, text, text
) to authenticated;
