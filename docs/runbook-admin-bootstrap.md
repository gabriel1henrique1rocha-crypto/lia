# Runbook — Bootstrap do 1º admin, SMTP e gate de rollout

> Feature `security-foundation` (M2). Operações **manuais e humanas** — nenhuma faz parte do Execute automatizado. Nada aqui contém segredo: use placeholders.
> Referências: [context.md](../.specs/features/security-foundation/context.md) (C-2/C-4), [design.md](../.specs/features/security-foundation/design.md) (§3.5, §5.2), [DECISIONS.md](../.specs/project/DECISIONS.md) (D-09, D-10).

---

## 1. Pré-requisito: e-mail transacional (SMTP) — config de dashboard

O magic link **não funciona em produção** com o SMTP default do Supabase (rate limit de desenvolvimento). Antes de convidar qualquer editor:

1. **Supabase Dashboard → Authentication → Emails → SMTP Settings**: configurar um provedor real (host, porta, usuário, senha, remetente). **Não** versionar credenciais — só no dashboard.
2. **Authentication → Emails → Templates → Magic Link**: ajustar o link para o fluxo **token_hash** que a rota [/auth/confirm](../src/app/auth/confirm/route.ts) espera:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/admin
   ```

   O default do template usa `{{ .ConfirmationURL }}` (fluxo `?code=`/PKCE). Trocar para `token_hash` é o que permite abrir o link em **outro dispositivo/browser** (comum em e-mail) — ver a decisão do callback no design.
3. **Authentication → URL Configuration → Site URL**: apontar para o domínio de produção; adicionar `…/auth/confirm` aos redirect URLs se necessário.

> **Local (dev):** o SMTP é o **Mailpit** embutido (`supabase_inbucket_lia`, http://127.0.0.1:54324). Nenhuma config extra; os e-mails aparecem lá. O script [scripts/e2e-magic-link.mjs](../scripts/e2e-magic-link.mjs) dirige o fluxo inteiro (login → Mailpit → callback → sessão httpOnly → gate) contra o `next dev` local e afirma D-10 — reprodução da verificação T19 (env: `LOCAL_URL/LOCAL_ANON/LOCAL_SECRET/APP_URL/MAILPIT_URL/DB_CONTAINER`).

---

## 2. Bootstrap do 1º admin — SQL PRIVILEGIADO (não service_role)

O primeiro `editor role='admin'` resolve o ovo-galinha do RBAC: a policy `editor_admin_insert` (migration 0007) exige que **já exista** um admin ativo para provisionar editores. O 1º admin, portanto, é criado por um caminho **privilegiado**, uma única vez, manualmente.

> ⚠️ **NÃO use a `service_role` para isto.** A matriz RLS (T16) **provou em runtime** que o `service_role` recebe `42501` (permission denied) ao escrever em `editor` — pós-2026-05-30 ele **não** tem GRANT de tabela nessas tabelas (dormência C-2, ver §4). O caminho correto é o **SQL Editor do dashboard**, que roda como `postgres` (superuser) e bypassa grants/RLS.

**Passos:**

1. **Criar o usuário de auth** — Dashboard → **Authentication → Users → Add user → Send invitation** (ou *Create new user*), com o e-mail do admin. Isso cria a linha em `auth.users` e dispara o convite/magic link. **Copie o `User UID` (UUID)** do usuário criado.

2. **Criar o perfil `editor`** — Dashboard → **SQL Editor** (roda como `postgres`), executar (substituindo os placeholders):

   ```sql
   insert into public.editor (id, email, name, role, active)
   values ('<UUID-do-auth-user>', '<email>', '<nome>', 'admin', true);
   ```

   `editor.id` **é** o `auth.users.id` (PK compartilhada, `on delete cascade`). Sem essa linha, o login autentica mas o gate retorna "não autorizado".

3. **Verificar** — acessar `/admin/login`, solicitar o magic link com o e-mail do admin, abrir o link → deve cair em `/admin` autenticado como admin. Um e-mail **não** cadastrado deve receber a mesma mensagem genérica e **não** criar usuário (conjunto fechado — `shouldCreateUser:false`).

**Editores seguintes** (`role='editor'` ou novos admins): provisionados por um **admin autenticado** via as policies `editor_admin_insert`/`editor_admin_update` (0007). A UI dessa gestão é follow-up; até lá, o mesmo passo 1+2 do dashboard serve.

> **Avisos operacionais:**
> - **Não desative a si mesmo** nem se rebaixe sendo o único admin — não há guard de "último admin" (risco A-8); a recuperação seria por este runbook/dashboard.
> - **Convites órfãos:** um `auth.users` sem linha `editor` consegue sessão, mas **nenhum** acesso (cai em "não autorizado"). Remova convites que não viraram editor.
> - `editor.email` é exibição; a identidade é o `id`. Mudar o e-mail no Auth **não** propaga para `editor` (sem UI de sync nesta fundação — A-9).

---

## 3. Fluxo de verificação (resumo)

```
/admin/login  → informa e-mail → server action signInWithOtp(shouldCreateUser:false)
   → e-mail (SMTP prod / Mailpit local) com link token_hash
   → /auth/confirm  verifyOtp → grava cookies de sessão httpOnly (D-10)
   → /admin (route group protected)  requireEditor() resolve papel (RLS self-read)
   → autorizado (ok) | "não autorizado" (sem editor ativo) | /admin/login (sem sessão)
