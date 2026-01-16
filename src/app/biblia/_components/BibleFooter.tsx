"use client";

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BibleFooterProps {
  bookName: string;
  chapter: number;
  goToPreviousChapter: () => void;
  goToNextChapter: () => void;
  canGoToPrevious: () => boolean;
  canGoToNext: () => boolean;
  footerThemeClasses: string;
}

export function BibleFooter({
  bookName,
  chapter,
  goToPreviousChapter,
  goToNextChapter,
  canGoToPrevious,
  canGoToNext,
  footerThemeClasses
}: BibleFooterProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-30 border-t shadow-lg ${footerThemeClasses}`}>
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousChapter}
            disabled={!canGoToPrevious()}
            className="flex items-center gap-2 min-h-[44px] flex-1 max-w-[150px] text-gray-900"
            aria-label="Ir para capítulo anterior"
          >
            <ChevronLeft size={16} />
            Anterior
          </Button>

          <div className="text-center text-sm opacity-75 px-4">
            {bookName} {chapter}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextChapter}
            disabled={!canGoToNext()}
            className="flex items-center gap-2 min-h-[44px] flex-1 max-w-[150px] text-gray-900"
            aria-label="Ir para próximo capítulo"
          >
            Próximo
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
