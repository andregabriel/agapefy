// CHANGELOG: Fase 8 – busca textual na Bíblia
import { supabase } from '@/lib/supabase';

export interface SearchResult {
  verse_id: string;
  book: string;
  chapter: string;
  start_verse: string;
  verse_text: string;
  snippet: string;
  highlighted_snippet: string;
}

// Mapear códigos de livros para nomes em português
const BOOK_NAMES: Record<string, string> = {
  'GEN': 'Gênesis',
  'EXO': 'Êxodo',
  'LEV': 'Levítico',
  'NUM': 'Números',
  'DEU': 'Deuteronômio',
  'JOS': 'Josué',
  'JDG': 'Juízes',
  'RUT': 'Rute',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Reis',
  '2KI': '2 Reis',
  '1CH': '1 Crônicas',
  '2CH': '2 Crônicas',
  'EZR': 'Esdras',
  'NEH': 'Neemias',
  'TOB': 'Tobias',
  'JDT': 'Judite',
  'EST': 'Ester',
  '1MA': '1 Macabeus',
  '2MA': '2 Macabeus',
  'JOB': 'Jó',
  'PSA': 'Salmos',
  'PRO': 'Provérbios',
  'ECC': 'Eclesiastes',
  'SNG': 'Cântico dos Cânticos',
  'WIS': 'Sabedoria',
  'SIR': 'Eclesiástico',
  'ISA': 'Isaías',
  'JER': 'Jeremias',
  'LAM': 'Lamentações',
  'BAR': 'Baruc',
  'EZK': 'Ezequiel',
  'DAN': 'Daniel',
  'HOS': 'Oseias',
  'JOL': 'Joel',
  'AMO': 'Amós',
  'OBA': 'Abdias',
  'JON': 'Jonas',
  'MIC': 'Miqueias',
  'NAH': 'Naum',
  'HAB': 'Habacuc',
  'ZEP': 'Sofonias',
  'HAG': 'Ageu',
  'ZEC': 'Zacarias',
  'MAL': 'Malaquias',
  'MAT': 'Mateus',
  'MRK': 'Marcos',
  'LUK': 'Lucas',
  'JHN': 'João',
  'ACT': 'Atos',
  'ROM': 'Romanos',
  '1CO': '1 Coríntios',
  '2CO': '2 Coríntios',
  'GAL': 'Gálatas',
  'EPH': 'Efésios',
  'PHP': 'Filipenses',
  'COL': 'Colossenses',
  '1TH': '1 Tessalonicenses',
  '2TH': '2 Tessalonicenses',
  '1TI': '1 Timóteo',
  '2TI': '2 Timóteo',
  'TIT': 'Tito',
  'PHM': 'Filemom',
  'HEB': 'Hebreus',
  'JAS': 'Tiago',
  '1PE': '1 Pedro',
  '2PE': '2 Pedro',
  '1JN': '1 João',
  '2JN': '2 João',
  '3JN': '3 João',
  'JUD': 'Judas',
  'REV': 'Apocalipse'
};

// Criar snippet com highlight
function createSnippet(text: string, query: string, maxLength: number = 120): { snippet: string; highlighted_snippet: string } {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Encontrar posição da primeira ocorrência
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) {
    // Se não encontrou, retornar início do texto
    const snippet = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    return {
      snippet,
      highlighted_snippet: snippet
    };
  }
  
  // Calcular posição do snippet centrado na palavra encontrada
  const queryLength = query.length;
  const halfLength = Math.floor((maxLength - queryLength) / 2);
  
  let start = Math.max(0, index - halfLength);
  let end = Math.min(text.length, start + maxLength);
  
  // Ajustar início se o fim ultrapassou
  if (end - start < maxLength && start > 0) {
    start = Math.max(0, end - maxLength);
  }
  
  // Criar snippet
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  // Criar versão com highlight
  const highlighted_snippet = snippet.replace(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
    '<mark>$1</mark>'
  );
  
  return { snippet, highlighted_snippet };
}