```

---

## 4. Dormência da `service_role` (C-2) — DECISÃO deliberada, não pendência

O módulo do client admin (`service_role`) existe e está **isolado** (server-only + env sem `NEXT_PUBLIC` + lint com allowlist vazia), mas **dormente**: nenhuma operação desta feature usa bypass de RLS. Isso é uma **escolha de segurança** (privilégio mínimo, C-2 / [D-09](../.specs/project/DECISIONS.md)), **não** um item por fazer:

- O `service_role` **não tem GRANT de tabela** em `editor`, `review`, `comment`, `recommendation` — provado em runtime (T16: `42501`). Tocar essas tabelas via `service_role` **exigiria** um `GRANT … ON public.<tabela> TO service_role;` explícito, **hoje ausente de propósito**.
- **NÃO "conserte" isto com um grant amplo** (`grant all … to service_role`, `grant … to service_role` genérico). Cada uso real de bypass deve ser uma **exceção documentada** (ADR própria), com o GRANT **mínimo** para a operação específica, e o gate de sessão+papel no servidor (SEC-08) na frente.
- Consequência prática: fixtures de teste e o bootstrap usam **psql como `postgres`** (superuser), não o `service_role` — como este runbook e a suíte T16 fazem.

---

## 5. Gate de rollout (SEC-17)

- **`SUPABASE_SERVICE_ROLE_KEY` NÃO entra em Production (Vercel)** — nem no merge desta feature, nem depois, **até** que uma feature futura especifique uma exceção real de bypass (com ADR + GRANT mínimo). O caminho público é anon; a auth de editor usa o client autenticado sob RLS.
- **Checklist antes/depois do merge:**
  - [ ] Vercel → Project → Settings → Environment Variables (Production): contém **apenas** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (+ `NEXT_PUBLIC_SITE_URL` se aplicável). **Sem** `SUPABASE_SERVICE_ROLE_KEY`.
  - [ ] Migrations 0007/0008 aplicadas em produção por `supabase db push` **humano** (passo pós-merge, A-11) — nunca automatizado no Execute.
  - [ ] SMTP de produção + template token_hash configurados (§1) antes de convidar editores reais.
  - [ ] 1º admin criado pelo §2 (SQL privilegiado), verificado por login.

> **Ordem recomendada (A-11):** merge do código → `db push` das 0007/0008 em produção → configurar SMTP/template → bootstrap do 1º admin → verificar login. As migrations são seguras de aplicar antes do merge (só adicionam privilégio a `authenticated`, papel que nenhum fluxo público usa), mas seguem o fluxo padrão de revisão.
