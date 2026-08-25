# DECISIONS — LIA (ADRs)

Registro de decisões arquiteturais. Origem: seção 10 do PRD ([docs/PRD-LIA.md](../../docs/PRD-LIA.md)).

**Status possíveis:** `Aceita` (resolvida) · `A decidir` (proposta, será resolvida na feature indicada).

| ID | Decisão | Status | Resolver em |
|---|---|---|---|
| D-01 | Escala da nota | ~~Aceita~~ **Superseded por D-11** | `reviews-crud` (M3) |
| D-02 | Anti-spam de comentários sem login | A decidir | `public-comments` (M3) |
| D-03 | Modelo de indicação (recomendam vs votação) | A decidir | `recommendations` (M3) |
| D-04 | Estratégia de busca | **Aceita** | `review-listing-search` (M1) |
| D-05 | Hospedagem | **Aceita** | `infra-foundation` (M0) |
| D-06 | Linguagem tipada | **Aceita** | `infra-foundation` (M0) |
| D-07 | Versão do Tailwind + estratégia de tokens | **Aceita** | `infra-foundation` (M0) |
| D-08 | Domínio canônico de produção | **Aceita** | `infra-foundation` (M0) |
| D-09 | Modelo de escrita do painel (autenticado+RLS; service_role exceção) | **Aceita** | `security-foundation` (M2) |
| D-10 | Sessão server-only + cookies httpOnly | **Aceita** | `security-foundation` (M2) |
| D-11 | Remoção da nota (rating) do produto | **Aceita** | `reviews-crud` (M3) |
| D-12 | Taxonomia de deficiência representada | **Aceita** | vertical de deficiência (M4) |
---

## D-05 — Hospedagem: Vercel

**Status:** Aceita · **Data:** 2026-06-07 · **Milestone:** M0 (`infra-foundation`)

**Contexto:** a stack é Next.js (App Router) com SSR/SSG e necessidade de CDN global e deploy contínuo.

**Decisão:** hospedar na **Vercel**.

**Razão:** suporte first-class a Next.js (App Router, SSR/SSG, edge), CDN global e integração direta com o fluxo de deploy via GitHub Actions. Reduz fricção de infra no MVP.

**Trade-off:** acoplamento ao ecossistema Vercel; custo pode escalar com tráfego. Aceitável no MVP.

**Impacto:** pipeline de deploy do M0 mira a Vercel; otimização de imagens e CDN assumidas como nativas da plataforma.

---

## D-06 — Linguagem tipada: TypeScript

**Status:** Aceita · **Data:** 2026-06-07 · **Milestone:** M0 (`infra-foundation`)

**Contexto:** a base da stack é JavaScript/Node.js. O modelo de dados e os contratos entre camadas (Supabase ↔ Next.js) se beneficiam de tipagem.

**Decisão:** adotar **TypeScript** sobre a base JavaScript.

**Razão:** tipar o modelo de dados e os contratos reduz bugs e melhora a manutenção, respeitando a stack "JavaScript". Recomendado no PRD.

**Trade-off:** passo de build/tipagem adicional e curva inicial. Compensado pela redução de bugs em cascata.

**Impacto:** projeto inicializado em TypeScript no M0; tipos derivados do schema das entidades núcleo; convenção de código em inglês.

---

## D-07 — Versão do Tailwind + estratégia de tokens

**Status:** Aceita · **Data:** 2026-06-07 · **Milestone:** M0 (`infra-foundation`)

**Contexto:** o scaffold precisa fixar a versão do Tailwind, pois ela define a estratégia de tokens (INFRA-07). O export de design oferece dois caminhos: v4 (`@theme`) ou v3 (`var(--token)`).

**Decisão:** adotar **Tailwind v4** com tokens declarados em `@theme` no `globals.css` como **fonte única** (sem `tailwind.config.js`).

