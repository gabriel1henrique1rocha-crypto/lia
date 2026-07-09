import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'
import { SESSION_COOKIE_OPTIONS } from '@/lib/auth/cookieOptions'

// Client AUTENTICADO — o PADRÃO de escrita do painel (C-2/SEC-11). Usa a
// publishable key + o JWT do editor logado transportado por COOKIES; opera como
// papel `authenticated` SOB RLS (a RLS é o gate — nunca bypassa). SERVER-ONLY.
//
// Usa SOMENTE env pública (URL + publishable): a sessão vem dos cookies, não de
// env — zero variáveis novas, nenhuma rota até a service_role.
//
// Contexto de uso: Server Components, route handlers e server actions (que leem
// cookies via next/headers). O REFRESH de token que reescreve cookies é feito no
// proxy (T7) — em Server Component, escrever cookie lança, e o `setAll` abaixo
// engole o erro (padrão Supabase). getUser() (não getSession()) é quem valida a
// identidade no Auth server para decisões de autorização (ver requireEditor, T8).
//
// Assíncrono: em Next 16 `cookies()` é assíncrono → os chamadores fazem `await`.
export async function createAuthenticatedClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      // httpOnly/Secure(prod)/SameSite=Lax (D-10) — a lib faz merge nas escritas.
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Chamado de um Server Component: escrever cookie lança. O refresh de
            // sessão é responsabilidade do proxy (T7); ignorar aqui é o padrão
            // documentado do @supabase/ssr.
          }
        },
      },
    }
  )
}
