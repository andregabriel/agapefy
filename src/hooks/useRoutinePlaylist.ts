"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Audio, Playlist } from '@/lib/supabase-queries';

export interface RoutinePlaylist extends Playlist {
  audios: Audio[];
}

export function useRoutinePlaylist() {
  const { user } = useAuth();
  const [routinePlaylist, setRoutinePlaylist] = useState<RoutinePlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar ou criar playlist "Minha Rotina"
  const fetchOrCreateRoutinePlaylist = async () => {
    if (!user) {
      console.log('🔍 useRoutinePlaylist: Usuário não autenticado');
      setLoading(false);
      return;
    }

    try {
      console.log('📋 useRoutinePlaylist: Buscando playlist Rotina do usuário:', user.id);
      setLoading(true);
      setError(null);

      // Buscar playlist "Minha Rotina" existente
      const { data: existingPlaylist, error: fetchError } = await supabase
        .from('playlists')
        .select('*')
        .eq('created_by', user.id)
        .eq('title', 'Minha Rotina')
        .eq('is_public', false)
        .single();

      let playlist = existingPlaylist;

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Playlist não existe, criar uma nova
          console.log('📝 useRoutinePlaylist: Criando playlist Rotina');
          playlist = await createRoutinePlaylist();
        } else {
          const { logDbError } = await import('@/lib/utils');
          logDbError('❌ useRoutinePlaylist: Erro ao buscar playlist', fetchError);
          setError('Erro ao carregar sua rotina');
          return;
        }
      }

      if (playlist) {
        // Buscar áudios da playlist
        const audios = await fetchPlaylistAudios(playlist.id);
        setRoutinePlaylist({
          ...playlist,
          audios
        });
        console.log('✅ useRoutinePlaylist: Playlist Rotina carregada com', audios.length, 'áudios');
      }
    } catch (err) {
      console.error('💥 useRoutinePlaylist: Erro inesperado:', err);
      setError('Erro inesperado ao carregar rotina');
    } finally {
      setLoading(false);
    }
  };

  // Criar playlist "Minha Rotina"
  const createRoutinePlaylist = async (): Promise<Playlist | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          title: 'Minha Rotina',
          description: 'Suas orações e práticas diárias personalizadas',
          created_by: user.id,
          is_public: false
        })
        .select()
        .single();

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ useRoutinePlaylist: Erro ao criar playlist', error);
        return null;
      }

      console.log('✅ useRoutinePlaylist: Playlist Rotina criada:', data);
      return data;
    } catch (err) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 useRoutinePlaylist: Erro ao criar playlist', err);
      return null;
    }
  };

  // Buscar áudios da playlist
  const fetchPlaylistAudios = async (playlistId: string): Promise<Audio[]> => {
    try {
      const { data, error } = await supabase
        .from('playlist_audios')
        .select(`
          position,
          audio:audios(
            *,
            category:categories(*)
          )
        `)
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ useRoutinePlaylist: Erro ao buscar áudios', error);
        return [];
      }

      return data?.map(item => item.audio).filter(Boolean) || [];
    } catch (err) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 useRoutinePlaylist: Erro ao buscar áudios', err);
      return [];
    }
  };

  // Adicionar áudio à rotina
  const addAudioToRoutine = async (audioId: string): Promise<boolean> => {
    if (!routinePlaylist) {
      console.log('⚠️ useRoutinePlaylist: Tentativa de adicionar áudio sem playlist');
      return false;
    }

    try {
      console.log('➕ useRoutinePlaylist: Adicionando áudio à rotina:', audioId);

      // Verificar se áudio já está na rotina
      const audioExists = routinePlaylist.audios.some(audio => audio.id === audioId);
      if (audioExists) {
        console.log('⚠️ useRoutinePlaylist: Áudio já está na rotina');
        return false;
      }

      // Calcular próxima posição
      const nextPosition = routinePlaylist.audios.length;

      const { error } = await supabase
        .from('playlist_audios')
        .insert({
          playlist_id: routinePlaylist.id,
          audio_id: audioId,
          position: nextPosition
        });

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ useRoutinePlaylist: Erro ao adicionar áudio', error);
        return false;
      }

      console.log('✅ useRoutinePlaylist: Áudio adicionado à rotina, recarregando...');
      
      // Recarregar playlist imediatamente
      await fetchOrCreateRoutinePlaylist();
      
      return true;
    } catch (err) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 useRoutinePlaylist: Erro ao adicionar áudio', err);
      return false;
    }
  };

  // Remover áudio da rotina
  const removeAudioFromRoutine = async (audioId: string): Promise<boolean> => {
    if (!routinePlaylist) return false;

    try {
      console.log('➖ useRoutinePlaylist: Removendo áudio da rotina:', audioId);

      const { error } = await supabase
        .from('playlist_audios')
        .delete()
        .eq('playlist_id', routinePlaylist.id)
        .eq('audio_id', audioId);

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ useRoutinePlaylist: Erro ao remover áudio', error);
        return false;
      }

      console.log('✅ useRoutinePlaylist: Áudio removido da rotina, recarregando...');
      
      // Recarregar playlist imediatamente
      await fetchOrCreateRoutinePlaylist();
      
      return true;
    } catch (err) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 useRoutinePlaylist: Erro ao remover áudio', err);
      return false;
    }
  };

  // Verificar se áudio está na rotina
  const isAudioInRoutine = (audioId: string): boolean => {
    return routinePlaylist?.audios.some(audio => audio.id === audioId) || false;
  };

  // Carregar playlist quando usuário mudar
  useEffect(() => {
    fetchOrCreateRoutinePlaylist();
  }, [user]);

  return {
    routinePlaylist,
    loading,
    error,
    addAudioToRoutine,
    removeAudioFromRoutine,
    isAudioInRoutine,
    refetch: fetchOrCreateRoutinePlaylist
  };
}