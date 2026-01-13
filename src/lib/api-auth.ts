import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSupabase } from '@/lib/supabase-admin';

type AuthResult =
  | { ok: true; userId: string; role?: string | null }
  | { ok: false; response: NextResponse };

const ADMIN_HEADER_NAMES = ['x-api-key', 'x-admin-key'];

function getBearerToken(req: NextRequest): string {
  const header = req.headers.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

function getHeaderToken(req: NextRequest, names: string[]): string {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value) return value.trim();
  }
  return '';
}

export function requireAdminApiKey(req: NextRequest): NextResponse | null {
  const adminKey = process.env.ADMIN_API_KEY || '';
  if (!adminKey) {
    return null;
  }

  const token = getHeaderToken(req, ADMIN_HEADER_NAMES) || getBearerToken(req);
  if (!token || token !== adminKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export async function requireUser(req: NextRequest): Promise<AuthResult> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'missing_bearer_token' }, { status: 401 }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    return { ok: false, response: NextResponse.json({ error: 'supabase_not_configured' }, { status: 500 }) };
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);

  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }

  return { ok: true, userId: user.id };
}

export async function requireAdminUser(req: NextRequest): Promise<AuthResult> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'missing_bearer_token' }, { status: 401 }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    return { ok: false, response: NextResponse.json({ error: 'supabase_not_configured' }, { status: 500 }) };
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);

  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }

  const admin = getAdminSupabase();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, response: NextResponse.json({ error: 'role_lookup_failed' }, { status: 500 }) };
  }

  if (profile?.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, role: profile?.role || null };
}

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const adminKey = process.env.ADMIN_API_KEY || '';
  if (adminKey) {
    const apiKeyResponse = requireAdminApiKey(req);
    if (!apiKeyResponse) {
      return { ok: true, userId: 'api_key', role: 'admin' };
    }
    if (apiKeyResponse.status !== 401) {
      return { ok: false, response: apiKeyResponse };
    }
  }
  return await requireAdminUser(req);
}

export function requireWebhookSecret(
  req: NextRequest,
  envKey: string,
  headerNames: string[] = ['x-webhook-secret', 'x-webhook-token', 'x-whatsapp-signature', 'client-token']
): NextResponse | null {
  // Default secret is read from the requested env key.
  // For WhatsApp webhooks we also accept Z-API's Client-Token as a safe fallback,
  // so the webhook doesn't hard-fail in production when WHATSAPP_WEBHOOK_SECRET isn't configured.
  // This still requires the caller to present the correct token in headers.
  let secret = process.env[envKey] || '';
  if (!secret && envKey === 'WHATSAPP_WEBHOOK_SECRET') {
    secret = process.env.ZAPI_CLIENT_TOKEN || '';
  }
  const isProd = process.env.NODE_ENV === 'production';
  if (!secret) {
    if (isProd) {
      return NextResponse.json({ error: 'webhook_secret_not_configured' }, { status: 500 });
    }
    return null;
  }

  // Some providers do not support custom headers for webhook callbacks.
  // Accept `?token=` in the URL as a fallback (keeps webhook protected without opening it publicly).
  let queryToken = '';
  try {
    queryToken = new URL(req.url).searchParams.get('token') || '';
  } catch {}

  const token = queryToken || getHeaderToken(req, headerNames) || getBearerToken(req);
  if (!token || token !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