**Razão:** padrão recomendado para projetos novos (`create-next-app --tailwind` instala v4); CSS-first elimina a duplicação `:root` ↔ config, satisfazendo INFRA-07 nativamente. Decisão acoplada (DD-2): a escala de espaçamento usa `--spacing: initial` + chaves explícitas `1–9` para honrar o token 1:1 e eliminar a colisão da INFRA-08.

**Trade-off:** v4 é mais novo (menos material legado); a escala numérica do token (`p-8`=64px) diverge da convenção numérica do Tailwind — documentado no `globals.css` e no design.

**Impacto:** `infra-foundation` configura tokens via `@theme`; componentes consomem só tokens; sem segundo arquivo a sincronizar.

---

## D-08 — Domínio canônico de produção

**Status:** Aceita · **Data:** 2026-07-30 · **Milestone:** M0 (`infra-foundation`)

**Contexto:** o domínio inicialmente registrado para produção, `www.literaturainclusiva.com.br`, permaneceu em **Invalid Configuration** na Vercel — o DNS nunca chegou a apontar corretamente (zona no Registro.br) — e o site seguiu servido pelo alias `lia-kappa.vercel.app`. Um novo domínio, `www.observatorioolda.com.br`, foi registrado na Hostinger.

**Decisão:** o domínio canônico de produção passa a ser **`www.observatorioolda.com.br`** (apex responde `308` → `www`). Substitui `www.literaturainclusiva.com.br` como domínio de referência do projeto.

**Razão:** registro efetivo do domínio na Hostinger, com DNS validado e SSL válido; o domínio anterior nunca saiu do estado "Invalid Configuration" na Vercel.

**Trade-off:** nenhum — é a resolução de uma pendência de infraestrutura (DNS), não uma escolha entre alternativas técnicas.

**Impacto:** `NEXT_PUBLIC_SITE_URL` de Production (setada na Vercel, fora deste repo) passa a `https://www.observatorioolda.com.br`, consumida por `metadataBase` em [layout.tsx](../../src/app/layout.tsx) (`og:url`/canonical) e pelo futuro sitemap (`seo-core`). `.env.example` atualizado como referência. Fecha a pendência de DNS registrada no backlog do [STATE.md](STATE.md).

---

## D-09 — Modelo de escrita do painel: autenticado + RLS por padrão; `service_role` como exceção mínima

**Status:** Aceita · **Data:** 2026-07-08 · **Milestone:** M2 (`security-foundation`)

**Contexto:** o painel admin introduz escrita no banco pela primeira vez. Duas rotas possíveis: toda escrita via `service_role` (bypassa RLS) ou via o JWT do editor logado (papel `authenticated`, sob RLS). A escolha define a superfície de risco de todo o M2+.

**Decisão:** o **padrão é o client AUTENTICADO** (JWT do editor, `authenticated`) operando **sob RLS**. A `service_role` é reservada **apenas** a operações que comprovadamente precisam furar a RLS, e **cada uma é uma exceção documentada** (ADR própria + GRANT mínimo + gate de sessão/papel no servidor). Nesta fundação a `service_role` fica **dormente**: o módulo do client admin existe e está isolado (server-only + env sem `NEXT_PUBLIC` + lint com allowlist vazia), mas **nenhuma operação a usa**.

**Razão:** privilégio mínimo (C-2). A RLS vira o gate no banco mesmo se uma checagem de app falhar (defesa em profundidade). Consequência de requisito: exige **policies de RLS de escrita** keyed no papel via `auth.uid() → editor` (migrations 0007/0008), o que a feature entrega e prova (matriz T16, 17/17).

**Trade-off:** escrever policies de escrita por papel dá mais trabalho que "bypass e valida no app". Compensa: a segurança não depende de lembrar de checar no app; um bug de app não vira vazamento porque a RLS reavalia por statement.

**Impacto:** provado empiricamente que o `service_role` **não** tem GRANT de tabela nas tabelas do M2 (T16: `42501`) — a dormência é real, não só convenção. Bootstrap e fixtures usam `postgres` (superuser) privilegiado, não `service_role` (ver [runbook](../../docs/runbook-admin-bootstrap.md)). Gate SEC-17: `SUPABASE_SERVICE_ROLE_KEY` fora de Production até uma exceção real existir.

