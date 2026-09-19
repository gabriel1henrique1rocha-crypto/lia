\set ON_ERROR_STOP 0
\set QUIET 1
-- fixtures (superuser)
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001','a@x'),('bbbbbbbb-0000-0000-0000-000000000002','b@x'),('cccccccc-0000-0000-0000-000000000003','adm@x');
insert into public.editor(id,email,name,role) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x','Ana','editor'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@x','Bia','editor'),
 ('cccccccc-0000-0000-0000-000000000003','adm@x','Adm','admin');
insert into public.genre(name,slug) values ('Romance','romance');
update public.disability_term set active=false where slug='surdocegueira';
create temp table ids as select
 (select id from public.genre limit 1) g,
 (select id from public.disability_term where slug='deficiencia-fisica') fis,
 (select id from public.disability_term where slug='tea') tea,
 (select id from public.disability_term where slug='surdocegueira') inativo;
grant select on ids to anon, authenticated;

-- 1) Editor A cria resenha PUBLICADA com 2 deficiências
set role authenticated; set request.jwt.claim.sub='aaaaaaaa-0000-0000-0000-000000000001';
select 'A cria' t, (create_review_with_book(p_book_title=>'Livro A',p_author=>'X',p_genre_id=>(select g from ids),p_publisher=>null,p_isbn=>null,p_cover_url=>null,p_year=>null,p_publication_city=>null,p_review_title=>'Resenha A',p_body=>'corpo',p_tags=>'{}',p_keywords=>'{}',p_highlight_quote=>null,p_further_reading=>'[]',p_status=>'published',p_slug_base=>'resenha-a',p_disability_ids=>array[(select fis from ids),(select tea from ids),(select fis from ids)])).slug;
-- rascunho de A sem deficiência, chamada ANTIGA (sem o parâmetro)
select 'A rascunho antigo' t, (create_review_with_book(p_book_title=>'Livro A2',p_author=>'X',p_genre_id=>(select g from ids),p_publisher=>null,p_isbn=>null,p_cover_url=>null,p_year=>null,p_publication_city=>null,p_review_title=>'Rascunho A',p_body=>null,p_tags=>'{}',p_keywords=>'{}',p_highlight_quote=>null,p_further_reading=>'[]',p_status=>'draft',p_slug_base=>'rascunho-a')).slug;
reset role;
select 'ORACULO vinculos A (esperado 2)' t, count(*) from review_disability rd join review r on r.id=rd.review_id where r.slug='resenha-a';

-- 2) anon: vê vínculos da publicada, não vê termo inativo
set role anon; reset request.jwt.claim.sub;
select 'anon ve vinculos publicada (2)' t, count(*) from review_disability;
select 'anon ve termos ativos (7)' t, count(*) from disability_term;
reset role;
-- vincular rascunho a termo p/ testar que anon NÃO vê
insert into review_disability select r.id, (select tea from ids) from review r where r.slug='rascunho-a';
set role anon;
select 'anon NAO ve vinculo do rascunho (2)' t, count(*) from review_disability;
select 'anon insert (deve falhar)' t; insert into review_disability select id,(select fis from ids) from review where slug='resenha-a';
reset role;

-- 3) Editor B tenta mexer na de A
set role authenticated; set request.jwt.claim.sub='bbbbbbbb-0000-0000-0000-000000000002';
select 'B termos visiveis (7, sem inativo)' t, count(*) from disability_term;
select 'B delete vinculos de A' t; delete from review_disability where review_id=(select id from review where slug='resenha-a');
select 'B insert vinculo em A (deve falhar)' t; insert into review_disability select id,(select inativo from ids) from review where slug='resenha-a';
select 'B cria termo (deve falhar)' t; insert into disability_term(name,slug) values ('Hack','hack');
reset role;
select 'ORACULO vinculos A continuam 2' t, count(*) from review_disability rd join review r on r.id=rd.review_id where r.slug='resenha-a';
select 'ORACULO termo hack inexistente (0)' t, count(*) from disability_term where slug='hack';

