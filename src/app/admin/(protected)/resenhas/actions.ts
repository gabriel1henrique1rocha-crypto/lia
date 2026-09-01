'use server'

import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/auth/requireEditor'
import { createAuthenticatedClient } from '@/lib/supabase/authenticated'
import { slugify } from '@/lib/review/slug'
import { readReviewForm, mapZodIssues, echoValues } from '@/lib/review/formData'
import {
  reviewStatusSchema,
  reviewDraftSchema,
  reviewPublishSchema,
  toCreateReviewRpcArgs,
  toUpdateReviewRpcArgs,
  type ReviewStatus,
} from '@/lib/review/schema'

/**
 * Server actions de escrita de resenha (T6). Ligam o formulário (T8) aos RPCs
 * atômicos da 0011.
 *
 * GATE POR OPERAÇÃO (SEC-08): cada action chama `requireEditor()` ANTES de
 * qualquer escrita. O layout `(protected)` protege PÁGINAS; server action é um
 * endpoint próprio, alcançável sem passar por página nenhuma — proteger só o
 * layout deixaria a escrita aberta.
 *
 * A RLS continua sendo o gate final: mesmo que este gate falhasse, as policies
 * de 0008/0009 reavaliam cada statement. Defesa em profundidade, não redundância.
 */

/**
 * O TIPO fica AQUI (declaração de tipo é apagada na compilação e não vira
 * endpoint); o VALOR neutro `IDLE_STATE` mora em `@/lib/review/formState`,
 * porque módulo `'use server'` só pode exportar função assíncrona. Ver o
 * cabeçalho daquele arquivo — foi um defeito latente do T6 que só acendeu
 * quando a T10 importou este módulo a partir de outro `'use server'`.
 *
 * Reexportar o tipo daqui (`export type { … }`) NÃO funciona: o registrador de
 * actions do Next lê o statement de reexport antes do apagamento de tipos e
 * tenta criar um endpoint para ele — `Export ReviewFormState doesn't exist in
 * target module`. Declaração, sim; reexport, não. Verificado nos dois sentidos.
 */
export type ReviewFormState = {
  status: 'idle' | 'saved' | 'error'
  message: string
  /** Erros por campo, para o `Field.error` do formulário (T8). */
  fieldErrors?: Record<string, string>
  /** Eco dos valores submetidos, para repopular sem perder digitação. */
  values?: Record<string, string>
}

/**
 * Mensagem ÚNICA para toda negação de acesso.
 *
 * Os RPCs devolvem 42501 tanto para "não existe" quanto para "não é seu" — de
 * propósito (0011), para não vazar a existência de rascunho alheio. As actions
 * PRESERVAM essa indistinção: os três caminhos abaixo produzem exatamente esta
 * string, sem detalhe que permita diferenciá-los —
 *
 *   1. a linha não é visível para o chamador (leitura devolve null);
 *   2. a linha é visível mas o UPDATE não alcança nenhuma (0 linhas);
 *   3. o banco levanta 42501.
 *
 * Se algum deles ganhasse mensagem própria, um atacante distinguiria "esse
 * rascunho não existe" de "existe e é de outro editor" — que é exatamente a
 * informação que a indistinção protege. Há teste fixando a igualdade.
 */
const SEM_PERMISSAO = 'Você não tem permissão para esta operação.'

const ERRO_GENERICO = 'Não foi possível concluir a operação. Tente novamente.'

/** Códigos que o T2/T3 documentaram como alcançáveis a partir dos RPCs. */
const PG_SEM_PRIVILEGIO = '42501'
const PG_UNICIDADE = '23505'
const PG_CHECK = '23514'
/** T4 (REV-19) — alcançáveis só a partir de `update_review_with_book` (0012). */
const PG_CONFLITO_OTIMISTA = '40001'
const PG_TIMEOUT = '57014'

type PostgrestLikeError = { code?: string; message?: string } | null

/**
 * Traduz erro do Postgres em estado de formulário.
 *
 * `23514` (violação de CHECK) NÃO deveria chegar aqui: o schema do T5 espelha
 * todos os CHECKs de `book`/`review`, então uma violação significa que o
 * espelhamento DIVERGIU do banco — schema afrouxou, ou migration nova
 * acrescentou constraint sem atualizar o Zod. É defeito nosso, não do usuário,
 * por isso vai para o log do servidor: sem esse registro, a divergência se
 * manifesta só como "erro genérico" intermitente e ninguém investiga.
 */
