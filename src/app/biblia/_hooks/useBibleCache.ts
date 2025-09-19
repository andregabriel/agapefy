"use client";

import { useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Verse {
  n: number;
  text: string;
}

interface CachedChapter {
  verses: Verse[];
  timestamp: number;
}

// Logs condicionais para desenvolvimento
const isDev = process.env.NODE_ENV === 'development';
const devLog = (category: string, ...args: any[]) => {
  if (isDev) {
    console.log(`[biblia:${category}]`, ...args);
  }
};

const devError = (category: string, ...args: any[]) => {
  if (isDev) {
    console.error(`[biblia:${category}]`, ...args);
  } else {
    console.warn('Erro na aplicação bíblica');
  }
};

// Lista completa de livros da Bíblia
const BOOKS = [
  { code: 'GEN', name: 'Gênesis', chapters: 50 },
  { code: 'EXO', name: 'Êxodo', chapters: 40 },
  { code: 'LEV', name: 'Levítico', chapters: 27 },
  { code: 'NUM', name: 'Números', chapters: 36 },
  { code: 'DEU', name: 'Deuteronômio', chapters: 34 },
  { code: 'JOS', name: 'Josué', chapters: 24 },
  { code: 'JDG', name: 'Juízes', chapters: 21 },
  { code: 'RUT', name: 'Rute', chapters: 4 },
  { code: '1SA', name: '1 Samuel', chapters: 31 },
  { code: '2SA', name: '2 Samuel', chapters: 24 },
  { code: '1KI', name: '1 Reis', chapters: 22 },
  { code: '2KI', name: '2 Reis', chapters: 25 },
  { code: '1CH', name: '1 Crônicas', chapters: 29 },
  { code: '2CH', name: '2 Crônicas', chapters: 36 },
  { code: 'EZR', name: 'Esdras', chapters: 10 },
  { code: 'NEH', name: 'Neemias', chapters: 13 },
  { code: 'TOB', name: 'Tobias', chapters: 14 },
  { code: 'JDT', name: 'Judite', chapters: 16 },
  { code: 'EST', name: 'Ester', chapters: 10 },
  { code: '1MA', name: '1 Macabeus', chapters: 16 },
  { code: '2MA', name: '2 Macabeus', chapters: 15 },
  { code: 'JOB', name: 'Jó', chapters: 42 },
  { code: 'PSA', name: 'Salmos', chapters: 150 },
  { code: 'PRO', name: 'Provérbios', chapters: 31 },
  { code: 'ECC', name: 'Eclesiastes', chapters: 12 },
  { code: 'SNG', name: 'Cântico dos Cânticos', chapters: 8 },
  { code: 'WIS', name: 'Sabedoria', chapters: 19 },
  { code: 'SIR', name: 'Eclesiástico', chapters: 51 },
  { code: 'ISA', name: 'Isaías', chapters: 66 },
  { code: 'JER', name: 'Jeremias', chapters: 52 },
  { code: 'LAM', name: 'Lamentações', chapters: 5 },
  { code: 'BAR', name: 'Baruc', chapters: 6 },
  { code: 'EZK', name: 'Ezequiel', chapters: 48 },
  { code: 'DAN', name: 'Daniel', chapters: 14 },
  { code: 'HOS', name: 'Oseias', chapters: 14 },
  { code: 'JOL', name: 'Joel', chapters: 3 },
  { code: 'AMO', name: 'Amós', chapters: 9 },
  { code: 'OBA', name: 'Abdias', chapters: 1 },
  { code: 'JON', name: 'Jonas', chapters: 4 },
  { code: 'MIC', name: 'Miqueias', chapters: 7 },
  { code: 'NAH', name: 'Naum', chapters: 3 },
  { code: 'HAB', name: 'Habacuc', chapters: 3 },
  { code: 'ZEP', name: 'Sofonias', chapters: 3 },
  { code: 'HAG', name: 'Ageu', chapters: 2 },
  { code: 'ZEC', name: 'Zacarias', chapters: 14 },
  { code: 'MAL', name: 'Malaquias', chapters: 4 },
  { code: 'MAT', name: 'Mateus', chapters: 28 },
  { code: 'MRK', name: 'Marcos', chapters: 16 },
  { code: 'LUK', name: 'Lucas', chapters: 24 },
  { code: 'JHN', name: 'João', chapters: 21 },
  { code: 'ACT', name: 'Atos', chapters: 28 },
  { code: 'ROM', name: 'Romanos', chapters: 16 },
  { code: '1CO', name: '1 Coríntios', chapters: 16 },
  { code: '2CO', name: '2 Coríntios', chapters: 13 },
  { code: 'GAL', name: 'Gálatas', chapters: 6 },
  { code: 'EPH', name: 'Efésios', chapters: 6 },
  { code: 'PHP', name: 'Filipenses', chapters: 4 },
  { code: 'COL', name: 'Colossenses', chapters: 4 },
  { code: '1TH', name: '1 Tessalonicenses', chapters: 5 },
  { code: '2TH', name: '2 Tessalonicenses', chapters: 3 },
  { code: '1TI', name: '1 Timóteo', chapters: 6 },
  { code: '2TI', name: '2 Timóteo', chapters: 4 },
  { code: 'TIT', name: 'Tito', chapters: 3 },
  { code: 'PHM', name: 'Filemom', chapters: 1 },
  { code: 'HEB', name: 'Hebreus', chapters: 13 },
  { code: 'JAS', name: 'Tiago', chapters: 5 },
  { code: '1PE', name: '1 Pedro', chapters: 5 },
  { code: '2PE', name: '2 Pedro', chapters: 3 },
  { code: '1JN', name: '1 João', chapters: 5 },
  { code: '2JN', name: '2 João', chapters: 1 },
  { code: '3JN', name: '3 João', chapters: 1 },
  { code: 'JUD', name: 'Judas', chapters: 1 },
  { code: 'REV', name: 'Apocalipse', chapters: 22 }
];

// Implementação real usando Supabase
async function getChapter(book: string, chapter: number): Promise<{ verses: Verse[] }> {
  try {
    devLog('supabase', `Loading ${book} chapter ${chapter}`);
    
    const { data, error } = await supabase
      .from('verses')
      .select('start_verse, verse_text')
      .eq('book', book)
      .eq('chapter', chapter.toString())
      .order('start_verse', { ascending: true });

    if (error) {
      devError('supabase', 'Query error:', error);
      throw new Error('Falha ao carregar capítulo');
    }

    if (!data || data.length === 0) {
      devLog('supabase', `No verses found for ${book} ${chapter}`);
      return { verses: [] };
    }

    const verses: Verse[] = data
      .map((row) => ({
        n: parseInt(row.start_verse, 10),
        text: row.verse_text
      }))
      .sort((a, b) => a.n - b.n);

    devLog('supabase', `Loaded ${verses.length} verses for ${book} ${chapter}`);
    return { verses };

  } catch (err) {
    devError('supabase', 'getChapter error:', err);
    throw new Error('Falha ao carregar capítulo');
  }
}

export function useBibleCache() {
  // Cache LRU e controle de prefetch
  const chapterCache = useRef<Map<string, CachedChapter>>(new Map());
  const prefetchControllers = useRef<Map<string, AbortController>>(new Map());
  const currentBookRef = useRef<string>('');
  const MAX_CACHE_SIZE = 5;

  // Gerar chave do cache
  const getCacheKey = useCallback((bookCode: string, chapterNum: number) => 
    `${bookCode}:${chapterNum}`, []);

  // Marcar item como recentemente usado
  const markAsRecentlyUsed = useCallback((key: string) => {
    const cache = chapterCache.current;
    if (cache.has(key)) {
      const value = cache.get(key)!;
      cache.delete(key);
      cache.set(key, value);
      devLog('lru', 'marked as recent', key);
    }
  }, []);

  // Eviction LRU
  const evictLRU = useCallback(() => {
    const cache = chapterCache.current;
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
        devLog('lru', 'evicted', oldestKey, 'cache size:', cache.size);
      }
    }
  }, []);

  // Adicionar ao cache com política LRU
  const addToCache = useCallback((key: string, data: CachedChapter) => {
    const cache = chapterCache.current;
    
    if (cache.has(key)) {
      cache.delete(key);
    } else {
      evictLRU();
    }
    
    cache.set(key, data);
    devLog('lru', 'added', key, 'cache size:', cache.size);
  }, [evictLRU]);

  // Cancelar prefetches pendentes
  const cancelPendingPrefetches = useCallback(() => {
    prefetchControllers.current.forEach((controller, key) => {
      controller.abort();
      devLog('prefetch', 'cancelled', key);
    });
    prefetchControllers.current.clear();
  }, []);

  // Limpar cache completamente
  const clearCache = useCallback(() => {
    const cacheSize = chapterCache.current.size;
    chapterCache.current.clear();
    devLog('lru', 'cleared cache', cacheSize, 'entries');
  }, []);

  // Prefetch de um capítulo específico
  const prefetchChapter = useCallback(async (bookCode: string, chapterNum: number) => {
    const cacheKey = getCacheKey(bookCode, chapterNum);
    
    if (chapterCache.current.has(cacheKey)) {
      devLog('prefetch', 'already cached', cacheKey);
      markAsRecentlyUsed(cacheKey);
      return;
    }

    if (prefetchControllers.current.has(cacheKey)) {
      devLog('prefetch', 'already in progress', cacheKey);
      return;
    }

    const controller = new AbortController();
    prefetchControllers.current.set(cacheKey, controller);

    try {
      devLog('prefetch', 'starting', cacheKey);
      const data = await getChapter(bookCode, chapterNum);
      
      if (!controller.signal.aborted && currentBookRef.current === bookCode) {
        addToCache(cacheKey, {
          verses: data.verses,
          timestamp: Date.now()
        });
        devLog('prefetch', 'completed', cacheKey);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        devError('prefetch', 'error', cacheKey, err);
      }
    } finally {
      prefetchControllers.current.delete(cacheKey);
    }
  }, [getCacheKey, markAsRecentlyUsed, addToCache]);

  // Prefetch de capítulos vizinhos
  const prefetchNeighbors = useCallback((bookCode: string, chapterNum: number) => {
    const currentBookData = BOOKS.find(b => b.code === bookCode);
    if (!currentBookData) return;

    if (chapterNum > 1) {
      prefetchChapter(bookCode, chapterNum - 1);
    }

    if (chapterNum < currentBookData.chapters) {
      prefetchChapter(bookCode, chapterNum + 1);
    }
  }, [prefetchChapter]);

  // Carregar capítulo (com cache LRU)
  const loadChapter = useCallback(async (bookCode: string, chapterNum: number) => {
    const cacheKey = getCacheKey(bookCode, chapterNum);
    const cached = chapterCache.current.get(cacheKey);
    
    if (cached) {
      devLog('lru', 'cache hit', cacheKey);
      markAsRecentlyUsed(cacheKey);
      return cached.verses;
    } else {
      devLog('lru', 'cache miss', cacheKey);
      const data = await getChapter(bookCode, chapterNum);
      
      addToCache(cacheKey, {
        verses: data.verses,
        timestamp: Date.now()
      });
      
      return data.verses;
    }
  }, [getCacheKey, markAsRecentlyUsed, addToCache]);

  // Atualizar livro atual
  const setCurrentBook = useCallback((bookCode: string) => {
    if (bookCode !== currentBookRef.current) {
      cancelPendingPrefetches();
      clearCache();
      currentBookRef.current = bookCode;
    }
  }, [cancelPendingPrefetches, clearCache]);

  return {
    loadChapter,
    prefetchNeighbors,
    setCurrentBook,
    cancelPendingPrefetches,
    clearCache
  };
}