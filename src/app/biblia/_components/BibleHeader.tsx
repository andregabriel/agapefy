"use client";

import Link from 'next/link';
import { BibleSelects } from './BibleSelects';
import { BibleControls } from './BibleControls';
// Biblicus pill removida do header para usar apenas o FAB inferior

interface BibleHeaderProps {
  book: string;
  chapter: number;
  maxChapters: number;
  bookName: string;
  books: Array<{ code: string; name: string; chapters: number }>;
  navigateToChapter: (book: string, chapter: number, verse?: number) => void;
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
  setShowBibleSearchModal,
  onFontScaleChange,
  onThemeChange,
  headerThemeClasses
}: BibleHeaderProps) {
  return (
    <div className={`sticky top-0 z-30 border-b ${headerThemeClasses}`}>
      <div className="max-w-4xl mx-auto px-4 py-2">
        {/* Cabeçalho com logo (somente mobile), igual ao da home */}
        <div className="flex items-center justify-between mb-2 md:hidden">
          <Link href="/" className="flex items-center">
            <img
              src="https://vvgqqlrujmyxzzygsizc.supabase.co/storage/v1/object/public/media/app-26/images/1758119247895-09choju49.png"
              alt="Logo"
              className="h-10 w-auto object-contain max-w-[120px]"
            />
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          {/* Linha 1: Selects compactos */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <BibleSelects
                book={book}
                chapter={chapter}
                maxChapters={maxChapters}
                books={books}
                navigateToChapter={navigateToChapter}
                setShowBibleSearchModal={setShowBibleSearchModal}
              />
            </div>
          </div>

          {/* Linha 2: Controles de fonte e tema compactos */}
          <BibleControls
            onFontScaleChange={onFontScaleChange}
            onThemeChange={onThemeChange}
          />
        </div>
      </div>
    </div>
  );
}