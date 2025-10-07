import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAdminSupabase } from '@/lib/supabase-admin';

function getFunctionsBaseUrl(): string {
  const explicit = process.env.SUPABASE_FUNCTIONS_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  try {
    const u = new URL(supabaseUrl);
    const ref = u.host.split('.')[0];
    return `https://${ref}.functions.supabase.co`;
  } catch {
    return '';
  }
}

function getWritableClient() {
  try {
    return getAdminSupabase();
  } catch (_) {
    return supabase; // fallback for dev/local where service role may be absent
  }
}

async function inlineSend(test: boolean, limit?: number) {
  const adminSupabase = getWritableClient();
  // Ler frase do dia
  const { data: settingsRows } = await adminSupabase.from('app_settings').select('key,value').in('key', ['prayer_quote_text','prayer_quote_reference','prayer_quote_last_verse_id']);
  const map: Record<string,string> = {};
  for (const r of settingsRows || []) map[r.key] = r.value as string;
  const text = (map['prayer_quote_text'] || '').trim();
  const reference = (map['prayer_quote_reference'] || '').trim();
  const verseId = (map['prayer_quote_last_verse_id'] || '').trim();
  if (!text || !reference) return { ok: false, reason: 'missing_quote' } as const;
  const message = `🌅 *Bom dia! Versículo do Dia*\n\n"${text}"\n\n📍 ${reference}\n\n🙏 Que este versículo abençoe seu dia!\n\n_Agape - Seu companheiro espiritual_ ✨`;

  // Buscar usuários
  let { data: users } = await adminSupabase.from('whatsapp_users').select('phone_number').eq('is_active', true).eq('receives_daily_verse', true);
  users = users || [];
  if (limit && users.length > limit) users = users.slice(0, limit);
  if (users.length === 0) return { ok: true, sent: 0, total: 0 } as const;

  const ZAPI_INSTANCE_NAME = process.env.ZAPI_INSTANCE_NAME || '';
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN || '';
  const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || '';
  const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

  let sent = 0;
  for (const u of users) {
    const phone = (u as any).phone_number as string;
    // idempotência
    const today = new Date().toISOString().split('T')[0];
    const { data: already } = await adminSupabase
      .from('daily_verse_log')
      .select('id')
      .eq('user_phone', phone)
      .gte('sent_at', `${today}T00:00:00.000Z`)
      .limit(1);
    if (already && already.length > 0 && !test) continue;

    if (!test) {
      const res = await fetch(`${ZAPI_BASE_URL}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone, message })
      });
      if (res.ok) {
        sent++;
        await adminSupabase.from('daily_verse_log').insert({ user_phone: phone, verse_id: verseId || null, delivery_status: 'sent' });
      } else {
        const errTxt = await res.text().catch(()=> '');
        await adminSupabase.from('daily_verse_log').insert({ user_phone: phone, verse_id: verseId || null, delivery_status: 'failed', error_msg: errTxt.slice(0,500) });
      }
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return { ok: true, sent, total: users.length } as const;
}

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

    const url = new URL(req.url);
    const test = url.searchParams.get('test') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '0') || undefined;

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
      // Concurrency guard: acquire a per-day lock before sending to avoid duplicate runs.
      // We use a unique row per date so that only one insert succeeds under race.
      if (!test) {
        const lockKey = `daily_verse_lock_${todaySp}`;
        const { error: lockError } = await supabase
          .from('app_settings')
          .insert({ key: lockKey, value: new Date().toISOString(), type: 'text' });
        if (lockError) {
          return NextResponse.json({ ok: true, cron: true, triggered: false, tz: TZ, scheduledFor: time, skipped: true, reason: 'concurrent_or_locked' });
        }
      }
      // 1) Tentar Edge Function
      const functionsBase = getFunctionsBaseUrl();
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      let senderOk = false;
      let senderStatus = 0;
      let senderError: any = null;

      if (functionsBase) {
        try {
          const endpoint = `${functionsBase}/daily-verse-sender${test ? `?test=true${limit?`&limit=${limit}`:''}`: ''}`;
          const senderRes = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' }
          });
          senderOk = senderRes.ok;
          senderStatus = senderRes.status;
          if (!senderRes.ok) senderError = await senderRes.text().catch(()=> '');
        } catch (e: any) {
          senderOk = false;
          senderError = e?.message || 'call_failed';
        }
      }

      // 2) Fallback inline
      let inlineResult: any = null;
      if (!senderOk) {
        inlineResult = await inlineSend(test, limit);
      }

      await supabase.from('app_settings').upsert({ key: 'daily_verse_last_sent_at', value: new Date().toISOString(), type: 'text' }, { onConflict: 'key' });

      return NextResponse.json({ ok: senderOk || inlineResult?.ok, status: senderStatus || 200, cron: true, triggered: true, tz: TZ, scheduledFor: time, senderOk, senderStatus, senderError, inlineResult });
    }

    return NextResponse.json({ ok: true, cron: true, triggered: false, tz: TZ, scheduledFor: time });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'cron error' }, { status: 500 });
  }
}
