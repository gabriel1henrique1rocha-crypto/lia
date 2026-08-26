'use server'

import { redirect } from 'next/navigation'
import { createReview, type ReviewFormState } from '../actions'

/**
 * Ponte entre o `ReviewForm` (T8) e o `createReview` (T6): persiste e, dando
 * certo, leva o editor para a lista.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UM ENVOLTÓRIO, E NÃO O REDIRECT DENTRO DO T6
 *
 * `createReview` é usada também fora desta tela (é um endpoint por si só) e o seu
 * contrato é DEVOLVER `ReviewFormState` — quem chama decide o que fazer com o
 * sucesso. Enfiar um `redirect` lá dentro amarraria a action a uma rota e a
 * tornaria inutilizável por qualquer outro chamador. Aqui, a navegação é decisão
 * DA PÁGINA, que é de quem ela deve ser.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORDEM: `revalidatePath` PRIMEIRO, `redirect` DEPOIS — e por que ela sai certa
 *
 * O `createReview` chama `revalidarRotasPublicas()` ANTES de retornar (só quando
 * o status é `published` — rascunho não muda nada público). Como o `redirect`
 * abaixo só acontece DEPOIS que aquele `await` resolveu, a ordem é
 * `revalidatePath` → `return` → `redirect`, que é a exigida: invalidar o cache
 * depois de navegar chegaria tarde, e a home continuaria servindo a versão sem a
 * resenha nova.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O `redirect` NÃO É ENGOLIDO — verificado, não suposto
 *
 * `redirect()` sinaliza por EXCEÇÃO de controle (`NEXT_REDIRECT`). Ela precisa
 * subir até o runtime do Next; um `try/catch` no caminho a transformaria em
 * "erro" e a navegação simplesmente não aconteceria — falha silenciosa clássica.
 * O caminho inteiro está livre de captura:
 *
 *   1. `createReview` (T6) não tem `try/catch` — trata erro do Postgres pelo
 *      VALOR de retorno (`{ error }` do supabase-js), nunca por exceção; e, de
 *      todo modo, ela já RETORNOU quando o `redirect` é lançado aqui;
 *   2. esta função não captura nada;
 *   3. o `validarEEnviar` do `ReviewForm` faz `return action(...)`, sem
 *      `try/catch` e sem `.catch()`.
 *
 * Há teste fixando (2): com o `redirect` lançando como o Next lança, o
 * envoltório propaga em vez de devolver estado — se alguém envolver isto num
 * `try` um dia, o teste fica vermelho.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Confirmação a exibir na lista. Só o rótulo viaja; o texto vive na página. */
function confirmacaoPara(status: FormDataEntryValue | null): 'publicada' | 'rascunho' {
  return status === 'published' ? 'publicada' : 'rascunho'
}

export async function createReviewAndGoToList(
  anterior: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const estado = await createReview(anterior, formData)

  // Falhou: devolve o estado para o formulário pintar os erros NO CAMPO. Sem
  // navegar — sair da tela levaria junto o que o editor digitou.
  if (estado.status !== 'saved') return estado

  /**
   * PARA ONDE VAI O EDITOR: a lista, com confirmação.
   *
   * Não é preferência de fluxo, é o único destino seguro nesta sprint. Ficar no
   * formulário depois de criar seria uma armadilha: a rota de EDIÇÃO está
   * cortada (design §13), então o formulário só sabe CRIAR — um segundo clique
   * em "Salvar rascunho" criaria uma SEGUNDA resenha em vez de atualizar a
   * primeira, e nada na tela avisaria. A lista, além de não ter essa armadilha,
   * é a prova visível de que gravou: a resenha está lá.
   *
   * O parâmetro é lido pela lista para anunciar o desfecho com FOCO (ver
   * `CreatedNotice`) — sem ele, o redirect trocaria a tela em silêncio para
   * quem usa leitor de tela.
   */
  redirect(`/admin/resenhas?criada=${confirmacaoPara(formData.get('status'))}`)
}
