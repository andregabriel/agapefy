import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';

    // Permitir requisições do Vercel Cron (user-agent) ou via secret opcional
    const isVercelCron = /vercel-cron\/1\.0/i.test(userAgent);
    const hasValidSecret = expected && authHeader === expected;
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && !isVercelCron && !hasValidSecret) {
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

    const TZ = 'America/Sao_Paulo';
    const now = new Date();
    // Hora atual no fuso de São Paulo (HH:mm)
    const nowSpTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now);
    // Data civil em São Paulo (YYYY-MM-DD)
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todaySp = dateFormatter.format(now); // ex: 2025-09-30

    // Evitar rodar mais de 1x por dia – comparar datas em São Paulo
    const lastISO = settings.prayer_quote_last_updated_at || '';
    const last = lastISO ? new Date(lastISO) : null;
    const lastSp = last ? dateFormatter.format(last) : '';
    const hasRunToday = !!last && lastSp === todaySp;

    if (nowSpTime >= `${hStr.padStart(2, '0')}:${mStr.padStart(2, '0')}` && !hasRunToday) {
      const targetUrl = new URL('/api/daily-quote', req.nextUrl);
      const res = await fetch(targetUrl.toString(), { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: res.ok, status: res.status, cron: true, triggered: true, tz: TZ, nowSpTime, scheduledFor: time, todaySp, ...data }, { status: res.ok ? 200 : res.status });
    }

    return NextResponse.json({ ok: true, cron: true, triggered: false, tz: TZ, now: now.toISOString(), nowSpTime, scheduledFor: time });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'cron error' }, { status: 500 });
  }
}


