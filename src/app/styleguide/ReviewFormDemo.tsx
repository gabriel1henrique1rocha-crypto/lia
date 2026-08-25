'use client'

import { ReviewForm } from '@/app/admin/(protected)/resenhas/ReviewForm'
import type { ReviewFormState } from '@/app/admin/(protected)/resenhas/actions'

/**
 * O `ReviewForm` (T8) montado no guia de estilos, para a auditoria em navegador
 * REAL — axe e teclado — existir antes da rota (T10).
 *
 * A action aqui é de DEMONSTRAÇÃO: devolve o mesmo `ReviewFormState` que a de
 * verdade, sem sessão, sem banco e sem `cookies()`. Não é um atalho em volta do
 * gate: o `createReview` real é protegido por `requireEditor()` e pela RLS, e
 * nada disto o alcança — o guia exercita a CASCA, que é justamente o objeto
 * desta task. A validação que roda aqui é a do cliente, com o `reviewInputSchema`
 * de verdade (T5), então os estados de erro auditados pelo axe são os reais.
 *
 * O mesmo motivo pelo qual o `ReviewForm` recebe a action por prop: um
 * componente que importasse `createReview` direto arrastaria `server-only` e
 * `next/cache` para toda tela que quisesse renderizá-lo.
 */

const GENEROS_DEMO = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Romance' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Romantismo' },
  { id: '20000000-0000-4000-8000-000000000003', name: 'Ensaio' },
]

async function acaoDemonstrativa(
  _anterior: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  return {
    status: 'saved',
    message:
      formData.get('status') === 'published'
        ? 'Demonstração: a resenha seria publicada.'
        : 'Demonstração: o rascunho seria salvo.',
  }
}

export function ReviewFormDemo() {
  return <ReviewForm action={acaoDemonstrativa} genres={GENEROS_DEMO} signedBy="Ana Ribeiro" />
}
