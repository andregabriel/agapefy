import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAdminSupabase } from '@/lib/supabase-admin';

type ChallengeRow = {
  phone_number: string;
  playlist_id: string;
  send_time: string | null;
};

function getWritableClient() {
  try {
    return getAdminSupabase();
  } catch (_) {
    return supabase; // fallback para dev/local sem service role
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
  const txt = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body: txt } as const;
}

async function inlineSend(test: boolean, limit?: number) {
  const adminSupabase = getWritableClient();
  const { timeStr, dateStr } = getNowInSaoPaulo();
  const [hStr, mStr] = timeStr.split(':');
  const currentMinutes = parseInt(hStr) * 60 + parseInt(mStr);

  // Janela móvel de 5 minutos para disparar o envio
  const windowStartMinutes = currentMinutes - 5;
  const windowEndMinutes = currentMinutes;

  // Buscar desafios ativos + preferências do usuário
  const { data: rows, error } = await adminSupabase
    .from('whatsapp_user_challenges')
    .select(`
      phone_number,
      playlist_id,
      send_time,
      whatsapp_users!inner(
        is_active,
        receives_daily_prayer,
        has_sent_first_message
      )
    `);

  if (error || !rows || rows.length === 0) {
    return { ok: true, sent: 0, totalCandidates: 0, reason: 'no_rows_or_error' as const };
  }

  // Filtrar usuários elegíveis (ativos, com desafio ligado e primeira mensagem enviada)
  const eligible: ChallengeRow[] = (rows as any[])
    .filter((r: any) => {
      const u = r.whatsapp_users || {};
      if (!u.is_active) return false;
      if (!u.receives_daily_prayer) return false;
      if (!u.has_sent_first_message) return false;
      const sendTime = (r.send_time as string) || '';
      if (!sendTime || sendTime.length < 5) return false;

      const [uh, um] = sendTime.slice(0, 5).split(':').map(Number);
      const userMinutes = uh * 60 + um;

      if (windowStartMinutes < 0) {
        // Janela atravessa a meia-noite
        return userMinutes >= (1440 + windowStartMinutes) || userMinutes <= windowEndMinutes;
      }
      return userMinutes >= windowStartMinutes && userMinutes <= windowEndMinutes;
    })
    .map((r: any) => ({
      phone_number: r.phone_number as string,
      playlist_id: r.playlist_id as string,
      send_time: (r.send_time as string) || null,
    }));

  if (eligible.length === 0) {
    return { ok: true, sent: 0, totalCandidates: 0, reason: 'no_eligible' as const };
  }

  // Aplicar limite opcional de envios por execução
  let candidates = eligible;
  if (limit && eligible.length > limit) {
    candidates = eligible.slice(0, limit);
  }

  // Pré-carregar áudios das playlists envolvidas
  const uniquePlaylistIds = Array.from(new Set(candidates.map(c => c.playlist_id)));
  const { data: playlistAudios, error: paError } = await adminSupabase
    .from('playlist_audios')
    .select(`
      playlist_id,
      position,
      audio_id,
      audios (
        title
      )
    `)
    .in('playlist_id', uniquePlaylistIds)
    // Garantir ordem consistente por posição dentro de cada playlist
    .order('position', { ascending: true });

  if (paError || !playlistAudios) {
    return { ok: true, sent: 0, totalCandidates: 0, reason: 'playlist_audios_error' as const };
  }

  const audiosByPlaylist: Record<string, { audio_id: string; title: string | null; position: number }[]> = {};
  for (const row of playlistAudios as any[]) {
    const pid = row.playlist_id as string;
    if (!audiosByPlaylist[pid]) audiosByPlaylist[pid] = [];
    const rawPos = Number(row.position);
    audiosByPlaylist[pid].push({
      audio_id: row.audio_id as string,
      title: (row.audios?.title as string) || null,
      // Normalizar posição; aceita tanto 0-based quanto 1-based, usamos apenas para ordenação relativa
      position: Number.isFinite(rawPos) ? rawPos : 0,
    });
  }
  // Ordenar por posição para garantir sequência 1..N
  for (const pid of Object.keys(audiosByPlaylist)) {
    audiosByPlaylist[pid] = audiosByPlaylist[pid].sort((a, b) => a.position - b.position);
  }

  let sentCount = 0;

  for (const c of candidates) {
    const phone = c.phone_number;
    const playlistId = c.playlist_id;
    const trackList = audiosByPlaylist[playlistId] || [];
    if (trackList.length === 0) continue;

    // Idempotência diária por usuário/playlist - verificar ANTES de processar
    const { data: alreadyToday, error: alreadyErr } = await adminSupabase
      .from('whatsapp_challenge_log')
      .select('id')
      .eq('user_phone', phone)
      .eq('playlist_id', playlistId)
      .eq('sent_date', dateStr) // Apenas HOJE, não dias anteriores
      .limit(1);
    if (!alreadyErr && alreadyToday && alreadyToday.length > 0 && !test) {
      // Já enviou hoje, pular
      continue;
    }

    // Descobrir o próximo índice da jornada (1..N)
    // Buscar apenas logs do dia atual ou anteriores (não futuros)
    const { data: lastLog } = await adminSupabase
      .from('whatsapp_challenge_log')
      .select('sequence_index')
      .eq('user_phone', phone)
      .eq('playlist_id', playlistId)
      .lte('sent_date', dateStr) // Apenas até hoje, não futuros
      .order('sequence_index', { ascending: false })
      .limit(1);

    const lastIndex = (lastLog && lastLog[0]?.sequence_index) || 0;
    const nextIndex = lastIndex + 1;

    // Se já enviou todos os áudios, não enviar mais nada para este desafio
    if (nextIndex > trackList.length) {
      continue;
    }

    const track = trackList[nextIndex - 1];
    const audioId = track.audio_id;
    const title = track.title || 'Oração';

    // Montar mensagem com link para o áudio específico da jornada
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agapefy.com';
    const audioUrl = `${baseUrl.replace(/\/$/, '')}/player/audio/${audioId}`;

    const message = `🙏 Desafio de oração - Dia ${nextIndex} de ${trackList.length}

*${title}*

Ouça agora: ${audioUrl}

_Agape - Seu companheiro espiritual_ ✨`;

    if (!test) {
      // Insert log BEFORE sending to prevent race conditions
      // If insert fails (duplicate), skip sending
      const { error: logError } = await adminSupabase
        .from('whatsapp_challenge_log')
        .insert({
          user_phone: phone,
          playlist_id: playlistId,
          audio_id: audioId,
          sequence_index: nextIndex,
          sent_date: dateStr, // Apenas HOJE
        });
      
      if (logError) {
        // If log insert fails (duplicate key), skip sending to avoid duplicates
        const maskedPhone = phone.replace(/\d(?=\d{4})/g, 'x');
        console.log(`Duplicate log detected for ${maskedPhone} ${playlistId} ${dateStr}, skipping send`);
        continue;
      }

      const res = await sendWhatsAppText(phone, message);
      if (res.ok) {
        sentCount++;
      } else {
        // If send failed, remove the log entry so it can be retried later
        await adminSupabase
          .from('whatsapp_challenge_log')
          .delete()
          .eq('user_phone', phone)
          .eq('playlist_id', playlistId)
          .eq('sent_date', dateStr)
          .eq('sequence_index', nextIndex);
      }
      // Evitar estourar limite de provider
      await new Promise(r => setTimeout(r, 700));
    }
  }

  return { ok: true, sent: sentCount, totalCandidates: candidates.length } as const;
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

    const result = await inlineSend(test, limit);
    const { TZ, timeStr } = getNowInSaoPaulo();

    return NextResponse.json({ ok: true, cron: true, tz: TZ, now: timeStr, test, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'cron_challenge_error' }, { status: 500 });
  }
}


