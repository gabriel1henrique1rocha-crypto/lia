import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createAuthenticatedClient } from '@/lib/supabase/authenticated'
import { safeNext } from '@/lib/auth/safeNext'

// Callback do MAGIC LINK — fluxo token_hash (C-1, design §3.2). Escolhido sobre
// PKCE/exchangeCodeForSession porque verifyOtp por token_hash funciona mesmo
// quando o editor abre o link num browser/dispositivo DIFERENTE do que solicitou
// (comum em e-mail); o PKCE exigiria o code_verifier no mesmo browser.
//
// A sessão é estabelecida AQUI (route handler PODE gravar cookies). Os cookies
// saem httpOnly/Secure(prod)/SameSite=Lax porque createAuthenticatedClient
// injeta SESSION_COOKIE_OPTIONS (ADR D-10). Template de e-mail correspondente
// ({{ .TokenHash }}) é passo de dashboard no runbook (T17), não código.
const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'email',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
  'signup',
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createAuthenticatedClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Token ausente/inválido/expirado → volta ao login com um erro genérico (sem
  // vazar detalhe do token). O gate real das rotas protegidas é o layout (T11).
  return NextResponse.redirect(new URL('/admin/login?erro=link-invalido', request.url))
}
