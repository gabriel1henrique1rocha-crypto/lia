import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ReviewForm, type GenreOption, type ReviewFormProps } from '../ReviewForm'
import type { ReviewFormState } from '../actions'
import type { DisabilityOption } from '@/lib/review/adminQueries'

/**
 * D-12 (DIS-05) — grupo "Deficiência(s) representada(s)" no formulário do admin.
 *
 * O que se fixa: o grupo é um fieldset com legend (nome do grupo para o leitor
 * de tela), cada checkbox tem <label for>, o marcador `disabilityIdsSent` viaja
 * sempre que o grupo existe (senão "nenhuma marcada" e "grupo ausente" seriam
 * indistinguíveis) e nenhum vínculo que o usuário não enxerga é apagado.
 */

const GENERO = '11111111-1111-4111-8111-111111111111'
const GENEROS: GenreOption[] = [{ id: GENERO, name: 'Romance' }]

const FISICA = 'a1111111-1111-4111-8111-111111111111'
const TEA = 'a2222222-2222-4222-8222-222222222222'
const INATIVO = 'a3333333-3333-4333-8333-333333333333'
const OCULTO = 'a4444444-4444-4444-8444-444444444444'

const OPCOES: DisabilityOption[] = [
  { id: FISICA, name: 'Deficiência física', active: true },
  { id: TEA, name: 'Transtorno do Espectro Autista (TEA)', active: true },
  { id: INATIVO, name: 'Surdocegueira', active: false },
]

const SALVO: ReviewFormState = { status: 'saved', message: 'Resenha salva.' }

function montar(props: Partial<ReviewFormProps> = {}) {
  const recebidas: FormData[] = []
  const action = vi.fn(async (_anterior: ReviewFormState, formData: FormData) => {
    recebidas.push(formData)
    return SALVO
  })
  const utils = render(
    <ReviewForm
      mode="create"
      action={action}
      genres={GENEROS}
      disabilityOptions={OPCOES}
      {...props}
    />
  )
  return { ...utils, action, recebidas }
}

function preencherObrigatorios() {
  fireEvent.change(screen.getByRole('textbox', { name: /^Título$/ }), {
    target: { value: 'Dom Casmurro' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /^Autor$/ }), {
    target: { value: 'Machado de Assis' },
  })
  fireEvent.change(screen.getByRole('combobox', { name: /^Gênero$/ }), {
    target: { value: GENERO },
  })
}

const grupo = () => screen.getByRole('group', { name: 'Deficiência(s) representada(s)' })

describe('estrutura do grupo', () => {
  it('é um fieldset nomeado pela legend, com um checkbox rotulado por termo', () => {
    montar()
    const checks = within(grupo()).getAllByRole('checkbox')
    expect(checks).toHaveLength(3)
    expect(
      within(grupo()).getByRole('checkbox', { name: 'Deficiência física' })
    ).toBeInTheDocument()
    // Desativado continua visível para quem o enxerga, e se identifica como tal.
    expect(
      within(grupo()).getByRole('checkbox', { name: 'Surdocegueira (desativado)' })
    ).toBeInTheDocument()
  })

  it('todo checkbox tem <label for> — mesma regra dos demais campos', () => {
    const { container } = montar()
    for (const check of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      expect(check.id).toBeTruthy()
      expect(container.querySelector(`label[for="${check.id}"]`)).not.toBeNull()
    }
  })

  it('sem `disabilityOptions` o grupo e o marcador NÃO existem (servidor não mexe nos vínculos)', () => {
    const { container } = montar({ disabilityOptions: undefined })
    expect(screen.queryByRole('group', { name: /Deficiência/ })).toBeNull()
    expect(container.querySelector('input[name="disabilityIdsSent"]')).toBeNull()
  })

  it('lista vazia de termos: grupo presente com aviso, sem checkboxes', () => {
    montar({ disabilityOptions: [] })
    expect(within(grupo()).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(grupo()).getByText('Nenhuma deficiência cadastrada ainda.')).toBeInTheDocument()
  })
})

describe('o que viaja no FormData', () => {
  it('marcar dois termos envia os dois ids + o marcador', async () => {
    const { recebidas } = montar()
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Deficiência física' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /TEA/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(recebidas).toHaveLength(1))
    expect(recebidas[0].get('disabilityIdsSent')).toBe('1')
    expect(recebidas[0].getAll('disabilityIds').sort()).toEqual([FISICA, TEA].sort())
  })

  it('nenhum marcado: marcador presente e zero ids (= limpar, não "não mexer")', async () => {
    const { recebidas } = montar()
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(recebidas).toHaveLength(1))
    expect(recebidas[0].get('disabilityIdsSent')).toBe('1')
    expect(recebidas[0].getAll('disabilityIds')).toEqual([])
  })

  it('desmarcar volta a não enviar o id', async () => {
    const { recebidas } = montar()
    preencherObrigatorios()
    const fisica = screen.getByRole('checkbox', { name: 'Deficiência física' })
    fireEvent.click(fisica)
    fireEvent.click(fisica)
    expect(fisica).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(recebidas).toHaveLength(1))
    expect(recebidas[0].getAll('disabilityIds')).toEqual([])
  })
})

describe("mode: 'edit'", () => {
  function montarEdit(defaultDisabilityIds: string[]) {
    return montar({
      mode: 'edit',
      reviewId: 'rev-1',
      expectedUpdatedAt: '2026-09-19T12:00:00.123456+00:00',
      isPublished: true,
      defaultValues: { title: 'Dom Casmurro', author: 'Machado de Assis', genreId: GENERO },
      defaultDisabilityIds,
    })
  }

  it('vínculos atuais chegam MARCADOS', () => {
    montarEdit([TEA, INATIVO])
    expect(screen.getByRole('checkbox', { name: /TEA/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Surdocegueira (desativado)' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Deficiência física' })).not.toBeChecked()
  })

  it('salvar sem tocar reenvia exatamente o conjunto atual', async () => {
    const { recebidas } = montarEdit([TEA])
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(recebidas).toHaveLength(1))
    expect(recebidas[0].getAll('disabilityIds')).toEqual([TEA])
  })

  it('vínculo que o usuário NÃO enxerga (termo oculto a não-admin) viaja como hidden', async () => {
    const { container, recebidas } = montarEdit([TEA, OCULTO])
    const oculto = container.querySelector<HTMLInputElement>(
      `input[type="hidden"][name="disabilityIds"][value="${OCULTO}"]`
    )
    expect(oculto).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(recebidas).toHaveLength(1))
    expect(recebidas[0].getAll('disabilityIds').sort()).toEqual([TEA, OCULTO].sort())
  })
})
