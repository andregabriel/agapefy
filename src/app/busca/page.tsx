"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useDownloads } from '@/hooks/useDownloads';
import { useSearch } from '@/hooks/useSearch';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { CategoryGrid } from '@/components/search/CategoryGrid';
import { LoadingState, EmptySearchState, EmptyCategoriesState } from '@/components/search/SearchStates';
import { toast } from 'sonner';
import type { Audio } from '@/types/search';
import type { SearchResult } from '@/lib/search';

// Componente interno que usa useSearchParams
function BuscaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { playAudio } = usePlayer();
  const { favorites, addToFavorites, removeFromFavorites } = useFavorites();
  const { downloads, addDownload } = useDownloads();
  
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initialLoadRef = useRef(true);

  const {
    results,
    categories,
    loading,
    loadingCategories,
    hasSearched,
    totalResults,
    performSearch,
    clearSearch,
    fetchCategoriesWithContent
  } = useSearch();

  // Debounce para busca em tempo real
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Função de busca com debounce
  const debouncedSearch = useCallback((term: string) => {
    // Limpar timeout anterior
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Configurar novo timeout
    debounceTimeoutRef.current = setTimeout(() => {
      if (term.trim().length >= 2) {
        console.log('🔍 Busca em tempo real:', term);
        performSearch(term);
        
        // Atualizar URL sem recarregar a página (apenas se não for carregamento inicial)
        if (!initialLoadRef.current) {
          const params = new URLSearchParams();
          if (term.trim()) {
            params.set('q', term.trim());
          }
          const newUrl = `/busca${params.toString() ? `?${params.toString()}` : ''}`;
          window.history.replaceState({}, '', newUrl);
        }
      } else if (term.trim().length === 0) {
        // Limpar busca se campo estiver vazio
        clearSearch();
        if (!initialLoadRef.current) {
          window.history.replaceState({}, '', '/busca');
        }
      }
    }, 400); // 400ms de debounce
  }, [performSearch, clearSearch]);

  // Busca em tempo real quando searchTerm muda
  useEffect(() => {
    debouncedSearch(searchTerm);

    // Cleanup do timeout quando componente desmonta
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm, debouncedSearch]);

  // Carregar categorias ao montar o componente
  useEffect(() => {
    fetchCategoriesWithContent();
  }, [fetchCategoriesWithContent]);

  // Carregar termo de busca da URL APENAS no carregamento inicial
  useEffect(() => {
    if (initialLoadRef.current) {
      const q = searchParams.get('q');
      if (q) {
        console.log('🔍 Carregando termo da URL:', q);
        setSearchTerm(q);
      }
      initialLoadRef.current = false;
    }
  }, [searchParams]);

  // Focar no input ao carregar
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Busca imediata quando formulário é submetido
    if (searchTerm.trim()) {
      // Cancelar debounce pendente
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      console.log('🔍 Busca manual (submit):', searchTerm);
      performSearch(searchTerm);
      
      // Atualizar URL
      const params = new URLSearchParams();
      params.set('q', searchTerm.trim());
      router.push(`/busca?${params.toString()}`);
    }
  };

  const handleClearSearch = () => {
    // Cancelar busca pendente
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    setSearchTerm('');
    clearSearch();
    router.push('/busca');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handlePlayAudio = (audio: Audio) => {
    playAudio(audio);
    toast.success(`Reproduzindo: ${audio.title}`);
  };

  const isFavorite = (audioId: string) => {
    return favorites.some(fav => fav.audio.id === audioId);
  };

  const isDownloaded = (audioId: string) => {
    return downloads.some(download => download.audio.id === audioId);
  };

  const handleToggleFavorite = async (audio: Audio) => {
    try {
      if (isFavorite(audio.id)) {
        const success = await removeFromFavorites(audio.id);
        if (success) {
          toast.success(`"${audio.title}" removido dos favoritos`);
        }
      } else {
        const success = await addToFavorites(audio.id);
        if (success) {
          toast.success(`"${audio.title}" adicionado aos favoritos`);
        }
      }
    } catch (error) {
      console.error('Erro ao alterar favorito:', error);
      toast.error('Erro ao alterar favorito');
    }
  };

  const handleDownload = async (audio: Audio) => {
    try {
      const success = await addDownload(audio.id, audio.audio_url);
      if (success) {
        toast.success(`"${audio.title}" baixado com sucesso`);
      }
    } catch (error) {
      console.error('Erro ao baixar áudio:', error);
      toast.error('Erro ao baixar áudio');
    }
  };

  const handleVerseClick = (verse: SearchResult) => {
    const chapter = parseInt(verse.chapter, 10);
    const verseNum = parseInt(verse.start_verse, 10);
    router.push(`/biblia?book=${verse.book}&chapter=${chapter}&verse=${verseNum}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header da página com título */}
      <div className="px-4 pt-8 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Buscar</h1>
        
        {/* Barra de busca */}
        <SearchBar
          ref={searchInputRef}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onSubmit={handleSearch}
          onClear={handleClearSearch}
          loading={loading}
        />
      </div>

      {/* Conteúdo principal */}
      <div className="px-4 pb-6">
        {!hasSearched ? (
          <div>
            {loadingCategories ? (
              <LoadingState message="Carregando categorias..." />
            ) : categories.length > 0 ? (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Categorias</h2>
                <CategoryGrid categories={categories} />
              </div>
            ) : (
              <EmptyCategoriesState />
            )}
          </div>
        ) : loading ? (
          <LoadingState message="Buscando conteúdo..." />
        ) : totalResults > 0 ? (
          <SearchResults
            results={results}
            searchTerm={searchTerm}
            totalResults={totalResults}
            onPlayAudio={handlePlayAudio}
            onToggleFavorite={handleToggleFavorite}
            onDownload={handleDownload}
            onVerseClick={handleVerseClick}
            isFavorite={isFavorite}
            isDownloaded={isDownloaded}
          />
        ) : (
          <EmptySearchState searchTerm={searchTerm} />
        )}
      </div>
    </div>
  );
}

// Loading fallback para Suspense
function BuscaLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header skeleton */}
      <div className="px-4 pt-8 pb-6">
        <div className="h-9 w-32 bg-gray-200 rounded mb-6 animate-pulse"></div>
        <div className="flex gap-3">
          <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
          <div className="w-24 h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="px-4 pb-6">
        <div className="h-6 w-32 bg-gray-200 rounded mb-6 animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Componente principal com Suspense
export default function BuscaPage() {
  return (
    <Suspense fallback={<BuscaLoading />}>
      <BuscaContent />
    </Suspense>
  );
}