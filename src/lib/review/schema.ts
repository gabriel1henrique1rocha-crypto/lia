import { z } from 'zod'
import { bookInputSchema } from '@/lib/book/schema'
import type { Database } from '@/lib/database.types'

/**
 * Contrato de validação da entrada de resenha (T5). Consumido pelas actions (T6)
 * e pelo formulário (T8).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRINCÍPIO: O SCHEMA ESPELHA O BANCO. Se ele aceitar o que o banco rejeita, o
 * usuário leva 500 em vez de erro de campo. A tabela abaixo é o espelhamento
 * conferido contra as migrations 0001/0002/0009/0010/0011 E contra
 * `information_schema`/`pg_constraint` do banco real — não de memória.
 *
 * BOOK
 *   title            NOT NULL            → `.min(1)` (bookInputSchema)
 *   author           NOT NULL            → `.min(1)` (bookInputSchema)
 *   genre_id         NOT NULL (0002)     → `z.uuid()` obrigatório
 *   publisher        NULL                → opcional
 *   isbn             NULL, sem CHECK     → opcional + checksum na app (0002 diz
 *                                          explicitamente que o checksum é da app)
 *   cover_url        NULL, sem CHECK     → opcional + **http/https só** (A-4);
 *                                          o gate é a app — o banco não valida
 *   year             NULL, book_year_sane: null OR 1..2100
 *                                        → opcional, 1..anoAtual (MAIS ESTRITO
 *                                          que o banco; ver nota "estrito" abaixo)
 *   pages            NULL, book_pages_positive: null OR > 0 → opcional, > 0
 *   book_translation_consistent: translator NULL OR translated_from NOT NULL
 *                                        → superRefine (bookInputSchema)
 *   publication_city NULL (0009)         → opcional
 *
 * REVIEW
 *   title            NOT NULL            → `reviewTitle` opcional na ENTRADA,
 *                                          mas o schema DERIVA do título do livro
 *                                          quando vazio, então a saída NUNCA é
 *                                          vazia (ver DERIVAÇÃO abaixo)
 *   body             NULL                → opcional no draft; OBRIGATÓRIO no
 *                                          publish (gate de produto, não do banco)
 *   status           NOT NULL, enum      → `reviewStatusSchema`
 *   tags             NOT NULL DEFAULT {} → `.default([])`, nunca null
 *   keywords         NOT NULL DEFAULT {} → `.default([])`, nunca null
 *   highlight_quote  NULL (0009)         → opcional
 *   further_reading  NOT NULL DEFAULT [],
 *                    CHECK jsonb_typeof = 'array'
 *                                        → `z.array(...)` com `.default([])`.
 *                                          É o MESMO CHECK que serve de injetor
 *                                          de falha no T4 — se ele sair, aquele
 *                                          teste para de provar rollback.
 *   slug             NOT NULL UNIQUE     → NÃO é campo de entrada: gerado por
 *                                          `unique_review_slug` (0011)
 *   editor_id        NULL                → NÃO é campo: o RPC usa `auth.uid()`
 *   reviewer_name    NULL (0009)         → NÃO é campo: o RPC congela de
 *                                          `editor.name` (DD-6)
 *   published_at     NULL                → NÃO é campo: o RPC carimba
 *   review_book_id_key / review_slug_key (UNIQUE)
 *                                        → não são validáveis na app (dependem
 *                                          do estado do banco); tratados por
 *                                          `unique_review_slug` + 23505 → "tente
 *                                          novamente" (design §9)
 *   rating           **NÃO EXISTE** — coluna dropada pela 0010 (D-11)
 *
 * MAIS ESTRITO QUE O BANCO, DE PROPÓSITO: `year` (teto = ano atual, banco aceita
 * até 2100) e `coverUrl` (http/https, banco não restringe). Ser mais estrito
 * NUNCA causa 500 — só recusa antes. O perigo é o inverso, e é o que a tabela
 * acima existe para impedir.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Status válido. Exportado à parte porque o T6 precisa validar o `status` do
 * `FormData` **antes** de escolher o schema — a emenda A-1: o schema é derivado
 * do status VALIDADO, nunca do botão clicado. Se vivesse dentro do action, cada
 * action teria a sua cópia.
 */
export const reviewStatusSchema = z.enum(['draft', 'published'])
export type ReviewStatus = z.infer<typeof reviewStatusSchema>

