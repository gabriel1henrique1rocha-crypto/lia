import { describe, it, expect } from 'vitest'
import {
  reviewDraftSchema,
  reviewPublishSchema,
  reviewStatusSchema,
  toCreateReviewRpcArgs,
  type ReviewInput,
} from '../schema'

const GENRE = '11111111-1111-4111-8111-111111111111'
const ISBN_VALIDO = '9783161484100' // checksum conferido

/** Entrada mínima válida (só a ficha obrigatória). */
function fichaMinima(over: Record<string, unknown> = {}) {
  return { title: 'Dom Casmurro', author: 'Machado de Assis', genreId: GENRE, ...over }
}

/** Caminho feliz de publicação. */
function publicavel(over: Record<string, unknown> = {}) {
  return fichaMinima({ body: 'Corpo da resenha com conteúdo real.', ...over })
}

/** Primeira mensagem de erro do campo, para asserção legível. */
function erroDe(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  campo: string
) {
  if (result.success) return null
  return result.error?.issues.find((i) => i.path.join('.') === campo)?.message ?? null
}

describe('reviewStatusSchema', () => {
  it('aceita apenas draft e published', () => {
    expect(reviewStatusSchema.safeParse('draft').success).toBe(true)
    expect(reviewStatusSchema.safeParse('published').success).toBe(true)
  })

  it('rejeita status forjado — o T6 valida ANTES de escolher o schema (A-1)', () => {
    for (const forjado of ['publicado', 'PUBLISHED', '', 'admin', null, undefined]) {
      expect(reviewStatusSchema.safeParse(forjado).success).toBe(false)
    }
  })
})

describe('reviewDraftSchema — caminho feliz', () => {
  it('aceita rascunho com só a ficha obrigatória', () => {
    const r = reviewDraftSchema.safeParse(fichaMinima())
    expect(r.success).toBe(true)
  })

  it('tags/keywords ausentes viram [] — a coluna é NOT NULL DEFAULT {}', () => {
    const r = reviewDraftSchema.parse(fichaMinima())
    expect(r.tagsInput).toEqual([])
    expect(r.keywordsInput).toEqual([])
  })

  it('further_reading ausente vira [] — coluna NOT NULL DEFAULT []', () => {
    expect(reviewDraftSchema.parse(fichaMinima()).furtherReading).toEqual([])
  })

  it('transforma "ficção, clássico" em array, ignorando vazios e espaços', () => {
    const r = reviewDraftSchema.parse(fichaMinima({ tagsInput: ' ficção , clássico ,, ' }))
    expect(r.tagsInput).toEqual(['ficção', 'clássico'])
  })

  it('string vazia de tags vira [] (não [""])', () => {
    expect(reviewDraftSchema.parse(fichaMinima({ tagsInput: '   ' })).tagsInput).toEqual([])
  })
})

/**
 * SEPARADOR DE TERMOS — vírgula OU ponto e vírgula.
 *
 * A regressão que originou esta suíte: `o-projeto-rosie`, a primeira resenha
 * real publicada, teve as tags separadas por `;`. O `split(',')` de então não
 * achou separador nenhum e gravou a linha inteira como UMA tag. O texto de
 * ajuda dizia "separe por vírgula" — mas texto de ajuda não é contrato.
 */
