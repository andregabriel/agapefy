import { supabase } from '@/lib/supabase';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (_e) {
    // ignore: request proceeds without auth header
  }
  return fetch(input, { ...init, headers });
}
