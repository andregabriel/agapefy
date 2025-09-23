import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';

    // Em produção, exigir header; em dev, permitir sem header para facilitar testes locais
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && (!expected || authHeader !== expected)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const targetUrl = new URL('/api/daily-quote?force=true', req.nextUrl);
    const res = await fetch(targetUrl.toString(), { method: 'POST' });
    const data = await res.json().catch(() => ({}));

    return NextResponse.json(
      { ok: res.ok, status: res.status, cron: true, ...data },
      { status: res.ok ? 200 : res.status }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'cron error' }, { status: 500 });
  }
}