describe('separador de termos — vírgula E ponto e vírgula', () => {
  const tags = (entrada: string) =>
    reviewDraftSchema.parse(fichaMinima({ tagsInput: entrada })).tagsInput
  const keywords = (entrada: string) =>
    reviewDraftSchema.parse(fichaMinima({ keywordsInput: entrada })).keywordsInput

  it('vírgula continua separando (nada regrediu)', () => {
    expect(tags('ficção, clássico, brasileiro')).toEqual(['ficção', 'clássico', 'brasileiro'])
  })

  it('ponto e vírgula separa — o caso que faltava', () => {
    expect(tags('ficção; clássico; brasileiro')).toEqual(['ficção', 'clássico', 'brasileiro'])
  })

  it('mistura dos dois na MESMA linha', () => {
    // O editor que troca de convenção no meio da lista não devia ser punido
    // por isso: os dois caracteres são separadores sob qualquer leitura.
    expect(tags('ficção; clássico, brasileiro; romance')).toEqual([
      'ficção',
      'clássico',
      'brasileiro',
      'romance',
    ])
  })

  it('separadores CONSECUTIVOS não geram elementos vazios', () => {
    expect(tags('ficção;; clássico')).toEqual(['ficção', 'clássico'])
    expect(tags('ficção,, clássico')).toEqual(['ficção', 'clássico'])
    expect(tags('ficção;,; clássico')).toEqual(['ficção', 'clássico'])
    expect(tags(' ; , ; ')).toEqual([])
  })

  it('separador solto na ponta não vira termo vazio', () => {
    expect(tags(';ficção; clássico;')).toEqual(['ficção', 'clássico'])
    expect(tags(',ficção, clássico,')).toEqual(['ficção', 'clássico'])
  })

  it('espaço em volta de cada termo é aparado — inclusive tabulação', () => {
    expect(tags('  ficção  ;	 clássico	 ;   brasileiro ')).toEqual([
      'ficção',
      'clássico',
      'brasileiro',
    ])
  })

  it('espaço DENTRO do termo é preservado (não é separador)', () => {
    expect(tags('comédia romântica; saúde mental')).toEqual(['comédia romântica', 'saúde mental'])
  })

  it('palavras-chave seguem a MESMA regra — é o mesmo parser', () => {
    expect(keywords('umberto eco; semiótica, medievo')).toEqual([
      'umberto eco',
      'semiótica',
      'medievo',
    ])
  })

  it('O CASO REAL, a string inteira de o-projeto-rosie', () => {
    // Exatamente como o editor digitou, ponto final incluído. Antes desta
    // correção o resultado era UM elemento com a linha toda dentro.
    const digitado =
      'neurodiversidade; autismo; amor; saúde mental; comédia romântica; vínculos humanos.'

    expect(tags(digitado)).toEqual([
      'neurodiversidade',
      'autismo',
      'amor',
      'saúde mental',
      'comédia romântica',
      'vínculos humanos.',
    ])
  })

  /**
   * PONTUAÇÃO NÃO É APARADA — decisão registrada, não descuido.
   *
   * Aceitar `;` REMOVE um palpite (as duas pontuações são separadoras de lista
   * sob qualquer leitura). Aparar o ponto final ACRESCENTARIA um: o parser
   * decidiria que o editor não quis um caractere que digitou, e erraria em
   * `etc.`, `S.A.`, `vol.`. O ponto sobrando é visível e corrigível pelo
   * editor; um caractere comido por regra invisível, não.
   */
  it('ponto final NÃO é aparado — o parser não decide o que o editor quis dizer', () => {
    expect(tags('vínculos humanos.')).toEqual(['vínculos humanos.'])
    expect(tags('etc.; S.A.; vol.')).toEqual(['etc.', 'S.A.', 'vol.'])
    // Ponto INTERNO nunca esteve em risco, mas prende o contrato.
    expect(tags('séc. XIX; J. R. R. Tolkien')).toEqual(['séc. XIX', 'J. R. R. Tolkien'])
  })

  /**
   * DUPLICATAS — comportamento HERDADO, preservado de propósito.
   *
   * Este teste não endossa o comportamento: prende-o, para que uma mudança
   * futura seja deliberada. Deduplicar exige decidir antes o que conta como
   * repetida (maiúsculas? acentos?), que é decisão de produto. Consequência já
   * observável e registrada no STATE.md: `ReviewTags` usa `key={tag}`, então
   * duas tags iguais produzem chave duplicada de React.
   */
  it('duplicatas passam inteiras — sem dedup, e sensível a maiúsculas', () => {
    expect(tags('amor; amor; Amor')).toEqual(['amor', 'amor', 'Amor'])
  })
})

describe('DERIVAÇÃO do título da resenha (review.title é NOT NULL)', () => {
  it('reviewTitle vazio → assume o título do livro, nunca sai indefinido', () => {
    expect(reviewDraftSchema.parse(fichaMinima()).reviewTitle).toBe('Dom Casmurro')
    expect(reviewDraftSchema.parse(fichaMinima({ reviewTitle: '   ' })).reviewTitle).toBe(
      'Dom Casmurro'
    )
  })

  it('reviewTitle preenchido é preservado', () => {
    const r = reviewDraftSchema.parse(fichaMinima({ reviewTitle: 'O ciúme como narrador' }))
    expect(r.reviewTitle).toBe('O ciúme como narrador')
  })

  it('vale também no schema de publicação', () => {
    expect(reviewPublishSchema.parse(publicavel()).reviewTitle).toBe('Dom Casmurro')
  })
})

