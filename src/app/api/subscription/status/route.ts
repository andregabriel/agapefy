import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase-admin';
import type { SubscriptionUserType } from '@/constants/paywall';
import {
  classifyUserTypeFromSubscriptions,
  type AssinaturaRow,
} from '@/lib/subscription/classifyUserTypeFromSubscriptions';

export async function GET(_req: NextRequest) {
  try {
    // auth-helpers espera cookies síncrono (ReadonlyRequestCookies). Não use função async aqui.
    const cookieStore = cookies();
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({
        userType: 'anonymous' as SubscriptionUserType,
        hasActiveSubscription: false,
        hasActiveTrial: false,
      });
    }

    const admin = getAdminSupabase();

    // Admins têm acesso completo independente de assinatura
    // (evita exibir paywall para usuários com role = 'admin')
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'admin') {
      return NextResponse.json({
        userType: 'active_subscription' as SubscriptionUserType,
        hasActiveSubscription: true,
        hasActiveTrial: false,
      });
    }

    const { data, error } = await admin
      .from('assinaturas')
      .select(
        'status, trial_days, trial_started_at, trial_finished_at, cancel_at_cycle_end',
      )
      .eq('subscriber_email', user.email)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Erro ao consultar assinaturas para status:', error);
      return NextResponse.json({
        userType: 'no_subscription' as SubscriptionUserType,
        hasActiveSubscription: false,
        hasActiveTrial: false,
      });
    }

    const classification = classifyUserTypeFromSubscriptions(
      (data || []) as AssinaturaRow[],
    );

    return NextResponse.json(classification);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Erro interno em /api/subscription/status:', e);
    return NextResponse.json(
      {
        userType: 'no_subscription' as SubscriptionUserType,
        hasActiveSubscription: false,
        hasActiveTrial: false,
      },
      { status: 200 },
    );
  }
}