function mapearErro(error: PostgrestLikeError): ReviewFormState {
  if (!error) return { status: 'error', message: ERRO_GENERICO }

  switch (error.code) {
    case PG_SEM_PRIVILEGIO:
      return { status: 'error', message: SEM_PERMISSAO }

    case PG_UNICIDADE:
      // Colisão de slug. O `unique_review_slug` (0011) resolve a esmagadora
      // maioria sob advisory lock; o que chega aqui é a corrida remanescente
      // (ver a análise de concorrência no cabeçalho da 0011). Erro NO CAMPO do
      // título, porque é dele que o slug deriva — não um erro de formulário
      // solto que o editor não sabe onde consertar.
      //
      // IMPRECISÃO ACEITA em update (T4): quem de fato dirige o slug em edição
      // é `slugBase` (P-2), não `reviewTitle` — mas o caminho é o MESMO
      // residual raríssimo já documentado na 0011 (corrida sob isolamento não
      // padrão), e `reviewTitle` continua sendo um campo real e visível em
      // qualquer um dos dois modos. Diferenciar por origem exigiria passar
      // contexto extra por uma exceção que praticamente nunca dispara —
      // registrado, não corrigido.
      return {
        status: 'error',
        message: 'Já existe uma resenha com um endereço muito parecido.',
        fieldErrors: { reviewTitle: 'Ajuste o título e tente novamente.' },
      }

    case PG_CHECK:
      console.error(
        '[reviews-crud] 23514: CHECK do banco violado APÓS a validação Zod — ' +
          'o espelhamento schema↔banco divergiu. Constraint:',
        error.message
      )
      return { status: 'error', message: ERRO_GENERICO }

    // T4 (REV-19/P-1) — conflito de edição concorrente. `40001` é o código
    // PRÓPRIO que a 0012 levanta (distinto de `42501` de propósito — ver o
    // cabeçalho da migration): "outra pessoa mexeu nisto enquanto você
    // editava", não "você não pode editar isto". SEM `fieldErrors`: o
    // conflito não pertence a UM campo, então o foco genérico do `ReviewForm`
    // (T2a) vai para a região de status — já é o destino certo, nenhum código
    // extra necessário aqui. O CONTEÚDO DIGITADO continua na tela porque
    // `valores` é estado do React, não algo que este retorno precise
    // preservar ativamente (T2a: campos controlados nunca se apagam sozinhos).
    case PG_CONFLITO_OTIMISTA:
      return {
        status: 'error',
        message:
          'Esta resenha foi alterada por outra pessoa — recarregue a página e tente novamente.',
      }

    // T4 — o `select ... for update` do RPC de update BLOQUEIA quando duas
    // edições da MESMA linha se sobrepõem (T1 mediu ~2,6s de bloqueio real).
    // `authenticated` tem `statement_timeout` (8s no padrão Supabase); se a
    // transação que segura o lock passar disso, a SEGUNDA morre com `57014`
    // (query_canceled) em vez de `40001` — o bloqueio nunca chega a resolver a
    // COMPARAÇÃO de conflito, só estoura o relógio primeiro. Sem esta
    // tradução, o editor veria a mensagem genérica do Postgres.
    case PG_TIMEOUT:
      return { status: 'error', message: 'Não foi possível salvar agora — tente novamente.' }

    default:
      return { status: 'error', message: ERRO_GENERICO }
  }
}

/**
 * Os helpers de leitura/eco do `FormData` e o mapeamento de issues vivem em
 * `@/lib/review/formData` — módulo PURO, importado TAMBÉM pelo formulário (T8).
 *
 * Não é fatoração por gosto: o cliente valida para dar retorno imediato e o
 * servidor revalida porque a validação do cliente nunca é garantia. As duas só
 * concordam se lerem os MESMOS nomes de campo — com duas cópias, o formulário
 * aprovaria payload que este action recusa, e o erro voltaria apontando para um
 * campo que a tela não tem. Ver o cabeçalho daquele módulo.
 */

