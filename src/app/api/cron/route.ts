import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';

    // Em produção, exigir header; em dev, permitir sem header para facilitar testes locais
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && (!expected || authHeader !== expected)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Carregar configurações
    const { data: rows } = await supabase.from('app_settings').select('*');
    const settings: Record<string, string> = {};
    for (const row of rows || []) settings[row.key] = row.value;

    const autoEnabled = (settings.prayer_quote_auto_enabled ?? 'true') === 'true';
    if (!autoEnabled) {
      return NextResponse.json({ ok: true, cron: true, skipped: true, reason: 'auto_disabled' });
    }

    // Determinar horário alvo (HH:mm)
    const time = (settings.prayer_quote_auto_time || '07:00').match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
      ? settings.prayer_quote_auto_time
      : '07:00';
    const [hStr, mStr] = time.split(':');
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);

    const now = new Date();
    const todayTarget = new Date(now);
    todayTarget.setHours(hours, minutes, 0, 0);

    // Evitar rodar mais de 1x por dia
    const lastISO = settings.prayer_quote_last_updated_at || '';
    const last = lastISO ? new Date(lastISO) : null;
    const hasRunToday = !!last && last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate();

    if (now >= todayTarget && !hasRunToday) {
      const targetUrl = new URL('/api/daily-quote', req.nextUrl);
      const res = await fetch(targetUrl.toString(), { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: res.ok, status: res.status, cron: true, triggered: true, ...data }, { status: res.ok ? 200 : res.status });
    }

    return NextResponse.json({ ok: true, cron: true, triggered: false, now: now.toISOString(), target: todayTarget.toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'cron error' }, { status: 500 });
  }
}


