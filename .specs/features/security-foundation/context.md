# security-foundation — Contexto (decisões do Specify)

> Gray areas detectadas na fase Specify — **TODAS RESOLVIDAS na revisão de 2026-07-07** (✅). Alimentam o Design.
> Documentação em português; identificadores em inglês.

---

## C-1 — Mecanismo de autenticação de editor: **magic link (Supabase Auth), sem senha** ✅ RESOLVIDA

**Pergunta:** como o editor autentica? Senha, magic link, OAuth?

**Decisão:** **Supabase Auth com magic link (passwordless)** — o editor recebe um link por e-mail e não há senha. **Sem gestão de senha/reset** (não existe senha). Sem auto-cadastro público (o conjunto é fechado — ver C-4). OAuth/social fora.

**Por quê:** conjunto pequeno e fechado de editores internos; magic link elimina gestão de credencial (armazenamento, reset, política de força de senha) e reduz superfície de ataque. Depende de e-mail transacional configurado no Supabase Auth — **a verificar no Design** (provedor de e-mail do projeto Supabase).

**Impacto no Design:** fluxo = página de solicitação (e-mail) → e-mail com magic link → rota de callback que estabelece a sessão (cookies server-side, provável `@supabase/ssr`). Sem tela/fluxo de senha.

---

## C-2 — Modelo de escrita do painel: **autenticado + RLS por padrão; `service_role` só como exceção documentada** ✅ RESOLVIDA *(decisão de segurança central)*

**Pergunta:** toda escrita do painel usa `service_role`?

**Decisão (privilégio mínimo):** o **padrão do painel admin é o client AUTENTICADO** (JWT do editor logado, papel `authenticated`) operando **sob RLS**. A `service_role` é reservada **apenas** a operações que **genuinamente** precisam furar a RLS, e **cada uma é documentada como exceção** (justificativa + caminho autenticado que a gateia). A RLS **continua ativa no admin** — é o gate no banco mesmo se uma checagem de app falhar (defesa em profundidade).

**Consequência de requisito (registrada):** isso **exige policies de RLS de ESCRITA para o papel autenticado** (keyed no papel `editor`/`admin` via `auth.uid()` → `editor`). Sem essas policies, o editor autenticado não escreve (deny-by-default). → ver SEC-11/SEC-12.

**Três clients (não dois):**

| Client | Chave / papel | RLS | Uso |
| --- | --- | --- | --- |
| **público** | publishable (anon), **sem fallback** | **gate** | leitura pública (migra do atual) |
| **autenticado** | JWT do editor logado (`authenticated`) | **gate** | **escrita editorial padrão** (review draft/publish; provisionar editor por admin) via policies keyed no papel |
| **admin** | `service_role` | **bypass** | **exceção documentada** — só operações que comprovadamente exigem burlar RLS |

**`service_role` nesta feature:** o módulo do client admin é **criado e isolado** (cumpre TD-04 — a base fica pronta e segura), mas **fica dormente**: nenhuma operação desta feature precisa de bypass (login usa o client autenticado; bootstrap do 1º admin é manual — C-4; provisionar editores é `admin` autenticado + policy). Assim a `service_role` **pode permanecer não-configurada em Production** até que uma feature futura especifique uma exceção real (SEC-17 vira princípio permanente, não só gate de merge).

**Possível ADR:** **D-09 — modelo de escrita do painel** (autenticado+RLS por padrão, `service_role` como exceção mínima). Registrar em DECISIONS.md.

---

## C-3 — Fronteira estrutural do client admin: **`server-only` + env sem `NEXT_PUBLIC` + guard de import** ✅ RESOLVIDA

**Decisão:** o módulo admin importa **`import 'server-only'`** (o build do Next quebra se ele entrar em bundle de cliente); a `service_role` vem de env **sem** prefixo `NEXT_PUBLIC` (nunca exposta ao browser por construção); opcionalmente uma **regra de lint de import boundary** restringe o import a caminhos server/admin. Camadas redundantes → falha no **build**, não em runtime.

