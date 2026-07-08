import { z } from 'zod'

// Env do caminho PÚBLICO.
//
// Hardening anti-troca de chave (design §1.5, F-3): se alguém colar a SECRET key
// na variável publishable, o boot FALHA em vez de vazar a chave secreta ao
// browser. As chaves novas do Supabase têm prefixo (`sb_publishable_` / `sb_secret_`).
//
// NOTA DE SEQUÊNCIA (T2→T3): o campo SUPABASE_SERVICE_ROLE_KEY abaixo é
// TRANSITÓRIO — só continua aqui porque o server.ts legado (fallback `??`) ainda
// o consome e será REMOVIDO na T3, no mesmo commit em que este campo sai do
// schema (fechando SEC-02: o schema público deixa de conhecer a service_role).
// A env isolada e definitiva do admin já vive em env.admin.ts (server-only, lazy).
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
  // TRANSITÓRIO — sai na T3 junto com server.ts (ver nota acima).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
})

// Parse eager no import (padrão do projeto). A lição de testes (STATE.md) vale:
// qualquer teste que toque a cadeia que importa este módulo usa import DINÂMICO
// no setup, para não detonar a validação no load.
export const env = schema.parse(process.env)
