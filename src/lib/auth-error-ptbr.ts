export type SupabaseAuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

const PT_BR_BY_CODE: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos. Confira e tente novamente.',
  invalid_login_credentials: 'E-mail ou senha incorretos. Confira e tente novamente.',
};

// Keys are stored normalized (lowercase)
const PT_BR_BY_MESSAGE_EXACT: Record<string, string> = {
  'invalid login credentials': 'E-mail ou senha incorretos. Confira e tente novamente.',
  'missing email or phone': 'Informe seu e-mail para continuar.',
  'user already registered': 'Usuário já cadastrado.',
  'password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
  'unable to validate email address: invalid format': 'E-mail inválido. Confira e tente novamente.',
  'email not confirmed': 'Seu e-mail ainda não foi confirmado.',
  'too many requests': 'Muitas tentativas. Tente novamente mais tarde.',
};

function normalizeMessage(s: string) {
  return s.trim().toLowerCase();
}

export function translateSupabaseAuthErrorToPtBr(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;

  const e = error as SupabaseAuthErrorLike;

  if (typeof e.code === 'string') {
    const byCode = PT_BR_BY_CODE[normalizeMessage(e.code)];
    if (byCode) return byCode;
  }

  if (typeof e.message === 'string') {
    const normalized = normalizeMessage(e.message);

    const exact = PT_BR_BY_MESSAGE_EXACT[normalized];
    if (exact) return exact;

    // Contains-based fallback for common variants
    if (normalized.includes('invalid login credentials')) {
      return 'E-mail ou senha incorretos. Confira e tente novamente.';
    }
  }

  return null;
}

