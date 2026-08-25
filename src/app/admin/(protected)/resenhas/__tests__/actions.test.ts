import { describe, it, expect, vi, beforeEach } from 'vitest'

// Gate de sessão e client mockados: não tocamos Supabase real nem next/headers.
// O efeito da RLS já é provado em runtime pelo T3/T4 (integration local-only);
// aqui o alvo é a LÓGICA da action — qual schema ela escolhe, o que ela manda ao
// RPC e o que ela devolve em cada erro.
const requireEditorMock = vi.fn()
vi.mock('@/lib/auth/requireEditor', () => ({
  requireEditor: () => requireEditorMock(),
}))

const rpc = vi.fn()
const from = vi.fn()
vi.mock('@/lib/supabase/authenticated', () => ({
  createAuthenticatedClient: vi.fn(async () => ({ rpc, from })),
}))

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidatePath(p) }))

import {
  createReview,
  publishReview,
  unpublishReview,
  IDLE_STATE,
  type ReviewFormState,
} from '../actions'

const GENRE = '11111111-1111-4111-8111-111111111111'
const SEM_PERMISSAO = 'Você não tem permissão para esta operação.'

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

/** Ficha completa e válida; o teste sobrescreve o que quiser quebrar. */
function fichaValida(over: Record<string, string> = {}) {
  return form({
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    genreId: GENRE,
    body: 'Corpo real da resenha.',
    status: 'draft',
    ...over,
  })
}

/** Encadeamento de `.from('review').select(...).eq(...).maybeSingle()`. */
function mockLeitura(resultado: { data: unknown; error: unknown }) {
  return {
    select: () => ({ eq: () => ({ maybeSingle: async () => resultado }) }),
  }
}

/** Encadeamento de `.from('review').update(...).eq(...).select(...)`. */
function mockUpdate(resultado: { data: unknown; error: unknown }, capturarPatch?: unknown[]) {
  return {
    update: (patch: unknown) => {
      capturarPatch?.push(patch)
      return { eq: () => ({ select: async () => resultado }) }
    },
  }
}

beforeEach(() => {
  requireEditorMock.mockReset()
  requireEditorMock.mockResolvedValue({ status: 'ok', editor: { id: 'ed-1', role: 'editor' } })
  rpc.mockReset()
  rpc.mockResolvedValue({ data: { slug: 'dom-casmurro' }, error: null })
  from.mockReset()
  revalidatePath.mockReset()
})

// ── Gate de sessão ───────────────────────────────────────────────────────────

