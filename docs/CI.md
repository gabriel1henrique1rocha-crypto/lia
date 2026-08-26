# CI — Gates de qualidade (T-09)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em **cada push e cada PR**. São quatro jobs; `a11y` só começa depois que `test` passa, e `rls` é independente dos demais.

| Job    | Nome do check no GitHub  | O que roda                                      | Bloqueia o merge?                        |
| ------ | ------------------------ | ----------------------------------------------- | ---------------------------------------- |
| `lint` | `lint + format + types`  | ESLint · Prettier `--check` · `tsc --noEmit`     | Sim                                      |
| `test` | `vitest`                 | Vitest (unidade/componente)                      | Sim                                      |
| `rls`  | `rls (supabase local)`   | Supabase local + as 7 suítes `*.integration`     | **Ainda não** — ver Branch protection    |
| `a11y` | `axe + lighthouse`       | axe-core (Playwright) · Lighthouse CI            | Sim para a11y · **Não** para performance |

> A coluna do meio é o que aparece em _Settings → Branches_: o GitHub lista o `name:` do job, não a chave. É por isso que os checks se chamam `lint + format + types` e não `lint`.

## Hard gates

- **axe — 0 violações críticas.** Roda em `/` e `/styleguide`. Qualquer violação de impacto `critical` reprova. (INFRA-15)
- **Lighthouse Accessibility = 100.** Assert `categories:accessibility >= 1.0`. Abaixo disso reprova. (INFRA-16)

## Medido mas NÃO bloqueante

- **Lighthouse Performance (LCP/CLS).** Coletado e reportado como `warn` (LCP alvo ≤ 2500 ms, CLS ≤ 0,1). Não reprova o pipeline — é instável em runners de CI (decisão registrada na spec). O relatório completo é publicado em `temporary-public-storage`; a URL aparece no log do job `a11y`.

## Rodar os checks localmente

Pré-requisito: `npm ci` (ou `npm install`).

```bash
# Gate de lint (espelha o job `lint`)
npm run lint            # ESLint
npm run format:check    # Prettier
npm run typecheck       # tsc --noEmit

# Testes de unidade/componente (job `test`)
npm test                # vitest run
npm run test:watch      # modo watch durante o desenvolvimento

# Acessibilidade (job `a11y`) — exige um build primeiro
npm run build
ENABLE_STYLEGUIDE=true npm run test:a11y   # axe em / e /styleguide
ENABLE_STYLEGUIDE=true npm run lhci        # Lighthouse (a11y + performance)
```

No Windows PowerShell, defina a flag antes do comando:

```powershell
$env:ENABLE_STYLEGUIDE = 'true'; npm run test:a11y
```

> `test:a11y` e `lhci` sobem `next start`, então precisam de um `npm run build` recente. A rota `/styleguide` só responde 200 com `ENABLE_STYLEGUIDE=true`; sem a flag ela é 404 (protegida em produção).

## Teste do próprio gate

Há duas camadas que comprovam que o gate realmente reprova violações:

### 1. Meta-teste automático (sempre verde)

[`tests/a11y-gate.spec.ts`](../tests/a11y-gate.spec.ts) injeta um `<img>` sem `alt` e **afirma** que o axe reporta `image-alt` como `critical`. Roda em todo CI. Se o gate algum dia ficar cego (config quebrada, regra desativada), este teste fica **vermelho** e denuncia o problema — sem precisar quebrar uma página real.

### 2. Demonstração de pipeline vermelho ponta a ponta

Para ver o Actions ficar **vermelho** de verdade com uma violação numa página servida:

```bash
git switch -c chore/a11y-gate-redtest
```

Adicione uma imagem sem `alt` em [`src/app/page.tsx`](../src/app/page.tsx), por exemplo:

```tsx
{/* VIOLAÇÃO DELIBERADA — só para provar o gate. Remover depois. */}
<img src="/next.svg" />
```

```bash
git commit -am "test(ci): violação a11y deliberada para provar o gate"
git push -u origin chore/a11y-gate-redtest
```

