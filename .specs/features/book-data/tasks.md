# book-data — Tasks

**Spec**: [spec.md](spec.md) · **Design**: [design.md](design.md) · **Status**: Approved
**Milestone**: M1 — Núcleo de leitura pública · **Stack**: Next.js (App Router) + React + TypeScript + Tailwind v4 + Supabase
> Documentação em português; nomes de feature, schema, identificadores e código em inglês.

---

## Dependency Graph

```
Phase 1 (paralelo — nenhuma dependência):
  T-11 [P] (isbn.ts)
  T-12 [P] (language.ts)
  T-13 [P] (migration 0002)

Phase 2 (após T-13 — paralelo):
  T-14 [P] (migration 0003)  ← T-13
  T-15 [P] (regen types)     ← T-13

Phase 3 (após T-15 — paralelo):
  T-16 [P] (schema.ts)       ← T-11, T-15
  T-17 [P] (queries.ts)      ← T-15

Phase 4 (após fases anteriores concluídas — paralelo):
  T-18 [P] (BookDetails.tsx) ← T-12, T-16, T-17
  T-21 [P] (seed.sql)        ← T-13, T-14

Phase 5:
  T-19 (globals.css)         ← T-18

Phase 6:
  T-20 (styleguide)          ← T-18, T-19

Phase 7:
  T-22 (RLS integration)     ← T-14, T-21
```

**Grupos de execução paralela:**
- Grupo 1: T-11 `[P]` T-12 `[P]` T-13 `[P]` (nenhuma dependência entre si)
- Grupo 2: T-14 `[P]` T-15 `[P]` (ambos dependem de T-13)
- Grupo 3: T-16 `[P]` T-17 `[P]` (ambos dependem de T-15; T-16 também exige T-11 — feito no Grupo 1)
- Grupo 4: T-18 `[P]` T-21 `[P]` (T-18 ← T-12+T-16+T-17; T-21 ← T-13+T-14)

---

## Requirement → Task Mapping

| Req | Task(s) |
| --- | --- |
| BOOK-01 | T-15, T-16 |
| BOOK-02 | T-13, T-16 |
| BOOK-03 | T-13, T-16 |
| BOOK-04 | T-13 |
| BOOK-05 | T-11, T-16 |
| BOOK-06 | T-11 |
| BOOK-07 | T-16 |
| BOOK-08 | T-11, T-18 |
| BOOK-09 | T-12, T-18 |
| BOOK-10 | T-13, T-16 |
| BOOK-11 | T-17, T-22 |
| BOOK-12 | T-18, T-19 |
| BOOK-13 | T-18 |
| BOOK-14 | T-20 |
| BOOK-15 | T-21 |
| BOOK-16 | T-21 |
| BOOK-17 | T-14, T-22 |

**Coverage:** 17/17 requisitos mapeados ✅

---

## Validações pré-aprovação

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T-11: isbn.ts + testes | 1 arquivo + 1 test | ✅ Atômico |
| T-12: language.ts + testes | 1 arquivo + 1 test | ✅ Atômico |
| T-13: migration 0002 | 1 arquivo SQL | ✅ Atômico |
| T-14: migration 0003 | 1 arquivo SQL | ✅ Atômico |
| T-15: regen types | 1 arquivo gerado (comando único) | ✅ Atômico |
| T-16: schema.ts + testes | 1 arquivo + 1 test | ✅ Atômico |
| T-17: queries.ts | 1 arquivo | ✅ Atômico |
| T-18: BookDetails.tsx + testes | 1 componente + 1 test | ✅ Atômico |
| T-19: .lia-book-details (globals.css) | 1 bloco CSS em arquivo existente | ✅ Atômico |
| T-20: styleguide seção Ficha | 1 seção em arquivo existente | ✅ Atômico |
| T-21: seed.sql + script db:seed | 1 arquivo SQL + 1 linha em package.json | ✅ Atômico |
| T-22: teste integração RLS (local) | 1 arquivo de teste | ✅ Atômico |

