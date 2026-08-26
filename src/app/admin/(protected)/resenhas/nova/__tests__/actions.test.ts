import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReviewFormState } from '../../actions'

/**
 * O envoltório que liga o formulário (T8) ao `createReview` (T6) e navega.
 *
 * `redirect` é MOCKADO LANÇANDO, como o Next lança de verdade: ele sinaliza por
 * exceção de controle. Um mock que apenas registrasse a chamada passaria mesmo
 * se alguém envolvesse tudo num `try/catch` — que é exatamente a falha que este
 * arquivo existe para impedir. Lançando, o teste distingue "propagou" de
 * "engoliu".
 */
const NEXT_REDIRECT = 'NEXT_REDIRECT'

const redirectMock = vi.fn((destino: string) => {
  const erro = new Error(`${NEXT_REDIRECT};replace;${destino}`)
  erro.name = NEXT_REDIRECT
  throw erro
})
vi.mock('next/navigation', () => ({ redirect: (destino: string) => redirectMock(destino) }))

const createReviewMock = vi.fn()
vi.mock('../../actions', () => ({
  createReview: (anterior: ReviewFormState, formData: FormData) =>
    createReviewMock(anterior, formData),
}))

import { createReviewAndGoToList } from '../actions'

const IDLE: ReviewFormState = { status: 'idle', message: '' }

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  redirectMock.mockClear()
  createReviewMock.mockReset()
})

describe('sucesso → lista, com confirmação', () => {
  it('rascunho salvo leva para /admin/resenhas?criada=rascunho', async () => {
    createReviewMock.mockResolvedValue({ status: 'saved', message: 'Resenha salva.' })

    await expect(createReviewAndGoToList(IDLE, form({ status: 'draft' }))).rejects.toMatchObject({
      name: NEXT_REDIRECT,
    })

    expect(redirectMock).toHaveBeenCalledWith('/admin/resenhas?criada=rascunho')
  })

  it('publicação leva para /admin/resenhas?criada=publicada', async () => {
    createReviewMock.mockResolvedValue({ status: 'saved', message: 'Resenha salva.' })

    await expect(
      createReviewAndGoToList(IDLE, form({ status: 'published' }))
    ).rejects.toMatchObject({ name: NEXT_REDIRECT })

    expect(redirectMock).toHaveBeenCalledWith('/admin/resenhas?criada=publicada')
  })

  it('O REDIRECT NÃO É ENGOLIDO: a exceção de controle sobe intacta', async () => {
    createReviewMock.mockResolvedValue({ status: 'saved', message: 'Resenha salva.' })

    // Se um `try/catch` aparecesse no caminho, isto RESOLVERIA (devolvendo um
    // estado) em vez de rejeitar — e a navegação nunca aconteceria, em silêncio.
    const resultado = createReviewAndGoToList(IDLE, form({ status: 'draft' }))
    await expect(resultado).rejects.toThrow(new RegExp(NEXT_REDIRECT))
  })

  it('o redirect acontece DEPOIS de createReview ter retornado', async () => {
    const ordem: string[] = []
    createReviewMock.mockImplementation(async () => {
      ordem.push('createReview')
      return { status: 'saved', message: 'Resenha salva.' }
    })
    redirectMock.mockImplementationOnce((destino: string) => {
      ordem.push('redirect')
      const erro = new Error(destino)
      erro.name = NEXT_REDIRECT
      throw erro
    })

    await createReviewAndGoToList(IDLE, form({ status: 'draft' })).catch(() => {})

    // `createReview` chama `revalidatePath` ANTES de retornar (T6), então esta
    // ordem é a prova de que a invalidação de cache precede a navegação.
    expect(ordem).toEqual(['createReview', 'redirect'])
  })
})

describe('falha → fica na tela, sem navegar', () => {
  it('erro de validação volta como estado, com os fieldErrors intactos', async () => {
    const erro: ReviewFormState = {
      status: 'error',
      message: 'Confira os campos destacados.',
      fieldErrors: { title: 'Título é obrigatório' },
    }
    createReviewMock.mockResolvedValue(erro)

    const estado = await createReviewAndGoToList(IDLE, form({ status: 'draft' }))

    expect(estado).toEqual(erro)
    // Navegar aqui levaria junto tudo o que o editor digitou.
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('negação de permissão também não navega', async () => {
    createReviewMock.mockResolvedValue({
      status: 'error',
      message: 'Você não tem permissão para esta operação.',
    })

    const estado = await createReviewAndGoToList(IDLE, form({ status: 'published' }))

    expect(estado.status).toBe('error')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('estado `idle` (nada aconteceu) não navega', async () => {
    createReviewMock.mockResolvedValue(IDLE)

    await createReviewAndGoToList(IDLE, form({ status: 'draft' }))

    expect(redirectMock).not.toHaveBeenCalled()
  })
})

describe('o envoltório NÃO reimplementa a decisão de publicar', () => {
  it('só repassa: o `status` do FormData chega a createReview sem ser tocado', async () => {
    createReviewMock.mockResolvedValue({ status: 'error', message: 'x' })
    const fd = form({ status: 'published', title: 'Dom Casmurro' })

    await createReviewAndGoToList(IDLE, fd)

    // MESMO objeto FormData — nada foi reescrito, filtrado ou reinterpretado no
    // caminho. Quem deriva o schema do status validado continua sendo o T6.
    expect(createReviewMock).toHaveBeenCalledWith(IDLE, fd)
  })
})
