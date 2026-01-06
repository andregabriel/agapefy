import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FALLBACK_SUPABASE_URL = 'https://vvgqqlrujmyxzzygsizc.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2Z3FxbHJ1am15eHp6eWdzaXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDk1MDYsImV4cCI6MjA3MDU4NTUwNn0.RDBnrokuwaXoQri56NpCUU1HU_VYb6gXxm_AcWniwfo';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isOnboardingRoute = pathname.startsWith('/onboarding');

  if (!isAdminRoute && !isOnboardingRoute) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient(
    { req, res },
    { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const redirectWithCookies = (url: URL) => {
    const redirectRes = NextResponse.redirect(url);
    res.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie);
    });
    return redirectRes;
  };

  if (userError || !user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return redirectWithCookies(loginUrl);
  }

  if (isOnboardingRoute) {
    return res;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    const homeUrl = new URL('/', req.url);
    return redirectWithCookies(homeUrl);
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/onboarding/:path*'],
};
