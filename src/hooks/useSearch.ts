"use client";

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCategories, searchAll } from '@/lib/supabase-queries';
import { searchVerses } from '@/lib/search';
import { toast } from 'sonner';
import type { SearchResults, Category } from '@/types/search';

export function useSearch() {
  const [results, setResults] = useState<SearchResults>({
    audios: [],
    playlists: [],
    categories: [],
    verses: []
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchCategoriesWithContent = useCallback(async () => {
    setLoadingCategories(true);
    try {
      console.log('🔍 Buscando categorias com conteúdo...');
      
      const allCategories = await getCategories();
      
      const categoriesWithContent = await Promise.all(
        allCategories.map(async (category) => {
          const { data: audios } = await supabase
            .from('audios')
            .select('id')
            .eq('category_id', category.id)
            .limit(1);

          const { data: playlists } = await supabase
            .from('playlists')
            .select('id')
            .contains('category_ids', [category.id])
            .eq('is_public', true)
            .limit(1);

          const hasContent = (audios && audios.length > 0) || (playlists && playlists.length > 0);
          return hasContent ? category : null;
        })
      );

      const validCategories = categoriesWithContent
        .filter((cat): cat is Category => cat !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setCategories(validCategories);
      console.log('✅ Categorias com conteúdo encontradas:', validCategories.length);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults({
        audios: [],
        playlists: [],
        categories: [],
        verses: []
      });
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const [appResults, bibleResults] = await Promise.all([
        searchAll(term.trim()),
        searchVerses(term.trim())
      ]);

      setResults({
        audios: appResults.audios,
        playlists: appResults.playlists,
        categories: appResults.categories,
        verses: bibleResults
      });

      console.log('🔍 Resultados da busca:', {
        audios: appResults.audios.length,
        playlists: appResults.playlists.length,
        categories: appResults.categories.length,
        verses: bibleResults.length
      });

    } catch (error) {
      console.error('Erro na busca:', error);
      toast.error('Erro ao buscar conteúdo');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setResults({
      audios: [],
      playlists: [],
      categories: [],
      verses: []
    });
    setHasSearched(false);
  }, []);

  const totalResults = results.audios.length + results.playlists.length + results.categories.length + results.verses.length;

  return {
    results,
    categories,
    loading,
    loadingCategories,
    hasSearched,
    totalResults,
    performSearch,
    clearSearch,
    fetchCategoriesWithContent
  };
}
