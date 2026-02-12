"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useSwipe } from './_components/useSwipe';
import { useSearchParams } from 'next/navigation';

// Hooks customizados
import { useBibleCache } from './_hooks/useBibleCache';
import { useBibleNavigation } from './_hooks/useBibleNavigation';
import { useBibleScroll } from './_hooks/useBibleScroll';
import { useBibleSettings } from './_hooks/useBibleSettings';

// Componentes UI
import { BibleHeader } from './_components/BibleHeader';
import { BibleContent } from './_components/BibleContent';
import { BibleFooter } from './_components/BibleFooter';

import BibleSearchModal from './_components/BibleSearchModal';

interface Verse {
  n: number;
  text: string;
}

// Componente principal que usa useSearchParams
function BibliaPageContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showBibleSearchModal, setShowBibleSearchModal] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Hooks customizados
  const { loadChapter, prefetchNeighbors, setCurrentBook, cancelPendingPrefetches } = useBibleCache();
  const {
    book,
    chapter,
    bookName,
    maxChapters,
    lastRead,
    navigateToChapter,
    goToPreviousChapter,
    goToNextChapter,
    canGoToPrevious,
    canGoToNext,
    saveLastRead,
    initializeFromState,
    BOOKS
  } = useBibleNavigation();
  
  const {
    targetVerse,
    showContinueButton,
    setTargetVerse,
    handleVerseClick,
    handleContinue,
    scrollToVerseAfterLoad,
    checkContinueButtonAfterLoad,
    setupScrollListener,
    createTimer,
    clearAllTimers
  } = useBibleScroll();
  
  const {
    fontScale,
    isDarkTheme,
    handleFontScaleChange,
    handleThemeChange,
    getThemeClasses
  } = useBibleSettings();

  // Classes de tema
  const { themeClasses, headerThemeClasses, verseThemeClasses, footerThemeClasses } = getThemeClasses();

  // Função para carregar capítulo com estados
  const loadChapterWithStates = useCallback(async (bookCode: string, chapterNum: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const versesData = await loadChapter(bookCode, chapterNum);
      setVerses(versesData);
    } catch (err) {
      console.error('[biblia] Load error:', err);
      setError('Não foi possível carregar o capítulo.');
    } finally {
      setLoading(false);
    }
  }, [loadChapter]);

  // Navegar para capítulo específico com cache
  const handleNavigateToChapter = useCallback(async (newBook: string, newChapter: number, targetVerseNum?: number) => {
    console.log('🎯 handleNavigateToChapter chamado:', { newBook, newChapter, targetVerseNum });
    
    // Verificar se mudou de livro
    if (newBook !== book) {
      setCurrentBook(newBook);
    }

    // Configurar versículo alvo APENAS se especificado
    if (targetVerseNum) {
      setTargetVerse(targetVerseNum);
      console.log('🎯 Versículo alvo configurado:', targetVerseNum);
    } else {
      // Limpar versículo alvo se não especificado (evita scroll automático)
      setTargetVerse(null);
    }

    const result = navigateToChapter(newBook, newChapter, targetVerseNum);
    if (result) {
      await loadChapterWithStates(result.book, result.chapter);
    }
  }, [book, setCurrentBook, setTargetVerse, navigateToChapter, loadChapterWithStates]);

  // Navegar para capítulo anterior com cache
  const handleGoToPreviousChapter = async () => {
    const result = goToPreviousChapter();
    if (result) {
      if (result.book !== book) {
        setCurrentBook(result.book);
      }
      // Não definir targetVerse para evitar scroll automático
      setTargetVerse(null);
      await loadChapterWithStates(result.book, result.chapter);
    }
  };

  // Navegar para próximo capítulo com cache
  const handleGoToNextChapter = async () => {
    const result = goToNextChapter();
    if (result) {
      if (result.book !== book) {
        setCurrentBook(result.book);
      }
      // Não definir targetVerse para evitar scroll automático
      setTargetVerse(null);
      await loadChapterWithStates(result.book, result.chapter);
    }
  };

  // Handler para clique em versículo
  const handleVerseClickWithSave = (verseNumber: number) => {
    handleVerseClick(verseNumber, book, chapter, saveLastRead);
  };

  // Handler para continuar leitura
  const handleContinueReading = () => {
    handleContinue(lastRead, book, chapter);
  };

  // Retry em caso de erro
  const handleRetry = () => {
    loadChapterWithStates(book, chapter);
  };

  // Configurar detecção de swipe com navegação
  useSwipe(containerRef, {
    threshold: 60,
    maxAngle: 0.5,
    timeout: 600,
    debounce: 300,
    onSwipeLeft: () => {
      if (canGoToNext()) {
        handleGoToNextChapter();
      }
    },
    onSwipeRight: () => {
      if (canGoToPrevious()) {
        handleGoToPreviousChapter();
      }
    }
  });

  // Verificar parâmetros da URL para navegação direta
  useEffect(() => {
    const urlBook = searchParams.get('book');
    const urlChapter = searchParams.get('chapter');
    const urlVerse = searchParams.get('verse');

    console.log('📖 Parâmetros da URL recebidos:', {
      urlBook,
      urlChapter,
      urlVerse,
      isInitialized
    });

    if (urlBook && urlChapter && !isInitialized) {
      console.log('🔍 Navegação direta via URL:', urlBook, urlChapter, urlVerse);
      
      const chapterNum = parseInt(urlChapter);
      const verseNum = urlVerse ? parseInt(urlVerse) : undefined;
      
      console.log('🔢 Valores convertidos:', {
        book: urlBook,
        chapter: chapterNum,
        verse: verseNum
      });
      
      if (chapterNum > 0) {
        console.log('🎯 Chamando handleNavigateToChapter via URL');
        
        // Usar handleNavigateToChapter
        handleNavigateToChapter(urlBook, chapterNum, verseNum).then(() => {
          console.log('✅ Navegação via URL concluída');
          setIsInitialized(true);
        });
        
        return; // Não executar inicialização padrão
      }
    }
  }, [searchParams, isInitialized]); // Removido handleNavigateToChapter das dependências

  // Inicialização - determinar estado inicial e carregar capítulo
  useEffect(() => {
    if (isInitialized) return;
    
    // Verificar se há parâmetros de URL primeiro
    const urlBook = searchParams.get('book');
    const urlChapter = searchParams.get('chapter');
    
    if (urlBook && urlChapter) {
      // Deixar o useEffect anterior lidar com isso
      return;
    }
    
    console.log('🚀 Inicialização padrão da bíblia');
    
    const initializePage = async () => {
      try {
        const initialState = initializeFromState();
        console.log('📚 Estado inicial:', initialState);
        
        // Para inicialização padrão, não passar versículo para evitar scroll
        await handleNavigateToChapter(initialState.book, initialState.chapter);
        setIsInitialized(true);
        
      } catch (err) {
        console.error('[biblia] Init error:', err);
        // Fallback para Gênesis 1
        await handleNavigateToChapter('GEN', 1);
        setIsInitialized(true);
      }
    };

    initializePage();
  }, [isInitialized, searchParams]); // Removido handleNavigateToChapter e initializeFromState das dependências

  // Prefetch após carregar capítulo
  useEffect(() => {
    if (!loading && verses.length > 0 && isInitialized) {
      const timer = createTimer(() => {
        prefetchNeighbors(book, chapter);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [loading, verses, book, chapter, prefetchNeighbors, createTimer, isInitialized]);

  // Scroll suave para verso após carregamento - APENAS quando há targetVerse
  useEffect(() => {
    if (!loading && verses.length > 0 && targetVerse) {
      console.log('📜 Fazendo scroll para versículo:', targetVerse);
      const timer = setTimeout(() => {
        const verseElement = document.getElementById(`verse-${targetVerse}`);
        if (verseElement) {
          verseElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          console.log('✅ Scroll realizado para versículo:', targetVerse);
        } else {
          console.log('❌ Elemento do versículo não encontrado:', `verse-${targetVerse}`);
        }
      }, 300); // Aguardar um pouco para garantir que os elementos estejam renderizados

      return () => clearTimeout(timer);
    }
  }, [loading, verses, targetVerse]);

  // Verificar botão continuar após carregamento
  useEffect(() => {
    return checkContinueButtonAfterLoad(lastRead, book, chapter, verses, loading);
  }, [checkContinueButtonAfterLoad, lastRead, book, chapter, verses, loading]);

  // Listener para scroll para atualizar botão continuar
  useEffect(() => {
    if (!isInitialized) return;
    return setupScrollListener(lastRead, book, chapter);
  }, [setupScrollListener, lastRead, book, chapter, isInitialized]);

  // Cleanup geral ao desmontar
  useEffect(() => {
    return () => {
      cancelPendingPrefetches();
      clearAllTimers();
    };
  }, [cancelPendingPrefetches, clearAllTimers]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${themeClasses}`}>
        <div className="text-center pt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mx-auto mb-4"></div>
          <p className="opacity-75">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${themeClasses}`}>
        <div className="text-center max-w-md mx-auto p-6 pt-20">
          <p className="mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${themeClasses}`}>
      {/* Header fixo */}
      <BibleHeader
        book={book}
        chapter={chapter}
        maxChapters={maxChapters}
        bookName={bookName}
        books={BOOKS}
        navigateToChapter={handleNavigateToChapter}
        setShowBibleSearchModal={setShowBibleSearchModal}
        onFontScaleChange={handleFontScaleChange}
        onThemeChange={handleThemeChange}
        headerThemeClasses={headerThemeClasses}
      />

      {/* CTA Biblicus removido (agora no header como pill) */}

      {/* Conteúdo principal */}
      <BibleContent
        verses={verses}
        book={book}
        chapter={chapter}
        bookName={bookName}
        fontScale={fontScale}
        containerRef={containerRef}
        verseThemeClasses={verseThemeClasses}
        handleVerseClick={handleVerseClickWithSave}
        goToPreviousChapter={handleGoToPreviousChapter}
        goToNextChapter={handleGoToNextChapter}
        canGoToPrevious={canGoToPrevious}
        canGoToNext={canGoToNext}
      />

      {/* Footer fixo */}
      <BibleFooter
        bookName={bookName}
        chapter={chapter}
        goToPreviousChapter={handleGoToPreviousChapter}
        goToNextChapter={handleGoToNextChapter}
        canGoToPrevious={canGoToPrevious}
        canGoToNext={canGoToNext}
        footerThemeClasses={footerThemeClasses}
      />

      {/* FAB Continuar */}
      {showContinueButton && (
        <button
          onClick={handleContinueReading}
          aria-label="Continuar do último versículo"
          className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          📍
        </button>
      )}

      {/* FAB Biblicus (mobile) */}
      <Link
        href="/biblicus"
        aria-label="Tire suas dúvidas"
        className="fixed bottom-20 right-4 inline-flex items-center gap-1 h-10 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm shadow-lg hover:shadow-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        <MessageCircle size={16} />
        <span className="ml-1">Tire suas dúvidas</span>
      </Link>

      {/* Modal de Busca Bíblica */}
      <BibleSearchModal
        isOpen={showBibleSearchModal}
        onClose={() => setShowBibleSearchModal(false)}
        onNavigate={handleNavigateToChapter}
      />
    </div>
  );
}

// Componente de loading para o Suspense
function BibliaPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="text-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mx-auto mb-4"></div>
        <p className="opacity-75">Carregando Bíblia...</p>
      </div>
    </div>
  );
}

// Componente principal exportado com Suspense
export default function BibliaPage() {
  return (
    <Suspense fallback={<BibliaPageLoading />}>
      <BibliaPageContent />
    </Suspense>
  );
}
