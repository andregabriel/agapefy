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
  const currentMinutes = parseInt(hStr) * 60 + parseInt(mStr);
  
  // We check if the user's selected time is in the past (within the last 5 minutes)
  // This ensures we only send once when the selected time arrives, even though cron runs every 5 minutes
  // The idempotency check prevents duplicate sends on the same day
  const windowStartMinutes = currentMinutes - 5; // Look back 5 minutes
  const windowEndMinutes = currentMinutes; // Up to current time
  
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
    // Concurrency guard: acquire a per-slot/day lock before processing to avoid duplicate runs
    if (!test) {
      const lockKey = `prayer_lock_${s.slot}_${dateStr}`;
      const { error: lockError } = await adminSupabase
        .from('app_settings')
        .insert({ key: lockKey, value: new Date().toISOString(), type: 'text' });
      if (lockError) {
        // If the row already exists (duplicate key), consider it locked and skip this slot
        console.log(`Slot ${s.slot} locked for ${dateStr}, skipping to avoid duplicates`);
        perSlotResults[s.slot] = 0;
        continue;
      }
    }

    // Fetch users eligible for this slot
    // Only users with receives_daily_routine = true (Minha Rotina) should receive routine prayers
    const q = adminSupabase
      .from('whatsapp_users')
      .select(`phone_number, is_active, receives_daily_routine, ${s.column}`)
      .eq('is_active', true)
      .eq('receives_daily_routine', true) // Only send to users who have "Minha Rotina" enabled
      .not(s.column as any, 'is', null);

    let { data: users, error } = await q;
    if (error) {
      perSlotResults[s.slot] = 0;
      continue;
    }
    users = users || [];

    // Filter users whose selected prayer time has just passed (within last 5 minutes)
    // This ensures we send only once when the selected time arrives, not every 5 minutes
    // IMPORTANT: Only send for TODAY, not for past days
    const eligibleUsers = users.filter((u: any) => {
      const userTimeStr = (u[s.column] as string) || '';
      if (!userTimeStr || userTimeStr.length < 5) return false;
      
      const [uh, um] = userTimeStr.slice(0, 5).split(':').map(Number);
      const userMinutes = uh * 60 + um;
      
      // Check if user's selected time is in the past (within last 5 minutes) but not too far back
      // This way, if user selected 07:00 and cron runs at 07:00, 07:05, 07:10...
      // It will only send when the time matches (07:00-07:05 window) and idempotency prevents duplicates
      if (windowStartMinutes < 0) {
        // Window crosses midnight (e.g., current time is 00:02, checking 23:57-00:02)
        return userMinutes >= (1440 + windowStartMinutes) || userMinutes <= windowEndMinutes;
      } else {
        // Normal case: window is within the same day
        // User's time must be >= (current - 5min) and <= current time
        return userMinutes >= windowStartMinutes && userMinutes <= windowEndMinutes;
      }
    });

    // Apply limit per whole run
    if (limit && totalCandidates + eligibleUsers.length > limit) {
      eligibleUsers.splice(limit - totalCandidates);
    }

    totalCandidates += eligibleUsers.length;
    perSlotResults[s.slot] = 0;

    for (const u of eligibleUsers) {
      const phone = (u as any).phone_number as string;

      // Idempotency per user/slot/day - CHECK BEFORE SENDING
      // This ensures we never send duplicates, even if multiple cron runs happen
      const { data: already } = await adminSupabase
        .from('whatsapp_prayer_log')
        .select('id')
        .eq('user_phone', phone)
        .eq('slot', s.slot)
        .eq('sent_date', dateStr) // Only check for TODAY, not past days
        .limit(1);
      
      // Skip if already sent today (even in test mode, we check but don't enforce)
      if (already && already.length > 0) {
        if (!test) {
          continue; // Skip this user, already sent today
        }
        // In test mode, log but don't skip
        console.log(`Test mode: User ${phone} already has log for ${s.slot} on ${dateStr}`);
      }

      const prompt = getSlotPrompt(s.slot);
      const prayer = await generatePrayerText(prompt);
      const message = `🙏 Oração ${s.label}
\n*${prayer.title || 'Oração'}*
\n${prayer.text}
\n_Agape - Seu companheiro espiritual_ ✨`;

      if (!test) {
        // Insert log BEFORE sending to prevent race conditions
        // If insert fails (duplicate), skip sending
        const { error: logError } = await adminSupabase
          .from('whatsapp_prayer_log')
          .insert({ user_phone: phone, slot: s.slot, sent_date: dateStr });
        
        if (logError) {
          // If log insert fails (duplicate key), skip sending to avoid duplicates
          console.log(`Duplicate log detected for ${phone} ${s.slot} ${dateStr}, skipping send`);
          continue;
        }

        const res = await sendWhatsAppText(phone, message);
        if (res.ok) {
          totalSent++;
          perSlotResults[s.slot]! += 1;
        } else {
          // If send failed, remove the log entry so it can be retried later
          await adminSupabase
            .from('whatsapp_prayer_log')
            .delete()
            .eq('user_phone', phone)
            .eq('slot', s.slot)
            .eq('sent_date', dateStr);
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

    // Kill switch global: por padrão, esta CRON fica desativada.
    // Só será executada se WHATSAPP_PRAYER_CRON_ENABLED === 'true'.
    const PRAYER_CRON_ENABLED = (process.env.WHATSAPP_PRAYER_CRON_ENABLED ?? 'false') === 'true';
    if (!PRAYER_CRON_ENABLED) {
      return NextResponse.json({
        ok: true,
        cron: true,
        tz: 'America/Sao_Paulo',
        test: false,
        triggered: false,
        skipped: true,
        reason: 'whatsapp_prayer_cron_disabled',
      });
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


