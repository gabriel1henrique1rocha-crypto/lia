-- seed.sql — dados iniciais idempotentes (DD-4, DD-8).
-- Roda automaticamente no `supabase db reset` (config.toml → [db.seed]).
-- Para o banco linkado/remoto: `npm run db:seed`.
--
-- Tudo num único bloco DO (uma só instrução) para também funcionar via
-- `supabase db query --file`, que executa o arquivo como statement único.
-- UUIDs fixos + `on conflict (id) do nothing` → reexecução não duplica.
-- 4 clássicos de domínio público, todos originais em português, SEM ISBN
-- (obras pré-1970 não têm ISBN original — não inventar) e sem tradução.
-- Gêneros inseridos antes dos livros (FK genre_id é NOT NULL).
do $$
begin
  -- Gêneros
  insert into genre (id, name, slug) values
    ('11111111-1111-4111-8111-111111111111', 'Romance',     'romance'),
    ('22222222-2222-4222-8222-222222222222', 'Realismo',    'realismo'),
    ('33333333-3333-4333-8333-333333333333', 'Romantismo',  'romantismo'),
    ('44444444-4444-4444-8444-444444444444', 'Naturalismo', 'naturalismo')
  on conflict (id) do nothing;

  -- Livros (isbn nulo; original_language = 'pt'; sem tradução)
  insert into book (id, title, author, genre_id, year, original_language) values
    ('aaaaaaaa-0000-4000-8000-000000000001', 'Dom Casmurro',
       'Machado de Assis', '11111111-1111-4111-8111-111111111111', 1899, 'pt'),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'O Crime do Padre Amaro',
       'Eça de Queirós',   '22222222-2222-4222-8222-222222222222', 1875, 'pt'),  -- pt de Portugal
    ('aaaaaaaa-0000-4000-8000-000000000003', 'Iracema',
       'José de Alencar',  '33333333-3333-4333-8333-333333333333', 1865, 'pt'),
    ('aaaaaaaa-0000-4000-8000-000000000004', 'O Cortiço',
       'Aluísio Azevedo',  '44444444-4444-4444-8444-444444444444', 1890, 'pt'),
    -- 5º livro: só de teste (dá um book real para a resenha em rascunho de RVW-18).
    ('aaaaaaaa-0000-4000-8000-000000000005', 'Memórias Póstumas de Brás Cubas',
       'Machado de Assis', '22222222-2222-4222-8222-222222222222', 1881, 'pt')
  on conflict (id) do nothing;

  -- Resenhas (review 1—1 book). 4 publicadas + 1 rascunho no 5º livro.
  -- rating numeric(2,1) → só 1 casa decimal; editor_id omitido (nullable, sem
  -- editores no M1); body multi-parágrafo separado por linha em branco (\n\n),
  -- renderizado como <p> por parágrafo na página. slug único e legível.
  insert into review (id, book_id, title, slug, rating, body, status, published_at) values
    ('bbbbbbbb-0000-4000-8000-000000000001',
       'aaaaaaaa-0000-4000-8000-000000000001',
       'Dom Casmurro: o ciúme como narrador',
       'dom-casmurro', 4.5,
       E'Machado entrega em Bento Santiago um dos narradores mais insidiosos da literatura brasileira. A dúvida sobre Capitu não se resolve — e é justamente aí que mora a genialidade do romance.\n\nMais de um século depois, a pergunta "traiu ou não traiu?" continua dizendo mais sobre quem lê do que sobre a personagem. Uma obra que se relê a cada geração.',
       'published', now()),
    ('bbbbbbbb-0000-4000-8000-000000000002',
       'aaaaaaaa-0000-4000-8000-000000000002',
       'O Crime do Padre Amaro: fé e hipocrisia',
       'o-crime-do-padre-amaro', 4.0,
       E'Eça de Queirós disseca a moral provinciana com ironia afiada. O padre Amaro é menos vilão do que produto de uma instituição que sufoca o desejo e premia a aparência.\n\nO realismo português ganha aqui um de seus retratos mais corrosivos — e ainda estranhamente atual em sua crítica às fachadas respeitáveis.',
       'published', now()),
    ('bbbbbbbb-0000-4000-8000-000000000003',
       'aaaaaaaa-0000-4000-8000-000000000003',
       'Iracema: a lenda que funda um país',
       'iracema', 4.5,
       E'Alencar escreve em prosa poética o mito de origem do Ceará. Iracema, a virgem dos lábios de mel, encarna a natureza que se doa e se perde no encontro com o colonizador.\n\nO indianismo romântico mostra aqui sua face mais lírica — e também suas ambiguidades sobre conquista e pertencimento.',
       'published', now()),
    ('bbbbbbbb-0000-4000-8000-000000000004',
       'aaaaaaaa-0000-4000-8000-000000000004',
       'O Cortiço: o organismo da miséria',
       'o-cortico', 5.0,
       E'Aluísio Azevedo transforma o cortiço num personagem coletivo, um corpo que respira, transpira e se multiplica. O naturalismo brasileiro atinge aqui sua expressão máxima.\n\nEntre determinismo e denúncia social, a obra segue impressionando pela força com que descreve a vida amontoada e a lógica implacável do lucro.',
       'published', now()),
    -- Rascunho (RVW-18): existe no banco, mas o público NUNCA deve vê-lo.
    -- published_at nulo; status draft. Serve ao teste de RLS (T-31).
    ('bbbbbbbb-0000-4000-8000-000000000005',
       'aaaaaaaa-0000-4000-8000-000000000005',
       'Memórias Póstumas: rascunho',
       'memorias-postumas-rascunho', 4.5,
       E'Rascunho de teste — não publicado. Não deve aparecer na leitura pública.\n\nUsado para verificar que a policy de RLS filtra status=draft para o cliente anônimo.',
       'draft', null)
  on conflict (id) do nothing;
end $$;
