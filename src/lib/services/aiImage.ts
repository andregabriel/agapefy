export const requestGenerateImage = async (payload: { prompt: string }): Promise<{ ok: boolean; data?: any; error?: string; rawText?: string; status?: number; headers?: Record<string,string> }> => {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let responseData: any;
  let responseText = '';
  try {
    responseText = await response.text();
    responseData = responseText ? JSON.parse(responseText) : { error: 'Resposta vazia do servidor' };
  } catch (e: any) {
    responseData = { error: 'Erro ao fazer parse da resposta', rawResponse: responseText, parseError: e?.message || 'Erro desconhecido' };
  }

  if (!response.ok) {
    return { ok: false, data: responseData, error: responseData?.error || `Erro HTTP ${response.status}`, rawText: responseText, status: response.status, headers: Object.fromEntries(response.headers.entries()) };
  }

  return { ok: true, data: responseData, rawText: responseText, status: response.status, headers: Object.fromEntries(response.headers.entries()) };
};