export async function searchVerses(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  const trimmedQuery = query.trim();
  
  try {
    // Tentar busca full-text primeiro (to_tsvector)
    let { data, error } = await supabase
      .from('verses')
      .select('verse_id, book, chapter, start_verse, verse_text')
      .textSearch('verse_text', trimmedQuery, {
        type: 'websearch',
        config: 'portuguese'
      })
      .limit(50);
    
    // Se full-text falhar, usar ilike como fallback
    if (error || !data || data.length === 0) {
      console.log('[search] Full-text search failed or no results, trying ilike fallback');
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('verses')
        .select('verse_id, book, chapter, start_verse, verse_text')
        .ilike('verse_text', `%${trimmedQuery}%`)
        .limit(50);
      
      if (fallbackError) {
        console.error('[search] Fallback search error:', fallbackError);
        throw fallbackError;
      }
      
      data = fallbackData;
    }
    
    if (!data) {
      return [];
    }
    
    // Processar resultados
    const results: SearchResult[] = data.map((verse) => {
      const bookName = BOOK_NAMES[verse.book] || verse.book;
      const { snippet, highlighted_snippet } = createSnippet(verse.verse_text, trimmedQuery);
      
      return {
        verse_id: verse.verse_id,
        book: verse.book,
        chapter: verse.chapter,
        start_verse: verse.start_verse,
        verse_text: verse.verse_text,
        snippet,
        highlighted_snippet
      };
    });
    
    console.log(`[search] Found ${results.length} results for "${trimmedQuery}"`);
    return results;
    
  } catch (error) {
    console.error('[search] Search error:', error);
    throw new Error('Erro ao buscar na Bíblia. Tente novamente.');
  }
}

// Obter nome do livro em português
export function getBookName(bookCode: string): string {
  return BOOK_NAMES[bookCode] || bookCode;
}

// ===== Unified Bible search (books, references and text) =====

type ParsedReference = {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
};

