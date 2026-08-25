import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ReviewForm, type GenreOption } from '../ReviewForm'
import type { ReviewFormState } from '../actions'

/**
 * O formulário de resenha (T8) sob a lente da acessibilidade.
 *
 * O `ReviewFormState` é importado com `import type` de propósito: `actions.ts`
 * é `'use server'` e arrasta `next/cache`/`server-only`. Tipo é apagado na
 * compilação, então nada de servidor entra no jsdom — e a action de verdade não
 * precisa ser mockada, porque o componente a RECEBE por prop.
 *
 * O que estes testes fixam não é aparência: é que cada campo tem nome
 * acessível, que erro cai no campo que o causou, que o foco tem destino em toda
 * transição (submissão falha, item repetível removido) e que os dois botões
 * mandam `status` como DADO. O axe cobre a estrutura em navegador real
 * (`tests/review-form-a11y.spec.ts`); comportamento de foco ele não vê.
 */

const GENERO = '11111111-1111-4111-8111-111111111111'
const GENEROS: GenreOption[] = [
  { id: GENERO, name: 'Romance' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Ensaio' },
]

const SALVO: ReviewFormState = { status: 'saved', message: 'Resenha salva.' }

function montar(resposta: ReviewFormState = SALVO) {
  const recebidas: FormData[] = []
  const action = vi.fn(async (_anterior: ReviewFormState, formData: FormData) => {
    recebidas.push(formData)
    return resposta
  })
  const utils = render(<ReviewForm action={action} genres={GENEROS} signedBy="Ana Ribeiro" />)
  return { ...utils, action, recebidas }
}

/* ── atalhos de consulta ─────────────────────────────────────────────────── */

const texto = (nome: RegExp | string) => screen.getByRole('textbox', { name: nome })
const numero = (nome: RegExp | string) => screen.getByRole('spinbutton', { name: nome })
const combo = (nome: RegExp | string) => screen.getByRole('combobox', { name: nome })
const botao = (nome: RegExp | string) => screen.getByRole('button', { name: nome })
const regiaoStatus = () => screen.getByRole('status')

function preencher(elemento: HTMLElement, valor: string) {
  fireEvent.change(elemento, { target: { value: valor } })
}

/** Ficha mínima válida — o teste quebra só o que quer ver falhar. */
function preencherObrigatorios() {
  preencher(texto(/^Título$/), 'Dom Casmurro')
  preencher(texto(/^Autor$/), 'Machado de Assis')
  preencher(combo(/^Gênero$/), GENERO)
}

/** Mensagem de erro que o `aria-describedby` do campo aponta. */
function erroDoCampo(controle: HTMLElement): string {
  const ids = (controle.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
}

/**
 * Espera o formulário sair do estado ocupado.
 *
 * `useActionState` desliga `isPending` num commit POSTERIOR ao que já pintou o
 * resultado — então existe um instante em que a mensagem de erro está na tela e
 * os botões ainda estão `aria-disabled`. No navegador é imperceptível; num teste
 * o segundo clique cai exatamente nessa janela e o `Button` o engole (é o que
 * `aria-disabled` promete fazer). Esperar aqui testa o componente real em vez de
 * uma corrida.
 */
async function esperarOcioso() {
  await waitFor(() => expect(botao('Salvar rascunho')).not.toHaveAttribute('aria-disabled'))
}

beforeEach(() => {
  vi.clearAllMocks()
})

/* ── 1. Estrutura e rótulos ──────────────────────────────────────────────── */

describe('estrutura: dois fieldsets e todo campo com label explícito', () => {
  it('agrupa em "Dados do livro" e "A resenha"', () => {
    const { container } = montar()
    const legendasDeTopo = [...container.querySelectorAll('form > fieldset > legend')].map((l) =>
      l.textContent?.trim()
    )
    expect(legendasDeTopo).toEqual(['Dados do livro', 'A resenha'])
  })

  it('TODO controle tem nome acessível vindo de um <label for> — nenhum placeholder-como-rótulo', () => {
    const { container } = montar()
    const controles = [...container.querySelectorAll<HTMLElement>('input, textarea, select')]

    expect(controles.length).toBeGreaterThan(0)
    for (const controle of controles) {
      expect(controle.id, 'controle sem id não pode ser alvo de htmlFor').toBeTruthy()
      // O rótulo é um <label for=id> de verdade, não aria-label nem placeholder.
      expect(
        container.querySelector(`label[for="${controle.id}"]`),
        `sem <label for> para #${controle.id}`
      ).not.toBeNull()
      expect(controle).toHaveAccessibleName()
      expect(controle).not.toHaveAttribute('aria-label')
    }
  })

  it('tem os campos do livro e os da resenha', () => {
    montar()
    // Livro
    texto(/^Título$/)
    texto(/^Autor$/)
    texto(/^Editora/)
    numero(/^Ano/)
    texto(/^ISBN/)
    combo(/^Gênero$/)
    texto(/^Cidade de publicação/)
    texto(/^URL da capa/)
    // Resenha
    texto(/^Título da resenha/)
    texto(/^Corpo da resenha/)
    texto(/^Citação em destaque/)
    texto(/^Tags/)
    texto(/^Palavras-chave/)
    expect(botao(/^Adicionar leitura$/)).toBeInTheDocument()
  })

  it('obrigatórios trazem required E aria-required, e o marcador visual não é só cor', () => {
    const { container } = montar()
    for (const controle of [texto(/^Título$/), texto(/^Autor$/), combo(/^Gênero$/)]) {
      expect(controle).toBeRequired()
      expect(controle).toHaveAttribute('aria-required', 'true')
      // O indicador é um glifo (*) — forma, não cor — e fica fora do nome
      // acessível (aria-hidden), porque quem lê a tela recebe a obrigatoriedade
      // pelo `required`, não pelo asterisco.
      const rotulo = container.querySelector(`label[for="${controle.id}"]`)
      expect(rotulo?.querySelector('[aria-hidden="true"]')?.textContent).toBe('*')
    }
    expect(screen.getByText(/são obrigatórios/i)).toBeInTheDocument()
  })

  it('NÃO coleta os campos que o RPC descarta, nem o nome de quem assina', () => {
    const { container } = montar()
    const nomes = [...container.querySelectorAll<HTMLElement>('[name]')].map((c) =>
      c.getAttribute('name')
    )
    for (const ausente of ['pages', 'originalLanguage', 'translator', 'translatedFrom']) {
      expect(nomes, `${ausente} não tem parâmetro no create_review_with_book`).not.toContain(
        ausente
      )
    }
    expect(nomes).not.toContain('reviewerName')
    // Quem assina é exibido (DD-6: congelado de editor.name), não perguntado.
    expect(screen.getByText('Ana Ribeiro')).toBeInTheDocument()
  })
})

/* ── 2. Região de status (aria-live) ─────────────────────────────────────── */

describe('região de status: polida, presente desde o 1º render', () => {
  it('existe e está VAZIA no primeiro render (WCAG 4.1.3)', () => {
    montar()
    const status = regiaoStatus()
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).not.toHaveAttribute('aria-live', 'assertive')
    expect(status.textContent).toBe('')
  })

  it('anuncia o SUCESSO da submissão', async () => {
    montar(SALVO)
    preencherObrigatorios()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(regiaoStatus()).toHaveTextContent('Resenha salva.'))
  })

  it('anuncia a FALHA da submissão — na mesma região, também polida', async () => {
    montar()
    fireEvent.click(botao('Salvar rascunho')) // sem preencher nada
    await waitFor(() => expect(regiaoStatus()).toHaveTextContent('Confira os campos destacados.'))
    expect(regiaoStatus()).toHaveAttribute('aria-live', 'polite')
  })

  it('anuncia também a falha VINDA DA ACTION (erro de formulário inteiro)', async () => {
    montar({ status: 'error', message: 'Você não tem permissão para esta operação.' })
    preencherObrigatorios()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(regiaoStatus()).toHaveTextContent(/não tem permissão/i))
  })
})