---

## D-10 — Sessão do editor server-only + cookies de auth httpOnly

**Status:** Aceita · **Data:** 2026-07-08 · **Milestone:** M2 (`security-foundation`)

**Contexto:** o M2 introduz autenticação de editor (magic link + `@supabase/ssr`). É preciso definir ONDE a sessão é lida e QUAIS atributos os cookies de auth carregam. O default do `@supabase/ssr` é `httpOnly:false` (para que um browser client consiga ler a sessão).

**Decisão:** a sessão do editor/admin é consumida **exclusivamente no servidor** — guards (`requireEditor`/`requireAdmin`) em server component / route handler; refresh server-side no `proxy.ts`; **nenhum browser client lê a sessão**. Os cookies de sessão são setados no callback (`/auth/confirm`) com **`httpOnly: true` + `Secure` (produção) + `SameSite=Lax`**, aplicados de forma consistente também no proxy e no client autenticado (`cookieOptions` do `createServerClient`, que a lib faz merge nas escritas).

**Razão:** `httpOnly` torna o cookie de sessão inacessível a JavaScript, mitigando roubo de sessão por XSS (F-13). É possível **porque** a sessão nunca é lida no browser — nenhuma funcionalidade depende de ler o token no cliente. `SameSite=Lax` protege contra CSRF em navegação cross-site preservando o fluxo de clique no link do e-mail. `Secure` só em produção porque um cookie Secure não é gravado sobre HTTP (dev/local + Mailpit usam `http://127.0.0.1`).

**Trade-off:** features futuras que precisem falar com o Supabase a partir do browser **não** poderão usar o JWT no cliente — deverão passar por **server action / route handler** usando o client autenticado. É o precedente pretendido (uploads de Storage, realtime de moderação seguem esse caminho), não uma limitação incidental.

**Impacto:** `src/lib/auth/cookieOptions.ts` centraliza `SESSION_COOKIE_OPTIONS`, consumido por `authenticated.ts`, `proxy.ts` e pelo callback. Fecha o resíduo A-10 do design (era "verificar no Execute") como decisão de primeira classe.

---

## D-01 — Escala da nota

