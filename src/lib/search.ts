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