/** URL segura: só `http`/`https` (A-4 — barra `javascript:` e `data:`). */
const safeUrl = z
  .string()
  .trim()
  .url('URL inválida')
  .refine((u) => /^https?:\/\//i.test(u), 'Use apenas endereços http ou https')

/**
 * Item de "para saber mais". A UI está CORTADA do Execute (design §13, REV-12
 * diferido), mas a coluna e o CHECK existem e o RPC aceita o campo — validar a
 * forma aqui evita que uma chamada direta grave lixo estruturalmente válido.
 */
const furtherReadingItem = z.object({
  label: z.string().trim().min(1, 'Rótulo do link é obrigatório'),
  url: safeUrl,
})

/**
 * Separadores de lista aceitos: vírgula **ou** ponto e vírgula.
 *
 * O ponto e vírgula entrou depois do fato. A primeira resenha real publicada
 * (`o-projeto-rosie`) teve as tags separadas por `;`, o `split(',')` de então
 * não achou separador nenhum, e a linha inteira virou UMA tag chamada
 * "neurodiversidade; autismo; amor; saúde mental; …". Só o `helpText` do
 * formulário dizia "separe por vírgula" — e texto de ajuda não é contrato: o
 * editor não deve ter de adivinhar a convenção do parser.
 *
 * Aceitar os dois separadores REMOVE um palpite — as duas pontuações são
 * inequivocamente separadoras de lista. É o oposto de aparar pontuação no fim
 * do termo, que ACRESCENTARIA um; ver a nota em `listaDeTermos`.
 *
 * NÃO inclui quebra de linha: uma lista colada uma-por-linha recai no mesmo
 * defeito. Fora do escopo desta correção — se aparecer no uso, o lugar é aqui.
 */
const SEPARADOR_DE_TERMOS = /[,;]/

/**
 * `"ficção, clássico"` ou `"ficção; clássico"` → `['ficção','clássico']`.
 * Vazio → `[]`, nunca null (a coluna é NOT NULL DEFAULT `{}`).
 *
 * O nome NÃO cita mais os separadores, de propósito: o anterior citava e virou
 * mentira no dia em que a regra mudou. Nome que descreve a REGRA precisa ser
 * renomeado sempre que a regra evolui — e o `SEPARADOR_DE_TERMOS` acima já é o
 * lugar, greppável, onde a regra está dita.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NÃO APARA PONTUAÇÃO — só espaço em branco
 *
 * O caso real trouxe `"… vínculos humanos."`, com ponto final: o editor
 * terminou a lista como se termina uma frase. Aparar o ponto deixaria a tag
 * limpa — e ainda assim não é o que este parser faz.
 *
 * A razão é a mesma que trouxe o defeito até aqui. Aceitar `;` além de `,`
 * REMOVE um palpite: sob qualquer leitura, as duas são separadoras de lista.
 * Remover o ponto final ACRESCENTA um — o parser passaria a decidir que o
 * editor "não quis" um caractere que ele digitou, e erraria em `etc.`, `S.A.`,
 * `vol.`, `Jr.`. É o princípio já registrado no `formData.ts` (dado perdido é
 * pior que dado não perguntado), agravado por ser perda SILENCIOSA.
 *
 * Assimetria que decide o caso: o ponto sobrando é VISÍVEL na tela e o editor
 * pode corrigi-lo; um caractere comido por regra invisível, não. O lugar de
 * pegar isso é a UI — um eco das tags já separadas ao lado do campo —, não uma
 * heurística de pontuação enterrada na validação.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NÃO DEDUPLICA, e isso é comportamento HERDADO, não decisão desta correção:
 * `"amor, amor"` chega ao banco como `['amor','amor']`. Registrado no STATE.md
 * junto com a consequência já observável (chave duplicada de React no
 * `ReviewTags`). Mudar exige decidir antes o que conta como repetida —
 * maiúsculas? acentos? —, o que é decisão de produto, não linha de parser.
 */
const listaDeTermos = z
  .string()
  .trim()
  .default('')
  .transform((s) =>
    s
      .split(SEPARADOR_DE_TERMOS)
      .map((t) => t.trim())
      .filter(Boolean)
  )

/**
 * Base: a ficha do livro + os campos da resenha.
 *
 * Usa `.safeExtend()`, não `.extend()`. No Zod 4 os dois preservam os
 * refinements da base (o checksum de ISBN e a regra tradutor→idioma continuam
 * valendo), mas `.extend()` LANÇA ao SOBRESCREVER uma chave já existente em
 * schema refinado — e aqui `coverUrl` é sobrescrito de propósito. Verificado:
 * `.safeExtend()` preserva a base E aplica o override.
 *
 * `.omit()` também não é opção: no Zod 4 ele lança em schema com refinements,
 * então não dá para enxugar a ficha por aqui (ver nota sobre os campos que o
 * RPC não aceita, mais abaixo).
 *
 * `coverUrl` é REDECLARADO com o mesmo refinamento http/https. Desde a correção
 * de A-4 (`fix(validation)`), o `bookInputSchema` JÁ restringe o esquema na
 * origem — então este override virou REDUNDANTE, não indispensável. Mantido
 * como defesa em profundidade: se alguém afrouxar a ficha um dia, o caminho de
 * resenha (o único que grava `cover_url` hoje) não afrouxa junto. `safeUrl` é a
 * fonte única do refinamento nos dois lugares.
 */
const reviewBase = bookInputSchema.safeExtend({
  publicationCity: z.string().trim().optional(),
  coverUrl: safeUrl.optional(),
  reviewTitle: z.string().trim().optional(),
  body: z.string().trim().optional(),
  tagsInput: listaDeTermos,
  keywordsInput: listaDeTermos,
  highlightQuote: z.string().trim().optional(),
  furtherReading: z.array(furtherReadingItem).default([]),
})

/**
 * DERIVAÇÃO do título da resenha (§6): vazio → título do livro.
 *
 * Feita AQUI, e não no formulário nem no action, por uma razão de correção:
 * `review.title` é NOT NULL. Se a derivação vivesse na UI, uma submissão que não
 * passe por ela (curl, action chamada de outro lugar) mandaria `null` ao RPC e o
 * banco responderia com violação de NOT NULL — 500 na tela, exatamente o que o
 * princípio deste arquivo existe para evitar. Derivando na saída do schema, é
 * impossível um payload validado sair sem título.
 */
function derivarTitulo<T extends { title: string; reviewTitle?: string }>(dados: T) {
  return { ...dados, reviewTitle: dados.reviewTitle?.trim() || dados.title }
}

/** Rascunho: só o mínimo estrutural — a ficha. Resto pode faltar (REV-15). */
export const reviewDraftSchema = reviewBase.transform(derivarTitulo)

/**
 * Publicação: exige o conjunto completo (design §5.4). `body` é NULL-able no
 * banco, então isto é gate de PRODUTO, não espelhamento — por isso vive só aqui
 * e não no draft.
 */
export const reviewPublishSchema = reviewBase
  .superRefine((dados, ctx) => {
    if (!dados.body || dados.body.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'O corpo da resenha é obrigatório para publicar',
      })
    }
  })
  .transform(derivarTitulo)

