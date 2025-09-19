"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Audio } from '@/lib/supabase-queries';

export interface UserDownload {
  id: string;
  user_id: string;
  audio_id: string;
  file_size: number;
  download_url: string | null;
  status: string;
  created_at: string;
  audio: Audio;
}

export interface DownloadInput {
  audio_id: string;
  file_size?: number;
  download_url?: string;
  status?: string;
}

export function useDownloads() {
  const { user } = useAuth();
  const [downloads, setDownloads] = useState<UserDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar downloads do usuário
  const fetchDownloads = async () => {
    if (!user) {
      console.log('🔍 useDownloads: Usuário não autenticado');
      setLoading(false);
      return;
    }

    try {
      console.log('📥 useDownloads: Buscando downloads do usuário:', user.id);
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_downloads')
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
        console.error('❌ useDownloads: Erro ao buscar downloads:', fetchError);
        setError('Erro ao carregar downloads');
        return;
      }

      console.log('✅ useDownloads: Downloads carregados:', data?.length || 0);
      setDownloads(data || []);
    } catch (err) {
      console.error('💥 useDownloads: Erro inesperado:', err);
      setError('Erro inesperado ao carregar downloads');
    } finally {
      setLoading(false);
    }
  };

  // Adicionar download
  const addDownload = async (downloadData: DownloadInput): Promise<boolean> => {
    if (!user) {
      console.log('⚠️ useDownloads: Tentativa de download sem usuário');
      return false;
    }

    try {
      console.log('➕ useDownloads: Adicionando download:', downloadData);

      // Verificar se já foi baixado
      const isAlreadyDownloaded = downloads.some(dl => dl.audio_id === downloadData.audio_id);
      if (isAlreadyDownloaded) {
        console.log('⚠️ useDownloads: Áudio já foi baixado');
        return false;
      }

      // Simular tamanho do arquivo baseado na duração (se não fornecido)
      const estimatedSize = downloadData.file_size || Math.floor(Math.random() * 50 + 20) * 1024 * 1024; // 20-70MB

      const { error } = await supabase
        .from('user_downloads')
        .insert({
          user_id: user.id,
          audio_id: downloadData.audio_id,
          file_size: estimatedSize,
          download_url: downloadData.download_url,
          status: downloadData.status || 'completed'
        });

      if (error) {
        console.error('❌ useDownloads: Erro ao adicionar download:', error);
        return false;
      }

      console.log('✅ useDownloads: Download adicionado');
      
      // Recarregar downloads
      await fetchDownloads();
      
      return true;
    } catch (err) {
      console.error('💥 useDownloads: Erro ao adicionar download:', err);
      return false;
    }
  };

  // Remover download
  const removeDownload = async (audioId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('➖ useDownloads: Removendo download:', audioId);

      const { error } = await supabase
        .from('user_downloads')
        .delete()
        .eq('user_id', user.id)
        .eq('audio_id', audioId);

      if (error) {
        console.error('❌ useDownloads: Erro ao remover download:', error);
        return false;
      }

      console.log('✅ useDownloads: Download removido');
      
      // Recarregar downloads
      await fetchDownloads();
      
      return true;
    } catch (err) {
      console.error('💥 useDownloads: Erro ao remover download:', err);
      return false;
    }
  };

  // Verificar se áudio foi baixado
  const isDownloaded = (audioId: string): boolean => {
    return downloads.some(dl => dl.audio_id === audioId);
  };

  // Toggle download (adicionar se não está, remover se está)
  const toggleDownload = async (audioId: string): Promise<boolean> => {
    if (isDownloaded(audioId)) {
      return await removeDownload(audioId);
    } else {
      return await addDownload({ audio_id: audioId });
    }
  };

  // Contar total de downloads
  const getDownloadsCount = (): number => {
    return downloads.length;
  };

  // Calcular tamanho total dos downloads
  const getTotalSize = (): number => {
    return downloads.reduce((total, download) => total + (download.file_size || 0), 0);
  };

  // Formatar tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Formatar data de download
  const formatDownloadDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Hoje';
    } else if (diffInDays === 1) {
      return 'Ontem';
    } else if (diffInDays < 7) {
      return `Há ${diffInDays} dias`;
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'short' 
      });
    }
  };

  // Carregar downloads quando usuário mudar
  useEffect(() => {
    fetchDownloads();
  }, [user]);

  return {
    downloads,
    loading,
    error,
    addDownload,
    removeDownload,
    toggleDownload,
    isDownloaded,
    getDownloadsCount,
    getTotalSize,
    formatFileSize,
    formatDownloadDate,
    refetch: fetchDownloads
  };
}