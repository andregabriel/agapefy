"use client";

import { useState, useCallback, useEffect } from 'react';
import { useBiblePreferences } from '@/hooks/useBiblePreferences';

interface LastRead {
  book: string;
  chapter: number;
  verse: number;
}

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

// Logs condicionais
const isDev = process.env.NODE_ENV === 'development';
const devLog = (category: string, ...args: any[]) => {
  if (isDev) {
    console.log(`[biblia:${category}]`, ...args);
  }
};

const devError = (category: string, ...args: any[]) => {
  if (isDev) {
    console.error(`[biblia:${category}]`, ...args);
  }
};

// Função para extrair estado inicial
function getInitialState(preferences: { last_read_book?: string | null; last_read_chapter?: number | null; last_read_verse?: number | null } | null): { book: string; chapter: number; verse: number | null } {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const livroParam = urlParams.get('livro');
    const capituloParam = urlParams.get('capitulo');
    const versiculoParam = urlParams.get('versiculo');
    
    if (livroParam && capituloParam) {
      const chapter = parseInt(capituloParam, 10);
      const verse = versiculoParam ? parseInt(versiculoParam, 10) : null;
      
      if (!isNaN(chapter) && chapter > 0) {
        devLog('init', 'Using query params:', { book: livroParam, chapter, verse });
        return { book: livroParam, chapter, verse };
      }
    }
    
    // Prioridade: Supabase > localStorage > default
    if (preferences?.last_read_book && preferences?.last_read_chapter && preferences?.last_read_verse) {
      devLog('init', 'Using Supabase preferences:', preferences);
      return {
        book: preferences.last_read_book,
        chapter: preferences.last_read_chapter,
        verse: preferences.last_read_verse
      };
    }
    
    try {
      const savedLastRead = localStorage.getItem('biblia_last_read');
      if (savedLastRead) {
        const lastReadData: LastRead = JSON.parse(savedLastRead);
        devLog('init', 'Using localStorage:', lastReadData);
        return { 
          book: lastReadData.book, 
          chapter: lastReadData.chapter, 
          verse: lastReadData.verse 
        };
      }
    } catch (err) {
      devError('init', 'Failed to parse localStorage:', err);
    }
  }
  
  devLog('init', 'Using default: Gênesis 1');
  return { book: 'GEN', chapter: 1, verse: null };
}

export function useBibleNavigation() {
  const { preferences, saveLastRead: saveLastReadToSupabase, loading: preferencesLoading } = useBiblePreferences();
  const [book, setBook] = useState<string>('GEN');
  const [chapter, setChapter] = useState<number>(1);
  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Obter informações do livro atual
  const currentBook = BOOKS.find(b => b.code === book);
  const bookName = currentBook?.name || 'Gênesis';
  const maxChapters = currentBook?.chapters || 50;

  // Inicializar quando as preferências forem carregadas
  useEffect(() => {
    if (!isInitialized && !preferencesLoading) {
      const initialState = getInitialState(preferences);
      setBook(initialState.book);
      setChapter(initialState.chapter);
      
      // Carregar lastRead das preferências ou localStorage
      if (preferences?.last_read_book && preferences?.last_read_chapter && preferences?.last_read_verse) {
        setLastRead({
          book: preferences.last_read_book,
          chapter: preferences.last_read_chapter,
          verse: preferences.last_read_verse
        });
      } else if (typeof window !== "undefined") {
        try {
          const savedLastRead = localStorage.getItem('biblia_last_read');
          if (savedLastRead) {
            const lastReadData: LastRead = JSON.parse(savedLastRead);
            setLastRead(lastReadData);
          }
        } catch (err) {
          devError('init', 'Failed to parse localStorage:', err);
        }
      }
      
      setIsInitialized(true);
    }
  }, [preferences, preferencesLoading, isInitialized]);

  // Salvar última leitura (localStorage + Supabase)
  const saveLastRead = useCallback(async (bookCode: string, chapterNum: number, verseNum: number) => {
    const newLastRead: LastRead = {
      book: bookCode,
      chapter: chapterNum,
      verse: verseNum
    };
    
    setLastRead(newLastRead);
    devLog('storage', 'Saving last read:', newLastRead);
    
    // Salvar no Supabase (que também salva no localStorage como cache)
    await saveLastReadToSupabase(bookCode, chapterNum, verseNum);
  }, [saveLastReadToSupabase]);

  // Navegar para capítulo específico
  const navigateToChapter = useCallback((newBook: string, newChapter: number, targetVerseNum?: number) => {
    setBook(newBook);
    setChapter(newChapter);
    
    // Salvar progresso (async, mas não bloqueia navegação)
    void saveLastRead(newBook, newChapter, targetVerseNum || 1);
    
    return { book: newBook, chapter: newChapter, verse: targetVerseNum || null };
  }, [saveLastRead]);

  // Navegar para capítulo anterior
  const goToPreviousChapter = useCallback(() => {
    if (chapter > 1) {
      return navigateToChapter(book, chapter - 1);
    } else {
      const currentBookIndex = BOOKS.findIndex(b => b.code === book);
      if (currentBookIndex > 0) {
        const previousBook = BOOKS[currentBookIndex - 1];
        return navigateToChapter(previousBook.code, previousBook.chapters);
      }
    }
    return null;
  }, [book, chapter, navigateToChapter]);

  // Navegar para próximo capítulo
  const goToNextChapter = useCallback(() => {
    if (chapter < maxChapters) {
      return navigateToChapter(book, chapter + 1);
    } else {
      const currentBookIndex = BOOKS.findIndex(b => b.code === book);
      if (currentBookIndex < BOOKS.length - 1) {
        const nextBook = BOOKS[currentBookIndex + 1];
        return navigateToChapter(nextBook.code, 1);
      }
    }
    return null;
  }, [book, chapter, maxChapters, navigateToChapter]);

  // Verificar se pode navegar
  const canGoToPrevious = useCallback(() => {
    if (chapter > 1) return true;
    const currentBookIndex = BOOKS.findIndex(b => b.code === book);
    return currentBookIndex > 0;
  }, [book, chapter]);

  const canGoToNext = useCallback(() => {
    if (chapter < maxChapters) return true;
    const currentBookIndex = BOOKS.findIndex(b => b.code === book);
    return currentBookIndex < BOOKS.length - 1;
  }, [book, chapter, maxChapters]);

  // Inicialização (mantida para compatibilidade, mas a inicialização real acontece no useEffect acima)
  const initializeFromState = useCallback(() => {
    const initialState = getInitialState(preferences);
    // Não atualizar estado aqui, pois já é feito no useEffect
    // Apenas retornar o estado inicial para compatibilidade
    return initialState;
  }, [preferences]);

  return {
    // Estado
    book,
    chapter,
    bookName,
    maxChapters,
    lastRead,
    
    // Funções
    navigateToChapter,
    goToPreviousChapter,
    goToNextChapter,
    canGoToPrevious,
    canGoToNext,
    saveLastRead,
    initializeFromState,
    
    // Constantes
    BOOKS
  };
}