/* ── 3. Validação: cada erro no seu campo ────────────────────────────────── */

describe('validação do cliente: o erro aparece NO campo que o causou', () => {
  it('obrigatórios vazios → erro em título, autor e gênero (e em mais nenhum)', async () => {
    montar()
    fireEvent.click(botao('Salvar rascunho'))

    await waitFor(() => expect(texto(/^Título$/)).toHaveAttribute('aria-invalid', 'true'))
    expect(erroDoCampo(texto(/^Título$/))).toMatch(/obrigatório/i)
    expect(erroDoCampo(texto(/^Autor$/))).toMatch(/obrigatório/i)
    expect(erroDoCampo(combo(/^Gênero$/))).toMatch(/gênero/i)

    // Campos sadios não ficam marcados por tabela.
    expect(texto(/^Editora/)).not.toHaveAttribute('aria-invalid')
    expect(texto(/^Corpo da resenha/)).not.toHaveAttribute('aria-invalid')
  })

  it('ISBN com checksum inválido → erro no ISBN', async () => {
    montar()
    preencherObrigatorios()
    preencher(texto(/^ISBN/), '1234567890')
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(erroDoCampo(texto(/^ISBN/))).toMatch(/ISBN inválido/i))
  })

  it('capa com javascript: → erro na URL da capa (A-4), não mensagem solta', async () => {
    montar()
    preencherObrigatorios()
    preencher(texto(/^URL da capa/), 'javascript:alert(1)')
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(erroDoCampo(texto(/^URL da capa/))).toMatch(/http/i))
  })

  it('ano futuro → erro no Ano', async () => {
    montar()
    preencherObrigatorios()
    preencher(numero(/^Ano/), String(new Date().getFullYear() + 1))
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(erroDoCampo(numero(/^Ano/))).toMatch(/futuro/i))
  })

  it('PUBLICAR sem corpo → erro NO corpo; o mesmo payload salva como rascunho', async () => {
    const { action } = montar()
    preencherObrigatorios()

    fireEvent.click(botao('Publicar'))
    await waitFor(() =>
      expect(erroDoCampo(texto(/^Corpo da resenha/))).toMatch(/obrigatório para publicar/i)
    )
    expect(action, 'nada deve chegar à action com payload reprovado').not.toHaveBeenCalled()

    await esperarOcioso()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
  })

  it('SUBMISSÃO REPROVADA NÃO APAGA A DIGITAÇÃO — o React 19 reseta o form ao fim da action', async () => {
    const { action } = montar()
    preencherObrigatorios()
    preencher(texto(/^Editora/), 'Editora Record')

    // Publicar sem corpo reprova; o reset do React 19 rodaria aqui.
    fireEvent.click(botao('Publicar'))
    await waitFor(() =>
      expect(erroDoCampo(texto(/^Corpo da resenha/))).toMatch(/obrigatório para publicar/i)
    )

    expect((texto(/^Título$/) as HTMLInputElement).value).toBe('Dom Casmurro')
    expect((texto(/^Autor$/) as HTMLInputElement).value).toBe('Machado de Assis')
    expect((texto(/^Editora/) as HTMLInputElement).value).toBe('Editora Record')
    expect((combo(/^Gênero$/) as HTMLSelectElement).value).toBe(GENERO)

    // E a segunda submissão passa SEM redigitar nada.
    await esperarOcioso()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
  })

  it('erro DEVOLVIDO PELA ACTION cai no campo correspondente, não como mensagem genérica', async () => {
    montar({
      status: 'error',
      message: 'Já existe uma resenha com um endereço muito parecido.',
      fieldErrors: { reviewTitle: 'Ajuste o título e tente novamente.' },
    })
    preencherObrigatorios()
    fireEvent.click(botao('Salvar rascunho'))

    await waitFor(() =>
      expect(erroDoCampo(texto(/^Título da resenha/))).toMatch(/Ajuste o título/i)
    )
    expect(texto(/^Título da resenha/)).toHaveAttribute('aria-invalid', 'true')
  })
})

