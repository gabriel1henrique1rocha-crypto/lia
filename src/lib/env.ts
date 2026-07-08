import { z } from 'zod'

// Env do caminho PÚBLICO. Contém EXCLUSIVAMENTE variáveis públicas (prefixo
// NEXT_PUBLIC_) — nenhuma menção à service_role (SEC-02). O schema público não
// pode exigir nem CONHECER a chave secreta: a separação é estrutural, não por
// convenção. A env isolada do admin vive em env.admin.ts (server-only, lazy).
//
// Hardening anti-troca de chave (design §1.5, F-3): se alguém colar a SECRET key
// na variável publishable, o boot FALHA em vez de vazar a chave secreta ao
// browser. As chaves novas do Supabase têm prefixo (`sb_publishable_` / `sb_secret_`).
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .refine((v) => !v.startsWith('sb_secret_'), {
      message:
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY parece ser uma SECRET key (prefixo sb_secret_). ' +
        'A variável pública nunca deve conter a service_role — isso vazaria a chave ao browser (SEC-02/F-3).',
    }),
})

// Parse eager no import (padrão do projeto). A lição de testes (STATE.md) vale:
// qualquer teste que toque a cadeia que importa este módulo usa import DINÂMICO
// no setup, para não detonar a validação no load.
export const env = schema.parse(process.env)
