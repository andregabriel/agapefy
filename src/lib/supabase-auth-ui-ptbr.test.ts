import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { wrapSupabaseClientForAuthUiPtBr } from '@/lib/supabase-auth-ui-ptbr';

describe('wrapSupabaseClientForAuthUiPtBr', () => {
  it('rewrites auth error.message to pt-BR for Auth UI', async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: null,
      error: { message: 'Invalid login credentials' },
    }));

    const fakeClient = {
      auth: { signInWithPassword },
    } as unknown as SupabaseClient;

    const wrapped = wrapSupabaseClientForAuthUiPtBr(fakeClient);
    const res: any = await (wrapped.auth as any).signInWithPassword({
      email: 'x@y.com',
      password: 'nope',
    });

    expect(res.error?.message).toBe('E-mail ou senha incorretos. Confira e tente novamente.');
  });
});