describe('gate de publicação (design §5.4 — regra de PRODUTO, não do banco)', () => {
  it('publish REJEITA corpo ausente; draft ACEITA', () => {
    expect(reviewPublishSchema.safeParse(fichaMinima()).success).toBe(false)
    expect(reviewDraftSchema.safeParse(fichaMinima()).success).toBe(true)
  })

  it('publish rejeita corpo só com espaços, com mensagem no campo', () => {
    const r = reviewPublishSchema.safeParse(fichaMinima({ body: '    ' }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'body')).toMatch(/corpo/i)
  })

  it('publish aceita quando completo', () => {
    expect(reviewPublishSchema.safeParse(publicavel()).success).toBe(true)
  })
})

// ── ESPELHAMENTO: um caso por constraint do banco ────────────────────────────
//
// Cada teste aqui prova que o SCHEMA recusa ANTES de o banco precisar recusar.
// Se algum destes for removido, a violação correspondente vira 500 na tela em
// vez de erro de campo — que é exatamente o que este arquivo existe para evitar.

describe('espelhamento dos NOT NULL', () => {
  it('book.title NOT NULL → título obrigatório', () => {
    const r = reviewDraftSchema.safeParse(fichaMinima({ title: '' }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'title')).toMatch(/obrigat/i)
  })

  it('book.author NOT NULL → autor obrigatório', () => {
    const r = reviewDraftSchema.safeParse(fichaMinima({ author: '   ' }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'author')).toMatch(/obrigat/i)
  })

  it('book.genre_id NOT NULL (0002) → gênero obrigatório e uuid', () => {
    expect(reviewDraftSchema.safeParse({ title: 'x', author: 'y' }).success).toBe(false)
    const r = reviewDraftSchema.safeParse(fichaMinima({ genreId: 'nao-e-uuid' }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'genreId')).toMatch(/g[êe]nero/i)
  })
})

describe('espelhamento de book_year_sane (year null OR 1..2100)', () => {
  it('rejeita ano 0', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ year: 0 })).success).toBe(false)
  })

  it('rejeita ano negativo', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ year: -5 })).success).toBe(false)
  })

  it('rejeita ano futuro — MAIS ESTRITO que o banco (que aceita até 2100)', () => {
    const futuro = new Date().getFullYear() + 1
    const r = reviewDraftSchema.safeParse(fichaMinima({ year: futuro }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'year')).toMatch(/futuro/i)
    // Ser mais estrito nunca causa 500 — recusa antes. O inverso é que quebraria.
    expect(futuro).toBeLessThan(2100)
  })

  it('aceita ano válido e ausência de ano', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ year: 1899 })).success).toBe(true)
    expect(reviewDraftSchema.safeParse(fichaMinima()).success).toBe(true)
  })
})

describe('espelhamento de book_pages_positive (pages null OR > 0)', () => {
  it('rejeita 0 e negativo', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ pages: 0 })).success).toBe(false)
    expect(reviewDraftSchema.safeParse(fichaMinima({ pages: -1 })).success).toBe(false)
  })

  it('aceita positivo', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ pages: 256 })).success).toBe(true)
  })
})

describe('espelhamento de book_translation_consistent (herdado do bookInputSchema)', () => {
  it('tradutor sem idioma de origem é rejeitado — o .extend() PRESERVOU a regra', () => {
    const r = reviewDraftSchema.safeParse(fichaMinima({ translator: 'Alguém' }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'translatedFrom')).toMatch(/idioma de origem/i)
  })

  it('tradutor com idioma de origem é aceito', () => {
    expect(
      reviewDraftSchema.safeParse(fichaMinima({ translator: 'Alguém', translatedFrom: 'ru' }))
        .success
    ).toBe(true)
  })
})

