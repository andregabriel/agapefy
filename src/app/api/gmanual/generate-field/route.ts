import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

type FieldKey = 'title' | 'subtitle' | 'description' | 'preparation' | 'text' | 'final_message';

const FIELD_TO_SETTING_KEY: Record<FieldKey, keyof any> = {
  title: 'gmanual_title_prompt',
  subtitle: 'gmanual_subtitle_prompt',
  description: 'gmanual_description_prompt',
  preparation: 'gmanual_preparation_prompt',
  text: 'gmanual_text_prompt',
  final_message: 'gmanual_final_message_prompt',
};

function applyPlaceholders(template: string, context: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = context[key];
    return typeof v === 'string' ? v : '';
  });
}

function sanitizeByField(field: FieldKey, text: string): string {
  let output = text.trim();
  // Remove cercas de código e aspas comuns
  output = output.replace(/^`{3,}[\s\S]*?`{3,}$/g, '').replace(/^['"“”‘’](.*)['"“”‘’]$/s, '$1').trim();

  const charLimit: Record<FieldKey, number | null> = {
    title: 60,
    subtitle: 100,
    description: 240,
    preparation: null,
    text: null,
    final_message: 240,
  };

  const limit = charLimit[field];
  if (typeof limit === 'number' && output.length > limit) {
    output = output.slice(0, limit).trim();
  }
  return output;
}

// Removidos prompts/sanitização automáticos: a resposta deve seguir APENAS o prompt definido pelo admin

export async function POST(request: NextRequest) {
  try {
    const { field, context } = await request.json();

    if (!field || !['title','subtitle','description','preparation','text','final_message'].includes(field)) {
      return NextResponse.json({ error: 'Campo inválido' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'Chave da API OpenAI não configurada' }, { status: 500 });
    }

    // Carregar template salvo em app_settings
    const admin = getAdminSupabase();
    const settingKey = FIELD_TO_SETTING_KEY[field as FieldKey] as string;
    const { data: settingRows, error: settingErr } = await admin
      .from('app_settings')
      .select('key,value')
      .eq('key', settingKey)
      .limit(1);

    if (settingErr) {
      return NextResponse.json({ error: 'Erro ao carregar prompt salvo' }, { status: 500 });
    }

    const template = (settingRows?.[0]?.value as string | undefined) || '';
    if (!template.trim()) {
      return NextResponse.json({ error: 'Prompt salvo está vazio para este campo' }, { status: 400 });
    }

    const rendered = applyPlaceholders(template, context || {});

    const candidateModels = ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
    const temperature = 1;
    const maxTokens = field === 'text' ? 900 : 250;

    let finalData: any = null;
    let finalModelUsed: string | null = null;
    let lastErrorText = '';

    for (const model of candidateModels) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: rendered },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (resp.ok) {
        finalData = await resp.json();
        finalModelUsed = finalData?.model || model;
        break;
      }

      // Read error and decide if we should try the next model
      const errText = await resp.text();
      lastErrorText = errText || `HTTP ${resp.status}`;

      // Retry for model-not-found/invalid; stop for auth/quota errors
      const lower = (errText || '').toLowerCase();
      const isModelIssue = resp.status === 404 || /model/.test(lower) && (/not found|does not exist|invalid/.test(lower));
      const isAuthOrQuota = resp.status === 401 || resp.status === 403 || resp.status === 429 || /insufficient_quota|invalid_api_key|permission/.test(lower);

      if (isAuthOrQuota) {
        break; // don't keep retrying on these
      }

      if (!isModelIssue) {
        // Unknown error; don't loop endlessly
        break;
      }
      // else try next candidate model
    }

    if (!finalData) {
      return NextResponse.json({ error: 'Erro na OpenAI', detail: lastErrorText }, { status: 500 });
    }

    const content: string = finalData?.choices?.[0]?.message?.content || '';
    return NextResponse.json({ content, model_used: finalModelUsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


