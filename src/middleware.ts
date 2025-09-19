import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Temporariamente, vamos permitir acesso ao admin para debug
  if (req.nextUrl.pathname.startsWith('/admin')) {
    console.log('🔍 Middleware: Permitindo acesso temporário ao admin para debug');
    return res;
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*']
}