// PT-BR aliases for book names (normalized, accents removed, lowercase, no extra spaces)
// Note: This mirrors the mapping used in the reference modal to keep behavior consistent.
const BOOK_ALIASES: Record<string, string> = {
  // Antigo Testamento
  'gn': 'GEN', 'gen': 'GEN', 'geneses': 'GEN', 'genesis': 'GEN', 'gênesis': 'GEN', 'genesis': 'GEN',
  'ex': 'EXO', 'exodo': 'EXO', 'êxodo': 'EXO', 'exo': 'EXO',
  'lv': 'LEV', 'lev': 'LEV', 'levitico': 'LEV', 'levítico': 'LEV',
  'nm': 'NUM', 'num': 'NUM', 'numeros': 'NUM', 'números': 'NUM',
  'dt': 'DEU', 'deu': 'DEU', 'deuteronomio': 'DEU', 'deuteronômio': 'DEU',
  'js': 'JOS', 'jos': 'JOS', 'josue': 'JOS', 'josué': 'JOS',
  'jz': 'JDG', 'jdg': 'JDG', 'juizes': 'JDG', 'juízes': 'JDG',
  'rt': 'RUT', 'rut': 'RUT', 'rute': 'RUT',
  '1sm': '1SA', '1smuel': '1SA', '1samuel': '1SA', '1 sm': '1SA',
  '2sm': '2SA', '2smuel': '2SA', '2samuel': '2SA', '2 sm': '2SA',
  '1rs': '1KI', '1reis': '1KI', '1 rs': '1KI',
  '2rs': '2KI', '2reis': '2KI', '2 rs': '2KI',
  '1cr': '1CH', '1cronicas': '1CH', '1 cr': '1CH',
  '2cr': '2CH', '2cronicas': '2CH', '2 cr': '2CH',
  'ed': 'EZR', 'esd': 'EZR', 'esdras': 'EZR',
  'ne': 'NEH', 'neemias': 'NEH',
  'tb': 'TOB', 'tobias': 'TOB',
  'jt': 'JDT', 'jdt': 'JDT', 'judite': 'JDT',
  'et': 'EST', 'est': 'EST', 'ester': 'EST',
  '1mc': '1MA', '1macabeus': '1MA', '1 mc': '1MA',
  '2mc': '2MA', '2macabeus': '2MA', '2 mc': '2MA',
  'jo': 'JOB', 'jó': 'JOB', 'job': 'JOB',
  'sl': 'PSA', 'sal': 'PSA', 'salmos': 'PSA', 'salmo': 'PSA',
  'pv': 'PRO', 'pro': 'PRO', 'proverbios': 'PRO', 'provérbios': 'PRO',
  'ec': 'ECC', 'ecl': 'ECC', 'eclesiastes': 'ECC',
  'ct': 'SNG', 'cnt': 'SNG', 'canticos': 'SNG', 'cânticos': 'SNG',
  'sb': 'WIS', 'sab': 'WIS', 'sabedoria': 'WIS',
  'sr': 'SIR', 'sir': 'SIR', 'eclesiastico': 'SIR', 'eclesiástico': 'SIR',
  'is': 'ISA', 'isaias': 'ISA', 'isaías': 'ISA',
  'jr': 'JER', 'jeremias': 'JER',
  'lm': 'LAM', 'lamentacoes': 'LAM', 'lamentações': 'LAM',
  'br': 'BAR', 'baruc': 'BAR',
  'ez': 'EZK', 'ezequiel': 'EZK',
  'dn': 'DAN', 'daniel': 'DAN',
  'os': 'HOS', 'oseias': 'HOS', 'oseias': 'HOS',
  'jl': 'JOL', 'joel': 'JOL',
  'am': 'AMO', 'amos': 'AMO', 'amós': 'AMO',
  'ob': 'OBA', 'abdias': 'OBA',
  'jn': 'JON', 'jonas': 'JON',
  'mq': 'MIC', 'miqueias': 'MIC',
  'na': 'NAH', 'naum': 'NAH',
  'hc': 'HAB', 'habacuc': 'HAB',
  'sf': 'ZEP', 'sofonias': 'ZEP',
  'ag': 'HAG', 'ageu': 'HAG',
  'zc': 'ZEC', 'zacarias': 'ZEC',
  'ml': 'MAL', 'malaquias': 'MAL',
  // Novo Testamento
  'mt': 'MAT', 'mateus': 'MAT',
  'mc': 'MRK', 'marcos': 'MRK',
  'lc': 'LUK', 'lucas': 'LUK',
  'joao': 'JHN', 'joão': 'JHN', 'jo': 'JHN',
  'at': 'ACT', 'atos': 'ACT',
  'rm': 'ROM', 'romanos': 'ROM',
  '1co': '1CO', '1co rintios': '1CO', '1corintios': '1CO', '1 corintios': '1CO', '1 coríntios': '1CO',
  '2co': '2CO', '2corintios': '2CO', '2 corintios': '2CO', '2 coríntios': '2CO',
  'gl': 'GAL', 'galatas': 'GAL', 'gálatas': 'GAL',
  'ef': 'EPH', 'efesios': 'EPH', 'efésios': 'EPH',
  'fp': 'PHP', 'filipenses': 'PHP', 'fl': 'PHP',
  'cl': 'COL', 'colossenses': 'COL',
  '1ts': '1TH', '1tessalonicenses': '1TH',
  '2ts': '2TH', '2tessalonicenses': '2TH',
  '1tm': '1TI', '1timoteo': '1TI', '1 timoteo': '1TI', '1 timóteo': '1TI',
  '2tm': '2TI', '2timoteo': '2TI', '2 timoteo': '2TI', '2 timóteo': '2TI',
  'tt': 'TIT', 'tito': 'TIT',
  'fm': 'PHM', 'filemom': 'PHM',
  'hb': 'HEB', 'hebreus': 'HEB',
  'tg': 'JAS', 'tiago': 'JAS',
  '1pe': '1PE', '1pedro': '1PE',
  '2pe': '2PE', '2pedro': '2PE',
  '1jo': '1JN', '1 jo': '1JN', '1joao': '1JN', '1 joao': '1JN', '1 joão': '1JN',
  '2jo': '2JN', '2 jo': '2JN', '2joao': '2JN', '2 joao': '2JN', '2 joão': '2JN',
  '3jo': '3JN', '3 jo': '3JN', '3joao': '3JN', '3 joao': '3JN', '3 joão': '3JN',
  'jd': 'JUD', 'judas': 'JUD',
  'ap': 'REV', 'apocalipse': 'REV'
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveBookCode(bookPartRaw: string): string | null {
  const key = normalize(bookPartRaw).replace(/\s+/g, '');
  if (BOOK_ALIASES[key]) return BOOK_ALIASES[key];

  // Try matching against full book names
  const normalizedInput = normalize(bookPartRaw);
  for (const [code, name] of Object.entries(BOOK_NAMES)) {
    const n = normalize(name);
    if (n === normalizedInput || n.includes(normalizedInput) || normalizedInput.includes(n)) {
      return code;
    }
  }
  return null;
}

function parseReferenceQuery(input: string): ParsedReference | null {
  const n = normalize(input);
  // [book] [chapter][:verse[-verse]]
  const match = n.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) return null;

  const [, bookPart, chapterStr, verseStartStr, verseEndStr] = match;
  const code = resolveBookCode(bookPart);
  if (!code) return null;

  const chapter = parseInt(chapterStr, 10);
  if (isNaN(chapter) || chapter < 1) return null;

  let verseStart: number | undefined;
  let verseEnd: number | undefined;
  if (verseStartStr) {
    verseStart = parseInt(verseStartStr, 10);
    if (isNaN(verseStart) || verseStart < 1) return null;
    if (verseEndStr) {
      verseEnd = parseInt(verseEndStr, 10);
      if (isNaN(verseEnd) || verseEnd < verseStart) return null;
    }
  }
  return { book: code, chapter, verseStart, verseEnd };
}