**Por quê:** `server-only` é o mecanismo idiomático do App Router; o prefixo de env é a 2ª barreira (a chave nunca vai ao cliente). Coerente com o rigor "fronteira que quebra o build" do projeto.

---

## C-4 — Bootstrap do 1º admin: **criação manual (dashboard/SQL), documentada, sem automatizar** ✅ RESOLVIDA

**Decisão:** o **primeiro editor (`role='admin'`)** é criado **manualmente** via **dashboard/SQL do Supabase** — uma operação **única** de bootstrap, **documentada no spec**, **sem credencial em código nem no seed** e **sem automação** (nada de trigger que promova `auth.users` a editor). O passo: criar o `auth.users` (convite/magic link no dashboard) e inserir a linha `editor` com o mesmo `id` e `role='admin'`.

**Editores seguintes:** provisionados por um **admin autenticado** (via caminho `admin` + policy RLS), fluxo cuja UI é follow-up.

**Por quê:** evita qualquer caminho automático que transforme um usuário arbitrário em editor; o bootstrap manual resolve o "ovo-galinha" sem embutir segredo no repositório. Documentar o passo (runbook) no spec, não executá-lo aqui.

---

## C-5 — `security-foundation` × `admin-auth-editors`: **são a mesma coisa — fundidas** ✅ RESOLVIDA

**Decisão:** a **auth de editores faz parte desta fundação**. A entrada `admin-auth-editors` do ROADMAP (login, papéis `admin`/`editor`, RBAC via RLS) é **absorvida** por `security-foundation` — **uma única entrada**, sem trabalho sobreposto descrito em dois lugares. `security-foundation` entrega: separação de clients + auth de editor (magic link + sessão + RBAC) + GRANTs/policies + regressão. As features seguintes do M2 (`reviews-crud`, `admin-reviews`, Storage) consomem esta fundação.

**Ação:** remover/fundir `admin-auth-editors` no ROADMAP.md (feito).

---

## C-6 — Escopo de policies: **deny-by-default garantido; lógica de moderação NÃO entra** ✅ RESOLVIDA

**Decisão:** esta feature **NÃO** inclui policies de **moderação de `comment`** (nem de `recommendation`). O escopo de RLS/GRANT aqui é: **garantir o deny-by-default** de **todas** as tabelas do M2 (RLS habilitada — já está desde 0001 — + a ausência de GRANT/policy indevidos), de modo que **nenhuma tabela fique exposta**, **mais** as policies/GRANTs que a fundação **precisa** para funcionar: `editor` (self-read + admin) e **escrita de `review`** pelo editor autenticado (destrava `reviews-crud`), reafirmando as leituras públicas (0003/0005/0006).

**Limite explícito:** *quem-modera-o-quê* (aprovar/rejeitar comentário, quem pode publicar de quem) é **lógica da feature de moderação** (`admin-comment-moderation`, M3) e do `admin-reviews` — **não** desta fundação. Para `comment`/`recommendation`, esta feature apenas **confirma e testa** o estado deny-by-default (anon não lê `pending`, não escreve), sem abrir policy de escrita/moderação.

**Por quê:** mantém a fundação enxuta e evita desenhar policies de features (comment/recommendation) que dependem de D-02/D-03, ainda não decididas. TD-03 é **reduzida** de forma rastreável; remanescentes listados (SEC-18).

---

## Registro para DECISIONS.md / STATE.md (após o commit)

- **TD-04 → em correção** nesta feature (separação de clients; fecha no merge). Fallback `??` removido.
- **TD-03 → reduzida** (GRANTs/policies do M2 core: `editor` + escrita de `review`); remanescentes (`comment` moderação, `recommendation`, Storage, Data API/`service_role` de tabelas não-tocadas) **listados**.
- **Gate/princípio de rollout:** `SUPABASE_SERVICE_ROLE_KEY` só entra em Production quando uma exceção real de bypass for especificada (C-2) — e nunca antes do merge desta feature.
- **D-09 (nova ADR proposta):** modelo de escrita do painel (autenticado+RLS por padrão; `service_role` exceção mínima).
- **Auth:** magic link (C-1); bootstrap manual do 1º admin (C-4); `admin-auth-editors` fundida aqui (C-5).