/**
 * Rotas invalidadas por uma transição de visibilidade pública.
 *
 * ESCOLHA DELIBERADA — só duas rotas, não "tudo por precaução":
 *   · `/`               — a home É a listagem (a resenha entra ou sai dela);
 *   · `/resenha/[slug]` — a página da resenha, via `revalidatePath(..., 'page')`
 *                         na rota concreta.
 *
 * O que NÃO é invalidado, e por quê: as rotas de `/admin/*` leem por
 * `createAuthenticatedClient`, que usa `cookies()` — isso as torna dinâmicas por
 * construção, renderizadas a cada request. Invalidá-las seria ruído sem efeito.
 *
 * Nas DUAS direções (E-4): despublicar também invalida. Sem isso, a home e a
 * página seguiriam servindo cache de uma resenha que não está mais publicada —
 * o sintoma de "despublicar não despublicou".
 */
function revalidarRotasPublicas(slug?: string) {
  revalidatePath('/')
  if (slug) revalidatePath(`/resenha/${slug}`)
}

/**
 * Cria livro + resenha atomicamente (REV-02/04).
 *
 * O GATE DE PUBLICAÇÃO É SCHEMA-DETERMINÍSTICO (emenda A-1) — a parte mais
 * sensível desta action:
 *
 *   1. o `status` é lido do `FormData` e validado contra um ENUM;
 *   2. o schema de validação é DERIVADO desse status já validado;
 *   3. o MESMO valor validado vai ao RPC como `p_status`.
 *
 * Em nenhum ponto o botão clicado, um booleano do cliente ou a presença de um
 * campo decide o schema. Os dois botões do formulário são só UI: ambos enviam
 * `status`, e é o valor — não a origem — que manda. Uma `FormData` forjada com
 * `status=published` e corpo vazio cai em `reviewPublishSchema` e é REJEITADA;
 * se o schema viesse do botão, ela publicaria incompleta pelo caminho normal do
 * app, sem nunca tocar a API direta.
 */
export async function createReview(
  _prev: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const sessao = await requireEditor()
  if (sessao.status !== 'ok') {
    return { status: 'error', message: SEM_PERMISSAO }
  }

  // (1) status primeiro, contra o enum. Falha aqui = nada persistido.
  const statusValidado = reviewStatusSchema.safeParse(formData.get('status'))
  if (!statusValidado.success) {
    return { status: 'error', message: 'Ação inválida.' }
  }
  const status: ReviewStatus = statusValidado.data

  // (2) o schema vem do STATUS VALIDADO, nunca do botão.
  const schema = status === 'published' ? reviewPublishSchema : reviewDraftSchema

  const bruto = readReviewForm(formData)
  const parsed = schema.safeParse(bruto)
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Confira os campos destacados.',
      fieldErrors: mapZodIssues(parsed.error.issues),
      values: echoValues(bruto),
    }
  }

  // (3) o MESMO status validado vai ao RPC.
  const slugBase = slugify(parsed.data.reviewTitle)
  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc(
    'create_review_with_book',
    toCreateReviewRpcArgs(parsed.data, slugBase, status)
  )

  if (error) return mapearErro(error)

  if (status === 'published') revalidarRotasPublicas(data?.slug)

  return { status: 'saved', message: 'Resenha salva.' }
}

/** Campos mínimos para reavaliar o gate de publicação a partir do banco. */
const SELECT_PARA_GATE =
  'id, title, slug, body, status, published_at, book(title, author, genre_id)'

/**
 * Publica uma resenha existente (REV-17).
 *
 * O gate é o MESMO `reviewPublishSchema` do formulário, reaplicado sobre o que
 * está GRAVADO. Não se confia no que o cliente manda: a action recebe só o `id`,
 * lê a linha e revalida. Assim um rascunho sem corpo não publica nem pela UI nem
 * por chamada direta — a regra vive num lugar só (T5), não duplicada aqui.
 */