export type ReviewInput = z.infer<typeof reviewDraftSchema>

/* ────────────────────────────────────────────────────────────────────────────
 * PONTE DE TIPOS PARA O RPC — a fricção sinalizada no T3.
 *
 * O gerador de tipos do Supabase emite os Args do RPC como NÃO-NULOS
 * (`p_publisher: string`), mas a função SQL aceita NULL em todos os opcionais —
 * VERIFICADO no banco, não suposto: a chamada com `null` em publisher/isbn/
 * cover_url/year/publication_city/tags/keywords/highlight_quote/further_reading
 * cria a resenha normalmente. A causa é estrutural: o Postgres não registra
 * nullability de PARÂMETRO no catálogo, então não há o que o gerador infira.
 *
 * Não dá para "consertar" o tipo gerado — ele é regerado a cada `db reset`.
 * Também não se resolve com `as never`, que apagaria o erro junto com qualquer
 * divergência REAL de assinatura futura.
 *
 * A saída: um tipo intermediário DERIVADO do gerado, corrigindo só a
 * nullability. Derivar (em vez de escrever à mão) mantém o acoplamento: se a
 * assinatura do RPC mudar, `CreateReviewRpcArgs` muda junto e o typecheck
 * acusa — que é exatamente o alarme que se quer preservar.
 * ──────────────────────────────────────────────────────────────────────────── */