describe('gate por operação (SEC-08)', () => {
  it.each([
    ['createReview', () => createReview(IDLE_STATE, fichaValida())],
    ['publishReview', () => publishReview('rev-1')],
    ['unpublishReview', () => unpublishReview('rev-1')],
  ])('%s: sessão não-ok → NADA é escrito', async (_nome, chamar) => {
    requireEditorMock.mockResolvedValue({ status: 'anonymous' })
    const estado = await chamar()
    expect(estado.status).toBe('error')
    expect(estado.message).toBe(SEM_PERMISSAO)
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})

// ── O TESTE MAIS IMPORTANTE: gate de publicação schema-determinístico ────────

describe('GATE DE PUBLICAÇÃO — o schema vem do STATUS VALIDADO, nunca do botão (A-1)', () => {
  it('PAYLOAD MANIPULADO: status=published SEM corpo → REJEITADO, nada persistido', async () => {
    // Este é o ataque que a emenda A-1 fecha: uma FormData forjada (curl,
    // DevTools, extensão) chega pelo CAMINHO NORMAL do app. Se o schema viesse
    // do botão clicado, ela publicaria incompleta sem nunca tocar a API direta.
    const estado = await createReview(IDLE_STATE, fichaValida({ status: 'published', body: '' }))

    expect(estado.status).toBe('error')
    expect(estado.fieldErrors?.body).toMatch(/corpo/i)
    expect(rpc).not.toHaveBeenCalled() // NADA foi ao banco
  })

  it('o MESMO payload passa como draft — prova que é o STATUS que decide', async () => {
    // Contraprova: se o teste acima falhasse por outro motivo (ficha inválida),
    // este também falharia. Só o status muda entre os dois.
    const estado = await createReview(IDLE_STATE, fichaValida({ status: 'draft', body: '' }))
    expect(estado.status).toBe('saved')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('status forjado FORA do enum → erro ANTES de tocar o RPC', async () => {
    for (const forjado of ['publicado', 'PUBLISHED', 'admin', '']) {
      rpc.mockClear()
      const estado = await createReview(IDLE_STATE, fichaValida({ status: forjado }))
      expect(estado.status).toBe('error')
      expect(estado.message).toBe('Ação inválida.')
      expect(rpc).not.toHaveBeenCalled()
    }
  })

  it('status ausente → erro, sem escrita', async () => {
    const fd = fichaValida()
    fd.delete('status')
    const estado = await createReview(IDLE_STATE, fd)
    expect(estado.status).toBe('error')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('o p_status enviado ao RPC é o MESMO valor validado — não há divergência', async () => {
    await createReview(IDLE_STATE, fichaValida({ status: 'published' }))
    expect(rpc.mock.calls[0][1].p_status).toBe('published')

    rpc.mockClear()
    await createReview(IDLE_STATE, fichaValida({ status: 'draft' }))
    expect(rpc.mock.calls[0][1].p_status).toBe('draft')
  })

  it('publicar exige corpo TAMBÉM quando publicando linha já gravada', async () => {
    from.mockReturnValue(
      mockLeitura({
        data: {
          id: 'rev-1',
          title: 'T',
          slug: 's',
          body: null, // rascunho sem corpo
          status: 'draft',
          published_at: null,
          book: { title: 'L', author: 'A', genre_id: GENRE },
        },
        error: null,
      })
    )
    const estado = await publishReview('rev-1')
    expect(estado.status).toBe('error')
    expect(estado.fieldErrors?.body).toMatch(/corpo/i)
  })
})

// ── 42501 não vaza existência ────────────────────────────────────────────────

describe('42501 — "não existe" e "não é seu" produzem resposta IDÊNTICA', () => {
  it('publishReview: linha invisível × policy negando × 42501 → mesma resposta', async () => {
    // (1) linha invisível ao chamador (não existe OU é rascunho alheio)
    from.mockReturnValue(mockLeitura({ data: null, error: null }))
    const invisivel = await publishReview('rev-x')

    // (2) linha visível (publicada alheia), mas o UPDATE não alcança nenhuma
    from.mockReturnValue({
      ...mockLeitura({
        data: {
          id: 'rev-1',
          title: 'T',
          slug: 's',
          body: 'corpo',
          status: 'draft',
          published_at: null,
          book: { title: 'L', author: 'A', genre_id: GENRE },
        },
        error: null,
      }),
      ...mockUpdate({ data: [], error: null }),
    })
    const zeroLinhas = await publishReview('rev-1')

    // (3) o banco levanta 42501
    from.mockReturnValue(mockLeitura({ data: null, error: { code: '42501', message: 'denied' } }))
    const erro42501 = await publishReview('rev-1')

    // A igualdade É a asserção de segurança: qualquer diferença — inclusive em
    // fieldErrors — permitiria distinguir os casos e enumerar rascunhos alheios.
    expect(invisivel).toEqual(zeroLinhas)
    expect(zeroLinhas).toEqual(erro42501)
    expect(invisivel.message).toBe(SEM_PERMISSAO)
    expect(invisivel.fieldErrors).toBeUndefined()
  })

  it('unpublishReview: 0 linhas e 42501 → mesma resposta', async () => {
    from.mockReturnValue(mockUpdate({ data: [], error: null }))
    const zeroLinhas = await unpublishReview('rev-1')

    from.mockReturnValue(mockUpdate({ data: null, error: { code: '42501', message: 'denied' } }))
    const erro42501 = await unpublishReview('rev-1')

    expect(zeroLinhas).toEqual(erro42501)
    expect(zeroLinhas.message).toBe(SEM_PERMISSAO)
  })

  it('a mensagem NÃO revela qual dos dois casos ocorreu', async () => {
    from.mockReturnValue(mockLeitura({ data: null, error: null }))
    const { message } = await publishReview('rev-x')
    expect(message).not.toMatch(/existe|encontrad|inexistente|outro editor|rascunho/i)
  })
})

// ── Mapeamento de erros ──────────────────────────────────────────────────────

describe('mapeamento de códigos do Postgres', () => {
  it('23505 (colisão de slug) → mensagem NO CAMPO, não erro genérico', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const estado = await createReview(IDLE_STATE, fichaValida())
    expect(estado.status).toBe('error')
    expect(estado.fieldErrors?.reviewTitle).toBeTruthy()
    expect(estado.message).toMatch(/parecido/i)
  })

  it('42501 no create → sem permissão, genérico', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    const estado = await createReview(IDLE_STATE, fichaValida())
    expect(estado.message).toBe(SEM_PERMISSAO)
  })

  it('23514 (CHECK) → genérico ao usuário E logado como divergência de espelhamento', async () => {
    // Não deveria chegar aqui: o schema do T5 espelha os CHECKs. Se chegou, o
    // espelhamento divergiu — e sem log isso vira "erro genérico" intermitente
    // que ninguém investiga.
    const erroLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    rpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'review_further_reading_is_array' },
    })
    const estado = await createReview(IDLE_STATE, fichaValida())
    expect(estado.status).toBe('error')
    expect(erroLog).toHaveBeenCalledWith(
      expect.stringContaining('23514'),
      expect.stringContaining('review_further_reading_is_array')
    )
    erroLog.mockRestore()
  })

  it('erro desconhecido → genérico, sem vazar detalhe do banco', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX999', message: 'internal detail' } })
    const estado = await createReview(IDLE_STATE, fichaValida())
    expect(estado.message).not.toMatch(/internal detail|XX999/)
  })
})

