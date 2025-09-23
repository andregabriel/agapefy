import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getBookName } from '@/lib/search';

type HistoryItem = { verse_id: string; date: string };

const BOOKS: Array<{ code: string; chapters: number }> = [
  { code: 'GEN', chapters: 50 }, { code: 'EXO', chapters: 40 }, { code: 'LEV', chapters: 27 },
  { code: 'NUM', chapters: 36 }, { code: 'DEU', chapters: 34 }, { code: 'JOS', chapters: 24 },
  { code: 'JDG', chapters: 21 }, { code: 'RUT', chapters: 4 },  { code: '1SA', chapters: 31 },
  { code: '2SA', chapters: 24 }, { code: '1KI', chapters: 22 }, { code: '2KI', chapters: 25 },
  { code: '1CH', chapters: 29 }, { code: '2CH', chapters: 36 }, { code: 'EZR', chapters: 10 },
  { code: 'NEH', chapters: 13 }, { code: 'EST', chapters: 10 }, { code: 'JOB', chapters: 42 },
  { code: 'PSA', chapters: 150 },{ code: 'PRO', chapters: 31 }, { code: 'ECC', chapters: 12 },
  { code: 'SNG', chapters: 8 },  { code: 'ISA', chapters: 66 }, { code: 'JER', chapters: 52 },
  { code: 'LAM', chapters: 5 },  { code: 'EZE', chapters: 48 }, { code: 'DAN', chapters: 12 },
  { code: 'HOS', chapters: 14 }, { code: 'JOE', chapters: 3 },  { code: 'AMO', chapters: 9 },
  { code: 'OBA', chapters: 1 },  { code: 'JON', chapters: 4 },  { code: 'MIC', chapters: 7 },
  { code: 'NAM', chapters: 3 },  { code: 'HAB', chapters: 3 },  { code: 'ZEP', chapters: 3 },
  { code: 'HAG', chapters: 2 },  { code: 'ZEC', chapters: 14 }, { code: 'MAL', chapters: 4 },
  { code: 'MAT', chapters: 28 }, { code: 'MRK', chapters: 16 }, { code: 'LUK', chapters: 24 },
  { code: 'JHN', chapters: 21 }, { code: 'ACT', chapters: 28 }, { code: 'ROM', chapters: 16 },
  { code: '1CO', chapters: 16 }, { code: '2CO', chapters: 13 }, { code: 'GAL', chapters: 6 },
  { code: 'EPH', chapters: 6 },  { code: 'PHP', chapters: 4 },  { code: 'COL', chapters: 4 },
  { code: '1TH', chapters: 5 },  { code: '2TH', chapters: 3 },  { code: '1TI', chapters: 6 },
  { code: '2TI', chapters: 4 },  { code: 'TIT', chapters: 3 },  { code: 'PHM', chapters: 1 },
  { code: 'HEB', chapters: 13 }, { code: 'JAS', chapters: 5 },  { code: '1PE', chapters: 5 },
  { code: '2PE', chapters: 3 },  { code: '1JN', chapters: 5 },  { code: '2JN', chapters: 1 },
  { code: '3JN', chapters: 1 },  { code: 'JUD', chapters: 1 },  { code: 'REV', chapters: 22 }
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function within30Days(dateISO: string): boolean {
  const dt = new Date(dateISO);
  const diff = Date.now() - dt.getTime();
  return diff <= 30 * 24 * 60 * 60 * 1000;
}

function isLegible(text: string): boolean {
  const len = text.trim().length;
  if (len < 80 || len > 220) return false;
  const hardWords = ['circuncisão', 'holocausto', 'linhagem', 'exortação'];
  return !hardWords.some(w => text.toLowerCase().includes(w));
}

async function getSettingsMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data ?? [])) map[row.key] = row.value;
  return map;
}

async function setSetting(key: string, value: string) {
  await supabase.from('app_settings').upsert({ key, value, type: 'text' }, { onConflict: 'key' });
}

