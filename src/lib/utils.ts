import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

// Normaliza strings removendo acentos e caixa para comparações robustas
export function normalizeText(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Identifica a categoria "Recentes" mesmo que seja salva como "Orações Recentes"
export function isRecentesCategoryName(name?: string | null): boolean {
  const normalized = normalizeText(name);
  return normalized === 'recentes' || normalized === 'oracoes recentes';
}

// Identifica a categoria "Rotina" mesmo que seja salva como "Minha Rotina"
export function isRotinaCategoryName(name?: string | null): boolean {
  const normalized = normalizeText(name);
  return normalized === 'rotina' || normalized === 'minha rotina';
}

// Database error helpers
export function extractDbError(error: any): { message: string; code?: string; details?: string; hint?: string } {
  const message =
    (error && (error.message || error.msg)) ||
    (error?.error && (error.error.message || error.error.msg)) ||
    (typeof error === 'string' ? error : '') ||
    'unknown_error';
  const code = error?.code || error?.error?.code;
  const details = error?.details || error?.error?.details;
  const hint = error?.hint || error?.error?.hint;
  return { message: String(message), code, details, hint };
}

export function logDbError(context: string, error: any) {
  const info = extractDbError(error);
  // Use warn to avoid noisy red overlays while still surfacing details in dev tools
  console.warn(`${context}: ${info.message}${info.code ? ` [${info.code}]` : ''}`, { details: info.details, hint: info.hint });
}

// Traduz mensagens de erro comuns do inglês para português
export function translateErrorMessage(error: string | null | undefined): string {
  if (!error) return 'Erro desconhecido';
  
  const errorLower = error.toLowerCase().trim();
  
  // Mapeamento de mensagens de erro comuns
  const translations: Record<string, string> = {
    'run failed': 'Falha ao processar a solicitação',
    'invalid login credentials': 'Credenciais de login inválidas',
    'user already registered': 'Usuário já cadastrado',
    'password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'unable to validate email address: invalid format': 'Não foi possível validar o endereço de e-mail: formato inválido',
    'email not confirmed': 'E-mail não confirmado',
    'too many requests': 'Muitas tentativas. Tente novamente mais tarde',
    'invalid email': 'E-mail inválido',
    'password is required': 'Senha é obrigatória',
    'email is required': 'E-mail é obrigatório',
    'signup requires a valid password': 'O cadastro requer uma senha válida',
    'user not found': 'Usuário não encontrado',
    'email address not confirmed': 'Endereço de e-mail não confirmado',
    'invalid password': 'Senha inválida',
    'weak password': 'Senha muito fraca',
    'password must be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'email already in use': 'E-mail já está em uso',
    'account not found': 'Conta não encontrada',
    'network error': 'Erro de rede. Verifique sua conexão',
    'server error': 'Erro do servidor. Tente novamente',
    'authentication failed': 'Falha na autenticação',
    'session expired': 'Sessão expirada',
    'access denied': 'Acesso negado',
    'rate limit exceeded': 'Limite de tentativas excedido',
    'email link is invalid or has expired': 'O link do e-mail é inválido ou expirou',
    'token has expired or is invalid': 'O token expirou ou é inválido',
    'unable to process request': 'Não foi possível processar a solicitação',
    'something went wrong': 'Algo deu errado. Tente novamente',
    'failed to fetch': 'Falha ao buscar dados',
    'unauthorized': 'Não autorizado',
    'forbidden': 'Acesso proibido',
    'not found': 'Não encontrado',
    'bad request': 'Requisição inválida',
    'internal server error': 'Erro interno do servidor',
    'service unavailable': 'Serviço indisponível',
    'gateway timeout': 'Tempo limite excedido',
    'request timeout': 'Tempo limite da requisição',
    'connection error': 'Erro de conexão',
    'fetch error': 'Erro ao buscar dados',
    'network request failed': 'Falha na requisição de rede',
    'failed to load': 'Falha ao carregar',
    'error loading': 'Erro ao carregar',
    'unknown error': 'Erro desconhecido',
    'unexpected error': 'Erro inesperado',
  };
  
  // Verificar correspondência exata (case-insensitive)
  for (const [key, translation] of Object.entries(translations)) {
    if (errorLower === key || errorLower.includes(key)) {
      return translation;
    }
  }
  
  // Se não encontrou tradução, retornar a mensagem original
  return error;
}

// Processa links markdown [texto](url) em HTML com target="_blank"
export function processLinks(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  
  // Função auxiliar para escapar HTML
  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  // Regex para encontrar links markdown [texto](url)
  // Suporta URLs com ou sem protocolo, e espaços no texto
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  // Dividir o texto em partes: texto normal e links
  const parts: Array<{ type: 'text' | 'link'; content: string; linkText?: string; url?: string }> = [];
  let lastIndex = 0;
  let match;
  
  while ((match = linkRegex.exec(text)) !== null) {
    // Adicionar texto antes do link
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }
    
    // Adicionar o link
    const linkText = match[1];
    let url = match[2].trim();
    
    // Garantir que a URL tenha protocolo
    if (!url.match(/^https?:\/\//i)) {
      url = `https://${url}`;
    }
    
    parts.push({
      type: 'link',
      content: '',
      linkText,
      url,
    });
    
    lastIndex = linkRegex.lastIndex;
  }
  
  // Adicionar texto restante após o último link
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }
  
  // Se não encontrou nenhum link, retornar texto escapado
  if (parts.length === 0) {
    return escapeHtml(text);
  }
  
  // Montar HTML final
  return parts.map(part => {
    if (part.type === 'text') {
      return escapeHtml(part.content);
    } else {
      const escapedText = escapeHtml(part.linkText || '');
      const escapedUrl = escapeHtml(part.url || '');
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${escapedText}</a>`;
    }
  }).join('');
}