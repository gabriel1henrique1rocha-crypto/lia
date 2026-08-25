-- 0011_reviews_crud_rpcs.sql
-- RPCs de submissão ATÔMICA livro+resenha (T2 do M3 `reviews-crud`) + helper de
-- slug único. Migration ADITIVA e idempotente (`create or replace`).
--
-- Vai em arquivo NOVO porque a 0009 e a 0010 JÁ ESTÃO APLICADAS EM PRODUÇÃO —
-- migration aplicada não se reescreve. O design (§3/§4) desenhava estas funções
-- dentro da 0009; o cronograma real as trouxe depois, e o arquivo próprio é a
-- consequência correta disso, não um desvio.
--
-- STOP A-11: `db push` de produção é passo HUMANO pós-merge.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE `SECURITY INVOKER` NOS DOIS RPCs — E NÃO `DEFINER`
--
-- INVOKER faz a função rodar COMO O EDITOR CHAMADOR. Consequências, todas
-- desejadas:
--   · cada INSERT/UPDATE é avaliado pelas policies já provadas —
--     `book_editor_insert`/`book_editor_update` (0009) e
--     `review_editor_insert`/`review_editor_update` (0008);
--   · `auth.uid()` dentro da função resolve o editor autenticado, não o dono
--     da função;
--   · A RLS CONTINUA SENDO O PORTÃO (D-09). A função não decide quem pode o quê.
--
-- `DEFINER` faria o oposto: rodaria como `postgres`, bypassaria a RLS inteira e
-- obrigaria a reimplementar posse/papel DENTRO do corpo — movendo a autorização
-- do banco para código imperativo, exatamente o que o M2 rejeitou. Um bug no
-- corpo viraria escalonamento de privilégio; sob INVOKER, vira "0 linhas".
--
-- ENCAIXE COM `owns_book_via_review` (definer, 0009): a posse do `book` é
-- TRANSITIVA — o editor é dono do book porque é dono da `review` 1—1 daquele
-- book. Quem faz essa travessia é a policy `book_editor_update`, que chama
-- `public.owns_book_via_review(id)`. Aquele helper É definer, e precisa ser: sem
-- ele, o subselect em `public.review` seria avaliado SOB A RLS DE `review`, e
-- uma linha invisível ao editor devolveria "não é seu" por INVISIBILIDADE, não
-- por posse — o erro de oráculo que a Lesson Learned do M2 registrou.
--
-- Ou seja: o RPC é INVOKER e DELEGA a decisão à policy; a policy usa um definer
-- MÍNIMO e ISOLADO só para enxergar a verdade da tabela. As duas coisas são
-- compatíveis, e o contrato anti-recursão documentado no cabeçalho da 0009 segue
-- respeitado — nenhuma função nova aqui lê a tabela que a protege.
--
-- `search_path = ''` (STRING VAZIA) em todas as funções deste arquivo, casando
-- com o hardening da 0007/0009: nada resolve sem qualificação explícita, então
-- um schema malicioso no path não consegue sombrear objeto nenhum. Por isso TODA
-- referência aqui é qualificada — `public.review`, `public.book`, `public.editor`,
-- `public.unique_review_slug`, `pg_catalog.now()`. `auth.uid()` já traz o schema.
--
-- EXCEÇÃO: `coalesce`, `nullif` e `case` NÃO são qualificados — não podem ser.
-- São CONSTRUÇÕES da linguagem SQL, resolvidas pelo parser, não funções de
-- schema; `pg_catalog.coalesce(...)` é erro de sintaxe. Isso não abre brecha:
-- justamente por serem do parser, não passam por resolução de nome e são
-- IMUNES a shadowing por schema no `search_path`.
--
-- GRANT EXECUTE explícito a `authenticated`, NUNCA a `anon`: pós-2026-05-30 o
-- Supabase não auto-concede (TD-03), e o `revoke ... from public` ANTES do grant
-- evita que o default de EXECUTE a PUBLIC deixe a função aberta. Mesmo padrão
-- das funções da 0007/0009.
--
-- NOTA DE ESCOPO: a assinatura de `book` aqui cobre os campos do formulário do
-- M3 (design §6.3) — title, author, genre_id, publisher, isbn, cover_url, year,
-- publication_city. As colunas `pages`, `original_language`, `translator` e
-- `translated_from` existem na tabela desde a 0001 mas NÃO entram nestes RPCs
-- porque não há campo para elas no formulário. Não é esquecimento: assinatura de
-- função é contrato — muda quando a UI mudar, não antes.
--
-- SEM parâmetro de nota: D-11 removeu a nota do produto e a 0010 dropou a coluna.
-- ─────────────────────────────────────────────────────────────────────────────


