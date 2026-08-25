/**
 * Ponte `FormData` → entrada do `reviewInputSchema` (T5), COMPARTILHADA entre o
 * server action (T6) e o formulário (T8).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE É UM MÓDULO À PARTE, E NÃO UMA FUNÇÃO DENTRO DO ACTION
 *
 * O formulário valida no cliente para dar retorno imediato; o action valida de
 * novo no servidor, porque a validação do cliente é conveniência e nunca
 * garantia. Duas validações só têm valor se lerem os MESMOS nomes de campo a
 * partir do MESMO `FormData` — se divergirem, a do cliente aprova o que a do
 * servidor recusa (ou pior: reprova o que o servidor aceitaria), e o erro
 * aparece no campo errado, ou em campo nenhum.
 *
 * `actions.ts` tem `'use server'`: tudo que ele EXPORTA vira endpoint e precisa
 * ser função assíncrona — então o leitor não pode morar lá e ser importado pelo
 * cliente. Daí este módulo puro: sem I/O, sem `server-only`, importável dos dois
 * lados. É o mesmo raciocínio de fronteira que separa `slug.ts` do RPC.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Prefixo dos campos repetíveis de "para saber mais" (`further_reading`). */
export const FURTHER_READING = 'furtherReading'

/**
 * Nome do input de um item repetível: `furtherReading.0.url`.
 *
 * A notação com PONTO não é estética: `mapZodIssues` monta a chave de erro com
 * `issue.path.join('.')`, e o caminho que o Zod produz para o segundo item é
 * `['furtherReading', 1, 'url']` → `'furtherReading.1.url'`. Nomear o input com
 * o mesmo formato faz o erro do servidor cair NO input que o causou, sem
 * tradução no meio. Trocar por `furtherReading[1][url]` quebraria isso em
 * silêncio: o erro voltaria e não acharia campo nenhum.
 */
export function furtherReadingName(indice: number, campo: 'label' | 'url'): string {
  return `${FURTHER_READING}.${indice}.${campo}`
}

type ItemLeitura = { label: string; url: string }

/**
 * Lê os itens repetíveis do `FormData`.
 *
 * DUAS REGRAS, ambas com consequência visível:
 *
 * 1. **Linha inteiramente em branco é DESCARTADA.** Um item recém-adicionado e
 *    não preenchido não pode reprovar a submissão — o editor clicou "adicionar"
 *    e mudou de ideia, o que não é erro. Linha PARCIAL (só rótulo, ou só URL)
 *    NÃO é descartada: ali há intenção declarada e falta metade, então tem de
 *    virar erro de campo.
 *
 * 2. **Os índices são reordenados numericamente e recompactados.** O formulário
 *    sempre renderiza índices densos, então na prática isto é identidade; existe
 *    para que um payload com buraco (`0` e `2`) não produza `undefined` no meio
 *    do array — que o Zod reprovaria com uma mensagem sobre um item que o
 *    usuário não vê.
 */
export function readFurtherReading(formData: FormData): ItemLeitura[] {
  const porIndice = new Map<number, ItemLeitura>()

  for (const [chave, valor] of formData.entries()) {
    const m = /^furtherReading\.(\d+)\.(label|url)$/.exec(chave)
    if (!m || typeof valor !== 'string') continue

    const indice = Number(m[1])
    const item = porIndice.get(indice) ?? { label: '', url: '' }
    item[m[2] as 'label' | 'url'] = valor.trim()
    porIndice.set(indice, item)
  }

  return [...porIndice.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item)
    .filter((item) => item.label !== '' || item.url !== '')
}

/**
 * `FormData` → objeto plano na forma que o `reviewInputSchema` espera.
 *
 * NÃO COLETA `pages`, `originalLanguage`, `translator` nem `translatedFrom`:
 * existem em `book` e no `bookInputSchema`, mas o `create_review_with_book`
 * (0011) não tem parâmetro para eles. Ler esses campos aqui capturaria digitação
 * que o mapeador do T5 descarta em silêncio — dado perdido é pior que dado não
 * perguntado. Acrescentá-los exige migration nova que estenda o RPC, e só então
 * este leitor e o formulário mudam.
 */
export function readReviewForm(formData: FormData) {
  const texto = (chave: string) => {
    const valor = formData.get(chave)
    return typeof valor === 'string' && valor.trim() !== '' ? valor : undefined
  }
  const numero = (chave: string) => {
    const valor = texto(chave)
    return valor === undefined ? undefined : Number(valor)
  }

  return {
    title: texto('title') ?? '',
    author: texto('author') ?? '',
    genreId: texto('genreId') ?? '',
    publisher: texto('publisher'),
    isbn: texto('isbn'),
    coverUrl: texto('coverUrl'),
    year: numero('year'),
    publicationCity: texto('publicationCity'),
    reviewTitle: texto('reviewTitle'),
    body: texto('body'),
    tagsInput: texto('tagsInput') ?? '',
    keywordsInput: texto('keywordsInput') ?? '',
    highlightQuote: texto('highlightQuote'),
    furtherReading: readFurtherReading(formData),
  }
}

export type RawReviewForm = ReturnType<typeof readReviewForm>

/**
 * Issues do Zod → `fieldErrors` (a PRIMEIRA mensagem por campo).
 *
 * Primeira e não todas: o `Field` exibe uma mensagem, e empilhar as demais num
 * lugar que não as mostra seria estado morto. A chave é o caminho pontilhado —
 * ver a nota em `furtherReadingName`.
 */
export function mapZodIssues(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const campo = issue.path.join('.') || '_'
    if (!fieldErrors[campo]) fieldErrors[campo] = issue.message
  }
  return fieldErrors
}

/**
 * Eco dos valores submetidos, para repopular sem perder digitação.
 *
 * Os itens repetíveis são ACHATADOS com o mesmo nome do input
 * (`furtherReading.0.url`), e não como array aninhado, para que `values`
 * continue sendo `Record<string, string>` — o tipo que o `ReviewFormState` (T6)
 * publica e que o formulário consome por nome de campo.
 */
export function echoValues(bruto: RawReviewForm): Record<string, string> {
  const eco: Record<string, string> = {}

  for (const [chave, valor] of Object.entries(bruto)) {
    if (typeof valor === 'string') eco[chave] = valor
  }
  bruto.furtherReading.forEach((item, i) => {
    eco[furtherReadingName(i, 'label')] = item.label
    eco[furtherReadingName(i, 'url')] = item.url
  })

  return eco
}