-- 4) A edita: null mantém, {} limpa, id inválido reverte tudo
set role authenticated; set request.jwt.claim.sub='aaaaaaaa-0000-0000-0000-000000000001';
select 'A update null (mantem)' t, (update_review_with_book(p_review_id=>(select id from review where slug='resenha-a'),p_book_title=>'Livro A',p_author=>'X',p_genre_id=>(select g from ids),p_publisher=>null,p_isbn=>null,p_cover_url=>null,p_year=>null,p_publication_city=>null,p_review_title=>'Resenha A v2',p_body=>'corpo',p_tags=>'{}',p_keywords=>'{}',p_highlight_quote=>null,p_further_reading=>'[]',p_status=>'published',p_expected_updated_at=>(select updated_at from review where slug='resenha-a'))).title;
reset role; select 'ORACULO apos null (2)' t, count(*) from review_disability rd join review r on r.id=rd.review_id where r.slug='resenha-a';
set role authenticated; set request.jwt.claim.sub='aaaaaaaa-0000-0000-0000-000000000001';
select 'A update id invalido (deve falhar)' t; select update_review_with_book(p_review_id=>(select id from review where slug='resenha-a'),p_book_title=>'Livro MUDADO',p_author=>'X',p_genre_id=>(select g from ids),p_publisher=>null,p_isbn=>null,p_cover_url=>null,p_year=>null,p_publication_city=>null,p_review_title=>'Resenha A v3',p_body=>'corpo',p_tags=>'{}',p_keywords=>'{}',p_highlight_quote=>null,p_further_reading=>'[]',p_status=>'published',p_expected_updated_at=>(select updated_at from review where slug='resenha-a'),p_disability_ids=>array['00000000-0000-0000-0000-000000000000'::uuid]);
reset role; select 'ORACULO atomico: titulo v2, livro A, 2 vinculos' t, r.title, b.title, (select count(*) from review_disability where review_id=r.id) from review r join book b on b.id=r.book_id where r.slug='resenha-a';
set role authenticated; set request.jwt.claim.sub='aaaaaaaa-0000-0000-0000-000000000001';
select 'A update troca p/ inativo' t, (update_review_with_book(p_review_id=>(select id from review where slug='resenha-a'),p_book_title=>'Livro A',p_author=>'X',p_genre_id=>(select g from ids),p_publisher=>null,p_isbn=>null,p_cover_url=>null,p_year=>null,p_publication_city=>null,p_review_title=>'Resenha A v2',p_body=>'corpo',p_tags=>'{}',p_keywords=>'{}',p_highlight_quote=>null,p_further_reading=>'[]',p_status=>'published',p_expected_updated_at=>(select updated_at from review where slug='resenha-a'),p_disability_ids=>array[(select tea from ids)])).title;
select 'A update {} limpa' t, (update_review_with_book(p_review_id=>(select id from review where slug='resenha-a'),p_book_title=>'Livro A',p_author=>'X',p_genre_id=>(select g from ids),p_publisher=>null,p_isbn=>null,p_cover_url=>null,p_year=>null,p_publication_city=>null,p_review_title=>'Resenha A v2',p_body=>'corpo',p_tags=>'{}',p_keywords=>'{}',p_highlight_quote=>null,p_further_reading=>'[]',p_status=>'published',p_expected_updated_at=>(select updated_at from review where slug='resenha-a'),p_disability_ids=>'{}')).title;
reset role; select 'ORACULO apos {} (0)' t, count(*) from review_disability rd join review r on r.id=rd.review_id where r.slug='resenha-a';

-- 5) B tenta update de A via RPC com deficiências
set role authenticated; set request.jwt.claim.sub='bbbbbbbb-0000-0000-0000-000000000002';
select 'B update RPC em A (deve falhar 42501)' t; select update_review_with_book(p_review_id=>(select id from review where slug='resenha-a'),p_book_title=>'x',p_author=>'X',p_genre_id=>(select g from ids),p_publisher=>null,p_isbn=>null,p_cover_url=>null,p_year=>null,p_publication_city=>null,p_review_title=>'x',p_body=>'c',p_tags=>'{}',p_keywords=>'{}',p_highlight_quote=>null,p_further_reading=>'[]',p_status=>'published',p_expected_updated_at=>(select updated_at from review where slug='resenha-a'),p_disability_ids=>array[(select fis from ids)]);
-- 6) Admin: vê inativo, edita termo, vincula em A
set request.jwt.claim.sub='cccccccc-0000-0000-0000-000000000003';
select 'admin ve 8 termos' t, count(*) from disability_term;
update disability_term set name='Deficiência física (renomeada)' where slug='deficiencia-fisica';
insert into review_disability select id,(select inativo from ids) from review where slug='resenha-a';
select 'admin delete termo (0 linhas, sem policy)' t; delete from disability_term where slug='tea';
reset role;
select 'ORACULO rename ok / tea existe / vinculo admin' t, (select name from disability_term where slug='deficiencia-fisica'), (select count(*) from disability_term where slug='tea'), (select count(*) from review_disability rd join review r on r.id=rd.review_id where r.slug='resenha-a');
