"use client";

import { BookOpen } from 'lucide-react';
import { getBookName, type SearchResult } from '@/lib/search';

interface VerseCardProps {
  verse: SearchResult;
  onClick: (verse: SearchResult) => void;
}

export function VerseCard({ verse, onClick }: VerseCardProps) {
  return (
    <div
      onClick={() => onClick(verse)}
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-medium text-yellow-400 group-hover:text-yellow-300">
          {getBookName(verse.book)} {verse.chapter}:{verse.start_verse}
        </div>
        <BookOpen className="text-gray-400 group-hover:text-gray-300 flex-shrink-0 ml-2" size={16} />
      </div>
      
      <div 
        className="text-gray-300 leading-relaxed text-sm"
        dangerouslySetInnerHTML={{ 
          __html: verse.highlighted_snippet 
        }}
      />
    </div>
  );
}