export async function publishReview(id: string): Promise<ReviewFormState> {
  const sessao = await requireEditor()
  if (sessao.status !== 'ok') {
    return { status: 'error', message: SEM_PERMISSAO }
  }

  const supabase = await createAuthenticatedClient()
  const { data: atual, error: erroLeitura } = await supabase
    .from('review')
    .select(SELECT_PARA_GATE)
    .eq('id', id)
    .maybeSingle()

  if (erroLeitura) return mapearErro(erroLeitura)
  // Linha invisível ao chamador → MESMA mensagem de 42501 (não vaza existência).
  if (!atual) return { status: 'error', message: SEM_PERMISSAO }

  const livro = atual.book

  const gate = reviewPublishSchema.safeParse({
    title: livro?.title ?? '',
    author: livro?.author ?? '',
    genreId: livro?.genre_id ?? '',
    reviewTitle: atual.title,
    body: atual.body ?? undefined,
  })

  if (!gate.success) {
    return {
      status: 'error',
      message: 'Complete a resenha antes de publicar.',
      fieldErrors: mapZodIssues(gate.error.issues),
    }
  }

  // `published_at` é carimbo da PRIMEIRA publicação (A-8): republicar NÃO
  // reescreve, senão a resenha saltaria para o topo de "Mais recentes" a cada
  // ciclo. Espelha o `coalesce` que o RPC de update faz.
  const patch: { status: 'published'; published_at?: string } = { status: 'published' }
  if (atual.published_at === null) patch.published_at = new Date().toISOString()

  const { data: atualizada, error } = await supabase
    .from('review')
    .update(patch)
    .eq('id', id)
    .select('slug')

  if (error) return mapearErro(error)
  // 0 linhas = a policy negou. MESMA mensagem de 42501 e de "não existe".
  if (!atualizada || atualizada.length === 0) {
    return { status: 'error', message: SEM_PERMISSAO }
  }

  revalidarRotasPublicas(atual.slug)
  return { status: 'saved', message: 'Resenha publicada.' }
}

/**
 * Despublica: volta a rascunho e some do público via RLS (REV-18).
 *
 * NÃO limpa `published_at` — o carimbo é da primeira publicação, e apagá-lo
 * faria uma republicação futura inventar data nova. Mesma regra do RPC.
 *
 * REVALIDA nas duas direções (E-4): sem isto, a home e a página seguem servindo
 * o cache de uma resenha que já não está publicada.
 */
export async function unpublishReview(id: string): Promise<ReviewFormState> {
  const sessao = await requireEditor()
  if (sessao.status !== 'ok') {
    return { status: 'error', message: SEM_PERMISSAO }
  }

  const supabase = await createAuthenticatedClient()
  const { data: atualizada, error } = await supabase
    .from('review')
    .update({ status: 'draft' })
    .eq('id', id)
    .select('slug')

  if (error) return mapearErro(error)
  if (!atualizada || atualizada.length === 0) {
    return { status: 'error', message: SEM_PERMISSAO }
  }

  revalidarRotasPublicas(atualizada[0]?.slug)
  return { status: 'saved', message: 'Resenha despublicada.' }
}

/**
 * Atualiza livro + resenha atomicamente (T4, REV-19). Fluxo idêntico ao de
 * `createReview` nos passos 1–2 (status validado PRIMEIRO, contra o enum; o
 * schema — inclusive o gate de publicação — DERIVA desse valor, nunca do botão
 * clicado nem de um branch cliente) — é o MESMO publish gate do M3, reusado,
 * não reescrito: "Publicar" numa resenha que edita o corpo publica com o corpo
 * NOVO; "Salvar rascunho" numa resenha JÁ publicada a DESPUBLICA (mesma função,
 * nenhum caminho separado — `update_review_with_book` cobre as duas direções).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OS TRÊS CAMPOS-MECANISMO — `reviewId`/`expectedUpdatedAt`/`slugBase` — NÃO
 * PASSAM POR `readReviewForm`/ZOD, DE PROPÓSITO
 *
 * Não são conteúdo da ficha nem da resenha: são o ALVO da operação, o CARIMBO
 * de versão (P-1) e a base opcional do slug (P-2). Read direto de `formData`,
 * fora do schema — o mesmo raciocínio que já separa `status` (T6/A-1) do resto
 * do payload.
 *
 * `expectedUpdatedAt`: STRING OPACA até o `.rpc()`. Nenhuma linha desta função
 * o toca — sem `new Date(...)`, sem `.toISOString()`, sem normalização de
 * timezone. É a MESMA string que saiu de `getReviewForEdit` (T3) e atravessou
 * o campo oculto do `ReviewForm` (T2a); aqui ela só entra no argumento do RPC.
 * Um parse em qualquer ponto do trajeto — aqui incluído — perde os
 * microssegundos que `timestamptz` guarda e `Date` do JS não tem, e a
 * comparação `is distinct from` da 0012 nunca bate: TODO save reportaria
 * `40001` (conflito falso), com cara de bug de permissão, nunca de precisão.
 *
 * `slugBase`: só existe no `FormData` quando `ReviewForm` o renderizou — que
 * (T2a) só acontece em `edit` + rascunho nunca publicado (P-2). Ausência ==
 * "não mexer no slug", sem precisar perguntar ao banco se a resenha está
 * publicada: o PRÓPRIO FORMULÁRIO já não oferece o campo nesse caso. O
 * `slugify()` aqui é NORMALIZAÇÃO (mesma função do create), não a regra de
 * "pode mudar" — essa regra mora inteira no RPC (`v_published_at is null` E
 * `p_slug_base <> v_current_slug`, lidos AO VIVO na transação), e não é
 * duplicada aqui: reenviar o valor sempre que presente é seguro porque o RPC
 * no-opa sozinho quando nada mudou (nem toma o advisory lock de
 * `unique_review_slug` nesse caso — conferido no corpo da 0012).
 */
