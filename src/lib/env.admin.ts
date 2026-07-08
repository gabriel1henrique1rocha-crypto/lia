import 'server-only'
import { z } from 'zod'

// Env do client ADMIN (service_role). ISOLADA do env.ts público e SERVER-ONLY:
// `import 'server-only'` quebra o build se este módulo entrar em bundle de
// cliente (SEC-03/C-3). A chave vem de variável SEM prefixo NEXT_PUBLIC — nunca
// inlinada no browser por construção do Next (SEC-04).
//
// Validação LAZY (design §1.5): o parse roda dentro de getAdminEnv(), NÃO no
// import do módulo. Assim:
//   - ambientes sem a var (CI, dev local, Production até o gate SEC-17) NÃO
//     quebram no boot — só quebram se algum código tentar USAR o admin;
//   - chave ausente → erro EXPLÍCITO e nomeado no ponto de uso, NUNCA degradação
//     silenciosa para anon/bypass (SEC-04 — o fallback `??` foi extinto).
//
// Hardening anti-troca de chave (F-3): se colarem a PUBLISHABLE key aqui, o
// admin seria degradado a anon silenciosamente — rejeitamos o prefixo.
const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .refine((v) => !v.startsWith('sb_publishable_'), {
      message:
        'SUPABASE_SERVICE_ROLE_KEY parece ser uma PUBLISHABLE key (prefixo sb_publishable_). ' +
        'O client admin exige a service_role real — uma publishable degradaria o admin a anon (SEC-04/F-3).',
    }),
})

export type AdminEnv = z.infer<typeof schema>

/**
 * Resolve e valida a env do admin no PONTO DE USO (lazy). Lança erro explícito e
 * nomeado quando a `SUPABASE_SERVICE_ROLE_KEY` está ausente ou malformada —
 * jamais retorna uma configuração degradada (SEC-04). Chamado por
 * `createAdminClient()`; nunca no topo de módulo.
 */
export function getAdminEnv(): AdminEnv {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      'Client admin INDISPONÍVEL: SUPABASE_SERVICE_ROLE_KEY ausente ou inválida. ' +
        'O caminho admin (service_role) exige a chave server-only; NÃO há fallback para anon (SEC-04, C-2). ' +
        `Detalhe: ${result.error.issues.map((i) => i.message).join('; ')}`
    )
  }
  return result.data
}
