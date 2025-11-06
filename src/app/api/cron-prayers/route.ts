import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAdminSupabase } from '@/lib/supabase-admin';

type PrayerSlot = 'wakeup' | 'lunch' | 'dinner' | 'sleep';

function getWritableClient() {
  try {
    return getAdminSupabase();
  } catch (_) {
    return supabase; // fallback for dev/local where service role may be absent
  }
}

function getNowInSaoPaulo() {
  const TZ = 'America/Sao_Paulo';
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return { TZ, now, timeStr, dateStr } as const;
}

function getSlotPrompt(slot: PrayerSlot): string {
  switch (slot) {
    case 'wakeup': return 'oração da manhã, ao acordar, pedindo direção e gratidão';
    case 'lunch': return 'oração antes do almoço, agradecendo o alimento e pedindo bênção';
    case 'dinner': return 'oração antes do jantar, agradecendo o dia e pedindo paz';
    case 'sleep': return 'oração da noite antes de dormir, entregando preocupações a Deus';
    default: return 'oração curta cristã';
  }
}

async function sendWhatsAppText(phone: string, message: string) {
  const ZAPI_INSTANCE_NAME = process.env.ZAPI_INSTANCE_NAME || '';
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN || '';
  const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || '';
  if (!ZAPI_INSTANCE_NAME || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    return { ok: false, status: 500, error: 'zapi_missing_env' } as const;
  }
  const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;
  const res = await fetch(`${ZAPI_BASE_URL}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone, message })
  });
  const txt = await res.text().catch(()=> '');
  return { ok: res.ok, status: res.status, body: txt } as const;
}

async function generatePrayerText(prompt: string) {
  // Prefer calling the internal Edge Function if configured
  const functionsBase = (() => {
    const explicit = process.env.SUPABASE_FUNCTIONS_URL;
    if (explicit) return explicit.replace(/\/$/, '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    try {
      const u = new URL(supabaseUrl);
      const ref = u.host.split('.')[0];
      return `https://${ref}.functions.supabase.co`;
    } catch { return ''; }
  })();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (functionsBase && serviceKey) {
    try {
      const r = await fetch(`${functionsBase}/generate-prayer-internal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (r.ok) {
        const data = await r.json();
        const title = (data?.title || '').toString().trim();
        const prayer = (data?.prayer_text || '').toString().trim();
        if (prayer) return { title, text: prayer } as const;
      }
    } catch {}
  }
  // Fallback to a simple template
  return { title: 'Oração', text: `Senhor, neste momento, coloco minha vida em Tuas mãos. Guia meus passos, fortalece minha fé e concede paz ao meu coração. Em nome de Jesus, amém.` } as const;
}

async function inlineSend(test: boolean, limit?: number) {
  const adminSupabase = getWritableClient();
  const { timeStr, dateStr } = getNowInSaoPaulo();
  const [hStr, mStr] = timeStr.split(':');
  const timeHHMM = `${hStr.padStart(2,'0')}:${mStr.padStart(2,'0')}`;

  // Gather candidates across slots; we will send if user time <= now and not yet sent today
  // This allows cron to run every 5 minutes without missing off-minute selections.
  const slots: Array<{ slot: PrayerSlot; column: string; label: string }> = [
    { slot: 'wakeup', column: 'prayer_time_wakeup', label: 'ao acordar' },
    { slot: 'lunch', column: 'prayer_time_lunch', label: 'no almoço' },
    { slot: 'dinner', column: 'prayer_time_dinner', label: 'no jantar' },
    { slot: 'sleep', column: 'prayer_time_sleep', label: 'ao dormir' },
  ];

  let totalCandidates = 0;
  let totalSent = 0;
  const perSlotResults: Record<string, number> = {};

  for (const s of slots) {
    // Fetch users eligible for this slot
    const q = adminSupabase
      .from('whatsapp_users')
      .select(`phone_number, is_active, receives_daily_prayer, receives_daily_routine, ${s.column}`)
      .eq('is_active', true)
      .or('receives_daily_prayer.eq.true,receives_daily_routine.eq.true')
      .not(s.column as any, 'is', null)
      .lte(s.column as any, `${timeHHMM}:59`);

    let { data: users, error } = await q;
    if (error) continue;
    users = users || [];

    // Apply limit per whole run
    if (limit && totalCandidates + users.length > limit) {
      users = users.slice(0, Math.max(0, limit - totalCandidates));
    }

    totalCandidates += users.length;
    perSlotResults[s.slot] = 0;

    for (const u of users) {
      const phone = (u as any).phone_number as string;

      // Idempotency per user/slot/day
      const { data: already } = await adminSupabase
        .from('whatsapp_prayer_log')
        .select('id')
        .eq('user_phone', phone)
        .eq('slot', s.slot)
        .eq('sent_date', dateStr)
        .limit(1);
      if ((already && already.length > 0) && !test) continue;

      const prompt = getSlotPrompt(s.slot);
      const prayer = await generatePrayerText(prompt);
      const message = `🙏 Oração ${s.label}
\n*${prayer.title || 'Oração'}*
\n${prayer.text}
\n_Agape - Seu companheiro espiritual_ ✨`;

      if (!test) {
        const res = await sendWhatsAppText(phone, message);
        if (res.ok) {
          await adminSupabase
            .from('whatsapp_prayer_log')
            .insert({ user_phone: phone, slot: s.slot, sent_date: dateStr });
          totalSent++;
          perSlotResults[s.slot]! += 1;
        }
        await new Promise(r => setTimeout(r, 700));
      }
    }

    if (limit && totalCandidates >= limit) break;
  }

  return { ok: true, sent: totalSent, totalCandidates, perSlotResults } as const;
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

    const { timeStr, TZ } = getNowInSaoPaulo();

    const result = await inlineSend(test, limit);
    return NextResponse.json({ ok: true, cron: true, tz: TZ, now: timeStr, test, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'cron_prayers_error' }, { status: 500 });
  }
}


