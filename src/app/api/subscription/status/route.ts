import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase-admin';
import type { SubscriptionUserType } from '@/constants/paywall';

interface AssinaturaRow {
  status: string | null;
  trial_days: number | null;
  trial_started_at: string | null;
  trial_finished_at: string | null;
  cancel_at_cycle_end: boolean | null;
}

function classifyUserTypeFromSubscriptions(rows: AssinaturaRow[]): {
  userType: SubscriptionUserType;
  hasActiveSubscription: boolean;
  hasActiveTrial: boolean;
} {
  if (!rows || rows.length === 0) {
    return {
      userType: 'no_subscription',
      hasActiveSubscription: false,
      hasActiveTrial: false,
    };
  }

  const now = new Date();
  const normalized = rows.map((row) => ({
    status: (row.status || '').toLowerCase(),
    trial_days: row.trial_days ?? 0,
    trial_started_at: row.trial_started_at ? new Date(row.trial_started_at) : null,
    trial_finished_at: row.trial_finished_at ? new Date(row.trial_finished_at) : null,
    cancel_at_cycle_end: !!row.cancel_at_cycle_end,
  }));

  const hasActiveTrial = normalized.some((row) => {
    if (!row.trial_days || row.trial_days <= 0) return false;
    if (row.trial_finished_at && row.trial_finished_at < now) return false;
    if (row.status === 'canceled' || row.status === 'cancelled' || row.status === 'expired') {
      return false;
    }
    return true;
  });

  if (hasActiveTrial) {
    return {
      userType: 'trial',
      hasActiveSubscription: false,
      hasActiveTrial: true,
    };
  }

  const activeStatuses = ['active', 'paid', 'authorized', 'trialing'];
  const hasActiveSubscription = normalized.some((row) => {
    if (activeStatuses.includes(row.status)) return true;
    return false;
  });

  if (hasActiveSubscription) {
    return {
      userType: 'active_subscription',
      hasActiveSubscription: true,
      hasActiveTrial: false,
    };
  }

  return {
    userType: 'no_subscription',
    hasActiveSubscription: false,
    hasActiveTrial: false,
  };
}

export async function GET(_req: NextRequest) {
  try {
    // Next.js 15+: `cookies()` é uma Dynamic API e pode precisar ser aguardada.
    // `await` é seguro mesmo quando `cookies()` retorna o valor diretamente.
    const cookieStore = await cookies();
    const userClient = createRouteHandlerClient({ cookies: async () => cookieStore });
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


