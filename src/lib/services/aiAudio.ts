import { authFetch } from '@/lib/auth-fetch';

export const requestGenerateAudio = async (payload: { text: string; voice_id: string }): Promise<{ ok: boolean; data?: any; error?: string; rawText?: string; status?: number; statusText?: string; headers?: Record<string,string> }> => {
  const response = await authFetch('/api/generate-audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data: any;
  let responseText = '';
  try {
    responseText = await response.text();
    data = responseText ? JSON.parse(responseText) : { error: 'Resposta vazia do servidor' };
  } catch (e: any) {
    data = { error: 'Erro ao fazer parse da resposta', rawResponse: responseText.substring(0, 500), parseError: e?.message || 'Erro desconhecido' };
  }

  if (!response.ok) {
    return { ok: false, data, error: data?.error || `Erro HTTP ${response.status}: ${response.statusText}`, rawText: responseText.substring(0, 500), status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()) };
  }

  return { ok: true, data, rawText: responseText.substring(0, 200), status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()) };
};

