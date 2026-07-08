import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'
import { getAdminEnv } from '@/lib/env.admin'

// Client ADMIN (service_role) — BYPASSA a RLS. SERVER-ONLY e DORMENTE (C-2).
//
// Fronteira estrutural (SEC-03/C-3), em 3 camadas redundantes:
//   1) `import 'server-only'` (1ª linha): entrar em bundle de cliente quebra o BUILD;
//   2) a chave vem de env SEM prefixo NEXT_PUBLIC (env.admin.ts) — nunca no browser;
//   3) regra de lint com allowlist VAZIA proíbe importar este módulo em src/**
//      (T5): a dormência da C-2 vira código — nenhum arquivo do app o importa hoje.
//
// DORMÊNCIA (C-2): nenhuma operação desta feature precisa furar a RLS — login usa
// o client autenticado, provisionar editor é admin autenticado + policy, leitura
// é anon. O módulo existe para fechar a TD-04 (base pronta e segura), mas o
// PRIMEIRO uso real exigirá, deliberadamente: ADR da exceção + edição da allowlist
// do lint + GRANT explícito de tabela p/ service_role + a env em Production (SEC-17).
//
// GATE (SEC-08): todo caminho que use este client DEVE ser precedido por
// requireEditor()/requireAdmin() no servidor, ANTES de qualquer operação.
export function createAdminClient() {
  // getAdminEnv() valida a service_role LAZY: ausente/malformada → erro nomeado
  // aqui (SEC-04), NUNCA degradação para anon. O fallback `??` não existe mais.
  const { SUPABASE_SERVICE_ROLE_KEY } = getAdminEnv()
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
