import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'

// Client PÚBLICO (anon / publishable). Substitui o antigo server.ts e o seu
// fallback `service_role ?? publishable` (TD-04): AQUI a única chave possível é a
// publishable — sem `??`, sem chave secreta, sem rota de import até ela
// (SEC-01/SEC-02). A RLS é o gate real do caminho público; as queries ainda
// filtram `status='published'` explicitamente como defesa em profundidade.
//
// NOTA: este módulo é vigiado por um tripwire (no-service-role.test.ts) que
// reprova qualquer ocorrência do identificador maiúsculo da chave secreta aqui.
//
// Fábrica (não singleton eager): instanciar sob demanda evita tocar env no load
// do módulo e casa com o padrão de injeção usado nas queries (teste local TD-02).
export function createPublicClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } }
  )
}
