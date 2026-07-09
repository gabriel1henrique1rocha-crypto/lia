import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { SESSION_COOKIE_OPTIONS } from '@/lib/auth/cookieOptions'

// PROXY do Next 16 (sucessor do middleware — A-5). Runtime Node OBRIGATÓRIO e
// não configurável: NÃO declarar `export const runtime` (o Next 16 lança).
//
// PAPEL (design §3.3): camada OTIMISTA, não o gate autoritativo.
//   1) REFRESH de sessão: getUser() valida o token e o setAll reescreve os
//      cookies na resposta — algo que Server Components NÃO podem fazer. Sem
//      isso, a sessão do editor expiraria sem renovar.
//   2) redirect otimista de UX: sem usuário em /admin/* → manda para o login.
//
// NÃO é autorização confiável: a lição do CVE-2025-29927 (bypass de middleware
// via header) e a recomendação vigente do Next mandam checar autorização JUNTO
// AO DADO. O gate real é requireEditor() no layout (protected) (T8/T11) + a RLS.
// Por isso aqui NÃO se consulta papel/`editor` — só presença de sessão.
//
// Matcher restrito a /admin/* → custo ZERO nas rotas públicas (/, /resenha/*).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      // Refresh reescreve cookies com a mesma política httpOnly (D-10) — sem isso
      // o refresh rebaixaria os atributos setados no callback.
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() (não getSession()): valida o JWT no Auth server. Chamado ANTES de
  // gerar a resposta para que o refresh consiga gravar os cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // /admin/login é público (fora do gate) — não redirecionar para evitar laço.
  if (!user && !request.nextUrl.pathname.startsWith('/admin/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
