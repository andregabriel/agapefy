import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ELEVENLABS_VOICES } from '@/constants/elevenlabsVoices';

type ReqBody = {
  title?: string;
  base_biblica?: string;
  tema_central?: string;
  category_id?: string;
  playlists?: string[];
  voice_id?: string;
  job_id?: string;
  created_by?: string;
};

type FieldKey = 'title' | 'subtitle' | 'description' | 'preparation' | 'text' | 'final_message' | 'image_prompt';

const FIELD_TO_SETTING_KEY: Record<FieldKey, string> = {
  title: 'gmanual_title_prompt',
  subtitle: 'gmanual_subtitle_prompt',
  description: 'gmanual_description_prompt',
  preparation: 'gmanual_preparation_prompt',
  text: 'gmanual_text_prompt',
  final_message: 'gmanual_final_message_prompt',
  image_prompt: 'gmanual_image_prompt_prompt',
};

function applyPlaceholders(template: string, context: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = context[key];
    return typeof v === 'string' ? v : '';
  });
}

async function generateField(field: FieldKey, context: Record<string, string>, candidateModels?: string[]): Promise<{ value: string; model?: string }> {
  const admin = getAdminSupabase();
  const settingKey = FIELD_TO_SETTING_KEY[field];
  const { data } = await admin.from('app_settings').select('key,value').eq('key', settingKey).limit(1);
  const rawValue = data?.[0]?.value as unknown;
  const templateStr = typeof rawValue === 'string' ? rawValue : (rawValue == null ? '' : String(rawValue));
  if (!templateStr.trim()) return { value: '' };

  const rendered = applyPlaceholders(templateStr, context || {});
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const models = (candidateModels && candidateModels.length > 0)
    ? candidateModels
    : ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
  const temperature = 1;
  const maxTokens = field === 'text' ? 900 : 250;

  for (const model of models) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: rendered }], temperature, max_tokens: maxTokens })
    });
    if (resp.ok) {
      const j = await resp.json();
      return { value: (j?.choices?.[0]?.message?.content || '').trim(), model };
    }
    const txt = (await resp.text()).toLowerCase();
    if (resp.status === 401 || resp.status === 403 || resp.status === 429) break;
    const isModelIssue = resp.status === 404 || (txt.includes('model') && (txt.includes('not found') || txt.includes('invalid')));
    if (!isModelIssue) break;
  }
  return { value: '' };
}

async function generateAudio(origin: string, text: string, voice_id?: string): Promise<{ url: string | null; voiceIdUsed: string | null; durationSeconds: number | null }> {
  try {
    const resp = await fetch(`${origin}/api/generate-audio`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && typeof data?.audio_url === 'string') {
      return {
        url: data.audio_url as string,
        voiceIdUsed: (data.voice_id_used as string) || null,
        durationSeconds: (typeof data.duration_seconds === 'number' ? data.duration_seconds as number : null)
      };
    }
  } catch (_) {}
  return { url: null, voiceIdUsed: null, durationSeconds: null };
}

