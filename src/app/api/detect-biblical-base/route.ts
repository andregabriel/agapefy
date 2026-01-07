import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// Very lightweight detector: tries to find up to 3 references like "Livro 3:16" or "Livro 23"
function detectBiblicalRefs(text: string): string[] {
  const refRegex = /\b([1-3]?\s?[A-ZÁÂÃÀÉÊÍÓÔÕÚ][a-záâãàéêíóôõúç]+)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = refRegex.exec(text)) !== null) {
    const book = match[1];
    const chapter = match[2];
    const verse = match[3];
    const endVerse = match[4];
    let ref = `${book} ${chapter}`;
    if (verse) {
      ref += `:${verse}`;
      if (endVerse) ref += `-${endVerse}`;
    }
    if (!found.includes(ref)) found.push(ref);
    if (found.length >= 3) break;
  }
  return found;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 });
    }

    const refs = detectBiblicalRefs(text.trim());
    return NextResponse.json({ references: refs, joined: refs.join('; ') });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

