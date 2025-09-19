"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Audio } from '@/lib/supabase-queries';

export interface UserFavorite {
  id: string;
  user_id: string;
  audio_id: string;
  created_at: string;
  audio: Audio;
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar favoritos do usuário
  const fetchFavorites = async () => {
    if (!user) {
      console.log('🔍 useFavorites: Usuário não autenticado');
      setLoading(false);
      return;
    }

    try {
      console.log('❤️ useFavorites: Buscando favoritos do usuário:', user.id);
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_favorites')
        .select(`
          *,
          audio:audios(
            *,
            category:categories(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('❌ useFavorites: Erro ao buscar favoritos:', fetchError);
        setError('Erro ao carregar favoritos');
        return;
      }

      console.log('✅ useFavorites: Favoritos carregados:', data?.length || 0);
      setFavorites(data || []);
    } catch (err) {
      console.error('💥 useFavorites: Erro inesperado:', err);
      setError('Erro inesperado ao carregar favoritos');
    } finally {
      setLoading(false);
    }
  };

  // Adicionar áudio aos favoritos
  const addToFavorites = async (audioId: string): Promise<boolean> => {
    if (!user) {
      console.log('⚠️ useFavorites: Tentativa de favoritar sem usuário');
      return false;
    }

    try {
      console.log('➕ useFavorites: Adicionando aos favoritos:', audioId);

      // Verificar se já está nos favoritos
      const isAlreadyFavorite = favorites.some(fav => fav.audio_id === audioId);
      if (isAlreadyFavorite) {
        console.log('⚠️ useFavorites: Áudio já está nos favoritos');
        return false;
      }

      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          audio_id: audioId
        });

      if (error) {
        console.error('❌ useFavorites: Erro ao adicionar favorito:', error);
        return false;
      }

      console.log('✅ useFavorites: Áudio adicionado aos favoritos');
      
      // Recarregar favoritos
      await fetchFavorites();
      
      return true;
    } catch (err) {
      console.error('💥 useFavorites: Erro ao adicionar favorito:', err);
      return false;
    }
  };

  // Remover áudio dos favoritos
  const removeFromFavorites = async (audioId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('➖ useFavorites: Removendo dos favoritos:', audioId);

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('audio_id', audioId);

      if (error) {
        console.error('❌ useFavorites: Erro ao remover favorito:', error);
        return false;
      }

      console.log('✅ useFavorites: Áudio removido dos favoritos');
      
      // Recarregar favoritos
      await fetchFavorites();
      
      return true;
    } catch (err) {
      console.error('💥 useFavorites: Erro ao remover favorito:', err);
      return false;
    }
  };

  // Verificar se áudio está nos favoritos
  const isFavorite = (audioId: string): boolean => {
    return favorites.some(fav => fav.audio_id === audioId);
  };

  // Toggle favorito (adicionar se não está, remover se está)
  const toggleFavorite = async (audioId: string): Promise<boolean> => {
    if (isFavorite(audioId)) {
      return await removeFromFavorites(audioId);
    } else {
      return await addToFavorites(audioId);
    }
  };

  // Contar total de favoritos
  const getFavoritesCount = (): number => {
    return favorites.length;
  };

  // Carregar favoritos quando usuário mudar
  useEffect(() => {
    fetchFavorites();
  }, [user]);

  return {
    favorites,
    loading,
    error,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    getFavoritesCount,
    refetch: fetchFavorites
  };
}