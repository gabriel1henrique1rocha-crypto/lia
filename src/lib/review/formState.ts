import type { ReviewFormState } from '@/app/admin/(protected)/resenhas/actions'

/**
 * Estado neutro do formulário de resenha: nada submetido ainda, nada a anunciar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO MORA EM `actions.ts`, ONDE NASCEU — um DEFEITO LATENTE do T6
 *
 * `actions.ts` tem `'use server'`, e um módulo assim só pode EXPORTAR funções
 * assíncronas: cada export vira um endpoint com id próprio. `IDLE_STATE` saía de
 * lá como objeto — inválido desde o primeiro dia, mas SILENCIOSO, porque nada no
 * grafo do build importava valores daquele módulo (o `ReviewForm` declara o seu
 * próprio estado inicial e importa só o TIPO, que é apagado na compilação).
 *
 * A T10 acendeu o alarme: `nova/actions.ts` importa `createReview`, o Next passa
 * a validar os exports do módulo e o build para com
 * `"use server" file can only export async functions, found object`.
 *
 * O TIPO continua declarado em `actions.ts` — declaração de tipo some na
 * compilação e não vira endpoint —, então o `import type` do T8 segue intacto.
 * Só o VALOR desceu para cá. (Reexportar o tipo do action também não serve: o
 * registrador de actions do Next lê o statement de reexport e tenta criar um
 * endpoint para ele.)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const IDLE_STATE: ReviewFormState = { status: 'idle', message: '' }
