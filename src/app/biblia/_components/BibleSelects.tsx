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
    <div className="flex w-full items-center gap-2">
      <div className="flex-1">
        <Select 
        value={book}
        onValueChange={(value) => navigateToChapter(value, 1)}
        aria-label="Selecionar livro da Bíblia"
        >
          <SelectTrigger className="w-full h-10 text-sm">
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
      </div>

      <div className="w-[110px]">
        <Select 
          value={chapter.toString()} 
          onValueChange={(value) => navigateToChapter(book, parseInt(value, 10))}
          aria-label="Selecionar capítulo"
        >
          <SelectTrigger className="w-full h-10 text-sm">
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
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowBibleSearchModal(true)}
        className="h-10 w-10 p-0 text-gray-900"
        aria-label="Buscar na Bíblia"
        title="Buscar na Bíblia"
      >
        <Search size={18} />
      </Button>
    </div>
  );
}
