import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/api-auth';

// Checks whether a WhatsApp phone number can be used by the current authenticated user.
// Reason: client-side upsert on whatsapp_users may be blocked by RLS when the phone is already claimed by another user.
export async function POST(req: NextRequest) {
  const userAuth = await requireUser(req);
  if (!userAuth.ok) return userAuth.response;

  const body = await req.json().catch(() => ({}));
  const phoneRaw = String(body?.phone || body?.phone_number || '');
  const cleanPhone = phoneRaw.replace(/\D/g, '');
  if (!cleanPhone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { data: row, error } = await admin
    .from('whatsapp_users')
    .select('user_id')
    .eq('phone_number', cleanPhone)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 });
  }

  // Not registered at all => available.
  if (!row) {
    return NextResponse.json({ ok: true, available: true });
  }

  // Legacy row without user_id can be claimed by setting user_id=auth.uid().
  if (!row.user_id) {
    return NextResponse.json({ ok: true, available: true, claimableLegacy: true });
  }

  const isMine = String(row.user_id) === userAuth.userId;
  if (isMine) {
    return NextResponse.json({ ok: true, available: true, alreadyMine: true });
  }

  return NextResponse.json({ ok: true, available: false, reason: 'claimed_by_other_user' });
}