async function generateImage(origin: string, prompt: string): Promise<string | null> {
  try {
    const attempt = async () => {
      const resp = await fetch(`${origin}/api/generate-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      let data: any = {};
      try { data = await resp.json(); } catch { data = {}; }
      if (resp.ok && typeof data?.image_url === 'string') return data.image_url as string;
      return null;
    };
    const first = await attempt();
    if (first) return first;
    // retry único
    return await attempt();
  } catch (_) { return null; }
}

async function ensurePlaylist(admin: any, title: string, categoryId?: string | null): Promise<string | null> {
  const needle = (title || '').toString().trim().toLowerCase();
  if (!needle) return null;
  const { data } = await admin.from('playlists').select('id,title,category_id').ilike('title', `%${title}%`);
  const rows: any[] = data || [];
  const exact = rows.find(r => (r.title || '').toString().trim().toLowerCase() === needle);
  if (exact?.id) return exact.id as string;
  const { data: created } = await admin.from('playlists').insert({ title, category_id: categoryId || null, is_public: true }).select().single();
  return created?.id || null;
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const body = await req.json() as ReqBody;
    const title = (body.title || '').trim();
    const base = (body.base_biblica || '').trim();
    const tema = (body.tema_central || '').trim();
    const categoryId = (body.category_id || '').trim();
    const playlists = Array.isArray(body.playlists) ? body.playlists.filter(s => typeof s === 'string' && s.trim()) : [];
    const voiceId = body.voice_id || '';

    if (!categoryId) return NextResponse.json({ ok: false, error: 'category_id obrigatório' }, { status: 400 });

    const admin = getAdminSupabase();
    // Buscar defaults relevantes em uma única query
    const { data: settingsRows } = await admin
      .from('app_settings')
      .select('key,value')
      .in('key', ['gmanual_default_voice_id', 'gmanual_default_ai_engine', 'gmanual_image_generate_template']);
    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { if (r?.key) settingsMap[r.key] = String(r.value ?? ''); });

    const preferredModel = (settingsMap['gmanual_default_ai_engine'] || '').trim();
    const modelCandidatesBase = ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
    const candidateModels = preferredModel ? [preferredModel, ...modelCandidatesBase.filter(m => m !== preferredModel)] : modelCandidatesBase;

  const defaultVoiceId = ((settingsMap['gmanual_default_voice_id'] || '').trim()) || '7i7dgyCkKt4c16dLtwT3';

    const ctxBase = { tema_central: tema, base_biblica: base } as Record<string,string>;
    // 1) texto
    const textRes = await generateField('text', ctxBase, candidateModels);
    const text = textRes.value;
    const modelUsed = textRes.model || null;
    if (!text.trim()) return NextResponse.json({ ok: false, error: 'Falha ao gerar texto' }, { status: 500 });

    const ctx = { ...ctxBase, texto: text };
    // 2) paralelos
    const [prepRes, finalMsgRes, genTitleRes, subtitleRes, descriptionRes, imagePromptRes] = await Promise.all([
      generateField('preparation', ctx, candidateModels),
      generateField('final_message', ctx, candidateModels),
      generateField('title', ctx, candidateModels),
      generateField('subtitle', ctx, candidateModels),
      generateField('description', ctx, candidateModels),
      generateField('image_prompt', ctx, candidateModels)
    ]);
    const prep = prepRes.value, finalMsg = finalMsgRes.value, genTitle = genTitleRes.value, subtitle = subtitleRes.value, description = descriptionRes.value, imagePrompt = imagePromptRes.value;

    // 3) áudio
    const audioText = [prep, text, finalMsg].filter(Boolean).join('\n\n');
    const chosenVoiceId = (voiceId || defaultVoiceId || undefined) as string | undefined;
    const audioGen = await generateAudio(origin, audioText, chosenVoiceId);
    const audioUrl = audioGen.url;
    const usedVoiceId = (voiceId || defaultVoiceId || audioGen.voiceIdUsed || null) as string | null;
    const usedVoiceName = usedVoiceId ? (ELEVENLABS_VOICES.find(v => v.id === usedVoiceId)?.name || null) : null;
    const durationSeconds = (typeof audioGen.durationSeconds === 'number' ? Math.round(audioGen.durationSeconds) : null);
    if (!audioUrl) return NextResponse.json({ ok: false, error: 'Falha ao gerar áudio' }, { status: 500 });

    // 4) imagem (tolerante a falha)
    let imageUrl: string | null = null;
    if (typeof imagePrompt === 'string' && imagePrompt.trim().length >= 20) {
      // Aplicar template de geração (mesma lógica do /admin/go)
      const templateRaw = (settingsMap['gmanual_image_generate_template'] || '{imagem_descricao}') as string;
      const templateCtx: Record<string,string> = {
        imagem_descricao: imagePrompt.trim(),
        titulo: (genTitle || title || ''),
        subtitulo: (subtitle || ''),
        descricao: (description || ''),
        preparacao: (prep || ''),
        texto: text,
        mensagem_final: (finalMsg || ''),
        tema_central: tema,
        base_biblica: base,
      };
      const compiledPrompt = templateRaw.replace(/\{([a-zA-Z_]+)\}/g, (_, k) => templateCtx[k] || '');
      const tmpUrl = await generateImage(origin, compiledPrompt);
      if (tmpUrl) {
        // Copiar para Storage para padronizar com /admin/go
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
          if (supabaseUrl && supabaseServiceKey) {
            const res = await fetch(tmpUrl);
            const buf = await res.arrayBuffer();
            const contentType = res.headers.get('content-type') || 'image/png';
            let ext = 'png';
            if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
            if (contentType.includes('webp')) ext = 'webp';
            const { createClient } = await import('@supabase/supabase-js');
            const s = createClient(supabaseUrl, supabaseServiceKey);
            const BUCKET = 'media';
            const PREFIX = 'app-26/images';
            const fileName = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: upErr } = await s.storage.from(BUCKET).upload(fileName, Buffer.from(buf), { contentType, cacheControl: '3600', upsert: false });
            if (!upErr) {
              const { data: pub } = s.storage.from(BUCKET).getPublicUrl(fileName);
              imageUrl = pub?.publicUrl || tmpUrl;
            } else {
              imageUrl = tmpUrl;
            }
          } else {
            imageUrl = tmpUrl; // sem credenciais, manter URL temporária
          }
        } catch {
          imageUrl = tmpUrl;
        }
      }
    }

    // 5) salvar
  const cookieStore = cookies();
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: auth } = await userClient.auth.getUser();
  const createdBy = (body.created_by && typeof body.created_by === 'string' && body.created_by.trim())
    ? body.created_by.trim()
    : (auth?.user?.id || null);
    const insertRes = await admin.from('audios').insert({
      title: title || genTitle || '',
      subtitle: subtitle || null,
      description: description || null,
      audio_url: audioUrl,
      transcript: audioText,
      duration: durationSeconds,
      category_id: categoryId,
      cover_url: imageUrl || null,
      created_by: createdBy,
      ai_engine: (preferredModel || 'gpt-5'),
      voice_id: usedVoiceId,
      voice_name: usedVoiceName,
      biblical_base: base || null,
    }).select().single();
    if (insertRes.error) return NextResponse.json({ ok: false, error: insertRes.error.message }, { status: 500 });
    const audioId = insertRes.data?.id as string;

    // 6) playlists
    for (const p of playlists) {
      const plId = await ensurePlaylist(admin, p, categoryId);
      if (plId) {
        const { error: paErr } = await admin
          .from('playlist_audios')
          .insert({ audio_id: audioId, playlist_id: plId });
        // Não falhar o job por erro de playlist; apenas continue
      }
    }

    return NextResponse.json({ ok: true, audio_id: audioId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro desconhecido' }, { status: 500 });
  }
}