Abra o PR (ou veja o run do push). Resultado esperado:

- Job **`a11y` vermelho** no passo `axe` — `image-alt` é `critical` em `/`.
- Ao remover o `<img>` e dar push de novo → **verde**.

Depois de conferir, descarte a branch:

```bash
git push origin --delete chore/a11y-gate-redtest
git switch main && git branch -D chore/a11y-gate-redtest
```

## Gate de RLS (`rls (supabase local)`)

Sobe um Supabase **efêmero** no runner e roda as sete suítes `*.integration.test.ts`, que provam **comportamento** de RLS contra um Postgres real: fronteira entre editores (A×B), `WITH CHECK` de reatribuição de ownership, posse transitiva de `book`, atomicidade dos RPCs e a prova de que o caminho público não vira bypass com a `service_role` no ambiente.

Antes de 2026-08-26 elas **pulavam** no CI (`describe.skipIf` sem `RUN_RLS_INTEGRATION`) — ver TD-02 no STATE.md.

- **Como o stack sobe:** `supabase/setup-cli` (versão **pinada**) + `supabase start`, com dez serviços excluídos por `-x`. Sobem só `postgres`, `kong`, `postgrest` e `gotrue` — os quatro que as suítes tocam.
- **Credenciais:** lidas de `supabase status -o env` do stack efêmero e exportadas como `SUPABASE_LOCAL_*`. Nada hardcoded, nada em secret.
- **Oráculo:** as suítes leem o estado real por `docker exec <container> psql -U postgres`. O CI descobre o nome do container por `docker ps` e o injeta em `SUPABASE_LOCAL_DB_CONTAINER` — o mesmo override que as suítes já liam, então o default local (`supabase_db_lia`) continua valendo.
- **Guarda de seed:** confere 4 published + 1 draft antes de rodar. Sem ela, um seed ausente apareceria como quinze asserções vermelhas espalhadas.
- **Diagnóstico:** todo run imprime os GRANTs de tabela dos papéis da Data API. Metade das asserções de negação depende de o Postgres barrar por **falta de GRANT** (`42501`) em vez de por **RLS** (0 linhas, sem erro) — quando os dois ambientes divergem nisso, a divergência precisa estar visível no log.

Rodar localmente (exige Docker e o stack de pé):

```bash
npx supabase start
npx supabase db reset          # migrations + seed
RUN_RLS_INTEGRATION=1 npx vitest run integration.test
```

```powershell
# PowerShell
$env:RUN_RLS_INTEGRATION = '1'; npx vitest run integration.test
```

## Branch protection (configuração no GitHub)

Configuração de repositório — **fora do código**, feita uma vez na UI, e só depois que o workflow tiver registrado os checks pelo menos uma vez em `main`.

Em **Settings → Branches → Branch protection rules → `main` → Edit**:

1. Marcar _Require status checks to pass before merging_.
2. No campo de busca de checks, adicionar **um a um**, pelo nome exato:
   - `lint + format + types`
   - `vitest`
   - `rls (supabase local)`
   - `axe + lighthouse`
3. _Require branches to be up to date before merging_ (opcional, recomendado).
4. **Save changes** no fim da página — a seleção não é gravada sozinha.

> Se `rls (supabase local)` não aparecer na busca, é porque o GitHub só oferece checks já vistos naquele repositório. Basta um run do workflow em qualquer branch (ou o merge desta) para ele passar a aparecer.

> ⚠️ **`rls (supabase local)` ainda NÃO deve entrar na lista de required.** Em 2026-08-26 o `supabase start` falhou por disputa de porta (`54322: address already in use`) em uma de sete execuções — as portas do `config.toml` caem dentro do range efêmero do kernel. É a **TD-11** no STATE.md, com a correção proposta e ainda não aplicada. Enquanto isso o job roda e reporta normalmente; só não bloqueia merge. Um required check que falha sem culpa do PR é pior que uma suíte que não roda, porque a reação natural é desabilitá-lo.