export async function POST(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === 'true';

  try {
    const settings = await getSettingsMap();

    const autoEnabled = (settings.prayer_quote_auto_enabled ?? 'true') === 'true';
    if (!autoEnabled && !force) {
      return NextResponse.json({ skipped: true, reason: 'auto_disabled' });
    }

    const history: HistoryItem[] = (() => {
      try { return JSON.parse(settings.prayer_quote_history ?? '[]'); } catch { return []; }
    })().filter(h => within30Days(h.date));
    
    // 1) Modo Frases (tabela phrases) – prioridade para automação diária
    //    Avança 1 registro/dia e faz wrap para o primeiro ao final
    const usePhrases = true; // ativado por padrão para automação baseada no banco
    if (usePhrases) {
      // Cursor salvo nas configurações (começa em 1)
      const cursor = Number.parseInt(settings.phrases_cursor || '1', 10) || 1;

      // Buscar registro atual (>= cursor)
      const { data: currentRows, error: currentErr } = await supabase
        .from('phrases')
        .select('id, livro, capitulo, versiculo, texto')
        .gte('id', cursor)
        .order('id', { ascending: true })
        .limit(1);

      if (!currentErr) {
        // Buscar também o primeiro registro para wrap e o próximo após o atual
        const [{ data: firstRows }, { data: nextRows }] = await Promise.all([
          supabase
            .from('phrases')
            .select('id')
            .order('id', { ascending: true })
            .limit(1),
          supabase
            .from('phrases')
            .select('id')
            .gt('id', cursor)
            .order('id', { ascending: true })
            .limit(1)
        ]);

        const current = (currentRows && currentRows[0]) || null;
        const firstId = firstRows && firstRows[0]?.id;
        const nextId = nextRows && nextRows[0]?.id;

        if (current) {
          const reference = `${getBookName(current.livro)} ${current.capitulo}:${current.versiculo}`;
          const text = (current.texto || '').trim();

          await Promise.all([
            setSetting('prayer_quote_text', text),
            setSetting('prayer_quote_reference', reference),
            setSetting('prayer_quote_last_updated_at', new Date().toISOString()),
            setSetting('phrases_cursor', String(nextId || firstId || current.id))
          ]);

          return NextResponse.json({ text, reference, mode: 'phrases', phrase_id: current.id });
        }
      }
      // Se a tabela não existir ou falhar, segue para IA/heurística
    }

    // 2) Modo IA (OpenAI) se habilitado
    const aiEnabled = (settings.prayer_quote_ai_enabled ?? 'false') === 'true';
    let chosen: any = null;

    if (aiEnabled) {
      try {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) throw new Error('OPENAI_API_KEY não configurada');

        const systemBase = settings.prayer_quote_ai_prompt_template || '';
        const systemPrompt = `${systemBase}\n\nFormato da resposta (JSON, sem comentários): {"book_code":"MAT","chapter":5,"verse":3,"rationale_pt":"..."}`;

        const recentList = history.map(h => h.verse_id);
        const userPrompt = `Últimos 30 versículos usados (não repetir): ${JSON.stringify(recentList)}. \n\nInstrução do admin: ${systemBase}\n\nDevolva somente 1 referência em JSON como especificado. Não devolva o texto do versículo.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 200
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content: string = data.choices?.[0]?.message?.content || '';
          try {
            const parsed = JSON.parse(content);
            const book = parsed.book_code;
            const chapter = String(parsed.chapter);
            const verseNum = String(parsed.verse);
            // Validar no Supabase
            const { data: verses } = await supabase
              .from('verses')
              .select('verse_id, verse_text, book, chapter, start_verse')
              .eq('book', book)
              .eq('chapter', chapter)
              .eq('start_verse', verseNum)
              .limit(1);
            if (verses && verses.length === 1 && !history.some(h => h.verse_id === verses[0].verse_id)) {
              chosen = verses[0];
              await setSetting('prayer_quote_ai_rationale', parsed.rationale_pt || '');
            }
          } catch { /* parse fail -> fallback abaixo */ }
        }
      } catch (e) {
        // Em qualquer erro, seguimos para fallback heurístico
      }
    }

    // Fallback heurístico (ou se IA desabilitada)
    if (!chosen) {
      for (let attempt = 0; attempt < 12 && !chosen; attempt++) {
        const b = pick(BOOKS);
        const chapter = 1 + Math.floor(Math.random() * b.chapters);
        const { data: verses } = await supabase
          .from('verses')
          .select('verse_id, verse_text, book, chapter, start_verse, end_verse')
          .eq('book', b.code)
          .eq('chapter', String(chapter));
        const candidates = (verses ?? [])
          .filter(v => isLegible(v.verse_text))
          .filter(v => !history.some(h => h.verse_id === v.verse_id));
        if (candidates.length > 0) chosen = pick(candidates);
      }
    }

    if (!chosen) {
      return NextResponse.json({ error: 'Nenhum versículo elegível encontrado' }, { status: 404 });
    }

    const reference = `${getBookName(chosen.book)} ${chosen.chapter}:${chosen.start_verse}`;
    const text = chosen.verse_text.trim();

    await Promise.all([
      setSetting('prayer_quote_text', text),
      setSetting('prayer_quote_reference', reference),
      setSetting('prayer_quote_last_verse_id', chosen.verse_id),
      setSetting('prayer_quote_last_updated_at', new Date().toISOString()),
      setSetting('prayer_quote_history', JSON.stringify(
        [{ verse_id: chosen.verse_id, date: new Date().toISOString() }, ...history].slice(0, 60)
      ))
    ]);

    return NextResponse.json({ text, reference, verse_id: chosen.verse_id, mode: aiEnabled ? 'ai' : 'heuristic' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro interno' }, { status: 500 });
  }
}


