import { describe, expect, it } from 'vitest';
import { translateSupabaseAuthErrorToPtBr } from '@/lib/auth-error-ptbr';

describe('translateSupabaseAuthErrorToPtBr', () => {
  it('translates the invalid login credentials message', () => {
    expect(
      translateSupabaseAuthErrorToPtBr({ message: 'Invalid login credentials' })
    ).toBe('E-mail ou senha incorretos. Confira e tente novamente.');
  });

  it('translates by error code (invalid_credentials)', () => {
    expect(
      translateSupabaseAuthErrorToPtBr({ code: 'invalid_credentials', message: 'x' })
    ).toBe('E-mail ou senha incorretos. Confira e tente novamente.');
  });

  it('translates the missing email/phone message', () => {
    expect(
      translateSupabaseAuthErrorToPtBr({ message: 'missing email or phone' })
    ).toBe('Informe seu e-mail para continuar.');
  });

  it('returns null for unknown errors', () => {
    expect(translateSupabaseAuthErrorToPtBr({ message: 'Something else' })).toBeNull();
  });
});

