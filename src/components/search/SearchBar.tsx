"use client";

import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  loading: boolean;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ searchTerm, onSearchTermChange, onSubmit, onClear, loading }, ref) => {
    return (
      <form onSubmit={onSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Input
            ref={ref}
            type="text"
            placeholder="Orações, Categorias, Bíblia e Mais"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="bg-white border-gray-200 text-gray-900 placeholder-gray-500 pr-10 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 h-auto rounded-full"
            >
              <X size={16} />
            </Button>
          )}
        </div>
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 shadow-sm"
        >
          <Search size={16} className="mr-2" />
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </form>
    );
  }
);

SearchBar.displayName = 'SearchBar';