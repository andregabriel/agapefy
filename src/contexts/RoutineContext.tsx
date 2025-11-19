"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Audio, Playlist } from '@/lib/supabase-queries';

export interface RoutinePlaylist extends Playlist {
  audios: Audio[];
}

interface RoutineContextType {
  routinePlaylist: RoutinePlaylist | null;
  loading: boolean;
  error: string | null;
  addAudioToRoutine: (audioId: string) => Promise<boolean>;
  removeAudioFromRoutine: (audioId: string) => Promise<boolean>;
  isAudioInRoutine: (audioId: string) => boolean;
  refetch: () => Promise<void>;
}

const RoutineContext = createContext<RoutineContextType | undefined>(undefined);

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [routinePlaylist, setRoutinePlaylist] = useState<RoutinePlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        logDbError('❌ RoutineContext: Erro ao buscar áudios', error);
        return [];
      }

      if (!data) return [];
      
      // Mapear e filtrar os áudios corretamente
      const audios: Audio[] = data
        .map((item: any) => item.audio)
        .filter((audio: any): audio is Audio => audio != null);
      
      return audios;
    } catch (err) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 RoutineContext: Erro ao buscar áudios', err);
      return [];
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
        logDbError('❌ RoutineContext: Erro ao criar playlist', error);
        return null;
      }

      console.log('✅ RoutineContext: Playlist Rotina criada:', data);
      return data;
    } catch (err) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 RoutineContext: Erro ao criar playlist', err);
      return null;
    }
  };

  // Buscar ou criar playlist "Minha Rotina"
  const fetchOrCreateRoutinePlaylist = useCallback(async () => {
    if (!user) {
      console.log('🔍 RoutineContext: Usuário não autenticado');
      setLoading(false);
      return;
    }

    try {
      console.log('📋 RoutineContext: Buscando playlist Rotina do usuário:', user.id);
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
          console.log('📝 RoutineContext: Criando playlist Rotina');
          playlist = await createRoutinePlaylist();
        } else {
          const { logDbError } = await import('@/lib/utils');
          logDbError('❌ RoutineContext: Erro ao buscar playlist', fetchError);
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
        console.log('✅ RoutineContext: Playlist Rotina carregada com', audios.length, 'áudios');
      }
    } catch (err) {
      console.error('💥 RoutineContext: Erro inesperado:', err);
      setError('Erro inesperado ao carregar rotina');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Buscar áudio completo por ID
  const fetchAudioById = async (audioId: string): Promise<Audio | null> => {
    try {
      const { data, error } = await supabase
        .from('audios')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('id', audioId)
        .single();

      if (error) {
        console.error('❌ RoutineContext: Erro ao buscar áudio:', error);
        return null;
      }

      return data as Audio;
    } catch (err) {
      console.error('💥 RoutineContext: Erro ao buscar áudio:', err);
      return null;
    }
  };

  // Adicionar áudio à rotina
  const addAudioToRoutine = useCallback(async (audioId: string): Promise<boolean> => {
    if (!user) {
      console.log('⚠️ RoutineContext: Usuário não autenticado');
      return false;
    }

    try {
      // Se não há playlist, criar ou buscar uma primeiro
      let playlist = routinePlaylist;
      if (!playlist) {
        console.log('📝 RoutineContext: Playlist não existe, criando/buscando...');
        await fetchOrCreateRoutinePlaylist();
        // Aguardar um pouco para o estado atualizar
        await new Promise(resolve => setTimeout(resolve, 100));
        // Buscar a playlist diretamente do banco para garantir que temos o ID
        const { data: existingPlaylist, error: fetchError } = await supabase
          .from('playlists')
          .select('*')
          .eq('created_by', user.id)
          .eq('title', 'Minha Rotina')
          .eq('is_public', false)
          .single();
        
        if (fetchError || !existingPlaylist) {
          console.log('❌ RoutineContext: Não foi possível obter a playlist');
          return false;
        }
        
        // Buscar áudios da playlist
        const audios = await fetchPlaylistAudios(existingPlaylist.id);
        playlist = {
          ...existingPlaylist,
          audios
        };
        // Atualizar o estado com a playlist encontrada
        setRoutinePlaylist(playlist);
      }

      console.log('➕ RoutineContext: Adicionando áudio à rotina:', audioId);

      // Verificar se áudio já está na rotina
      const audioExists = playlist.audios.some(audio => audio.id === audioId);
      if (audioExists) {
        console.log('⚠️ RoutineContext: Áudio já está na rotina');
        return false;
      }

      // Buscar dados completos do áudio antes de adicionar
      const audioToAdd = await fetchAudioById(audioId);
      if (!audioToAdd) {
        console.log('❌ RoutineContext: Não foi possível buscar dados do áudio');
        return false;
      }

      // Calcular próxima posição
      const nextPosition = playlist.audios.length;

      const { error } = await supabase
        .from('playlist_audios')
        .insert({
          playlist_id: playlist.id,
          audio_id: audioId,
          position: nextPosition
        });

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ RoutineContext: Erro ao adicionar áudio', error);
        return false;
      }

      console.log('✅ RoutineContext: Áudio adicionado à rotina, atualizando estado...');
      
      // Atualização otimista: adicionar o áudio ao estado imediatamente
      setRoutinePlaylist(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          audios: [...prev.audios, audioToAdd]
        };
      });
      
      // Recarregar playlist em background para garantir sincronização
      fetchOrCreateRoutinePlaylist().catch(err => {
        console.error('Erro ao recarregar playlist em background:', err);
      });
      
      return true;
    } catch (err) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 RoutineContext: Erro ao adicionar áudio', err);
      return false;
    }
  }, [user, routinePlaylist, fetchOrCreateRoutinePlaylist]);

  // Remover áudio da rotina
  const removeAudioFromRoutine = useCallback(async (audioId: string): Promise<boolean> => {
    if (!routinePlaylist) return false;

    try {
      console.log('➖ RoutineContext: Removendo áudio da rotina:', audioId);

      // Atualização otimista: remover o áudio do estado imediatamente
      const audioToRemove = routinePlaylist.audios.find(a => a.id === audioId);
      setRoutinePlaylist(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          audios: prev.audios.filter(audio => audio.id !== audioId)
        };
      });

      const { error } = await supabase
        .from('playlist_audios')
        .delete()
        .eq('playlist_id', routinePlaylist.id)
        .eq('audio_id', audioId);

      if (error) {
        // Reverter atualização otimista em caso de erro
        if (audioToRemove) {
          setRoutinePlaylist(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              audios: [...prev.audios, audioToRemove]
            };
          });
        }
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ RoutineContext: Erro ao remover áudio', error);
        return false;
      }

      console.log('✅ RoutineContext: Áudio removido da rotina');
      
      // Recarregar playlist em background para garantir sincronização
      fetchOrCreateRoutinePlaylist().catch(err => {
        console.error('Erro ao recarregar playlist em background:', err);
      });
      
      return true;
    } catch (err) {
      // Reverter atualização otimista em caso de erro
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 RoutineContext: Erro ao remover áudio', err);
      // Tentar recarregar para restaurar estado correto
      await fetchOrCreateRoutinePlaylist();
      return false;
    }
  }, [routinePlaylist, fetchOrCreateRoutinePlaylist]);

  // Verificar se áudio está na rotina
  const isAudioInRoutine = useCallback((audioId: string): boolean => {
    return routinePlaylist?.audios.some(audio => audio.id === audioId) || false;
  }, [routinePlaylist]);

  // Carregar playlist quando usuário mudar
  useEffect(() => {
    fetchOrCreateRoutinePlaylist();
  }, [fetchOrCreateRoutinePlaylist]);

  return (
    <RoutineContext.Provider
      value={{
        routinePlaylist,
        loading,
        error,
        addAudioToRoutine,
        removeAudioFromRoutine,
        isAudioInRoutine,
        refetch: fetchOrCreateRoutinePlaylist
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
}

export function useRoutine() {
  const context = useContext(RoutineContext);
  if (context === undefined) {
    throw new Error('useRoutine must be used within a RoutineProvider');
  }
  return context;
}

