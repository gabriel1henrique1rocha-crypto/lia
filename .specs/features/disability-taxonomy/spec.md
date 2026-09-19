# DIS — `disability-taxonomy` (D-12, vertical de livros)

**Marco:** M4 · **Fase:** Execute concluído (2026-09-19) — spec **aprovada** com P-1..P-4 conforme recomendação · **ADR:** [D-12](../../project/DECISIONS.md#d-12--taxonomia-de-deficiência-representada)
**Origem:** doc "Customização do site" (Mirian, 2026-09-14) — "Resenhas: buscador por deficiência representada no lugar da nota"; "Página da resenha: DEFICIÊNCIA(S) REPRESENTADA(S), mais de uma por obra"; comentário: "usar as defis que constam no nosso formulário de coleta de dados".

## 1. Problema

Desde D-11 a home não tem o eixo editorial do observatório: não dá para achar
resenhas pela deficiência representada. A ficha da resenha também não informa
isso. D-12 já decidiu a MODELAGEM (vocabulário único + junção por vertical);
o que travava era o vocabulário inicial `[PREENCHER]`.

**Desbloqueio proposto:** o vocabulário é DADO, não schema. A migration cria a
estrutura e semeia uma **lista-base provisória** (§4); a lista final é validada
pela Mirian e ajustada por `UPDATE`/`INSERT` — sem nova migration de estrutura.

## 2. Escopo

**Dentro:**
- Tabela `disability_term` + junção `review_disability` (N:N), RLS e GRANTs.
- Seleção múltipla de deficiência(s) no formulário do admin (criar e editar).
- Campo "Deficiência(s) representada(s)" na ficha resumida da resenha pública.
- Filtro por deficiência na busca da home (`?deficiencia=<slug>`, form GET, sem JS).
- Seed da lista-base provisória (§4).

**Fora (registrado):**
- `film_disability` e Filmografia — modelada em D-12, implementada com a vertical de filmes.
- Tela de admin para gerenciar os termos (criar/renomear/desativar) — ver P-2.
- Página por termo (`/deficiencia/<slug>`) e consulta transversal livros+filmes.

## 3. Requisitos

- **DIS-01** — `disability_term(id uuid, name text unique, slug text unique, active boolean default true, sort_order smallint, created_at)`. Nunca deleta: desativar (`active=false`) preserva o histórico.
- **DIS-02** — `review_disability(review_id → review ON DELETE CASCADE, term_id → disability_term ON DELETE RESTRICT, PK composta)`.
- **DIS-03** — RLS: `anon`/`authenticated` leem termos **ativos**; só `is_admin()` escreve em `disability_term`. Em `review_disability`: leitura pública só de vínculos de resenha **publicada**; escrita segue own-or-admin da resenha (mesma regra da 0008). GRANTs explícitos (pós-2026-05-30).
- **DIS-04** — Gravação atômica: resenha + livro + deficiências na MESMA transação (estender `create_review_with_book`/`update_review_with_book` com `p_disability_ids uuid[] default null`; `null` = não mexer, `{}` = limpar). Parâmetro novo com default para não quebrar a janela de deploy (padrão da 0012).
- **DIS-05** — Admin: grupo de checkboxes em `<fieldset><legend>Deficiência(s) representada(s)</legend>`, só termos ativos, ordem `sort_order`. Termo inativo já vinculado aparece marcado e identificado "(desativado)".
- **DIS-06** — Pública (ficha): par `Deficiência(s) representada(s)` com os nomes em lista; omitido se vazio (sem `<dt>` órfão).
- **DIS-07** — Busca: `<select name="deficiencia">` com "Todas" + termos ativos que têm ao menos uma resenha publicada; slug inválido é ignorado (degrada sem erro, como `?nota=`).
- **DIS-08** — Publicar sem deficiência é **permitido** (as 5 resenhas atuais não têm) — ver P-3.
- **DIS-09** — WCAG 2.1 AA: nome acessível no grupo, foco visível, axe limpo, filtro funcional sem JS.

## 4. Lista-base provisória (para a Mirian validar)

Base legal brasileira (Decreto 5.296/2004, art. 5º; LBI 13.146/2015; Lei 12.764/2012 para TEA) + psicossocial (CDPD):

| # | Termo proposto |
|---|---|
| 1 | Deficiência física |
| 2 | Deficiência visual (cegueira e baixa visão) |
| 3 | Deficiência auditiva / Surdez |
| 4 | Surdocegueira |
| 5 | Deficiência intelectual |
| 6 | Transtorno do Espectro Autista (TEA) |
| 7 | Deficiência psicossocial |
| 8 | Deficiência múltipla |

**Pedido à Mirian:** substituir esta tabela pela lista do formulário de coleta de dados. Os nomes podem ser trocados depois sem migration.

## 5. Decisões para aprovação

- **P-1 — Granularidade.** Termos amplos (tabela acima) ou finos (cegueira ≠ baixa visão, surdez ≠ deficiência auditiva)? *Recomendo amplos agora*: a lista do formulário decide, e dividir depois é `INSERT` + reclassificação das poucas resenhas existentes.
- **P-2 — Gestão dos termos.** Nesta entrega, termos mudam por SQL (só o Gabriel). A tela de admin fica para depois. *Recomendo assim*: a lista muda raramente, e a tela é escopo extra.
- **P-3 — Obrigatoriedade.** Exigir ≥1 deficiência para PUBLICAR? *Recomendo não exigir agora* (as 5 publicadas quebrariam na próxima edição); reavaliar quando o acervo estiver classificado.
- **P-4 — Filtro com um termo por vez** (select) ou vários (checkboxes na busca)? *Recomendo um por vez*: URL simples, no-JS trivial, e cobre "o que o OLDA tem sobre X?".

## 6. Done when

- [ ] Migration 0013 aplicada com `db push` ANTES do merge; RLS verificada por oráculo superusuário.
- [ ] Admin marca 0..N deficiências ao criar e editar; salvar sem tocar mantém os vínculos.
- [ ] Ficha pública mostra as deficiências; some se vazio.
- [ ] `/?deficiencia=<slug>` filtra; slug inválido não quebra.
- [ ] Gate verde: `typecheck; lint; format:check; test; test:a11y`.
