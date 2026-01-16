import type { SupabaseClient } from '@supabase/supabase-js';
import { translateSupabaseAuthErrorToPtBr } from '@/lib/auth-error-ptbr';

const AUTH_METHODS_TO_TRANSLATE = new Set<string>([
  // email/password
  'signInWithPassword',
  'signUp',
  // magic link / otp / recovery
  'signInWithOtp',
  'resetPasswordForEmail',
  'verifyOtp',
  'updateUser',
  // social (usually not shown inline, but harmless)
  'signInWithOAuth',
]);

function withTranslatedError<T>(res: T): T {
  if (!res || typeof res !== 'object') return res;
  const anyRes = res as any;
  if (!anyRes.error) return res;

  const translated = translateSupabaseAuthErrorToPtBr(anyRes.error);
  if (!translated) return res;

  return {
    ...anyRes,
    error: {
      ...anyRes.error,
      message: translated,
    },
  } as T;
}

/**
 * Wraps a Supabase client so that Supabase Auth UI receives pt-BR error messages.
 *
 * Why: @supabase/auth-ui-react renders `error.message` directly, without i18n for server errors.
 */
export function wrapSupabaseClientForAuthUiPtBr(client: SupabaseClient): SupabaseClient {
  const authProxy = new Proxy(client.auth as any, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && AUTH_METHODS_TO_TRANSLATE.has(prop) && typeof original === 'function') {
        return async (...args: any[]) => withTranslatedError(await original.apply(target, args));
      }
      return original;
    },
  });

  return new Proxy(client as any, {
    get(target, prop, receiver) {
      if (prop === 'auth') return authProxy;
      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseClient;
}

