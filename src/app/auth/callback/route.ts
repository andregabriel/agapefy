import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  console.log('🔄 Auth Callback: Código recebido:', !!code)

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('❌ Auth Callback: Erro ao trocar código:', error)
        return NextResponse.redirect(new URL('/login?error=auth_error', request.url))
      }

      console.log('✅ Auth Callback: Sessão criada para:', data.user?.email)

      // Verificar se é admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      console.log('👤 Auth Callback: Perfil encontrado:', profile)

      // Redirecionar baseado no role
      if (profile?.role === 'admin') {
        console.log('🔑 Auth Callback: Redirecionando admin para /admin')
        return NextResponse.redirect(new URL('/admin', request.url))
      } else {
        console.log('👤 Auth Callback: Redirecionando usuário para /')
        return NextResponse.redirect(new URL('/', request.url))
      }

    } catch (error) {
      console.error('💥 Auth Callback: Erro geral:', error)
      return NextResponse.redirect(new URL('/login?error=callback_error', request.url))
    }
  }

  // Se não há código, redirecionar para login
  console.log('❌ Auth Callback: Nenhum código fornecido')
  return NextResponse.redirect(new URL('/login?error=no_code', request.url))
}