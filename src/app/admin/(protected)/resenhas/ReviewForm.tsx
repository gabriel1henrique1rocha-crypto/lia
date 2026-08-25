'use client'

import { useActionState, useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { reviewDraftSchema, reviewPublishSchema, reviewStatusSchema } from '@/lib/review/schema'
import { echoValues, furtherReadingName, mapZodIssues, readReviewForm } from '@/lib/review/formData'
import type { ReviewFormState } from './actions'

/**
 * Formulário de resenha (T8) — a primeira superfície de escrita do painel.
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
 * · **Não coleta `pages`, `originalLanguage`, `translator`, `translatedFrom`
 *   nem o nome de quem assina.** Nenhum deles tem parâmetro no
 *   `create_review_with_book` (0011): o que fosse digitado ali seria descartado
 *   em silêncio no mapeamento do T5. Campo que perde o que recebe é pior que
 *   campo ausente — o editor confia que gravou. O nome de quem assina aparece
 *   como TEXTO (não input) porque o RPC o congela de `editor.name` (DD-6): é
 *   informação a mostrar, não dado a pedir.
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

export type ReviewFormProps = {
  /** Action que persiste (T6). Injetada para o componente não amarrar rota. */
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>
  /** Gêneros para o `select` — `genre_id` é NOT NULL no banco. */
  genres: GenreOption[]
  /** Nome que assinará a resenha. Exibido, não coletado (DD-6). */
  signedBy?: string | null
}

const ESTADO_INICIAL: ReviewFormState = { status: 'idle', message: '' }

/** Teto do campo de ano — o mesmo do `bookInputSchema` (ano não futuro). */
const ANO_MAXIMO = new Date().getFullYear()

/**
 * Campos de valor único. A lista existe para o estado ser DERIVADO dela — um
 * campo novo entra aqui e ganha estado, nome e eco sem edição em três lugares.
 * Os repetíveis (`furtherReading.N.*`) têm estado próprio, por serem lista.
 */
const CAMPOS = [
  'title',
  'author',
  'genreId',
  'publisher',
  'year',
  'isbn',
  'publicationCity',
  'coverUrl',
  'reviewTitle',
  'body',
  'highlightQuote',
  'tagsInput',
  'keywordsInput',
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

export function ReviewForm({ action, genres, signedBy }: ReviewFormProps) {
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
   */
  const [valores, setValores] = useState<Record<Campo, string>>(VALORES_VAZIOS)

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

  const bylineId = useId()

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
          <Field
            label="ISBN"
            {...campoProps('isbn')}
            inputMode="numeric"
            showOptional
            helpText="10 ou 13 dígitos. O dígito verificador é conferido."
          />
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

      <fieldset className="lia-review-form__group">
        <legend className="lia-review-form__legend">A resenha</legend>

        <div className="lia-review-form__stack">
          <Field
            label="Título da resenha"
            {...campoProps('reviewTitle')}
            showOptional
            helpText="Se ficar vazio, a resenha usa o título do livro."
          />

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
            helpText="Um trecho curto para abrir a página da resenha."
          />

          <Field
            label="Tags"
            {...campoProps('tagsInput')}
            showOptional
            helpText="Separe por vírgula. Ex.: clássico, romance"
          />

          <Field
            label="Palavras-chave"
            {...campoProps('keywordsInput')}
            showOptional
            helpText="Separe por vírgula. Usadas em metadados de busca."
          />

          {/* Fieldset ANINHADO: cada item repetível é um par de campos que só
              faz sentido junto, e o `legend` dá ao grupo um nome que o leitor de
              tela anuncia ao entrar. Aninhar é HTML válido e não cria um
              terceiro agrupamento de topo — continuam dois. */}
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
