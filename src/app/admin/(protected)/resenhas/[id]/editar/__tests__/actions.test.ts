import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReviewFormState } from '../../../actions'

/**
 * O envoltório que liga o `ReviewForm` (`mode="edit"`) ao `updateReview` (T4) e
 * navega. MESMO PADRÃO de `nova/__tests__/actions.test.ts` (T10) — `redirect`
 * mockado LANÇANDO como o Next lança de verdade, para que "engolir a exceção
 * num try/catch" reprove em vez de passar por acidente. Ver o cabeçalho
 * daquele arquivo para o raciocínio completo.
 */
const NEXT_REDIRECT = 'NEXT_REDIRECT'

const redirectMock = vi.fn((destino: string) => {
  const erro = new Error(`${NEXT_REDIRECT};replace;${destino}`)
  erro.name = NEXT_REDIRECT
  throw erro
})
vi.mock('next/navigation', () => ({ redirect: (destino: string) => redirectMock(destino) }))

const updateReviewMock = vi.fn()
vi.mock('../../../actions', () => ({
  updateReview: (anterior: ReviewFormState, formData: FormData) =>
    updateReviewMock(anterior, formData),
}))

import { updateReviewAndGoToList } from '../actions'

const IDLE: ReviewFormState = { status: 'idle', message: '' }

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  redirectMock.mockClear()
  updateReviewMock.mockReset()
})

describe('sucesso → lista, com confirmação de EDIÇÃO (não a de criação)', () => {
  it('rascunho salvo leva para /admin/resenhas?editada=rascunho', async () => {
    updateReviewMock.mockResolvedValue({ status: 'saved', message: 'Alterações salvas.' })

    await expect(updateReviewAndGoToList(IDLE, form({ status: 'draft' }))).rejects.toMatchObject({
      name: NEXT_REDIRECT,
    })

    expect(redirectMock).toHaveBeenCalledWith('/admin/resenhas?editada=rascunho')
  })

  it('publicação leva para /admin/resenhas?editada=publicada', async () => {
    updateReviewMock.mockResolvedValue({ status: 'saved', message: 'Alterações salvas.' })

    await expect(
      updateReviewAndGoToList(IDLE, form({ status: 'published' }))
    ).rejects.toMatchObject({ name: NEXT_REDIRECT })

    expect(redirectMock).toHaveBeenCalledWith('/admin/resenhas?editada=publicada')
  })

  it('O REDIRECT NÃO É ENGOLIDO: a exceção de controle sobe intacta', async () => {
    updateReviewMock.mockResolvedValue({ status: 'saved', message: 'Alterações salvas.' })

    const resultado = updateReviewAndGoToList(IDLE, form({ status: 'draft' }))
    await expect(resultado).rejects.toThrow(new RegExp(NEXT_REDIRECT))
  })

  it('o redirect acontece DEPOIS de updateReview ter retornado', async () => {
    const ordem: string[] = []
    updateReviewMock.mockImplementation(async () => {
      ordem.push('updateReview')
      return { status: 'saved', message: 'Alterações salvas.' }
    })
    redirectMock.mockImplementationOnce((destino: string) => {
      ordem.push('redirect')
      const erro = new Error(destino)
      erro.name = NEXT_REDIRECT
      throw erro
    })

    await updateReviewAndGoToList(IDLE, form({ status: 'draft' })).catch(() => {})

    // `updateReview` chama `revalidatePath` ANTES de retornar (T4), então esta
    // ordem prova que a invalidação de cache precede a navegação.
    expect(ordem).toEqual(['updateReview', 'redirect'])
  })
})

describe('falha → fica na tela, sem navegar', () => {
  it('erro de validação volta como estado, com os fieldErrors intactos', async () => {
    const erro: ReviewFormState = {
      status: 'error',
      message: 'Confira os campos destacados.',
      fieldErrors: { title: 'Título é obrigatório' },
    }
    updateReviewMock.mockResolvedValue(erro)

    const estado = await updateReviewAndGoToList(IDLE, form({ status: 'draft' }))

    expect(estado).toEqual(erro)
    // Navegar aqui levaria junto tudo o que o editor digitou.
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('40001 (conflito otimista, P-1) também não navega — o editor precisa VER o aviso e recarregar', async () => {
    updateReviewMock.mockResolvedValue({
      status: 'error',
      message:
        'Esta resenha foi alterada por outra pessoa — recarregue a página e tente novamente.',
    })

    const estado = await updateReviewAndGoToList(IDLE, form({ status: 'draft' }))

    expect(estado.status).toBe('error')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('negação de permissão também não navega', async () => {
    updateReviewMock.mockResolvedValue({
      status: 'error',
      message: 'Você não tem permissão para esta operação.',
    })

    const estado = await updateReviewAndGoToList(IDLE, form({ status: 'published' }))

    expect(estado.status).toBe('error')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('estado `idle` (nada aconteceu) não navega', async () => {
    updateReviewMock.mockResolvedValue(IDLE)

    await updateReviewAndGoToList(IDLE, form({ status: 'draft' }))

    expect(redirectMock).not.toHaveBeenCalled()
  })
})

describe('o envoltório NÃO reimplementa a decisão de publicar nem os campos-mecanismo', () => {
  it('só repassa: o MESMO FormData chega a updateReview sem ser tocado', async () => {
    updateReviewMock.mockResolvedValue({ status: 'error', message: 'x' })
    const fd = form({
      status: 'published',
      reviewId: 'rev-1',
      expectedUpdatedAt: '2026-01-01T00:00:00.123456+00:00',
    })

    await updateReviewAndGoToList(IDLE, fd)

    // MESMO objeto FormData — nada foi reescrito, filtrado ou reinterpretado
    // no caminho. Quem lê `reviewId`/`expectedUpdatedAt`/decide o schema
    // continua sendo o T4.
    expect(updateReviewMock).toHaveBeenCalledWith(IDLE, fd)
  })
})
