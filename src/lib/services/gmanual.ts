export const generateField = async (
  field: 'title'|'subtitle'|'description'|'preparation'|'text'|'final_message'|'image_prompt',
  context: Record<string, any>
): Promise<{ ok: boolean; content?: string; error?: string }> => {
  const res = await fetch('/api/gmanual/generate-field', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, context })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Falha ao gerar' };
  }
  return { ok: true, content: data?.content || '' };
};


