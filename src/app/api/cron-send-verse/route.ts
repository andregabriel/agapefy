import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';

    const isVercelCron = /vercel-cron\/1\.0/i.test(userAgent);
    const hasValidSecret = expected && authHeader === expected;
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && !isVercelCron && !hasValidSecret) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data: rows } = await supabase.from('app_settings').select('*');
    const settings: Record<string, string> = {};
    for (const row of rows || []) settings[row.key] = row.value;

    const enabled = (settings.send_daily_verse_whatsapp ?? 'false') === 'true';
    if (!enabled) return NextResponse.json({ ok: true, cron: true, skipped: true, reason: 'disabled' });

    const time = (settings.daily_verse_send_time || '09:00').match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
      ? settings.daily_verse_send_time
      : '09:00';
    const [hStr, mStr] = time.split(':');

    const TZ = 'America/Sao_Paulo';
    const now = new Date();
    const nowSpTime = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todaySp = dateFormatter.format(now);

    const lastISO = settings.daily_verse_last_sent_at || '';
    const last = lastISO ? new Date(lastISO) : null;
    const lastSp = last ? dateFormatter.format(last) : '';
    const hasRunToday = !!last && lastSp === todaySp;

    if (nowSpTime >= `${hStr.padStart(2, '0')}:${mStr.padStart(2, '0')}` && !hasRunToday) {
      const senderUrl = process.env.SUPABASE_FUNCTIONS_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const endpoint = `${senderUrl}/daily-verse-sender`;
      const senderRes = await fetch(endpoint, { headers: { Authorization: `Bearer ${serviceKey}` } });

      // registrar última execução
      await supabase.from('app_settings').upsert({ key: 'daily_verse_last_sent_at', value: new Date().toISOString(), type: 'text' }, { onConflict: 'key' });

      return NextResponse.json({ ok: senderRes.ok, status: senderRes.status, cron: true, triggered: true, tz: TZ, scheduledFor: time });
    }

    return NextResponse.json({ ok: true, cron: true, triggered: false, tz: TZ, scheduledFor: time });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'cron error' }, { status: 500 });
  }
}
