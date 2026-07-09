import { NextResponse, type NextRequest } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/authenticated'

// Sign-out — POST (não GET: evita logout por prefetch/link acidental). signOut()
// invalida a sessão no Auth server e LIMPA os cookies via setAll (route handler
// pode gravar). Redireciona 303 (POST → GET) para o login.
export async function POST(request: NextRequest) {
  const supabase = await createAuthenticatedClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/admin/login', request.url), 303)
}