function parseBookOnly(input: string): { book: string } | null {
  const code = resolveBookCode(input);
  return code ? { book: code } : null;
}

export async function searchBible(query: string): Promise<SearchResult[]> {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];

  const results: SearchResult[] = [];

  // 1) Try reference parsing
  const ref = parseReferenceQuery(trimmed);
  if (ref) {
    const verseForNav = ref.verseStart ?? 1;
    const label = `${getBookName(ref.book)} ${ref.chapter}:${verseForNav}`;
    const verseId = `ref:${ref.book}:${ref.chapter}:${verseForNav}`;

    // Synthetic result to allow clicking and navigating
    results.push({
      verse_id: verseId,
      book: ref.book,
      chapter: String(ref.chapter),
      start_verse: String(verseForNav),
      verse_text: label,
      snippet: label,
      highlighted_snippet: `<strong>${label}</strong>`
    });

    // We prioritize the reference; do not run text search to avoid noise
    return results;
  }

  // 2) Try book-only parsing
  const bookOnly = parseBookOnly(trimmed);
  if (bookOnly) {
    const label = `Abrir ${getBookName(bookOnly.book)}`;
    const verseId = `book:${bookOnly.book}:1:1`;
    results.push({
      verse_id: verseId,
      book: bookOnly.book,
      chapter: '1',
      start_verse: '1',
      verse_text: label,
      snippet: label,
      highlighted_snippet: `<strong>${label}</strong>`
    });

    // We still return textual results if any exist for the query term
    const textHits = await searchVerses(trimmed);
    return [...results, ...textHits];
  }

  // 3) Fallback to plain text search (current behavior)
  return searchVerses(trimmed);
}