// ── Validação e eco ──────────────────────────────────────────────────────────

describe('createReview — validação de campos', () => {
  it('ficha inválida → fieldErrors por campo, sem tocar o RPC', async () => {
    const estado = await createReview(IDLE_STATE, fichaValida({ title: '', author: '' }))
    expect(estado.fieldErrors?.title).toBeTruthy()
    expect(estado.fieldErrors?.author).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('coverUrl com javascript: → rejeitado (A-4) antes do banco', async () => {
    const estado = await createReview(IDLE_STATE, fichaValida({ coverUrl: 'javascript:alert(1)' }))
    expect(estado.fieldErrors?.coverUrl).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('devolve eco dos valores para o formulário repopular', async () => {
    const estado = await createReview(IDLE_STATE, fichaValida({ title: '', author: 'Machado' }))
    expect(estado.values?.author).toBe('Machado')
  })

  it('slug é derivado do título da resenha, com acento normalizado', async () => {
    await createReview(IDLE_STATE, fichaValida({ reviewTitle: 'Ação e Coração' }))
    expect(rpc.mock.calls[0][1].p_slug_base).toBe('acao-e-coracao')
  })

  it('reviewTitle vazio → slug deriva do título do LIVRO (derivação do T5)', async () => {
    await createReview(IDLE_STATE, fichaValida())
    expect(rpc.mock.calls[0][1].p_review_title).toBe('Dom Casmurro')
    expect(rpc.mock.calls[0][1].p_slug_base).toBe('dom-casmurro')
  })
})

// ── published_at e revalidação ───────────────────────────────────────────────

// ── further_reading: o leitor compartilhado com o formulário (T8) ────────────

describe('further_reading — o que o formulário coleta CHEGA ao RPC', () => {
  it('itens indexados no FormData viram o array de p_further_reading', async () => {
    const fd = fichaValida()
    fd.set('furtherReading.0.label', 'Ensaio sobre Machado')
    fd.set('furtherReading.0.url', 'https://exemplo.org/ensaio')
    fd.set('furtherReading.1.label', 'Entrevista')
    fd.set('furtherReading.1.url', 'https://exemplo.org/entrevista')

    await createReview(IDLE_STATE, fd)

    expect(rpc.mock.calls[0][1].p_further_reading).toEqual([
      { label: 'Ensaio sobre Machado', url: 'https://exemplo.org/ensaio' },
      { label: 'Entrevista', url: 'https://exemplo.org/entrevista' },
    ])
  })

  it('item EM BRANCO é descartado — não vira erro nem lixo no jsonb', async () => {
    const fd = fichaValida()
    fd.set('furtherReading.0.label', '')
    fd.set('furtherReading.0.url', '')

    const estado = await createReview(IDLE_STATE, fd)

    expect(estado.status).toBe('saved')
    expect(rpc.mock.calls[0][1].p_further_reading).toEqual([])
  })

  it('item PELA METADE reprova no campo daquele item (caminho pontilhado)', async () => {
    const fd = fichaValida()
    fd.set('furtherReading.0.label', 'Só o rótulo')
    fd.set('furtherReading.0.url', '')

    const estado = await createReview(IDLE_STATE, fd)

    expect(estado.status).toBe('error')
    expect(estado.fieldErrors?.['furtherReading.0.url']).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('URL de esquema perigoso num item é barrada como em qualquer outra URL (A-4)', async () => {
    const fd = fichaValida()
    fd.set('furtherReading.0.label', 'Armadilha')
    fd.set('furtherReading.0.url', 'javascript:alert(1)')

    const estado = await createReview(IDLE_STATE, fd)

    expect(estado.fieldErrors?.['furtherReading.0.url']).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sem nenhum item o RPC recebe array vazio, nunca null (CHECK jsonb_typeof)', async () => {
    await createReview(IDLE_STATE, fichaValida())
    expect(rpc.mock.calls[0][1].p_further_reading).toEqual([])
  })
})

describe('published_at — carimbo da PRIMEIRA publicação (A-8)', () => {
  const linhaBase = {
    id: 'rev-1',
    title: 'T',
    slug: 'dom-casmurro',
    body: 'corpo',
    status: 'draft',
    book: { title: 'L', author: 'A', genre_id: GENRE },
  }

  it('primeira publicação: carimba published_at', async () => {
    const patches: unknown[] = []
    from.mockReturnValue({
      ...mockLeitura({ data: { ...linhaBase, published_at: null }, error: null }),
      ...mockUpdate({ data: [{ slug: 'dom-casmurro' }], error: null }, patches),
    })
    const estado = await publishReview('rev-1')
    expect(estado.status).toBe('saved')
    expect(patches[0]).toHaveProperty('published_at')
  })

  it('REPUBLICAÇÃO: NÃO sobrescreve o carimbo original', async () => {
    // Sem isto, republicar empurraria a resenha para o topo de "Mais recentes"
    // a cada ciclo de edição.
    const patches: unknown[] = []
    from.mockReturnValue({
      ...mockLeitura({
        data: { ...linhaBase, published_at: '2020-01-01T00:00:00Z' },
        error: null,
      }),
      ...mockUpdate({ data: [{ slug: 'dom-casmurro' }], error: null }, patches),
    })
    await publishReview('rev-1')
    expect(patches[0]).not.toHaveProperty('published_at')
  })

  it('unpublish NÃO limpa published_at', async () => {
    const patches: unknown[] = []
    from.mockReturnValue(mockUpdate({ data: [{ slug: 'x' }], error: null }, patches))
    await unpublishReview('rev-1')
    expect(patches[0]).toEqual({ status: 'draft' })
  })
})

describe('revalidação de cache', () => {
  const linhaOk = {
    id: 'rev-1',
    title: 'T',
    slug: 'dom-casmurro',
    body: 'corpo',
    status: 'draft',
    published_at: null,
    book: { title: 'L', author: 'A', genre_id: GENRE },
  }

  it('publicar invalida a home E a página da resenha', async () => {
    from.mockReturnValue({
      ...mockLeitura({ data: linhaOk, error: null }),
      ...mockUpdate({ data: [{ slug: 'dom-casmurro' }], error: null }),
    })
    await publishReview('rev-1')
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/resenha/dom-casmurro')
  })

  it('DESPUBLICAR também invalida — nas duas direções (E-4)', async () => {
    // Sem isto, a home e a página seguem servindo cache de uma resenha que já
    // não está publicada: "despublicar não despublicou".
    from.mockReturnValue(mockUpdate({ data: [{ slug: 'dom-casmurro' }], error: null }))
    await unpublishReview('rev-1')
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/resenha/dom-casmurro')
  })

  it('criar RASCUNHO não invalida nada público — não há mudança visível', async () => {
    await createReview(IDLE_STATE, fichaValida({ status: 'draft' }))
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('criar JÁ PUBLICADA invalida as rotas públicas', async () => {
    await createReview(IDLE_STATE, fichaValida({ status: 'published' }))
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/resenha/dom-casmurro')
  })

  it('NÃO invalida rotas de /admin — são dinâmicas por usarem cookies()', async () => {
    await createReview(IDLE_STATE, fichaValida({ status: 'published' }))
    const alvos = revalidatePath.mock.calls.map((c) => c[0])
    expect(alvos.some((a: string) => a.startsWith('/admin'))).toBe(false)
  })

  it('erro NÃO invalida cache — nada mudou', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'x' } })
    await createReview(IDLE_STATE, fichaValida({ status: 'published' }))
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('caminho feliz', () => {
  it('createReview devolve saved e chama o RPC uma vez', async () => {
    const estado: ReviewFormState = await createReview(IDLE_STATE, fichaValida())
    expect(estado.status).toBe('saved')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('create_review_with_book')
  })
})
