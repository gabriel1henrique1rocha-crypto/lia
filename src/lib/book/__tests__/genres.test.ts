import { describe, it, expect, vi, beforeEach } from 'vitest'

// Client mockado: o alvo é o CONTRATO da query (tabela, campos, ordenação e o
// tratamento de vazio/erro). O efeito da policy `genre_public_read` é do banco.
const from = vi.fn()
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({ from }),
}))

import { listGenres } from '../queries'

/** Encadeamento de `.from('genre').select(campos).order(coluna)`. */
function mockChain(
  resultado: { data: unknown; error: unknown },
  captura: { tabela?: string[]; select?: string[]; order?: string[] } = {}
) {
  return {
    select: (campos: string) => {
      captura.select?.push(campos)
      return {
        order: async (coluna: string) => {
          captura.order?.push(coluna)
          return resultado
        },
      }
    },
  }
}

beforeEach(() => {
  from.mockReset()
})

describe('listGenres', () => {
  it('lê id e nome de `genre`, ordenados por nome', async () => {
    const select: string[] = []
    const order: string[] = []
    const tabelas: string[] = []
    from.mockImplementation((tabela: string) => {
      tabelas.push(tabela)
      return mockChain({ data: [{ id: 'g1', name: 'Ensaio' }], error: null }, { select, order })
    })

    const generos = await listGenres()

    expect(tabelas).toEqual(['genre'])
    expect(select).toEqual(['id, name'])
    // Ordem estável entre visitas: um `select` que reordena sozinho é hostil a
    // quem escolhe pela posição.
    expect(order).toEqual(['name'])
    expect(generos).toEqual([{ id: 'g1', name: 'Ensaio' }])
  })

  it('`id` é o que vai ao banco — `genre_id` é NOT NULL e é UUID, não nome', async () => {
    from.mockReturnValue(
      mockChain({
        data: [{ id: '20000000-0000-4000-8000-000000000001', name: 'Romance' }],
        error: null,
      })
    )

    const [genero] = await listGenres()

    expect(genero.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('sem gênero nenhum devolve array vazio, não erro', async () => {
    from.mockReturnValue(mockChain({ data: [], error: null }))
    await expect(listGenres()).resolves.toEqual([])
  })

  it('`data: null` sem erro também vira array vazio', async () => {
    from.mockReturnValue(mockChain({ data: null, error: null }))
    await expect(listGenres()).resolves.toEqual([])
  })

  it('erro do banco propaga — a página não renderiza um select vazio em silêncio', async () => {
    from.mockReturnValue(mockChain({ data: null, error: { code: '42501', message: 'x' } }))
    await expect(listGenres()).rejects.toBeTruthy()
  })
})
