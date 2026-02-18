import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api-auth';

interface ProfileRow {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string;
}

interface SubscriptionRow {
  subscriber_email: string | null;
  status: string | null;
  last_status_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  cancel_at_cycle_end: boolean | null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getRowEventTime(row: SubscriptionRow): number {
  return (
    parseDate(row.last_status_at)?.getTime() ||
    parseDate(row.updated_at)?.getTime() ||
    parseDate(row.created_at)?.getTime() ||
    0
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const admin = getAdminSupabase();

    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, username, full_name, role, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Erro ao buscar perfis no admin/users:', profilesError);
      return NextResponse.json(
        { error: 'Erro ao buscar perfis' },
        { status: 500 },
      );
    }

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();
    if (usersError) {
      console.error('Erro ao buscar auth.users no admin/users:', usersError);
    }

    const { data: subscriptionsData, error: subscriptionsError } = await admin
      .from('assinaturas')
      .select(
        'subscriber_email, status, last_status_at, updated_at, created_at, cancel_at_cycle_end',
      )
      .not('subscriber_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20000);
    if (subscriptionsError) {
      console.error('Erro ao buscar assinaturas no admin/users:', subscriptionsError);
    }

    const latestSubscriptionByEmail = new Map<string, SubscriptionRow>();
    for (const row of (subscriptionsData || []) as SubscriptionRow[]) {
      const email = normalizeEmail(row.subscriber_email);
      if (!email) continue;
      const current = latestSubscriptionByEmail.get(email);
      if (!current || getRowEventTime(row) > getRowEventTime(current)) {
        latestSubscriptionByEmail.set(email, row);
      }
    }

    const emailByUserId = new Map<string, string>();
    for (const user of usersData?.users || []) {
      if (user.id && user.email) {
        emailByUserId.set(user.id, user.email);
      }
    }

    const rows = ((profiles || []) as ProfileRow[]).map((profile) => ({
      ...profile,
      role: profile.role || 'user',
      email: emailByUserId.get(profile.id) || null,
      subscription_access: (() => {
        const email = normalizeEmail(emailByUserId.get(profile.id));
        if (!email) return 'none' as const;
        const subscription = latestSubscriptionByEmail.get(email);
        if (!subscription) return 'none' as const;
        const providerStatus = (subscription.status || '').trim().toLowerCase();
        return providerStatus === 'active' ? ('active' as const) : ('inactive' as const);
      })(),
      subscription_provider_status: (() => {
        const email = normalizeEmail(emailByUserId.get(profile.id));
        if (!email) return null;
        const subscription = latestSubscriptionByEmail.get(email);
        if (!subscription?.status) return null;
        return subscription.status.trim().toLowerCase();
      })(),
      subscription_updated_at: (() => {
        const email = normalizeEmail(emailByUserId.get(profile.id));
        if (!email) return null;
        const subscription = latestSubscriptionByEmail.get(email);
        return (
          subscription?.last_status_at ||
          subscription?.updated_at ||
          subscription?.created_at ||
          null
        );
      })(),
      subscription_cancel_at_cycle_end: (() => {
        const email = normalizeEmail(emailByUserId.get(profile.id));
        if (!email) return null;
        const subscription = latestSubscriptionByEmail.get(email);
        return subscription?.cancel_at_cycle_end ?? null;
      })(),
    }));

    return NextResponse.json({
      users: rows,
      partial: !!usersError || !!subscriptionsError,
    });
  } catch (error) {
    console.error('Erro interno em /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}
