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
       'Aluísio Azevedo',  '44444444-4444-4444-8444-444444444444', 1890, 'pt')
  on conflict (id) do nothing;
end $$;