-- 1) Helper de slug único ------------------------------------------------------
--
-- POR QUE DEFINER (e por que isso é seguro): a unicidade de slug precisa
-- enxergar TODOS os slugs, inclusive rascunhos de outros editores, que a RLS de
-- `review` esconde do chamador. Sob INVOKER a checagem não veria a colisão, o
-- INSERT bateria no índice UNIQUE e a transação abortaria com erro cru. O
-- definer aqui é MÍNIMO e ISOLADO: recebe texto, devolve texto, não expõe linha
-- nenhuma. O residual conhecido e aceito (design §4.1) é que um sufixo `-2`
-- revela que ALGUMA resenha já usa aquele slug — inclusive rascunho alheio.
-- Slug deriva de título público; o vazamento é de existência, não de conteúdo.
--
-- ESTRATÉGIA: sufixo numérico incremental a partir de `-2`
-- (`dom-casmurro`, `dom-casmurro-2`, `dom-casmurro-3`, …). Escolhida sobre as
-- alternativas por ser a única que produz URL LEGÍVEL e REPRODUZÍVEL:
--   · sufixo aleatório/hash (`dom-casmurro-a7f3`) — mata a legibilidade e não é
--     dedutível a partir do título;
--   · timestamp — idem, e ainda vaza horário de criação na URL;
--   · id na URL — mata o SEO do slug, que é o motivo de existir slug.
--
-- CONCORRÊNCIA — LEIA ANTES DE CONFIAR:
-- o laço `select ... where slug = ?` sozinho NÃO é seguro sob concorrência: dois
-- editores submetendo o mesmo título no mesmo instante leriam ambos "livre" e o
-- segundo INSERT levaria 23505. Por isso a função toma um LOCK CONSULTIVO DE
-- TRANSAÇÃO na base do slug ANTES de procurar: a segunda transação espera a
-- primeira terminar e só então procura — já enxergando o slug recém-criado, e
-- devolvendo `-2`. O lock é liberado no commit OU no rollback, automaticamente.
--
-- LIMITE HONESTO DESSA GARANTIA: ela vale sob READ COMMITTED, o nível padrão do
-- PostgREST — a busca roda depois do lock e enxerga o que a outra transação
-- commitou. Sob REPEATABLE READ ou SERIALIZABLE o snapshot é anterior ao lock, a
-- segunda transação NÃO veria a linha nova, e a corrida voltaria a terminar em
-- 23505. Não é hipótese de laboratório: basta alguém trocar o nível de
-- isolamento da conexão. Por isso o índice UNIQUE `review_slug_key` permanece
-- como BACKSTOP FINAL e a action traduz 23505 em "tente novamente" (design §9).
-- O lock reduz drasticamente a janela de corrida; não a abole.
--
-- VOLATILIDADE: `volatile`, NÃO `stable` como o design ilustrava. `stable`
-- promete ao planner que a função não tem efeito colateral e pode ser dobrada
-- dentro de um statement; tomar um lock É efeito colateral. Marcar `stable` aqui
-- seria mentir para o planner por estética de assinatura.
create or replace function public.unique_review_slug(p_base text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_n    int := 1;
begin
  -- Base vazia/nula não pode virar slug '' (o UNIQUE aceitaria UMA linha assim e
  -- a URL pública ficaria `/resenha/`). Fallback determinístico.
  v_base := nullif(pg_catalog.btrim(coalesce(p_base, '')), '');
  if v_base is null then
    v_base := 'resenha';
  end if;

  -- Serializa a geração POR BASE. `hashtextextended` reduz a base a um bigint;
  -- colisão de hash apenas serializa dois bases distintos sem necessidade —
  -- custo desprezível, nunca incorreção.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_base, 0));

  v_slug := v_base;
  while exists (select 1 from public.review r where r.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  return v_slug;
end $$;

revoke all on function public.unique_review_slug(text) from public;
grant execute on function public.unique_review_slug(text) to authenticated;


-- 2) create_review_with_book ---------------------------------------------------
--
-- Uma chamada `.rpc()` = uma transação PostgREST = atomicidade real. Se o INSERT
-- de `review` falhar por QUALQUER motivo — policy, CHECK, UNIQUE de `book_id`,
-- UNIQUE de `slug` — a transação inteira faz rollback e o `book` recém-inserido
-- NÃO persiste. É a garantia dura do REV-04: sem livro órfão. A alternativa
-- rejeitada era inserir em dois passos e compensar com DELETE — a compensação
-- também pode falhar, deixando exatamente o órfão que se queria evitar.
--
-- `editor_id` é SEMPRE `auth.uid()` e NÃO É PARÂMETRO: não existe forma de um
-- editor criar resenha em nome de outro por esta função. Mesmo que existisse, a
-- policy `review_editor_insert` exige `editor_id = auth.uid()` para quem não é
-- admin — estrutura e RLS dizem a mesma coisa, em camadas independentes.
--
-- `reviewer_name` é DENORMALIZADO e CONGELADO (DD-6): lido de `public.editor`
-- pela self-read da 0007 e gravado na linha. NÃO se deriva de `editor.name` na
-- leitura pública — a página pública é lida por `anon`, que não tem nem GRANT
-- nem policy em `editor`, e fazer join ali obrigaria a abrir a tabela mais
-- sensível da fundação. O congelamento é INTENCIONAL: trocar o nome do editor
-- depois não reescreve resenhas antigas, porque o campo é "quem assinou ESTA
-- resenha". Não "corrigir" isso achando que é bug.
--
-- `published_at` no create recebe `now()` quando nasce publicada e `null` quando
-- nasce rascunho. Não há valor anterior a preservar aqui — o `coalesce` que
-- protege a PRIMEIRA publicação vive no update, onde existe valor anterior.
create or replace function public.create_review_with_book(
  p_book_title       text,
  p_author           text,
  p_genre_id         uuid,
  p_publisher        text,
  p_isbn             text,
  p_cover_url        text,
  p_year             smallint,
  p_publication_city text,
  p_review_title     text,
  p_body             text,
  p_tags             text[],
  p_keywords         text[],
  p_highlight_quote  text,
  p_further_reading  jsonb,
  p_status           public.review_status,
  p_slug_base        text
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
  -- Nome do resenhista: self-read (`editor_self_read`, 0007). Se o chamador não
  -- tiver linha em `editor`, v_name fica null e o INSERT de review abaixo será
  -- negado pela policy (que exige editor ativo) — a falha acontece no lugar certo.
  select e.name into v_name
  from public.editor e
  where e.id = auth.uid();

  insert into public.book
    (title, author, genre_id, publisher, isbn, cover_url, year, publication_city)
  values
    (p_book_title, p_author, p_genre_id, p_publisher,
     p_isbn, p_cover_url, p_year, p_publication_city)
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
  text, text, text[], text[], text, jsonb, public.review_status, text
) from public;
grant execute on function public.create_review_with_book(
  text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, text
) to authenticated;