**Status:** ~~Aceita~~ **SUPERSEDED por [D-11](#d-11--remoção-da-nota-rating-do-produto)** (2026-08-24) · **Data:** 2026-08-09 · **Milestone:** M3 (`reviews-crud`)

> **Superseded por D-11 em 2026-08-24.** A nota saiu do produto por inteiro, então a pergunta que esta ADR respondia — *qual escala?* — deixou de existir. O texto abaixo permanece **intacto e sem edição**: é o registro de por que a escala inteira foi escolhida enquanto a nota existia, e o contexto que D-11 precisa para ser lida. Não implementar nada a partir daqui.

**Contexto:** a resenha tem uma nota exibida na listagem, na página e usada em filtros/ordenação. A escala precisa ser definida antes do CRUD.

**Opções:** (a) 0–5 estrelas com meia estrela, armazenado como número `0.0–5.0`; (b) escala inteira 0–5; (c) escala 0–10.

**Recomendação do PRD:** 0–5 estrelas com meia estrela, armazenar como número (`0.0`–`5.0`).

**Decisão:** **(b) escala inteira 0–5** — nota numérica de 0 a 5, **só inteiros**, **sem meio-ponto**.

**Razão:** simplicidade do cadastro (controle acessível de 0–5 sem parsear decimais). A coluna `review.rating numeric(2,1)` é **mantida** (aceita `4.0`); a restrição a inteiros é regra de validação — o mecanismo de enforcement (CHECK no banco × validação no app) é detalhe de Design da `reviews-crud`.

**Trade-off:** granularidade menor que meia-estrela; aceitável no MVP e reversível de forma aditiva (afrouxar para meio-ponto não exige recriar coluna).

**Impacto:** `reviews-crud` valida a nota como inteiro 0–5 de forma acessível (REV-07). O seed de produção **tem dados existentes com meio-ponto** (`dom-casmurro` e `iracema` = 4,5) — a migration 0009 vai precisar tratá-los antes de qualquer CHECK no banco; a **estratégia de normalização (round/floor/ceil) fica para a revisão do Design** (ponto A-3), fora do escopo desta ADR.

---

## D-02 — Anti-spam de comentários sem login (acessível)

**Status:** A decidir · **Resolver em:** `public-comments` (M3)

**Contexto:** comentários são enviados sem autenticação; a proteção anti-spam precisa ser acessível (não pode depender de visão, por WCAG 2.1 AA).

**Opções:** (a) honeypot + rate-limit por hash de IP + moderação obrigatória; (b) CAPTCHA visual (rejeitado por acessibilidade); (c) desafio acessível adicional se necessário.

**Recomendação do PRD:** honeypot + rate-limit por hash de IP + moderação obrigatória; evitar CAPTCHA visual; desafio acessível só se necessário.

**Decisão:** _pendente._

---

## D-03 — Modelo de indicação: "leitores recomendam" vs votação

**Status:** A decidir · **Resolver em:** `recommendations` (M3)

**Contexto:** a seção de indicações pode ser submissão de conteúdo ("leitores recomendam") ou votação em resenhas existentes. A escolha afeta moderação e modelo de dados (`recommendation`).

**Opções:** (a) votação/recomendação em resenhas existentes, sem login, com controle por rate-limit/fingerprint; (b) submissão aberta "leitores recomendam".

**Recomendação do PRD:** votação/recomendação em resenhas existentes no MVP (mais simples, menos moderação); submissão "leitores recomendam" fica para fase futura.

**Decisão:** _pendente._

---

## D-04 — Estratégia de busca

**Status:** Aceita · **Data:** 2026-07-06 · **Milestone:** M1 (`review-listing-search`)

**Contexto:** a listagem precisa de busca por título e filtros combináveis. A abordagem afeta o schema e a infra.

**Opções:** (a) Postgres full-text search / `ilike` no Supabase no MVP; (b) busca avançada / serviço dedicado (fase futura); (c) busca client-side sobre dados carregados (rejeitada — quebra o DoD de a11y sem-JS e a paginação real).

**Decisão:** **server-side no Supabase via `ilike`** (`%termo%`, case-insensitive), alvo **só `review.title`** (C-1 — autor/gênero são FILTROS, não busca textual). Filtros/ordenação/paginação compõem na mesma query, via cliente **anon** lendo só `status='published'`.

**Razão:** única opção que honra o DoD de a11y (busca/filtros funcionam **sem JS**, via `searchParams` na URL) e a paginação real (`range` + `count`); RLS permanece o gate na origem. Recomendação do PRD.

**Trade-off (registrado):** `ilike '%termo%'` **não usa índice B-tree** — full scan na tabela. Irrelevante no volume do MVP; **migrar para Postgres full-text (tsvector) ou `pg_trgm` quando o volume justificar** (evolução aditiva, sem quebrar o contrato da query).

**Impacto:** `listPublishedReviews(params)` na camada de query; home lê `searchParams`; controles como form GET + links (progressive enhancement).

---

## D-11 — Remoção da nota (rating) do produto

**Status:** Aceita · **Data:** 2026-08-24 · **Milestone:** M3 (`reviews-crud`)
**Supersedes:** [D-01](#d-01--escala-da-nota) (escala inteira 0–5)

**Contexto:** o OLDA é um **observatório de literatura e deficiência**. A avaliação numérica de obras não serve ao propósito editorial: o observatório documenta e mapeia representação, não emite veredito de qualidade. O eixo de navegação relevante é a **deficiência representada**, não a nota atribuída. A nota foi herdada do PRD original (site de resenhas) e sobreviveu até aqui por inércia — D-01 decidiu *qual escala usar* sem que a pergunta anterior (*deve existir?*) tivesse sido feita.

**Decisão:** a nota **deixa de ser capturada, exibida e usada como filtro ou ordenação**.

**Razão:** um número de 0 a 5 ao lado de uma obra convida o leitor a ler a página como recomendação de consumo, não como registro de observatório. Some-se a isso que a nota é o único campo do modelo que exprime juízo do resenhista sobre mérito — todos os outros (ficha ABNT, tags, deficiência representada) são descritivos. Retirá-la alinha o produto ao propósito e libera o lugar de destaque na UI para o eixo que importa (D-12).

**Trade-off:** perde-se a ordenação "Melhor nota" da home, hoje uma das três opções de ordenação, e o filtro por nota mínima. Enquanto o filtro por deficiência representada (D-12) não existir, a home fica com **menos** eixos de navegação do que tem hoje — é o custo aceito, e é exatamente por isso que a ORDEM DE REMOÇÃO abaixo é parte da decisão, não detalhe de implementação.

**Consequências:**

- a `0009` perde o `CHECK review_rating_integer` e os UPDATEs de normalização (a migration **ainda não foi aplicada em produção** — o registro para na `0008` —, logo ela é editável sem migration corretiva);
- **T9** (`RatingInput`) deixa de existir;
- **T5** (schema Zod), **T8** (formulário), **T11**/**T12** (exibição pública) encolhem;
- o **M1 já em produção** precisa de regressão: filtro por nota, ordenação "Melhor nota" e exibição da nota na home, no card e na página de resenha;
- a coluna `review.rating` **NÃO é dropada por esta decisão** (ver ORDEM DE REMOÇÃO).

**ORDEM DE REMOÇÃO** — parte da decisão, não detalhe de implementação:

1. a `0009` para de **constranger** a coluna (CHECK e normalização saem);
2. a aplicação para de **escrever** nela (M3 — schema, formulário, RPCs);
3. a aplicação para de **ler / filtrar / ordenar** por ela — **SOMENTE depois que o filtro por deficiência representada existir**, sob pena de deixar a home sem filtro algum;
4. uma **migração dedicada** dropa a coluna — só quando nada mais a lê.

Entre os passos 2 e 4 a coluna fica **dormente, com os dados intactos**: nada escreve, o que já estava gravado permanece. É o que torna a decisão **reversível** sem recuperação de backup — reverter antes do passo 4 custa reativar código, não restaurar dado. O passo 4 é a única porta de mão única, e por isso é o último e tem migration própria.

**Impacto:** ~~esta ADR executa os passos 1 e 2 no M3. O passo 3 fica bloqueado por D-12 e é registrado como pendência explícita no `tasks.md` de `reviews-crud`. O passo 4 não tem data — depende do passo 3 estar concluído e verificado em produção.~~ **Substituído pela emenda abaixo.**

### EMENDA 2026-08-24 — ORDEM DE REMOÇÃO COLAPSADA

A **ORDEM DE REMOÇÃO acima foi colapsada por decisão do responsável.** Os passos **2, 3 e 4 executam juntos**: o código de leitura sai e a coluna é dropada na mesma leva (migration **`0010_drop_review_rating.sql`**).

**Consequência aceita explicitamente:** a home fica **sem filtro nem ordenação** até o filtro por deficiência representada ([D-12](#d-12--taxonomia-de-deficiência-representada)) existir — e D-12 está bloqueada pelo vocabulário inicial, ainda `[PREENCHER]`. **Isto não é regressão acidental**: é o custo conhecido, ponderado e aceito de não manter a coluna dormente esperando D-12.

O **texto original da ordem permanece acima**, sem edição, como registro do que foi ponderado — inclusive o argumento de que o passo 4 é "a única porta de mão única". Ele continua verdadeiro: **o drop é irreversível**, e a decisão foi tomada sabendo disso. Depois da `0010` aplicada em produção, os valores de nota das resenhas existentes **só voltam por restauração de backup**.

**O que muda na prática:**

- a `0009` **não é reeditada** — ela já havia sido emendada (`accdc9a`) para não constranger a coluna, e migration aplicada ou não, não se reescreve para acrescentar um drop; o drop vai em arquivo próprio;
- a `0010` **não é aplicada por esta ADR** — `db push` segue sendo passo humano (A-11);
- a pendência de regressão do M1 registrada no `tasks.md` deixa de ser futura e passa a **executada**.

---

## D-12 — Taxonomia de deficiência representada

**Status:** Aceita · **Data:** 2026-08-24 · **Milestone:** M4 (vertical de deficiência)

**Contexto:** com a saída da nota (D-11), o eixo de navegação do observatório passa a ser a **deficiência representada** na obra. Isso exige um modelo de dados que ainda não existe. A escolha estrutural é entre um vocabulário único compartilhado por todas as verticais (livros, filmografia, e o que vier) ou vocabulários independentes por vertical.

**Opções:** (a) vocabulário **único e controlado**, compartilhado, com junções separadas por vertical; (b) tabelas de termos **separadas por vertical** (`review_disability_term`, `film_disability_term`, …); (c) campo de texto livre com tags (rejeitada de saída — sem controle, a nomenclatura diverge no primeiro mês e a consulta transversal nunca funciona).

**Decisão:** **(a) vocabulário ÚNICO e controlado**, compartilhado entre as verticais, com **junções separadas por vertical**:

- **`disability_term`** — lista fechada; **só admin** cria, renomeia e desativa (nunca deleta: desativar preserva o histórico das obras já marcadas);
- **`review_disability`** — junção N:N com `review`;
- **`film_disability`** — junção N:N com `film` (vertical futura).

**Razão:** a consulta que dá sentido ao observatório é transversal — *"o que o OLDA tem sobre cegueira?"* deve responder livros **e** filmes numa lista só. Com vocabulários separados essa pergunta exige unir tabelas por string, o que só funciona enquanto ninguém escrever "Cegueira" de um lado e "Deficiência visual" do outro. Um vocabulário único também concentra a curadoria: renomear um termo é um `UPDATE` numa linha, não uma varredura por vertical.

**A reversibilidade é assimétrica, e é o argumento decisivo:** sair de **único → separado** é barato (basta marcar cada termo com a vertical a que pertence e particionar); sair de **separado → único** exige **deduplicação com julgamento humano** — alguém precisa decidir, caso a caso, se dois termos parecidos são o mesmo conceito, e essa decisão não é automatizável nem reversível. Diante de duas opções plausíveis, escolhe-se a que deixa a porta de saída aberta.

**Trade-off:** as junções separadas por vertical significam uma tabela nova por vertical adicionada, em vez de uma única junção polimórfica com `(entity_type, entity_id)`. É deliberado: a junção polimórfica não aceita chave estrangeira real, e perder integridade referencial para economizar uma tabela é troca ruim.

**Escopo:** a **filmografia é contemplada na modelagem** desde já — `film_disability` é desenhada junto —, mas **implementada depois**; o M4 entrega a vertical de livros. Modelar as duas juntas evita que a segunda vertical force a remodelagem da primeira.

**Vocabulário inicial:** **[PREENCHER — decisão editorial pendente]**. A lista de termos é escolha editorial do observatório, não técnica, e bloqueia a migration de seed da tabela `disability_term` (não a modelagem, que pode seguir).

**Impacto:** ~~desbloqueia o passo 3 da ORDEM DE REMOÇÃO de D-11 — o filtro por nota só pode sair da home depois que o filtro por deficiência existir. Enquanto D-12 não for implementada, a home mantém o filtro por nota mesmo com a captura já removida.~~

**REVISTO pela emenda de D-11 (2026-08-24):** a ordem foi colapsada e o filtro por nota **já saiu**, sem esperar por D-12. A relação entre as duas ADRs inverteu-se: D-12 não desbloqueia mais nada — ela **fecha uma lacuna já aberta**. Enquanto o vocabulário inicial seguir `[PREENCHER]`, a home fica **sem filtro nem ordenação**. Isso torna D-12 mais urgente do que era, não menos.
