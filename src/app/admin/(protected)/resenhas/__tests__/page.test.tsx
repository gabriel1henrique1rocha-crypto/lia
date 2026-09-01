import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { EditorReviewListItem } from '@/lib/review/adminQueries'

// A leitura é do T7 e já tem teste próprio (contrato do select + o `.eq` que
// compensa o confounder de `review_public_read`). Aqui o alvo é o WIRING: o que
// a página faz com o que a leitura devolve.
const listEditorReviewsMock = vi.fn()
vi.mock('@/lib/review/adminQueries', () => ({
  listEditorReviews: () => listEditorReviewsMock(),
}))

import EditorReviewsPage, { metadata } from '../page'

const LINHA: EditorReviewListItem = {
  id: 'r1',
  title: 'A biblioteca como labirinto',
  slug: 'a-biblioteca-como-labirinto',
  status: 'draft',
  published_at: null,
  updated_at: '2026-08-24T18:30:00Z',
  book: { title: 'O Nome da Rosa' },
}

/** Server Component assíncrono: resolve e renderiza o elemento devolvido. */
async function renderizar(params: Record<string, string> = {}) {
  return render(await EditorReviewsPage({ searchParams: Promise.resolve(params) }))
}

beforeEach(() => {
  listEditorReviewsMock.mockReset()
  cleanup()
})

describe('/admin/resenhas', () => {
  it('renderiza as resenhas do editor', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar()

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'A biblioteca como labirinto' })).toBeVisible()
    expect(screen.getByText('O Nome da Rosa')).toBeInTheDocument()
  })

  it('tem UM <h1> e ele diz de que página se trata', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    const { container } = await renderizar()

    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Suas resenhas')
  })

  it('oferece o caminho para criar', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar()

    expect(screen.getByRole('link', { name: 'Nova resenha' })).toHaveAttribute(
      'href',
      '/admin/resenhas/nova'
    )
  })

  it('editor sem resenha nenhuma vê o convite, não uma tabela vazia', async () => {
    listEditorReviewsMock.mockResolvedValue([])
    await renderizar()

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('link', { name: /Escrever a primeira resenha/ })).toBeInTheDocument()
  })

  it('não é indexável', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('cada linha aponta para a rota de edição (T5)', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar()

    expect(
      screen.getByRole('link', { name: 'Editar resenha: A biblioteca como labirinto' })
    ).toHaveAttribute('href', '/admin/resenhas/r1/editar')
  })
})

describe('confirmação de criação (volta do redirect)', () => {
  it('sem o parâmetro, não há mensagem nenhuma', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('?criada=rascunho anuncia rascunho salvo, e o anúncio recebe o FOCO', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar({ criada: 'rascunho' })

    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent(/Rascunho salvo/)
    // A mensagem chega junto com o documento: live region não anuncia o que já
    // estava no HTML, então o foco é o que faz o leitor de tela lê-la.
    expect(aviso).toHaveFocus()
  })

  it('?criada=publicada anuncia publicação', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar({ criada: 'publicada' })
    expect(screen.getByRole('status')).toHaveTextContent(/publicada/i)
  })

  it('valor arbitrário na URL NÃO vira texto na tela', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar({ criada: '<script>alert(1)</script>' })

    // O parâmetro só SELECIONA uma mensagem fixa; fora do mapa, nada aparece.
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/alert\(1\)/)).toBeNull()
  })
})

describe('confirmação de EDIÇÃO (volta do redirect de updateReviewAndGoToList, T5)', () => {
  it('?editada=rascunho anuncia alterações salvas como rascunho, com FOCO no aviso', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar({ editada: 'rascunho' })

    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent(/Alterações salvas como rascunho/)
    expect(aviso).toHaveFocus()
  })

  it('?editada=publicada anuncia alterações salvas — texto DIFERENTE de "Resenha publicada" (E-9)', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar({ editada: 'publicada' })

    // Não é `CONFIRMACOES.publicada`: quem editou uma resenha publicada há
    // meses não "acabou de publicar" — o texto de `criada=publicada` mentiria
    // sobre o que de fato aconteceu.
    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent(/Alterações salvas/)
    expect(aviso).not.toHaveTextContent(/^Resenha publicada/)
  })

  it('?criada= tem precedência se, por algum motivo, os dois vierem juntos', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar({ criada: 'rascunho', editada: 'publicada' })

    expect(screen.getByRole('status')).toHaveTextContent(/Rascunho salvo/)
  })

  it('valor arbitrário em ?editada= NÃO vira texto na tela', async () => {
    listEditorReviewsMock.mockResolvedValue([LINHA])
    await renderizar({ editada: '<script>alert(1)</script>' })

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/alert\(1\)/)).toBeNull()
  })
})
