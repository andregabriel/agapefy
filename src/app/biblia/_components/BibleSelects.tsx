"use client";

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface BibleSelectsProps {
  book: string;
  chapter: number;
  maxChapters: number;
  books: Array<{ code: string; name: string; chapters: number }>;
  navigateToChapter: (book: string, chapter: number, verse?: number) => void;
  setShowBibleSearchModal: (show: boolean) => void;
}

export function BibleSelects({
  book,
  chapter,
  maxChapters,
  books,
  navigateToChapter,
  setShowBibleSearchModal
}: BibleSelectsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <Select 
        value={book} 
        onValueChange={(value) => navigateToChapter(value, 1)}
        aria-label="Selecionar livro da Bíblia"
      >
        <SelectTrigger className="w-48 min-h-[44px]">
          <SelectValue placeholder="Selecione o livro" />
        </SelectTrigger>
        <SelectContent>
          {books.map((bookItem) => (
            <SelectItem key={bookItem.code} value={bookItem.code}>
              {bookItem.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select 
        value={chapter.toString()} 
        onValueChange={(value) => navigateToChapter(book, parseInt(value, 10))}
        aria-label="Selecionar capítulo"
      >
        <SelectTrigger className="w-32 min-h-[44px]">
          <SelectValue placeholder="Capítulo" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: maxChapters }, (_, i) => i + 1).map((chapterNum) => (
            <SelectItem key={chapterNum} value={chapterNum.toString()}>
              Capítulo {chapterNum}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBibleSearchModal(true)}
          className="flex items-center gap-2 min-h-[44px]"
          aria-label="Buscar na Bíblia"
        >
          <Search size={16} />
          Buscar
        </Button>
      </div>
    </div>
  );
}