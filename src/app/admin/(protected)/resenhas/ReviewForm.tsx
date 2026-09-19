'use client'

import {
  Fragment,
  useActionState,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { reviewDraftSchema, reviewPublishSchema, reviewStatusSchema } from '@/lib/review/schema'
import {
  DISABILITY_IDS,
  DISABILITY_IDS_SENT,
  echoValues,
  furtherReadingName,
  mapZodIssues,
  readReviewForm,
} from '@/lib/review/formData'
import type { DisabilityOption } from '@/lib/review/adminQueries'
import { LANGUAGES } from '@/lib/book/language'
import type { ReviewFormState } from './actions'

/**
 * Formulário de resenha (T8), extraído em MODO DUPLO na T2a (REV-19) para
 * servir criação E edição sem duplicar a superfície que passou pelo gate axe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * T2a — REGRA DURA: `mode: 'create'` produz o MESMO HTML de antes da extração
 *
 * Só `mode: 'create'` é exercido nesta task; os campos de `edit` entram na
 * assinatura SEM CONSUMIDOR (T3–T5 os ligam). Verificado por comparação
 * literal do HTML renderizado — repouso, com leituras adicionadas e com erro
 * de validação — antes e depois desta extração: idêntico byte a byte nos três
 * estados. Toda ramificação nova é condicionada a `mode === 'edit'`, nunca ao
 * contrário — o caminho de `create` não pergunta "estou em create?", ele
 * simplesmente continua sendo o que já era.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMPOS OCULTOS DE `edit` — POR QUE EXISTEM, E POR QUE SÃO PERIGOSOS
 *
 * `tags`, `keywords` e `further_reading` NÃO são editáveis nesta tela enquanto
 * D-12 (taxonomia de deficiência representada) estiver `[PREENCHER]` — não há
 * UI de vocabulário controlado para oferecer. Mas o RPC (0011/0012) faz
 * `coalesce(p_tags, '{}')` / `coalesce(p_keywords, '{}')` /
 * `coalesce(p_further_reading, '[]'::jsonb)`: omitir o campo NÃO preserva o
 * valor atual — GRAVA VAZIO. `o-projeto-rosie` tem 15 tags reais em produção;
 * salvar uma edição do corpo sem reenviá-las as apagaria em silêncio. Por isso
 * `mode === 'edit'` os transporta como `<input type="hidden">`, com os MESMOS
 * nomes de campo que `readReviewForm`/`reviewDraftSchema` já leem
 * (`tagsInput`, `keywordsInput`, `furtherReading.N.label/url` via
 * `furtherReadingName` — nenhum formato novo, mesma leitura de sempre) — a UI
 * não oferece edição, mas o valor faz a viagem de volta intacto.
 *
 * `expectedUpdatedAt` (P-1) é o campo mais perigoso de mexer: viaja como a
 * STRING EXATA que o Supabase devolveu, nunca como `Date`. Ver a nota no local
 * onde ele é renderizado, mais abaixo — resumo aqui: `Date` do JS só tem
 * milissegundos, `timestamptz` do Postgres guarda microssegundos, e qualquer
 * parse+reserialização no caminho perde a precisão. A comparação
 * `is distinct from` do RPC (0012) então NUNCA bate, e TODO save relata
 * conflito falso — com cara de bug de permissão, não de bug de precisão.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SLUG (P-2) — POR QUE NÃO EXISTE VERSÃO `disabled`
 *
 * Três estados, não dois: ausente (`create`), editável (`edit` + rascunho
 * nunca publicado) e TEXTO ESTÁTICO com explicação (`edit` + já publicada).
 * Nunca `disabled`: um campo desabilitado SAI da ordem de tabulação e some da
 * navegação por formulário em leitor de tela — a informação ("por que não
 * posso mudar isto?") desapareceria em vez de ser explicada. Texto estático
 * com `aria-describedby` permanece perceptível e diz o motivo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE COMPONENTE NÃO FAZ, DE PROPÓSITO
 *
 * · **Não conhece rota.** A action chega por prop; a página que a fornece é a
 *   T10. Isso mantém o componente montável em teste e no guia de estilos sem
 *   sessão, sem banco e sem `cookies()` — e é o que permite auditar a11y em
 *   navegador real antes de a rota existir.
 * · **Não busca gêneros.** A lista vem por prop, lida no servidor por quem
 *   renderiza. Um `select` que busca sozinho viraria mais um caminho de leitura
 *   a proteger.
 * · **Não decide publicação.** Ver "OS DOIS BOTÕES" abaixo.
 * · **Não coleta o nome de quem assina.** O RPC o congela de `editor.name`
 *   (DD-6) — é informação a MOSTRAR (texto, não input), não dado a pedir.
 * · **`pages`/`originalLanguage`/`translator`/`translatedFrom` SÃO coletados
 *   desde a T2b (P-3/0012)** — até então não tinham parâmetro no RPC (0011) e
 *   este arquivo os descartava de propósito (campo que perde o que recebe é
 *   pior que campo ausente). A 0012 abriu espaço na assinatura, com
 *   `default null`; ver "Idioma original"/"Tradutor"/"Idioma de origem"/
 *   "Páginas" na ficha do livro, mais abaixo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OS DOIS BOTÕES ENVIAM `status`; NÃO DECIDEM STATUS
 *
 * "Salvar rascunho" e "Publicar" são dois `<button type="submit">` com o MESMO
 * `name="status"` e valores diferentes. O navegador põe o par nome/valor do
 * botão acionado no `FormData` — então a escolha viaja como DADO, no mesmo saco
 * dos outros campos, e não como identidade de botão.
 *
 * Quem ramifica é o servidor (T6): ele lê `status` do `FormData`, valida contra
 * `reviewStatusSchema` e DERIVA o schema desse valor já validado. Não existe
 * neste arquivo booleano `publicando`, nem handler que troque o schema, nem
 * `onClick` que mude o destino — se existisse, uma `FormData` forjada com
 * `status=published` publicaria incompleta pelo caminho normal do app.
 *
 * A validação do cliente abaixo faz a MESMA derivação, pela mesma razão: ela
 * precisa reprovar exatamente o que o servidor reprovaria.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CLIENTE É CONVENIÊNCIA, NUNCA GARANTIA
 *
 * `validarEEnviar` envolve a action recebida: valida no cliente para dar retorno
 * imediato (sem ida ao servidor) e, passando, DELEGA à action — que valida tudo
 * de novo. As duas leem o mesmo `FormData` pelo mesmo leitor
 * (`@/lib/review/formData`) e produzem `fieldErrors` na mesma forma, então o
 * erro do servidor cai no MESMO campo em que o do cliente cairia. Desligar o JS
 * remove a camada do cliente e não afrouxa nada.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type GenreOption = { id: string; name: string }

/** `create`: formulário de criação (T8, comportamento intocado). `edit`: T3–T5. */
export type ReviewFormMode = 'create' | 'edit'

/**
 * Valores iniciais dos campos de valor único (ver `CAMPOS` abaixo) — inclusive
 * `slugBase`, que só é lido em `mode: 'edit'`. `Partial`: em `create` o objeto
 * inteiro está ausente e cada campo nasce vazio, como sempre.
 */
export type ReviewFormValues = Partial<Record<Campo, string>>

export type ReviewFormProps = {
  mode: ReviewFormMode
  /** Action que persiste (T6/T4). Injetada para o componente não amarrar rota. */
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>
  /** Gêneros para o `select` — `genre_id` é NOT NULL no banco. */
  genres: GenreOption[]
  /** Nome que assinará a resenha. Exibido, não coletado (DD-6). */
  signedBy?: string | null
  /** Valores atuais para pré-preencher `mode: 'edit'`. Ignorado em `create`. */
  defaultValues?: ReviewFormValues
  /** ID da resenha em edição. Viaja como campo oculto — `mode: 'edit'` só. */
  reviewId?: string
  /**
   * `updated_at` lido junto com `defaultValues`, para o conflito otimista
   * (P-1/0012). Ver a nota completa onde é renderizado, mais abaixo.
   */
  expectedUpdatedAt?: string
  /** Governa o modo do campo de slug (P-2). Irrelevante em `create`. */
  isPublished?: boolean
  /** Tags atuais, a REENVIAR intactas em `mode: 'edit'` (não editáveis — D-12). */
  preservedTags?: string[]
  /** Mesma regra de `preservedTags`, para palavras-chave. */
  preservedKeywords?: string[]
  /** Mesma regra, para leituras adicionais — formato ainda não fixado por T3. */
  preservedFurtherReading?: unknown[]
  /**
   * Termos de deficiência (D-12, DIS-05). Sem a prop, o grupo não é renderizado
   * NEM o marcador `disabilityIdsSent` — o servidor então não mexe nos vínculos.
   */
  disabilityOptions?: DisabilityOption[]
  /** Ids já vinculados à resenha (`mode: 'edit'`). */
  defaultDisabilityIds?: string[]
}

const ESTADO_INICIAL: ReviewFormState = { status: 'idle', message: '' }

/** Teto do campo de ano — o mesmo do `bookInputSchema` (ano não futuro). */
const ANO_MAXIMO = new Date().getFullYear()

/**
 * Campos de valor único. A lista existe para o estado ser DERIVADO dela — um
 * campo novo entra aqui e ganha estado, nome e eco sem edição em três lugares.
 * Os repetíveis (`furtherReading.N.*`) têm estado próprio, por serem lista.
 *
 * `slugBase` (T2a): só renderiza em `mode: 'edit'` (P-2) — entrar na lista
 * custa zero em `create`, porque nenhum `Field` chama `campoProps('slugBase')`
 * nesse modo; a chave fica no estado, inerte, sem virar elemento na tela.
 */
const CAMPOS = [
  'title',
  'author',
  'genreId',
  'publisher',
  'year',
  'pages',
  'isbn',
  'originalLanguage',
  'translator',
  'translatedFrom',
  'publicationCity',
  'coverUrl',
  'reviewTitle',
  'body',
  'highlightQuote',
  'tagsInput',
  'keywordsInput',
  'slugBase',
] as const

type Campo = (typeof CAMPOS)[number]

const VALORES_VAZIOS = Object.fromEntries(CAMPOS.map((campo) => [campo, ''])) as Record<
  Campo,
  string
>

/** Só o que se lê de qualquer `change` — serve a input, textarea e select. */
type EventoDeCampo = { currentTarget: { value: string } }

type Leitura = { chave: number; label: string; url: string }

/** Para onde o foco deve ir depois do próximo render da lista repetível. */
type FocoPendente =
  | { tipo: 'campo'; nome: string }
  | { tipo: 'remover'; indice: number }
  | { tipo: 'adicionar' }

export function ReviewForm({
  mode,
  action,
  genres,
  signedBy,
  defaultValues,
  reviewId,
  expectedUpdatedAt,
  isPublished,
  preservedTags,
  preservedKeywords,
  preservedFurtherReading,
  disabilityOptions,
  defaultDisabilityIds,
}: ReviewFormProps) {
  /**
   * Envolve a action com a validação do cliente. Como o retorno tem a MESMA
   * forma (`ReviewFormState`), o resto do componente não sabe — nem precisa
   * saber — de qual das duas validações veio o erro que está exibindo.
   */
  const validarEEnviar = useCallback(
    async (anterior: ReviewFormState, formData: FormData): Promise<ReviewFormState> => {
      const status = reviewStatusSchema.safeParse(formData.get('status'))
      if (!status.success) return { status: 'error', message: 'Ação inválida.' }

      const schema = status.data === 'published' ? reviewPublishSchema : reviewDraftSchema
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
      return action(anterior, formData)
    },
    [action]
  )

  const [state, formAction, pending] = useActionState(validarEEnviar, ESTADO_INICIAL)

  const formRef = useRef<HTMLFormElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const adicionarRef = useRef<HTMLButtonElement>(null)
  const removerRefs = useRef<(HTMLButtonElement | null)[]>([])
  const focoPendente = useRef<FocoPendente | null>(null)

  const [leituras, setLeituras] = useState<Leitura[]>([])
  const proximaChave = useRef(0)

  /**
   * TODOS os campos são CONTROLADOS — não é preferência de estilo.
   *
   * O React 19 RESETA o formulário quando a action termina, com sucesso ou com
   * erro. Num formulário não-controlado isso apaga a digitação exatamente no
   * momento em que ela é mais cara: a submissão que falhou na validação. Em
   * campo controlado o React mantém `defaultValue` sincronizado com o valor
   * renderizado, então o reset volta ao que já estava lá e nada se perde.
   * (Há teste fixando isto: reprovar e submeter de novo NÃO exige redigitar.)
   *
   * O eco de `state.values` (T6) continua vindo do servidor e permanece útil a
   * quem consuma a action sem este componente; aqui a digitação já vive no
   * estado do React e não precisa ser reidratada.
   *
   * T2a: `{ ...VALORES_VAZIOS, ...defaultValues }` — em `create`,
   * `defaultValues` é `undefined`, e espalhar `undefined` num objeto não faz
   * nada (não lança, não sobrescreve chave nenhuma); o resultado é
   * `VALORES_VAZIOS` exatamente como antes desta task. Só `edit`, com
   * `defaultValues` de verdade, pré-preenche.
   */
  const [valores, setValores] = useState<Record<Campo, string>>({
    ...VALORES_VAZIOS,
    ...defaultValues,
  })

  /**
   * CANCELA o reset automático que o React 19 dispara ao fim de TODA action.
   *
   * Num formulário controlado o reset deveria ser inócuo, e para `<input>` é: o
   * React mantém `defaultValue` sincronizado com o valor renderizado, então o
   * reset devolve o mesmo texto. Para `<select>` NÃO é — o React marca a opção
   * escolhida pela PROPRIEDADE `selected` e não mexe no atributo, e o reset volta
   * à opção que tem o atributo: o placeholder "Selecione…".
   *
   * O efeito, observado e agora coberto por teste: uma submissão REPROVADA
   * zerava em silêncio o gênero já escolhido. A tela seguia mostrando o campo
   * como se estivesse preenchido — o `value` do React voltaria no próximo render,
   * que não acontece porque nada no estado mudou — e a submissão seguinte
   * falhava por um campo que o editor jurava ter preenchido. É o pior tipo de
   * perda de dado: silenciosa e culpando o usuário.
   *
   * Por que listener nativo em CAPTURA, e não a prop `onReset`: o handler
   * sintético do React chega tarde demais para cancelar a ação padrão —
   * verificado, `preventDefault()` na prop não impede o reset, e na captura
   * impede. Vale para qualquer `form.reset()`, não só o do React.
   */
  useLayoutEffect(() => {
    const form = formRef.current
    if (!form) return
    const cancelar = (evento: Event) => evento.preventDefault()
    form.addEventListener('reset', cancelar, true)
    return () => form.removeEventListener('reset', cancelar, true)
  }, [])

  /**
   * Deficiências marcadas — CONTROLADAS pelo mesmo motivo dos demais campos
   * (o reset do React 19 é cancelado acima; o estado é a fonte de verdade).
   */
  const [deficiencias, setDeficiencias] = useState<Set<string>>(
    () => new Set(defaultDisabilityIds ?? [])
  )
  function alternarDeficiencia(id: string, marcado: boolean) {
    setDeficiencias((atual) => {
      const proximo = new Set(atual)
      if (marcado) proximo.add(id)
      else proximo.delete(id)
      return proximo
    })
  }
  /**
   * Vínculos que ESTE usuário não enxerga como opção (termo desativado, para
   * quem não é admin): viajam ocultos para o conjunto enviado não os apagar.
   */
  const idsVisiveis = new Set((disabilityOptions ?? []).map((opcao) => opcao.id))
  const vinculosOcultos = [...deficiencias].filter((id) => !idsVisiveis.has(id))
  const deficienciasHelpId = useId()

  const bylineId = useId()
  const slugStaticId = useId()

  const erroDe = (campo: string) => state.fieldErrors?.[campo]

  /** Nome + valor + onChange + erro de um campo, num lugar só. */
  const campoProps = (campo: Campo) => ({
    name: campo,
    value: valores[campo],
    onChange: (evento: EventoDeCampo) => {
      const valor = evento.currentTarget.value
      setValores((atual) => ({ ...atual, [campo]: valor }))
    },
    error: erroDe(campo),
  })

  /* ── Lista repetível: adicionar/remover SEMPRE reposicionam o foco ────────
     Um controle que some leva o foco junto e o navegador o devolve ao `<body>`
     — quem navega por teclado é ejetado do formulário e precisa retabular tudo.
     Por isso toda mutação da lista declara o próximo alvo. */

  function adicionarLeitura() {
    const indiceNovo = leituras.length
    setLeituras((atual) => [...atual, { chave: proximaChave.current++, label: '', url: '' }])
    // Foco no primeiro campo do item novo: o item foi criado para ser
    // preenchido, então o cursor já chega onde se digita.
    focoPendente.current = { tipo: 'campo', nome: furtherReadingName(indiceNovo, 'label') }
  }

  /**
   * REMOÇÃO — a regra que o "Done when" desta task cobra explicitamente.
   *
   *   · sobrou item  → foco no botão "Remover" que passou a ocupar a posição,
   *     ou no último, se o removido era o último. O teclado continua na MESMA
   *     função (remover), no lugar onde a ação aconteceu.
   *   · lista vazia  → foco em "Adicionar leitura", o único controle que restou
   *     daquela seção. É o caso do "remover o último item": o alvo natural
   *     desapareceu, e sem este ramo o foco ficaria órfão no `<body>`.
   */
  function removerLeitura(indice: number) {
    const restantes = leituras.length - 1
    setLeituras((atual) => atual.filter((_, i) => i !== indice))
    focoPendente.current =
      restantes === 0
        ? { tipo: 'adicionar' }
        : { tipo: 'remover', indice: Math.min(indice, restantes - 1) }
  }

  function atualizarLeitura(indice: number, campo: 'label' | 'url', valor: string) {
    setLeituras((atual) =>
      atual.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item))
    )
  }

  // `useLayoutEffect`: move o foco no MESMO commit em que a lista muda, antes de
  // o navegador pintar. Com `useEffect` haveria um quadro com o foco no body.
  useLayoutEffect(() => {
    const alvo = focoPendente.current
    if (!alvo) return
    focoPendente.current = null

    if (alvo.tipo === 'adicionar') {
      adicionarRef.current?.focus()
      return
    }
    if (alvo.tipo === 'remover') {
      removerRefs.current[alvo.indice]?.focus()
      return
    }
    formRef.current?.querySelector<HTMLElement>(`[name="${alvo.nome}"]`)?.focus()
  }, [leituras])

  /* ── Falha na submissão: foco no PRIMEIRO campo com erro ─────────────────
     Em ordem de DOM, não na ordem em que o Zod devolveu as issues — quem lê a
     tela espera aterrissar no primeiro erro de cima para baixo. Sem campo
     correspondente (erro de formulário inteiro, como negação de permissão), o
     foco vai para a região de status, que é onde a mensagem está. Nunca fica
     sem destino. */
  useLayoutEffect(() => {
    if (state.status !== 'error') return

    const comErro = Object.keys(state.fieldErrors ?? {})
    const form = formRef.current

    if (form && comErro.length > 0) {
      const controles = form.querySelectorAll<HTMLElement>(
        'input[name], textarea[name], select[name]'
      )
      for (const controle of controles) {
        const nome = controle.getAttribute('name')
        if (nome && comErro.includes(nome)) {
          controle.focus()
          return
        }
      }
    }
    statusRef.current?.focus()
  }, [state])

  return (
    <form ref={formRef} action={formAction} noValidate className="lia-review-form">
      <p className="lia-review-form__required-note">
        Campos marcados com <span aria-hidden="true">*</span> são obrigatórios.
      </p>

      {/* Live region PRESENTE E VAZIA desde o 1º render — só assim o leitor de
          tela anuncia o texto quando ele chega (WCAG 4.1.3). `role="status"` é
          polido por definição: interromper a leitura em curso é o que NÃO se
          quer aqui, nem no sucesso nem na falha. `tabIndex={-1}` a torna alvo de
          foco programático para o erro que não pertence a campo nenhum. */}
      <p
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="lia-review-form__status"
        data-tone={state.status}
      >
        {state.status === 'idle' ? '' : state.message}
      </p>

      <fieldset className="lia-review-form__group">
        <legend className="lia-review-form__legend">Dados do livro</legend>

        <div className="lia-review-form__grid">
          <Field
            label="Título"
            {...campoProps('title')}
            required
            aria-required="true"
            autoComplete="off"
            className="lia-review-form__span-2"
          />
          <Field
            label="Autor"
            {...campoProps('author')}
            required
            aria-required="true"
            autoComplete="off"
            className="lia-review-form__span-2"
          />
          <Field
            as="select"
            label="Gênero"
            {...campoProps('genreId')}
            required
            aria-required="true"
          >
            <option value="">Selecione…</option>
            {genres.map((genero) => (
              <option key={genero.id} value={genero.id}>
                {genero.name}
              </option>
            ))}
          </Field>
          <Field label="Editora" {...campoProps('publisher')} showOptional />
          <Field
            label="Ano"
            {...campoProps('year')}
            type="number"
            inputMode="numeric"
            min={1}
            max={ANO_MAXIMO}
            step={1}
            showOptional
            helpText={`Entre 1 e ${ANO_MAXIMO}.`}
          />
          {/* T2b (REV-19/P-3) — ficha técnica completa. `type="number"` é só
              apresentação: o `<form noValidate>` desliga a validação nativa do
              navegador (não confiável para leitor de tela — varia por
              navegador, alguns nem anunciam), então o erro de "menor que 1"
              chega SEMPRE pelo mesmo `Field`/`aria-describedby` dos demais
              campos, nunca pelo balão nativo do `type="number"`. */}
          <Field
            label="Páginas"
            {...campoProps('pages')}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            showOptional
            helpText="Número inteiro maior que zero."
          />
          <Field
            label="ISBN"
            {...campoProps('isbn')}
            inputMode="numeric"
            showOptional
            helpText="10 ou 13 dígitos. O dígito verificador é conferido."
          />
          <Field
            as="select"
            label="Idioma original"
            {...campoProps('originalLanguage')}
            showOptional
          >
            <option value="">Selecione…</option>
            {Object.entries(LANGUAGES).map(([codigo, nome]) => (
              <option key={codigo} value={codigo}>
                {nome}
              </option>
            ))}
          </Field>
          <Field label="Tradutor" {...campoProps('translator')} showOptional />
          {/* `book_translation_consistent` (banco) / `bookInputSchema`
              (superRefine, T5): tradutor sem idioma de origem é erro. O Zod já
              ancora essa mensagem em `translatedFrom` — é o campo que falta
              preencher, não o que já está certo —, então ela chega aqui pelo
              MESMO `campoProps`/`aria-describedby` de qualquer outro erro,
              sem tratamento especial. */}
          <Field
            as="select"
            label="Idioma de origem"
            {...campoProps('translatedFrom')}
            showOptional
          >
            <option value="">Selecione…</option>
            {Object.entries(LANGUAGES).map(([codigo, nome]) => (
              <option key={codigo} value={codigo}>
                {nome}
              </option>
            ))}
          </Field>
          <Field label="Cidade de publicação" {...campoProps('publicationCity')} showOptional />
          <Field
            label="URL da capa"
            {...campoProps('coverUrl')}
            type="url"
            inputMode="url"
            showOptional
            helpText="Endereço http ou https da imagem."
          />
        </div>
      </fieldset>

      {disabilityOptions && (
        <fieldset className="lia-review-form__group" aria-describedby={deficienciasHelpId}>
          <legend className="lia-review-form__legend">Deficiência(s) representada(s)</legend>
          <p id={deficienciasHelpId} className="lia-review-form__hint">
            Marque todas as que aparecem na obra. Opcional.
          </p>

          {/* Marcador: "este formulário tem o grupo" — ver `DISABILITY_IDS_SENT`. */}
          <input type="hidden" name={DISABILITY_IDS_SENT} value="1" />
          {vinculosOcultos.map((id) => (
            <input key={id} type="hidden" name={DISABILITY_IDS} value={id} />
          ))}

          {disabilityOptions.length > 0 ? (
            <ul className="lia-review-form__checks">
              {disabilityOptions.map((opcao) => (
                <li key={opcao.id}>
                  <label
                    className="lia-review-form__check"
                    htmlFor={`${deficienciasHelpId}-${opcao.id}`}
                  >
                    <input
                      id={`${deficienciasHelpId}-${opcao.id}`}
                      type="checkbox"
                      name={DISABILITY_IDS}
                      value={opcao.id}
                      checked={deficiencias.has(opcao.id)}
                      onChange={(evento) =>
                        alternarDeficiencia(opcao.id, evento.currentTarget.checked)
                      }
                    />
                    <span>
                      {opcao.name}
                      {!opcao.active && ' (desativado)'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lia-review-form__hint">Nenhuma deficiência cadastrada ainda.</p>
          )}
        </fieldset>
      )}

      <fieldset className="lia-review-form__group">
        <legend className="lia-review-form__legend">A resenha</legend>

        <div className="lia-review-form__stack">
          <Field
            label="Título da resenha"
            {...campoProps('reviewTitle')}
            showOptional
            helpText="Se ficar vazio, a resenha usa o título do livro."
          />

          {/* Slug (P-2) — três estados, nunca `disabled` (ver o cabeçalho do
              arquivo). Ausente em `create`: a rota de criação não pede — o
              slug nasce derivado do título, como sempre. */}
          {mode === 'edit' &&
            (isPublished ? (
              // Mesma forma visual do bloco "Quem assina" logo abaixo — rótulo +
              // valor + ajuda, todos texto estático. Reuso deliberado: é o MESMO
              // padrão (informação que não se edita aqui, com o porquê explicado),
              // e reaproveitar as classes já auditadas evita introduzir classe CSS
              // nova sem passar por design nesta task mecânica.
              <div className="lia-review-form__byline">
                <p className="lia-review-form__byline-label" id={slugStaticId}>
                  Endereço da resenha
                </p>
                <p className="lia-review-form__byline-value" aria-describedby={slugStaticId}>
                  /resenha/{valores.slugBase}
                </p>
                <p className="lia-review-form__byline-help">
                  Publicada: o endereço não muda mais, mesmo editando o título.
                </p>
              </div>
            ) : (
              <Field
                label="Endereço da resenha (slug)"
                {...campoProps('slugBase')}
                showOptional
                helpText="Deriva do título se deixado como está. Só pode mudar enquanto a resenha não for publicada."
              />
            ))}

          <Field
            as="textarea"
            label="Corpo da resenha"
            {...campoProps('body')}
            rows={12}
            helpText="Obrigatório para publicar; pode ficar vazio num rascunho."
          />

          {/* Quem assina NÃO é campo: o RPC congela `reviewer_name` de
              `editor.name` no momento da criação (DD-6). Um input aqui pediria
              um dado que o banco ignoraria. */}
          <div className="lia-review-form__byline">
            <p className="lia-review-form__byline-label" id={bylineId}>
              Quem assina
            </p>
            <p className="lia-review-form__byline-value" aria-describedby={bylineId}>
              {signedBy?.trim() ? signedBy : 'A conta que criar a resenha'}
            </p>
            <p className="lia-review-form__byline-help">
              Registrado a partir da sua conta ao salvar e mantido mesmo se o nome mudar depois.
            </p>
          </div>

          <Field
            as="textarea"
            label="Citação em destaque"
            {...campoProps('highlightQuote')}
            rows={3}
            showOptional
            helpText="Um trecho curto para abrir a página. Não há campo de fonte: para atribuir, escreva a fonte no próprio texto."
          />

          {/* Tags/palavras-chave (D-12): editáveis SÓ em `create`. Em `edit`
              não há UI de vocabulário controlado ainda — a tela não pode
              oferecer edição que não existe —, mas o valor ATUAL precisa
              viajar de volta pelo MESMO nome de campo que `readReviewForm`
              já lê (`tagsInput`/`keywordsInput`), senão o RPC grava `{}` por
              cima das 15 tags reais de `o-projeto-rosie` (ver cabeçalho). */}
          {mode === 'create' ? (
            <Field
              label="Tags"
              {...campoProps('tagsInput')}
              showOptional
              helpText="Separe por vírgula ou ponto e vírgula. Ex.: clássico, romance"
            />
          ) : (
            <input type="hidden" name="tagsInput" value={(preservedTags ?? []).join(', ')} />
          )}

          {mode === 'create' ? (
            <Field
              label="Palavras-chave"
              {...campoProps('keywordsInput')}
              showOptional
              helpText="Separe por vírgula ou ponto e vírgula. Usadas em metadados de busca."
            />
          ) : (
            <input
              type="hidden"
              name="keywordsInput"
              value={(preservedKeywords ?? []).join(', ')}
            />
          )}

          {/* Fieldset ANINHADO: cada item repetível é um par de campos que só
              faz sentido junto, e o `legend` dá ao grupo um nome que o leitor de
              tela anuncia ao entrar. Aninhar é HTML válido e não cria um
              terceiro agrupamento de topo — continuam dois.

              MESMO TRATAMENTO de tags/keywords em `edit` (D-12): a UI de
              adicionar/remover só existe em `create`. Os itens atuais viajam
              como pares ocultos, pelo MESMO `furtherReadingName` que o leitor
              indexado já espera — não é formato novo, é o de sempre, só que
              sem controle visível para editar. */}
          {mode === 'create' ? (
            <fieldset className="lia-review-form__repeatable">
              <legend className="lia-review-form__legend lia-review-form__legend--sub">
                Leituras adicionais
              </legend>
              <p className="lia-review-form__hint">
                Links de apoio. Itens em branco são descartados ao salvar.
              </p>

              {leituras.length > 0 && (
                <ul className="lia-review-form__leituras">
                  {leituras.map((leitura, indice) => (
                    <li key={leitura.chave} className="lia-review-form__leitura">
                      <Field
                        label={`Título do link ${indice + 1}`}
                        name={furtherReadingName(indice, 'label')}
                        value={leitura.label}
                        onChange={(evento) =>
                          atualizarLeitura(indice, 'label', evento.currentTarget.value)
                        }
                        error={erroDe(furtherReadingName(indice, 'label'))}
                      />
                      <Field
                        label={`Endereço do link ${indice + 1}`}
                        name={furtherReadingName(indice, 'url')}
                        type="url"
                        inputMode="url"
                        value={leitura.url}
                        onChange={(evento) =>
                          atualizarLeitura(indice, 'url', evento.currentTarget.value)
                        }
                        error={erroDe(furtherReadingName(indice, 'url'))}
                      />
                      <Button
                        ref={(elemento) => {
                          removerRefs.current[indice] = elemento
                        }}
                        variant="secondary"
                        icon={<Trash2 size={16} />}
                        onClick={() => removerLeitura(indice)}
                        className="lia-review-form__leitura-remover"
                      >
                        Remover leitura {indice + 1}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                ref={adicionarRef}
                variant="secondary"
                icon={<Plus size={16} />}
                onClick={adicionarLeitura}
              >
                Adicionar leitura
              </Button>
            </fieldset>
          ) : (
            (preservedFurtherReading ?? []).map((item, indice) => {
              const leitura = item as { label?: string; url?: string }
              return (
                <Fragment key={indice}>
                  <input
                    type="hidden"
                    name={furtherReadingName(indice, 'label')}
                    value={leitura.label ?? ''}
                  />
                  <input
                    type="hidden"
                    name={furtherReadingName(indice, 'url')}
                    value={leitura.url ?? ''}
                  />
                </Fragment>
              )
            })
          )}

          {/* `reviewId` — só `edit` tem um ID para identificar. */}
          {mode === 'edit' && reviewId !== undefined && (
            <input type="hidden" name="reviewId" value={reviewId} />
          )}

          {/*
           * `expectedUpdatedAt` (P-1) — STRING OPACA, JAMAIS `Date`.
           *
           * `value={expectedUpdatedAt}` recebe a string exata que o Supabase
           * devolveu e a repassa sem tocar — sem `new Date(...)`, sem
           * `.toISOString()`, sem formatação, sem normalização de timezone.
           * `timestamptz` do Postgres guarda MICROSSEGUNDOS; `Date` do
           * JavaScript só tem MILISSEGUNDOS. Se este valor passasse por um
           * `Date` em qualquer ponto do trajeto — aqui, na action, no
           * cliente que popula `defaultValues` —, os microssegundos
           * cairiam, a comparação `is distinct from` do RPC (0012) NUNCA
           * bateria, e TODO save reportaria conflito falso (40001) — com
           * cara de bug de permissão, não de perda de precisão numérica.
           * Se algum tipo do TypeScript um dia forçar `Date` aqui, o
           * conserto é mudar o TIPO, nunca o valor.
           */}
          {mode === 'edit' && expectedUpdatedAt !== undefined && (
            <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
          )}
        </div>
      </fieldset>

      {/* Mesmo `name`, valores diferentes: o navegador envia o par do botão
          acionado como DADO. O servidor é quem ramifica (ver o cabeçalho). */}
      <div className="lia-review-form__actions">
        <Button
          type="submit"
          name="status"
          value="draft"
          variant="secondary"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          Salvar rascunho
        </Button>
        <Button
          type="submit"
          name="status"
          value="published"
          variant="primary"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          Publicar
        </Button>
      </div>
    </form>
  )
}