/* ── 4. Foco na submissão que falha ──────────────────────────────────────── */

describe('foco após submissão com erro', () => {
  it('vai para o PRIMEIRO campo com erro em ordem de DOM', async () => {
    montar()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(texto(/^Título$/)).toHaveFocus())
  })

  it('quando o título está certo, aterrissa no próximo campo com erro', async () => {
    montar()
    preencher(texto(/^Título$/), 'Dom Casmurro')
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(texto(/^Autor$/)).toHaveFocus())
  })

  it('erro sem campo correspondente → foco na região de status, nunca órfão', async () => {
    montar({ status: 'error', message: 'Você não tem permissão para esta operação.' })
    preencherObrigatorios()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(regiaoStatus()).toHaveFocus())
  })

  it('foco vai para o campo do erro DEVOLVIDO PELA ACTION', async () => {
    montar({
      status: 'error',
      message: 'Confira os campos destacados.',
      fieldErrors: { coverUrl: 'URL de capa inválida' },
    })
    preencherObrigatorios()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(texto(/^URL da capa/)).toHaveFocus())
  })
})

/* ── 5. Campos repetíveis (further_reading) ──────────────────────────────── */

describe('leituras adicionais: adicionar, remover e o foco em cada transição', () => {
  it('começa sem nenhum item', () => {
    montar()
    expect(screen.queryByRole('textbox', { name: /^Título do link/ })).toBeNull()
  })

  it('adicionar cria o par de campos e leva o foco ao primeiro deles', async () => {
    montar()
    fireEvent.click(botao(/^Adicionar leitura$/))

    await waitFor(() => expect(texto(/^Título do link 1$/)).toBeInTheDocument())
    expect(texto(/^Endereço do link 1$/)).toBeInTheDocument()
    expect(texto(/^Título do link 1$/)).toHaveFocus()
  })

  it('cada item tem rótulos próprios e numerados — nomes acessíveis únicos', () => {
    montar()
    fireEvent.click(botao(/^Adicionar leitura$/))
    fireEvent.click(botao(/^Adicionar leitura$/))

    expect(texto(/^Título do link 1$/)).toBeInTheDocument()
    expect(texto(/^Título do link 2$/)).toBeInTheDocument()
    expect(botao(/^Remover leitura 1$/)).toBeInTheDocument()
    expect(botao(/^Remover leitura 2$/)).toBeInTheDocument()
  })

  it('REMOVER O ÚLTIMO ITEM RESTANTE → foco em "Adicionar leitura" (nunca órfão)', async () => {
    montar()
    fireEvent.click(botao(/^Adicionar leitura$/))
    fireEvent.click(botao(/^Remover leitura 1$/))

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: /^Título do link/ })).toBeNull()
    )
    expect(botao(/^Adicionar leitura$/)).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('remover o item de MAIOR índice → foco no "Remover" que passou a ser o último', async () => {
    montar()
    fireEvent.click(botao(/^Adicionar leitura$/))
    fireEvent.click(botao(/^Adicionar leitura$/))
    fireEvent.click(botao(/^Remover leitura 2$/))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Remover leitura 2$/ })).toBeNull()
    )
    expect(botao(/^Remover leitura 1$/)).toHaveFocus()
  })

  it('remover um item DO MEIO → foco no "Remover" que ocupou a posição', async () => {
    montar()
    for (let i = 0; i < 3; i++) fireEvent.click(botao(/^Adicionar leitura$/))
    preencher(texto(/^Título do link 3$/), 'terceiro')

    fireEvent.click(botao(/^Remover leitura 2$/))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Remover leitura 3$/ })).toBeNull()
    )
    // O 3º virou o 2º: o foco fica na MESMA posição da lista, não salta.
    expect(botao(/^Remover leitura 2$/)).toHaveFocus()
    expect((texto(/^Título do link 2$/) as HTMLInputElement).value).toBe('terceiro')
  })

  it('item pela metade (rótulo sem URL) → erro NO campo de URL daquele item', async () => {
    montar()
    preencherObrigatorios()
    fireEvent.click(botao(/^Adicionar leitura$/))
    preencher(texto(/^Título do link 1$/), 'Ensaio sobre Machado')
    fireEvent.click(botao('Salvar rascunho'))

    await waitFor(() => expect(erroDoCampo(texto(/^Endereço do link 1$/))).toBeTruthy())
    expect(texto(/^Endereço do link 1$/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('item EM BRANCO não reprova a submissão — é descartado', async () => {
    const { action, recebidas } = montar()
    preencherObrigatorios()
    fireEvent.click(botao(/^Adicionar leitura$/))
    fireEvent.click(botao('Salvar rascunho'))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(recebidas[0].get('furtherReading.0.label')).toBe('')
  })

  it('item preenchido chega à action com nome de campo indexado', async () => {
    const { action, recebidas } = montar()
    preencherObrigatorios()
    fireEvent.click(botao(/^Adicionar leitura$/))
    preencher(texto(/^Título do link 1$/), 'Ensaio')
    preencher(texto(/^Endereço do link 1$/), 'https://exemplo.org/ensaio')
    fireEvent.click(botao('Salvar rascunho'))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(recebidas[0].get('furtherReading.0.label')).toBe('Ensaio')
    expect(recebidas[0].get('furtherReading.0.url')).toBe('https://exemplo.org/ensaio')
  })
})

/* ── 6. Os dois botões enviam `status` como DADO ─────────────────────────── */

describe('os dois botões mandam status; quem decide publicação é o servidor', () => {
  it('"Salvar rascunho" envia status=draft', async () => {
    const { action, recebidas } = montar()
    preencherObrigatorios()
    fireEvent.click(botao('Salvar rascunho'))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(recebidas[0].get('status')).toBe('draft')
  })

  it('"Publicar" envia status=published — mesmo formulário, mesmo caminho', async () => {
    const { action, recebidas } = montar()
    preencherObrigatorios()
    preencher(texto(/^Corpo da resenha/), 'Corpo real da resenha.')
    fireEvent.click(botao('Publicar'))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(recebidas[0].get('status')).toBe('published')
  })

  it('`status` existe SÓ nos dois submits — nada mais o carrega', () => {
    const { container } = montar()
    const portadores = [...container.querySelectorAll('[name="status"]')]
    expect(portadores).toHaveLength(2)
    for (const elemento of portadores) {
      expect(elemento.tagName).toBe('BUTTON')
      expect(elemento).toHaveAttribute('type', 'submit')
    }
    // Nenhum input escondido decidindo por baixo do pano.
    expect(container.querySelector('input[type="hidden"]')).toBeNull()
  })

  it('os botões são <button>, não div clicável', () => {
    const { container } = montar()
    const acoes = container.querySelector('.lia-review-form__actions')!
    expect(within(acoes as HTMLElement).getAllByRole('button')).toHaveLength(2)
    expect(acoes.querySelector('div[onclick], span[role="button"]')).toBeNull()
  })
})
