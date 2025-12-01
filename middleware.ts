import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * IMPORTANTE:
 * Hoje o cliente Supabase usado no app (`@/lib/supabase`) guarda a sessão apenas em `localStorage`,
 * e não em cookies. O middleware roda no edge (servidor) e não consegue enxergar essa sessão.
 *
 * A proteção forte de quem é ou não admin continua sendo feita no `AdminLayout` (client-side),
 * que:
 *  - Redireciona para /login se não houver usuário logado
 *  - Mostra tela de "Acesso negado" e redireciona para / se `profiles.role !== 'admin'`
 *
 * Se tentarmos forçar checagem de sessão/role aqui sem cookies, o resultado é loop infinito
 * entre /admin e /login para usuários já autenticados (como aconteceu no seu teste).
 *
 * Por isso, o middleware fica apenas como ponto de observabilidade/log para /admin,
 * sem interferir na navegação, até migrarmos o app inteiro para usar sessões em cookies
 * com `@supabase/auth-helpers-nextjs`.
 */
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    console.log('🔐 Middleware: acesso a /admin detectado (proteção efetiva via AdminLayout client-side).');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};