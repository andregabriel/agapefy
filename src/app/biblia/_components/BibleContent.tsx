"use client";

import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Verse {
  n: number;
  text: string;
}

interface BibleContentProps {
  verses: Verse[];
  book: string;
  chapter: number;
  bookName: string;
  fontScale: number;
  containerRef: RefObject<HTMLDivElement>;
  verseThemeClasses: string;
  handleVerseClick: (verseNumber: number) => void;
  goToPreviousChapter: () => void;
  goToNextChapter: () => void;
  canGoToPrevious: () => boolean;
  canGoToNext: () => boolean;
}

export function BibleContent({
  verses,
  book,
  chapter,
  bookName,
  fontScale,
  containerRef,
  verseThemeClasses,
  handleVerseClick,
  goToPreviousChapter,
  goToNextChapter,
  canGoToPrevious,
  canGoToNext
}: BibleContentProps) {
  return (
    <div 
      ref={containerRef}
      className="max-w-4xl mx-auto px-4 py-8"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Título do capítulo */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold mb-4">
          {bookName} {chapter}
        </h1>

        {/* Botões de navegação */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousChapter}
            disabled={!canGoToPrevious()}
            className="flex items-center gap-2 min-h-[44px]"
          >
            <ChevronLeft size={16} />
            Anterior
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextChapter}
            disabled={!canGoToNext()}
            className="flex items-center gap-2 min-h-[44px]"
          >
            Próximo
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Lista de versículos com escala de fonte aplicada */}
      <div style={{ fontSize: `${fontScale}em` }}>
        {verses.map((verse) => (
          <p
            key={verse.n}
            id={`verse-${verse.n}`}
            className={`mb-3 cursor-pointer hover:shadow-sm rounded-lg p-4 transition-all duration-200 leading-relaxed min-h-[44px] flex items-start ${verseThemeClasses}`}
            onClick={() => handleVerseClick(verse.n)}
          >
            <sup className="text-sm opacity-75 mr-2 font-medium">
              {verse.n}
            </sup>
            <span>{verse.text}</span>
          </p>
        ))}
      </div>

      {/* Espaçamento inferior para o rodapé fixo */}
      <div className="h-16"></div>
    </div>
  );
}