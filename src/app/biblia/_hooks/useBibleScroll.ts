"use client";

import { useState, useCallback, useRef } from 'react';

interface LastRead {
  book: string;
  chapter: number;
  verse: number;
}

export function useBibleScroll() {
  const [targetVerse, setTargetVerse] = useState<number | null>(null);
  const [showContinueButton, setShowContinueButton] = useState<boolean>(false);
  
  // Refs para cleanup de timers
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Utility para gerenciar timers com cleanup automático
  const createTimer = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  // Cleanup de todos os timers
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  // Scroll suave para versículo (SSR-safe)
  const scrollToVerse = useCallback((verseNumber: number) => {
    if (typeof window === "undefined") return;
    
    const verseElement = document.getElementById(`verse-${verseNumber}`);
    if (verseElement) {
      verseElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, []);

  // Verificar se deve mostrar botão continuar (SSR-safe)
  const checkShowContinueButton = useCallback((lastRead: LastRead | null, book: string, chapter: number) => {
    if (typeof window === "undefined") return;
    
    if (!lastRead || lastRead.book !== book || lastRead.chapter !== chapter) {
      setShowContinueButton(false);
      return;
    }

    const verseElement = document.getElementById(`verse-${lastRead.verse}`);
    if (!verseElement) {
      setShowContinueButton(false);
      return;
    }

    const rect = verseElement.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    
    setShowContinueButton(!isVisible);
  }, []);

  // Salvar progresso ao clicar em versículo
  const handleVerseClick = useCallback((verseNumber: number, book: string, chapter: number, saveLastRead: (book: string, chapter: number, verse: number) => void) => {
    setTargetVerse(verseNumber);
    saveLastRead(book, chapter, verseNumber);
    scrollToVerse(verseNumber);
  }, [scrollToVerse]);

  // Continuar do último versículo
  const handleContinue = useCallback((lastRead: LastRead | null, book: string, chapter: number) => {
    if (lastRead && lastRead.book === book && lastRead.chapter === chapter) {
      scrollToVerse(lastRead.verse);
    }
  }, [scrollToVerse]);

  // Scroll para verso após carregamento
  const scrollToVerseAfterLoad = useCallback((verseNumber: number | null, verses: any[], isLoading: boolean) => {
    if (!isLoading && verseNumber && verses.length > 0) {
      const timer = createTimer(() => {
        scrollToVerse(verseNumber);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [scrollToVerse, createTimer]);

  // Verificar botão continuar após carregamento
  const checkContinueButtonAfterLoad = useCallback((lastRead: LastRead | null, book: string, chapter: number, verses: any[], isLoading: boolean) => {
    if (!isLoading && verses.length > 0) {
      const timer = createTimer(() => {
        checkShowContinueButton(lastRead, book, chapter);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [checkShowContinueButton, createTimer]);

  // Setup scroll listener
  const setupScrollListener = useCallback((lastRead: LastRead | null, book: string, chapter: number) => {
    if (typeof window === "undefined") return;
    
    const handleScroll = () => {
      checkShowContinueButton(lastRead, book, chapter);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [checkShowContinueButton]);

  return {
    // Estado
    targetVerse,
    showContinueButton,
    
    // Funções
    setTargetVerse,
    scrollToVerse,
    handleVerseClick,
    handleContinue,
    checkShowContinueButton,
    scrollToVerseAfterLoad,
    checkContinueButtonAfterLoad,
    setupScrollListener,
    createTimer,
    clearAllTimers
  };
}