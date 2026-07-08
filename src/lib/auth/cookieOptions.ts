import type { CookieOptionsWithName } from '@supabase/ssr'

// Política de cookies de SESSÃO do editor/admin (ADR D-10).
//
// A sessão é consumida SOMENTE no servidor: guards (requireEditor/requireAdmin)
// rodam em server component / route handler; o refresh é server-side no proxy;
// NENHUM browser client lê a sessão. Como consequência, os cookies de auth podem
// e DEVEM ser httpOnly — inacessíveis a JS, mitigando roubo de sessão por XSS
// (F-13). Precedente: features futuras (uploads de Storage, realtime de
// moderação) passam por server action / route handler usando o client
// autenticado, NUNCA por um browser client com o JWT.
//
// A lib @supabase/ssr faz merge deste objeto (via `cookieOptions` do
// createServerClient) em toda escrita de cookie de sessão. Seu default é
// httpOnly:false (para permitir browser client) — que aqui SOBRESCREVEMOS.
// Aplicado de forma consistente no callback, no proxy e no client autenticado,
// para que o refresh não rebaixe os atributos.
//
// `secure` só em produção: em dev/local (http://127.0.0.1 + Mailpit) um cookie
// Secure não é gravado sobre HTTP e quebraria o login local (T19).
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}
