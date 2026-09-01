'use server'

import { redirect } from 'next/navigation'
import { updateReview, type ReviewFormState } from '../../actions'

/**
 * Ponte entre o `ReviewForm` (T2a, `mode="edit"`) e o `updateReview` (T4): salva
 * e, dando certo, leva o editor para a lista. MESMO ENVOLTÓRIO de
 * `nova/actions.ts` (T10) — a razão de existir, a ordem `revalidatePath` →
 * `return` → `redirect` e a garantia de que o `redirect` não é engolido são
 * IDÊNTICAS às de lá; ver o cabeçalho daquele arquivo para o raciocínio
 * completo, não repetido aqui.
 *
 * A ÚNICA diferença é o DESTINO: `criada=` vs `editada=`. Não é o mesmo
 * parâmetro reaproveitado — `EditorReviewsPage` (T10) precisa de mensagens de
 * confirmação com texto DIFERENTE ("Resenha publicada" faz sentido para quem
 * acabou de criar; para quem editou uma resenha que já estava publicada há
 * meses, "Alterações salvas" é o que de fato aconteceu). `editada=rascunho` /
 * `editada=publicada` moram no MESMO mapa de confirmações da lista, ao lado de
 * `criada=`, cada um com o próprio texto.
 */

/** Mesma lógica de `confirmacaoPara` em `nova/actions.ts` — o BOTÃO clicado, não o resultado do RPC. */
function confirmacaoPara(status: FormDataEntryValue | null): 'rascunho' | 'publicada' {
  return status === 'published' ? 'publicada' : 'rascunho'
}

export async function updateReviewAndGoToList(
  anterior: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const estado = await updateReview(anterior, formData)

  // Falhou: devolve o estado para o formulário pintar os erros NO CAMPO (ou o
  // aviso de conflito otimista, 40001) — sem navegar, o que levaria junto o
  // que o editor digitou.
  if (estado.status !== 'saved') return estado

  redirect(`/admin/resenhas?editada=${confirmacaoPara(formData.get('status'))}`)
}
