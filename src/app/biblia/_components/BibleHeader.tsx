"use client";

import { BibleSelects } from './BibleSelects';
import { BibleControls } from './BibleControls';

interface BibleHeaderProps {
  book: string;
  chapter: number;
  maxChapters: number;
  bookName: string;
  books: Array<{ code: string; name: string; chapters: number }>;
  navigateToChapter: (book: string, chapter: number, verse?: number) => void;
  setShowReferenceModal: (show: boolean) => void;
  setShowBibleSearchModal: (show: boolean) => void;
  onFontScaleChange: (scale: number) => void;
  onThemeChange: (isDark: boolean) => void;
  headerThemeClasses: string;
}

export function BibleHeader({
  book,
  chapter,
  maxChapters,
  bookName,
  books,
  navigateToChapter,
  setShowReferenceModal,
  setShowBibleSearchModal,
  onFontScaleChange,
  onThemeChange,
  headerThemeClasses
}: BibleHeaderProps) {
  return (
    <div className={`sticky top-16 z-30 border-b shadow-sm ${headerThemeClasses}`}>
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {/* Linha 1: Selects de livro e capítulo + botões */}
          <BibleSelects
            book={book}
            chapter={chapter}
            maxChapters={maxChapters}
            books={books}
            navigateToChapter={navigateToChapter}
            setShowReferenceModal={setShowReferenceModal}
            setShowBibleSearchModal={setShowBibleSearchModal}
          />

          {/* Linha 2: Controles de fonte e tema */}
          <BibleControls
            onFontScaleChange={onFontScaleChange}
            onThemeChange={onThemeChange}
          />
        </div>
      </div>
    </div>
  );
}