### Check 2 — Diagrama × Definição

| Task | `Depends on` (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T-11 | Nenhuma | Fase 1, sem seta entrada | ✅ |
| T-12 | Nenhuma | Fase 1, sem seta entrada | ✅ |
| T-13 | Nenhuma | Fase 1, sem seta entrada | ✅ |
| T-14 | T-13 | ← T-13 | ✅ |
| T-15 | T-13 | ← T-13 | ✅ |
| T-16 | T-11, T-15 | ← T-11, T-15 | ✅ |
| T-17 | T-15 | ← T-15 | ✅ |
| T-18 | T-12, T-16, T-17 | ← T-12, T-16, T-17 | ✅ |
| T-19 | T-18 | ← T-18 | ✅ |
| T-20 | T-18, T-19 | ← T-18, T-19 | ✅ |
| T-21 | T-13, T-14 | ← T-13, T-14 | ✅ |
| T-22 | T-14, T-21 | ← T-14, T-21 | ✅ |

### Check 3 — Co-localização de testes

Stack de testes do projeto: **Vitest + RTL** (unit/componente em `src/`), **Playwright + axe** (a11y), integração RLS local-only (TD-02).

| Task | Camada criada/modificada | Tipo requerido | Task diz | Status |
| --- | --- | --- | --- | --- |
| T-11 | Função pura TS (isbn.ts) | unit | unit (isbn.test.ts co-localizado) | ✅ |
| T-12 | Função pura TS (language.ts) | unit | unit (language.test.ts co-localizado) | ✅ |
| T-13 | Migration SQL | none (DB-level, manual) | none | ✅ |
| T-14 | Migration SQL + RLS | none (DB-level, manual) | none | ✅ |
| T-15 | Tipos gerados (comando) | none (geração automática) | none (typecheck gate) | ✅ |
| T-16 | Schema zod (schema.ts) | unit | unit (schema.test.ts co-localizado) | ✅ |
| T-17 | Queries server (queries.ts) | none¹ | none (integração em T-22) | ✅ |
| T-18 | Server Component (BookDetails.tsx) | componente | component (BookDetails.test.tsx co-localizado) | ✅ |
| T-19 | CSS layer (globals.css) | none | none (build gate) | ✅ |
| T-20 | Styleguide page | a11y | a11y (axe + Lighthouse gate) | ✅ |
| T-21 | Seed SQL | none (manual/local) | none | ✅ |
| T-22 | Teste integração RLS | integration (local-only, TD-02) | integration/local | ✅ |

> ¹ `queries.ts` é função de servidor que requer banco real; a cobertura de integração está em T-22 (co-localização por agrupamento funcional, não por arquivo separado — padrão aceito quando a dependência de infraestrutura impede teste unitário).

Todos os checks passaram. ✅

---

## Tasks

### T-11 — `src/lib/book/isbn.ts` + testes

| | |
| --- | --- |
| **Reqs** | BOOK-05, BOOK-06, BOOK-08 |
| **Depends on** | — |
| **Where** | `src/lib/book/isbn.ts` · `src/lib/book/__tests__/isbn.test.ts` |
| **Reuses** | padrão de função pura TS (sem deps externas) |
| **Tests** | unit (Vitest) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `done` (24 testes ✅) |

**What**: Criar `isbn.ts` com 5 funções exportadas: `normalizeIsbn`, `isValidIsbn10`, `isValidIsbn13`, `isValidIsbn`, `formatIsbn`; e cobrir com testes unitários co-localizados.

**Interfaces** (conforme design):
```typescript
export function normalizeIsbn(raw: string): string         // remove separadores; preserva X final (ISBN-10)
export function isValidIsbn10(value: string): boolean      // mód-11, peso 10..1, X=10
export function isValidIsbn13(value: string): boolean      // mód-10, pesos 1/3
export function isValidIsbn(value: string): boolean        // normaliza + valida 10 ou 13
export function formatIsbn(value: string): string          // hifenização pragmática (DD-5)
```

**Done when**:
- [ ] `normalizeIsbn('978-85-359-0277-5')` → `'9788535902775'`
- [ ] `normalizeIsbn('85-359-0277-0')` → `'8535902770'`
- [ ] `isValidIsbn13('9788535902775')` → `true`; dígito errado → `false`
- [ ] `isValidIsbn10('8535902770')` → `true`; `isValidIsbn10` aceita ISBN-10 com `X` final
- [ ] `isValidIsbn('')` → `false`; `isValidIsbn` com campo vazio não quebra
- [ ] `formatIsbn` retorna string com hífens legíveis para ISBN-10 e ISBN-13
- [ ] Idempotência: `normalizeIsbn(normalizeIsbn(x)) === normalizeIsbn(x)`
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 15 testes em `isbn.test.ts`

**Commit**: `feat(book): T-11 isbn — normalize, validate (10/13), format`

---

### T-12 — `src/lib/book/language.ts` + testes

| | |
| --- | --- |
| **Reqs** | BOOK-09 |
| **Depends on** | — |
| **Where** | `src/lib/book/language.ts` · `src/lib/book/__tests__/language.test.ts` |
| **Reuses** | padrão de mapa + função pura TS |
| **Tests** | unit (Vitest) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `done` (5 testes ✅) |

**What**: Criar `language.ts` com mapa ISO 639-1 → rótulo PT e a função `languageLabel`; cobrir com testes unitários.

**Interfaces**:
```typescript
export const LANGUAGES: Record<string, string>     // { pt: 'Português', fr: 'Francês', en: 'Inglês', es: 'Espanhol', … }
export function languageLabel(code: string): string // fallback: retorna o próprio código se desconhecido
```

**Done when**:
- [ ] `languageLabel('pt')` → `'Português'`; `languageLabel('fr')` → `'Francês'`; `languageLabel('en')` → `'Inglês'`
- [ ] `languageLabel('xx')` → `'xx'` (fallback, não quebra)
- [ ] `LANGUAGES` exportado (usado em formulários no M2)
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 5 testes em `language.test.ts`

**Commit**: `feat(book): T-12 language — mapa ISO 639-1 → rótulo PT`

---

### T-13 — Migration `0002_book_data_hardening.sql`

| | |
| --- | --- |
| **Reqs** | BOOK-02, BOOK-03, BOOK-04, BOOK-10 |
| **Depends on** | — |
| **Where** | `supabase/migrations/0002_book_data_hardening.sql` |
| **Reuses** | padrão `DO $$ … IF NOT EXISTS` de [0001](../../../supabase/migrations/0001_core_schema.sql) |
| **Tests** | none (verificação manual no banco local) |
| **Gate** | manual: aplicar localmente + inspecionar schema |
| **Status** | `done` (arquivo criado — gate manual pendente de verificação) |

**What**: Criar a migration idempotente que endurece a tabela `book`:
- `genre_id NOT NULL` (guarda: só aplica se `is_nullable='YES'`)
- CHECK `book_pages_positive` (`pages is null or pages > 0`)
- CHECK `book_year_sane` (`year is null or year between 1 and 2100`)
- CHECK `book_translation_consistent` (`translator is null or translated_from is not null`)

Conteúdo exato no design (seção Data Models).

**Done when**:
- [ ] Arquivo criado em `supabase/migrations/0002_book_data_hardening.sql`
- [ ] `supabase db reset` local executa sem erro
- [ ] `\d book` mostra `genre_id not null` e os 3 CHECKs
- [ ] `INSERT INTO book (...) VALUES (... genre_id = NULL ...)` → rejeitado
- [ ] `INSERT INTO book (... pages = 0 ...)` → rejeitado
- [ ] `INSERT INTO book (... year = 3000 ...)` → rejeitado
- [ ] `INSERT INTO book (... translator = 'X', translated_from = NULL ...)` → rejeitado
- [ ] Reaplicar migration é no-op (idempotente)

**Commit**: `feat(db): T-13 migration 0002 — book hardening (genre NOT NULL + CHECKs)`

---

### T-14 — Migration `0003_book_public_read_policy.sql`

| | |
| --- | --- |
| **Reqs** | BOOK-17 |
| **Depends on** | T-13 |
| **Where** | `supabase/migrations/0003_book_public_read_policy.sql` |
| **Reuses** | padrão `DO $$ … IF NOT EXISTS` de [0001](../../../supabase/migrations/0001_core_schema.sql) |
| **Tests** | none (verificação manual; integração em T-22) |
| **Gate** | manual: aplicar localmente + inspecionar `pg_policies` |
| **Status** | `pending` |

**What**: Criar a migration idempotente que adiciona policy de leitura pública em `book`:
```sql
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='book' and policyname='book_public_read'
  ) then
    create policy "book_public_read" on book for select to anon, authenticated using (true);
  end if;
end $$;
```
Sem policy de `INSERT/UPDATE/DELETE` — escrita permanece deny-by-default.

**Done when**:
- [ ] Arquivo criado em `supabase/migrations/0003_book_public_read_policy.sql`
- [ ] `supabase db reset` local executa sem erro
- [ ] `SELECT * FROM pg_policies WHERE tablename='book'` lista exatamente 1 policy (`book_public_read`, command `SELECT`)
- [ ] RLS continua `enabled` na tabela (não tocar em `alter table book enable row level security`)
- [ ] Reaplicar migration é no-op

**Commit**: `feat(db): T-14 migration 0003 — book RLS policy (SELECT público)`

---

### T-15 — Regerar `src/lib/database.types.ts`

| | |
| --- | --- |
| **Reqs** | BOOK-01 |
| **Depends on** | T-13 |
| **Where** | `src/lib/database.types.ts` |
| **Reuses** | processo já executado no M0 |
| **Tests** | none (arquivo gerado — verificado por typecheck) |
| **Gate** | `npm run typecheck` |
| **Status** | `pending` |

**What**: Aplicar `0002` no banco local (via `supabase db reset` ou `supabase db push`) e rodar `supabase gen types typescript --local > src/lib/database.types.ts` para refletir `genre_id NOT NULL`.

**Done when**:
- [ ] `Tables<'book'>['genre_id']` é `string` (não `string | null`) no tipo `Row`
- [ ] `Tables<'book'>` no tipo `Insert` exige `genre_id` (sem `?`)
- [ ] `npm run typecheck` passa sem erros no arquivo gerado

**Commit**: `chore(types): T-15 regen database.types após migration 0002`

---

### T-16 — `src/lib/book/schema.ts` + testes

| | |
| --- | --- |
| **Reqs** | BOOK-01, BOOK-02, BOOK-03, BOOK-07, BOOK-10 |
| **Depends on** | T-11, T-15 |
| **Where** | `src/lib/book/schema.ts` · `src/lib/book/__tests__/schema.test.ts` |
| **Reuses** | padrão zod de [src/lib/env.ts](../../../src/lib/env.ts); `isValidIsbn` de T-11 |
| **Tests** | unit (Vitest) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `pending` |

**What**: Criar `schema.ts` com `bookInputSchema` (zod) e `type BookInput`; cobrir com testes unitários.

**Interfaces** (conforme design, seção Data Models):
```typescript
export const bookInputSchema: z.ZodObject<…>   // obrigatórios: title, author, genreId; opcionais: restantes
export type BookInput = z.infer<typeof bookInputSchema>
```

`superRefine`: (a) `isbn` presente → `isValidIsbn(isbn)` ou `ctx.addIssue`; (b) `translator` presente → `translatedFrom` presente ou `ctx.addIssue`.

**Done when**:
- [ ] Ficha mínima `{ title, author, genreId }` → parse OK
- [ ] Falta `title` ou `author` ou `genreId` → erro zod
- [ ] `pages = 0` → erro; `pages = 1` → OK
- [ ] `year > <ano corrente>` → erro; `year = 1800` → OK
- [ ] ISBN inválido → erro com mensagem PT (não só código); ISBN vazio → aceito
- [ ] `translator` sem `translatedFrom` → erro; com `translatedFrom` → OK
- [ ] `BookInput` inferido bate com os campos do PRD
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 12 testes em `schema.test.ts`

**Commit**: `feat(book): T-16 bookInputSchema (zod) — validação de ficha com ISBN e tradução`

---

### T-17 — `src/lib/book/queries.ts`

| | |
| --- | --- |
| **Reqs** | BOOK-11 (read) |
| **Depends on** | T-15 |
| **Where** | `src/lib/book/queries.ts` |
| **Reuses** | [src/lib/supabase/server.ts](../../../src/lib/supabase/server.ts); `Tables<'book'>` de `database.types` |
| **Tests** | none¹ (integração coberta por T-22) |
| **Gate** | `npm run typecheck` |
| **Status** | `pending` |

> ¹ Requer banco real; teste unitário com mock não acrescenta cobertura de contrato. Integração em T-22.

**What**: Criar `queries.ts` com `BookView`, `getBookById` e `listBooks` — usando `createServerClient` e join com `genre`.

**Interfaces**:
```typescript
export type BookView = Tables<'book'> & { genre: { name: string; slug: string } | null }
export async function getBookById(id: string): Promise<BookView | null>
export async function listBooks(): Promise<BookView[]>
```

**Done when**:
- [ ] `BookView` usa `Tables<'book'>` (sem `any`)
- [ ] `getBookById` retorna `null` quando não encontrado (sem throw)
- [ ] `listBooks` usa `select('*, genre(name, slug)')`
- [ ] `npm run typecheck` passa (sem erros de tipo no arquivo)

**Commit**: `feat(book): T-17 queries — getBookById + listBooks com join genre`

---

### T-18 — `src/components/book/BookDetails.tsx` + testes

| | |
| --- | --- |
| **Reqs** | BOOK-12, BOOK-13 |
| **Depends on** | T-12, T-16, T-17 |
| **Where** | `src/components/book/BookDetails.tsx` · `src/components/book/__tests__/BookDetails.test.tsx` |
| **Reuses** | padrão Server Component do [Card.tsx](../../../src/components/ui/Card.tsx); helper `cx`; `languageLabel` (T-12); `formatIsbn` (T-11) |
| **Tests** | componente (Vitest + RTL) |
| **Gate** | quick: `npm run typecheck && npm test` |
| **Status** | `pending` |

**What**: Criar `BookDetails` como Server Component (`<dl className="lia-book-details">`, pares `<dt>/<dd>` apenas para campos presentes) com suporte ao bloco de tradução (sub-`<dl>` com heading configurável).

**Interfaces**:
```typescript
interface BookDetailsProps {
  book: BookView
  headingLevel?: 2 | 3 | 4   // padrão 3 — configura o <h{N}> "Tradução"
}
export function BookDetails({ book, headingLevel = 3 }: BookDetailsProps): JSX.Element
```

Campos exibidos: Autor, Gênero (`book.genre?.name`), Editora, Ano, Páginas, Idioma original (`languageLabel`), ISBN (`formatIsbn`). Bloco "Tradução" condicional: heading + Tradutor + Idioma de origem.

**Done when**:
- [ ] Sem `'use client'` → Server Component puro
- [ ] Ficha mínima: renderiza só Autor + Gênero (sem `<dt>` para campos ausentes)
- [ ] Ficha completa: todos os campos presentes renderizam
- [ ] ISBN exibido formatado (`formatIsbn`); idioma exibido com rótulo PT (`languageLabel`)
- [ ] Bloco "Tradução" aparece somente quando `book.translator` está presente
- [ ] `headingLevel` altera a tag do heading do bloco de tradução
- [ ] Axe não retorna issue crítico quando renderizado no jsdom (RTL)
- [ ] Gate: `npm run typecheck && npm test` passa; ≥ 8 testes em `BookDetails.test.tsx`

**Commit**: `feat(book): T-18 BookDetails — Server Component semântico com dl/dt/dd`

---

### T-19 — `.lia-book-details` em `src/app/globals.css`

| | |
| --- | --- |
| **Reqs** | BOOK-12 |
| **Depends on** | T-18 |
| **Where** | `src/app/globals.css` (bloco `@layer components`) |
| **Reuses** | padrão `.lia-card`, `.lia-field` em [globals.css:210](../../../src/app/globals.css#L210) |
| **Tests** | none |
| **Gate** | build: `npm run build` |
| **Status** | `pending` |

**What**: Adicionar `.lia-book-details`, `.lia-book-details dt`, `.lia-book-details dd`, `.lia-book-details__group` em `@layer components`, consumindo **apenas tokens** do `@theme` (sem hex, sem valores hardcoded).

**Done when**:
- [ ] Classes adicionadas ao lado de `.lia-card` / `.lia-field` no `@layer components`
- [ ] Zero valores hex ou literais de cor (só tokens)
- [ ] Contraste AA (≥ 4.5:1) mantido — verificado visualmente no styleguide
- [ ] `npm run build` passa sem erro de CSS

**Commit**: `feat(book): T-19 .lia-book-details — estilos em @layer components (tokens)`

---

### T-20 — Styleguide: seção Ficha (`src/app/styleguide/page.tsx`)

| | |
| --- | --- |
| **Reqs** | BOOK-14 |
| **Depends on** | T-18, T-19 |
| **Where** | `src/app/styleguide/page.tsx` |
| **Reuses** | helpers `Section`/`Row` existentes; gate axe+Lighthouse do M0 já cobre `/styleguide` |
| **Tests** | a11y (Playwright + axe + Lighthouse CI) |
| **Gate** | `npm run build && npm run test:a11y && npm run lhci` |
| **Status** | `pending` |

**What**: Adicionar `<Section id="ficha" title="Ficha do Livro">` com 3 casos de `<BookDetails>` usando dados mock locais (sem banco): **completa** (todos os campos + ISBN), **mínima** (title/author/genre), **com tradução** (translator + translatedFrom).

**Done when**:
- [ ] 3 casos renderizam corretamente na rota `/styleguide`
- [ ] Campos ausentes (caso mínimo) não geram `<dt>` órfão no HTML
- [ ] Bloco de tradução aparece apenas no caso "com tradução"
- [ ] `npm run test:a11y` → axe 0 issues críticos na rota `/styleguide`
- [ ] `npm run lhci` → Lighthouse Accessibility mantém 100

**Commit**: `feat(book): T-20 styleguide — seção Ficha (3 casos: completa, mínima, tradução)`

---

### T-21 — `supabase/seed.sql` + script `db:seed`

| | |
| --- | --- |
| **Reqs** | BOOK-15, BOOK-16 |
| **Depends on** | T-13, T-14 |
| **Where** | `supabase/seed.sql` · `package.json` (script `db:seed`) |
| **Reuses** | mecanismo `[db.seed]` do `supabase/config.toml`; padrão `on conflict (id) do nothing` |
| **Tests** | none (verificação manual local) |
| **Gate** | manual: `supabase db reset` local → contar linhas |
| **Status** | `pending` |

**What**: Criar `supabase/seed.sql` idempotente com:
- 4 gêneros (UUIDs fixos): Romance, Realismo, Romantismo, Naturalismo
- 4 livros (UUIDs fixos): Dom Casmurro (Machado), O Crime do Padre Amaro (Eça), Iracema (Alencar), O Cortiço (Aluísio Azevedo) — todos `original_language='pt'`, sem tradução; 1–2 com ISBN-13 válido

Adicionar script `"db:seed": "supabase db execute --file supabase/seed.sql"` em `package.json`.

**Dados**:
| Título | Autor | Gênero | Ano | ISBN |
| --- | --- | --- | --- | --- |
| Dom Casmurro | Machado de Assis | Romance | 1899 | — |
| O Crime do Padre Amaro | Eça de Queirós | Realismo | 1875 | — |
| Iracema | José de Alencar | Romantismo | 1865 | — |
| O Cortiço | Aluísio Azevedo | Naturalismo | 1890 | (ISBN de edição moderna válida, ex.: 9788520932051) |

**Done when**:
- [ ] `supabase db reset` local → 4 livros + 4 gêneros, todos com `genre_id` preenchido
- [ ] Reexecutar `supabase db reset` → sem duplicatas
- [ ] Livro(s) com ISBN passam `isValidIsbn()` manualmente
- [ ] Script `db:seed` listado em `package.json`

**Commit**: `feat(db): T-21 seed — 4 clássicos PT + gêneros (idempotente, UUIDs fixos)`

---

### T-22 — Teste de integração RLS (local-only)

| | |
| --- | --- |
| **Reqs** | BOOK-11, BOOK-17 |
| **Depends on** | T-14, T-21 |
| **Where** | `src/lib/book/__tests__/rls.integration.test.ts` |
| **Reuses** | client anon de [src/lib/supabase/client.ts](../../../src/lib/supabase/client.ts) |
| **Tests** | integration (local Supabase — **não roda no CI atual**, ver TD-02) |
| **Gate** | manual: `supabase start && npm test -- rls.integration` |
| **Status** | `pending` |

> **Dívida TD-02**: este teste roda somente com `supabase start`. O CI não tem Supabase; adicionar o serviço ao pipeline é avaliado no M4. O arquivo DEVE conter um comentário `// LOCAL-ONLY — ver TD-02 em STATE.md` e ser excluído do coverage do CI via `vitest.config.ts` se necessário.

**What**: Arquivo de teste que usa o client `anon` do Supabase local para verificar:
1. `SELECT` em `book` retorna as fichas do seed (BOOK-17 AC#2)
2. `INSERT` anônimo em `book` é rejeitado (BOOK-17 AC#3)
3. Segunda `review` para o mesmo `book_id` é rejeitada pela constraint `unique` (BOOK-11 AC#2)
4. `book` sem `review` existe sem erro (BOOK-11 AC#3)

**Done when**:
- [ ] Arquivo criado com comentário `// LOCAL-ONLY — ver TD-02 em STATE.md`
- [ ] `SELECT` anon em `book` → `data.length >= 4` (seed presente)
- [ ] `INSERT` anon em `book` → `error.code === '42501'` (RLS violation)
- [ ] Segunda `review` com mesmo `book_id` → `error.code === '23505'` (unique violation)
- [ ] `book` sem `review` — `listBooks()` inclui o livro sem erro
- [ ] Executar manualmente com Supabase local: todos os asserts passam

**Commit**: `test(book): T-22 RLS integration test (local-only, TD-02)`

---

## Status Summary

| Task | Descrição | Status |
| --- | --- | --- |
| T-11 | isbn.ts + testes | `done` |
| T-12 | language.ts + testes | `done` |
| T-13 | Migration 0002 hardening | `done` (gate manual pendente) |
| T-14 | Migration 0003 RLS policy | `pending` |
| T-15 | Regen database.types.ts | `pending` |
| T-16 | schema.ts + testes | `pending` |
| T-17 | queries.ts | `pending` |
| T-18 | BookDetails.tsx + testes | `pending` |
| T-19 | .lia-book-details globals.css | `pending` |
| T-20 | Styleguide seção Ficha | `pending` |
| T-21 | seed.sql + db:seed | `pending` |
| T-22 | RLS integration test (local) | `pending` |

**12 tasks · 17/17 reqs mapeados · pronto para execução**