export async function updateReview(
  _prev: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const sessao = await requireEditor()
  if (sessao.status !== 'ok') {
    return { status: 'error', message: SEM_PERMISSAO }
  }

  const reviewIdBruto = formData.get('reviewId')
  if (typeof reviewIdBruto !== 'string' || reviewIdBruto === '') {
    return { status: 'error', message: ERRO_GENERICO }
  }
  const reviewId = reviewIdBruto

  // Ver a nota do cabeçalho: string opaca, sem NENHUM parse.
  const expectedUpdatedAtBruto = formData.get('expectedUpdatedAt')
  if (typeof expectedUpdatedAtBruto !== 'string' || expectedUpdatedAtBruto === '') {
    return { status: 'error', message: ERRO_GENERICO }
  }
  const expectedUpdatedAt = expectedUpdatedAtBruto

  // (1) status primeiro, contra o enum. Falha aqui = nada persistido.
  const statusValidado = reviewStatusSchema.safeParse(formData.get('status'))
  if (!statusValidado.success) {
    return { status: 'error', message: 'Ação inválida.' }
  }
  const status: ReviewStatus = statusValidado.data

  // (2) o schema vem do STATUS VALIDADO, nunca do botão — MESMO gate do create.
  const schema = status === 'published' ? reviewPublishSchema : reviewDraftSchema

  const bruto = readReviewForm(formData)
  const parsed = schema.safeParse(bruto)
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Confira os campos destacados.',
      fieldErrors: mapZodIssues(parsed.error.issues),
      values: echoValues(bruto),
    }
  }

  const slugBaseSubmetido = formData.get('slugBase')
  const slugBaseNormalizado =
    typeof slugBaseSubmetido === 'string' ? slugify(slugBaseSubmetido) : ''
  const slugBase = slugBaseNormalizado === '' ? null : slugBaseNormalizado

  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc(
    'update_review_with_book',
    toUpdateReviewRpcArgs(parsed.data, reviewId, expectedUpdatedAt, slugBase, status)
  )

  if (error) return mapearErro(error)

  // `/admin/resenhas` é dinâmica por construção (lê `cookies()` via
  // `createAuthenticatedClient` — mesma nota já registrada acima, em
  // `revalidarRotasPublicas`). Chamar `revalidatePath` aqui é NO-OP hoje;
  // mantido por clareza e como salvaguarda caso a rota deixe de ser dinâmica
  // no futuro.
  revalidatePath('/admin/resenhas')

  // `published_at` não-nulo == "esta resenha JÁ foi publicada alguma vez" —
  // verdadeiro em TRÊS casos que todos precisam de revalidação pública, com
  // uma condição só: (a) segue publicada e o conteúdo mudou; (b) acabou de
  // publicar pela primeira vez NESTE save (`coalesce` do RPC acabou de
  // carimbar); (c) acabou de ser DESPUBLICADA por este mesmo save (o carimbo
  // preserva, nunca limpa — por isso ainda aparece aqui, e é exatamente o
  // caso em que a página pública precisa sumir/revalidar para 404). O único
  // caso que FICA de fora, corretamente, é rascunho→rascunho: nunca teve
  // página pública, nada para invalidar. `data.slug` é sempre o alvo certo
  // porque o slug NÃO MUDA depois da primeira publicação (P-2/REV-23) — não
  // existe um "slug antigo" divergente a revalidar à parte.
  if (data?.published_at) revalidarRotasPublicas(data.slug)

  return { status: 'saved', message: 'Alterações salvas.' }
}