-- 3) update_review_with_book ---------------------------------------------------
--
-- CRIADA E PROVISIONADA, MAS NÃO EXERCIDA nesta milestone: REV-19 (editar
-- resenha) está DIFERIDO e a rota `/admin/resenhas/[id]/editar` não existe
-- (design §13). Entra completa mesmo assim para que o schema não fique pela
-- metade e a feature de edição não precise de outra migration.
--
-- O QUE ESTA FUNÇÃO NÃO TOCA, POR DESIGN:
--   · `slug` — ESTÁVEL no edit (REV-23). Trocar o título NÃO muda a URL: link
--     público e SEO não quebram. É decisão, não omissão.
--   · `reviewer_name` — CONGELADO (DD-6). Admin editando resenha alheia NÃO
--     vira o resenhista.
--   · `editor_id` — a posse não se transfere por edição.
--
-- `published_at` com COALESCE nos DOIS ramos: publicar preserva o carimbo da
-- PRIMEIRA publicação (`coalesce(published_at, now())` — republicar não
-- reescreve, senão a resenha saltaria para o topo de "Mais recentes" a cada
-- edição, A-8); despublicar TAMBÉM preserva, para que republicar depois recupere
-- a data original em vez de inventar uma nova. Em nenhum caminho o campo volta
-- a null.
--
-- 0 LINHAS AFETADAS VIRA ERRO, NÃO SUCESSO SILENCIOSO. Sob RLS, um UPDATE que
-- não casa nenhuma linha NÃO levanta exceção — simplesmente não faz nada. Se a
-- função retornasse normalmente, o chamador não distinguiria "editei" de "não
-- era meu". Levantamos 42501 (`insufficient_privilege`), o MESMO código que a
-- RLS usa, para a action já mapeá-lo na mensagem amigável existente (design §9).
-- O mesmo 42501 cobre "não existe" e "não é seu" DE PROPÓSITO: distinguir os
-- dois vazaria a existência de rascunho alheio.
create or replace function public.update_review_with_book(
  p_review_id        uuid,
  p_book_title       text,
  p_author           text,
  p_genre_id         uuid,
  p_publisher        text,
  p_isbn             text,
  p_cover_url        text,
  p_year             smallint,
  p_publication_city text,
  p_review_title     text,
  p_body             text,
  p_tags             text[],
  p_keywords         text[],
  p_highlight_quote  text,
  p_further_reading  jsonb,
  p_status           public.review_status
)
returns public.review
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_book_id uuid;
  v_review  public.review;
begin
  -- Sob RLS o editor enxerga as próprias resenhas (own) e as publicadas. Poder
  -- LER o book_id de uma resenha publicada alheia é inofensivo: os dois UPDATEs
  -- abaixo continuam gated por policy e devolvem 0 linhas, virando 42501.
  select r.book_id into v_book_id
  from public.review r
  where r.id = p_review_id;

  if v_book_id is null then
    raise exception 'Resenha inexistente ou fora do seu alcance.'
      using errcode = '42501';
  end if;

  update public.book b set
    title            = p_book_title,
    author           = p_author,
    genre_id         = p_genre_id,
    publisher        = p_publisher,
    isbn             = p_isbn,
    cover_url        = p_cover_url,
    year             = p_year,
    publication_city = p_publication_city
  where b.id = v_book_id;

  if not found then
    raise exception 'Sem permissão para editar a ficha deste livro.'
      using errcode = '42501';
  end if;

  update public.review r set
    title           = p_review_title,
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
  text, text, text[], text[], text, jsonb, public.review_status
) from public;
grant execute on function public.update_review_with_book(
  uuid, text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status
) to authenticated;
