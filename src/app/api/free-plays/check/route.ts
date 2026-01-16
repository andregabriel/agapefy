import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase-admin';

interface CheckRequestBody {
  maxPerDay?: number;
  context?: 'anonymous' | 'no_subscription' | 'other';
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as CheckRequestBody;
    const rawMaxPerDay = (body as any).maxPerDay;
    const parsedMaxPerDay = rawMaxPerDay == null ? NaN : Number(rawMaxPerDay);
    const maxPerDay = Number.isFinite(parsedMaxPerDay) ? parsedMaxPerDay : 1;
    const context = body.context ?? 'anonymous';

    if (maxPerDay <= 0) {
      return NextResponse.json({
        allowed: false,
        count: 0,
        max: maxPerDay,
        reason: 'limit_zero',
      });
    }

    const cookieStore = cookies();
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await userClient.auth.getUser();

    // Derivar chave de limite
    let limitKey: string;
    if (user?.id) {
      limitKey = `user:${user.id}`;
    } else {
      const forwardedFor = req.headers.get('x-forwarded-for') || '';
      const ip = forwardedFor.split(',')[0].trim() || (req as any).ip || 'unknown_ip';
      const ua = (req.headers.get('user-agent') || 'unknown_ua').slice(0, 120);
      limitKey = `anon:${ip}|${ua}`;
    }

    const today = new Date().toISOString().slice(0, 10);

    const admin = getAdminSupabase();

    // Buscar registro existente
    const { data, error } = await admin
      .from('free_play_limits')
      .select('id, play_count')
      .eq('limit_key', limitKey)
      .eq('play_date', today)
      .maybeSingle();

    if (error && (error as any).code !== 'PGRST116') {
      // Se a tabela não existir ou outro erro, deixar passar para não travar o app
      // eslint-disable-next-line no-console
      console.warn('free-plays/check: erro ao buscar limite, permitindo por segurança', error);
      return NextResponse.json({
        allowed: true,
        reason: 'backend_error',
      });
    }

    if (!data) {
      // Nenhum registro hoje: criar com play_count = 1
      const { error: insertError } = await admin.from('free_play_limits').insert({
        limit_key: limitKey,
        context,
        play_date: today,
        play_count: 1,
      });

      if (insertError) {
        // eslint-disable-next-line no-console
        console.warn(
          'free-plays/check: erro ao inserir limite, permitindo por segurança',
          insertError,
        );
      }

      return NextResponse.json({
        allowed: true,
        count: 1,
        max: maxPerDay,
      });
    }

    const currentCount = typeof data.play_count === 'number' ? data.play_count : 0;

    if (currentCount >= maxPerDay) {
      return NextResponse.json({
        allowed: false,
        count: currentCount,
        max: maxPerDay,
      });
    }

    const nextCount = currentCount + 1;
    const { error: updateError } = await admin
      .from('free_play_limits')
      .update({ play_count: nextCount })
      .eq('id', data.id);

    if (updateError) {
      // eslint-disable-next-line no-console
      console.warn(
        'free-plays/check: erro ao atualizar limite, permitindo por segurança',
        updateError,
      );
    }

    return NextResponse.json({
      allowed: true,
      count: nextCount,
      max: maxPerDay,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('free-plays/check: erro inesperado, permitindo por segurança', e);
    return NextResponse.json(
      {
        allowed: true,
        reason: 'unexpected_error',
      },
      { status: 200 },
    );
  }
}









