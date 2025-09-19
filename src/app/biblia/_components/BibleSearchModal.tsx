"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, BookOpen, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchVerses, getBookName, type SearchResult } from '@/lib/search';

interface BibleSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (book: string, chapter: number, verse?: number) => void;
}

export default function BibleSearchModal({ isOpen, onClose, onNavigate }: BibleSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Refs para debounce e controle
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Função de busca
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    // Cancelar busca anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Criar novo AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const searchResults = await searchVerses(searchQuery.trim());
      
      // Verificar se não foi cancelado
      if (!controller.signal.aborted) {
        setResults(searchResults);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('[bible-search] Search error:', err);
        setError(err instanceof Error ? err.message : 'Erro ao buscar na Bíblia');
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  // Debounce da busca
  useEffect(() => {
    // Limpar timeout anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Configurar novo timeout
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 400);

    // Cleanup
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Focar input quando modal abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Cleanup ao fechar modal
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      
      // Cancelar busca pendente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    }
  }, [isOpen]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Navegar para versículo e fechar modal
  const handleResultClick = (result: SearchResult) => {
    const chapter = parseInt(result.chapter, 10);
    const verse = parseInt(result.start_verse, 10);
    onNavigate(result.book, chapter, verse);
    onClose();
  };

  // Retry em caso de erro
  const handleRetry = () => {
    performSearch(query);
  };

  // Fechar modal com Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Buscar na Bíblia</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Input de busca */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite pelo menos 2 caracteres para buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="animate-spin text-gray-400" size={20} />
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Estado inicial */}
          {!hasSearched && !loading && (
            <div className="text-center py-8">
              <BookOpen className="mx-auto mb-4 text-gray-400" size={48} />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Buscar versículos
              </h3>
              <p className="text-gray-500">
                Digite pelo menos 2 caracteres para começar a busca
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto mb-4 text-blue-500" size={32} />
              <p className="text-gray-600">Buscando...</p>
            </div>
          )}

          {/* Erro */}
          {error && !loading && (
            <div className="text-center py-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-red-800 mb-4">{error}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* Resultados vazios */}
          {hasSearched && !loading && !error && results.length === 0 && (
            <div className="text-center py-8">
              <Search className="mx-auto mb-4 text-gray-400" size={48} />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-gray-500">
                Tente usar palavras diferentes ou verifique a ortografia
              </p>
            </div>
          )}

          {/* Lista de resultados */}
          {results.length > 0 && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-800">
                  {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                </h3>
              </div>

              <div className="space-y-3">
                {results.map((result) => (
                  <div
                    key={result.verse_id}
                    onClick={() => handleResultClick(result)}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 hover:border-gray-300 cursor-pointer transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-blue-600 group-hover:text-blue-700">
                        {getBookName(result.book)} {result.chapter}:{result.start_verse}
                      </div>
                      <BookOpen className="text-gray-400 group-hover:text-gray-500 flex-shrink-0 ml-2" size={16} />
                    </div>
                    
                    <div 
                      className="text-gray-700 leading-relaxed text-sm"
                      dangerouslySetInnerHTML={{ 
                        __html: result.highlighted_snippet 
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}