describe('espelhamento de review_further_reading_is_array (CHECK jsonb_typeof = array)', () => {
  it('rejeita objeto — é o MESMO CHECK que o T4 usa como injetor de falha', () => {
    // Se este espelhamento sumir, um objeto chega ao banco, viola o CHECK e vira
    // 500. Se o CHECK sumir do banco, o T4 para de provar rollback. Os dois
    // pontos dependem da mesma constraint — mexer num exige olhar o outro.
    expect(
      reviewDraftSchema.safeParse(fichaMinima({ furtherReading: { nao: 'array' } })).success
    ).toBe(false)
  })

  it('rejeita string e número', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ furtherReading: 'texto' })).success).toBe(
      false
    )
    expect(reviewDraftSchema.safeParse(fichaMinima({ furtherReading: 42 })).success).toBe(false)
  })

  it('aceita array vazio e array de itens bem formados', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ furtherReading: [] })).success).toBe(true)
    expect(
      reviewDraftSchema.safeParse(
        fichaMinima({ furtherReading: [{ label: 'Entrevista', url: 'https://a.com/x' }] })
      ).success
    ).toBe(true)
  })

  it('rejeita item sem rótulo e item com URL insegura', () => {
    expect(
      reviewDraftSchema.safeParse(
        fichaMinima({ furtherReading: [{ label: '', url: 'https://a.com' }] })
      ).success
    ).toBe(false)
    expect(
      reviewDraftSchema.safeParse(
        fichaMinima({ furtherReading: [{ label: 'x', url: 'javascript:alert(1)' }] })
      ).success
    ).toBe(false)
  })
})

describe('A-4 — cover_url só http/https (o banco NÃO tem CHECK; a app é o gate)', () => {
  it('rejeita javascript: e data:', () => {
    const r = reviewDraftSchema.safeParse(fichaMinima({ coverUrl: 'javascript:alert(1)' }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'coverUrl')).toMatch(/http/i)
    expect(reviewDraftSchema.safeParse(fichaMinima({ coverUrl: 'data:text/html,x' })).success).toBe(
      false
    )
  })

  it('rejeita esquema não-web (ftp) e string sem esquema', () => {
    expect(
      reviewDraftSchema.safeParse(fichaMinima({ coverUrl: 'ftp://a.com/c.jpg' })).success
    ).toBe(false)
    expect(reviewDraftSchema.safeParse(fichaMinima({ coverUrl: 'a.com/capa.jpg' })).success).toBe(
      false
    )
  })

  it('aceita http e https', () => {
    expect(
      reviewDraftSchema.safeParse(fichaMinima({ coverUrl: 'https://a.com/capa.jpg' })).success
    ).toBe(true)
    expect(
      reviewDraftSchema.safeParse(fichaMinima({ coverUrl: 'http://a.com/capa.jpg' })).success
    ).toBe(true)
  })
})

describe('ISBN — sem CHECK no banco (0002 delega à app), checksum aqui', () => {
  it('rejeita checksum inválido', () => {
    const r = reviewDraftSchema.safeParse(fichaMinima({ isbn: '9788535902775' }))
    expect(r.success).toBe(false)
    expect(erroDe(r, 'isbn')).toMatch(/isbn/i)
  })

  it('aceita ISBN válido e ausência de ISBN', () => {
    expect(reviewDraftSchema.safeParse(fichaMinima({ isbn: ISBN_VALIDO })).success).toBe(true)
    expect(reviewDraftSchema.safeParse(fichaMinima()).success).toBe(true)
  })
})

// ── Ponte de tipos para o RPC ────────────────────────────────────────────────