type GeneratedCreateArgs = Database['public']['Functions']['create_review_with_book']['Args']

/**
 * Parâmetros que mapeiam COLUNA NULLABLE e, portanto, aceitam NULL de verdade.
 * A lista é deliberadamente restrita: tornar TODOS os parâmetros nuláveis seria
 * mais fácil e pior — `p_author` e `p_book_title` alimentam colunas NOT NULL, e
 * afrouxá-los aqui trocaria um erro de compilação por um 500 em runtime.
 */
type ParamsNullable =
  | 'p_publisher'
  | 'p_isbn'
  | 'p_cover_url'
  | 'p_year'
  | 'p_publication_city'
  | 'p_body'
  | 'p_highlight_quote'

/**
 * Assinatura REAL do RPC: derivada da gerada, corrigindo a nullability APENAS
 * onde a coluna é nullable. Derivar (em vez de escrever à mão) mantém o
 * acoplamento — se a assinatura do RPC mudar, este tipo muda junto e o typecheck
 * acusa, que é justamente o alarme que se quer preservar.
 */
export type CreateReviewRpcArgs = Omit<GeneratedCreateArgs, ParamsNullable> & {
  [K in ParamsNullable]: GeneratedCreateArgs[K] | null
}

/** `''`/`undefined` → `null`. Coluna nullable deve receber NULL, não `''`. */
function ouNulo(valor: string | undefined): string | null {
  const limpo = valor?.trim()
  return limpo ? limpo : null
}

/**
 * Converte a entrada validada nos argumentos do RPC de criação.
 *
 * CAMPOS DA FICHA QUE O RPC NÃO ACEITA: `pages`, `originalLanguage`,
 * `translator` e `translatedFrom` existem em `book` (0001) e em
 * `bookInputSchema`, mas **não estão na assinatura do `create_review_with_book`**
 * (0011). Este mapeador os DESCARTA — em silêncio no runtime, mas não em
 * silêncio no código: se o formulário passar a coletá-los, o valor NÃO chega ao
 * banco, e a correção é acrescentar os parâmetros ao RPC por migration nova.
 * Há um teste fixando esse descarte, para que a mudança seja deliberada.
 *
 * SOBRE O `as` NO RETORNO — é a ÚNICA asserção de tipo deste módulo, e está aqui
 * de propósito, em UM lugar, para que o T6 não precise inventar a sua:
 *
 *   · o objeto é montado e checado como `CreateReviewRpcArgs`, o tipo HONESTO;
 *   · o `as` só o reapresenta como `GeneratedCreateArgs`, que é o que o
 *     `.rpc()` tipado exige;
 *   · a divergência entre os dois é EXCLUSIVAMENTE a nullability dos parâmetros
 *     opcionais, e ela é um defeito do gerador, não do nosso código: o Postgres
 *     não registra nullability de PARÂMETRO no catálogo, então não há o que
 *     inferir. VERIFICADO no banco real que o RPC aceita NULL nesses campos.
 *
 * Não é `as never` nem `as unknown as`: se a assinatura do RPC ganhar ou perder
 * um parâmetro, `CreateReviewRpcArgs` deixa de se sobrepor a `GeneratedCreateArgs`
 * e a asserção passa a FALHAR na compilação. O alarme continua armado — só a
 * nullability foi silenciada, e apenas onde se provou que ela mente.
 */
export function toCreateReviewRpcArgs(
  input: ReviewInput,
  slugBase: string,
  status: ReviewStatus
): GeneratedCreateArgs {
  const args: CreateReviewRpcArgs = {
    p_book_title: input.title,
    p_author: input.author,
    p_genre_id: input.genreId,
    p_publisher: ouNulo(input.publisher),
    p_isbn: ouNulo(input.isbn),
    p_cover_url: ouNulo(input.coverUrl),
    p_year: input.year ?? null,
    p_publication_city: ouNulo(input.publicationCity),
    p_review_title: input.reviewTitle,
    p_body: ouNulo(input.body),
    p_tags: input.tagsInput,
    p_keywords: input.keywordsInput,
    p_highlight_quote: ouNulo(input.highlightQuote),
    p_further_reading: input.furtherReading,
    p_status: status,
    p_slug_base: slugBase,
  }
  return args as GeneratedCreateArgs
}