describe('toCreateReviewRpcArgs — ponte para a assinatura do RPC', () => {
  const parsed: ReviewInput = reviewDraftSchema.parse(
    fichaMinima({
      publisher: 'Nova Fronteira',
      publicationCity: 'Rio de Janeiro',
      year: 1899,
      isbn: ISBN_VALIDO,
      coverUrl: 'https://a.com/capa.jpg',
      body: 'corpo',
      tagsInput: 'classico, brasileiro',
      keywordsInput: 'machado',
      highlightQuote: 'uma frase',
    })
  )

  it('mapeia os campos preenchidos para os parâmetros do RPC', () => {
    const args = toCreateReviewRpcArgs(parsed, 'dom-casmurro', 'draft')
    expect(args.p_book_title).toBe('Dom Casmurro')
    expect(args.p_author).toBe('Machado de Assis')
    expect(args.p_genre_id).toBe(GENRE)
    expect(args.p_publication_city).toBe('Rio de Janeiro')
    expect(args.p_review_title).toBe('Dom Casmurro') // derivado
    expect(args.p_tags).toEqual(['classico', 'brasileiro'])
    expect(args.p_keywords).toEqual(['machado'])
    expect(args.p_status).toBe('draft')
    expect(args.p_slug_base).toBe('dom-casmurro')
  })

  it('o ponto e vírgula chega SEPARADO ao parâmetro do RPC — é o que se grava', () => {
    // O parser isolado já está coberto acima; esta asserção fecha o caminho até
    // `p_tags`, que é o valor que de fato vira `review.tags` no banco. Sem ela,
    // um mapeamento futuro poderia reagrupar a lista sem nenhum teste reclamar.
    const comPontoEVirgula = reviewDraftSchema.parse(
      fichaMinima({
        tagsInput: 'neurodiversidade; autismo; amor',
        keywordsInput: 'simsion; rosie',
      })
    )
    const args = toCreateReviewRpcArgs(comPontoEVirgula, 'o-projeto-rosie', 'published')

    expect(args.p_tags).toEqual(['neurodiversidade', 'autismo', 'amor'])
    expect(args.p_keywords).toEqual(['simsion', 'rosie'])
  })

  it('campo opcional ausente vira NULL, NUNCA string vazia', () => {
    // A coluna é nullable: gravar '' em vez de NULL faria `publisher is null`
    // deixar de encontrar a linha. O RPC aceita NULL (verificado no banco).
    const minimo = reviewDraftSchema.parse(fichaMinima())
    const args = toCreateReviewRpcArgs(minimo, 'x', 'draft')
    expect(args.p_publisher).toBeNull()
    expect(args.p_isbn).toBeNull()
    expect(args.p_cover_url).toBeNull()
    expect(args.p_publication_city).toBeNull()
    expect(args.p_highlight_quote).toBeNull()
    expect(args.p_body).toBeNull()
    expect(args.p_year).toBeNull()
  })

  it('arrays NUNCA viram null — as colunas são NOT NULL DEFAULT {}', () => {
    const args = toCreateReviewRpcArgs(reviewDraftSchema.parse(fichaMinima()), 'x', 'draft')
    expect(args.p_tags).toEqual([])
    expect(args.p_keywords).toEqual([])
    expect(args.p_further_reading).toEqual([])
  })

  it('o status vem do argumento VALIDADO, não de dentro do payload (A-1)', () => {
    expect(toCreateReviewRpcArgs(parsed, 'x', 'published').p_status).toBe('published')
    expect(toCreateReviewRpcArgs(parsed, 'x', 'draft').p_status).toBe('draft')
  })

  it('DESCARTA os campos da ficha que o RPC não aceita — comportamento fixado', () => {
    // `pages`, `originalLanguage`, `translator` e `translatedFrom` existem em
    // `book` e no bookInputSchema, mas NÃO estão na assinatura do RPC (0011).
    // Este teste trava o descarte: se alguém acrescentar os parâmetros ao RPC,
    // ele quebra e obriga a atualizar o mapeador em vez de esquecê-lo.
    const comExtras = reviewDraftSchema.parse(
      fichaMinima({ pages: 256, originalLanguage: 'pt', translator: 'X', translatedFrom: 'ru' })
    )
    const args = toCreateReviewRpcArgs(comExtras, 'x', 'draft')
    for (const ausente of ['p_pages', 'p_original_language', 'p_translator', 'p_translated_from']) {
      expect(args).not.toHaveProperty(ausente)
    }
    // E o mapeador cobre TODOS os parâmetros que o RPC realmente tem.
    expect(Object.keys(args).sort()).toEqual(
      [
        'p_author',
        'p_body',
        'p_book_title',
        'p_cover_url',
        'p_further_reading',
        'p_genre_id',
        'p_highlight_quote',
        'p_isbn',
        'p_keywords',
        'p_publication_city',
        'p_publisher',
        'p_review_title',
        'p_slug_base',
        'p_status',
        'p_tags',
        'p_year',
      ].sort()
    )
  })
})
