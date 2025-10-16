"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Heart, Download, Plus, Check } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useDownloads } from '@/hooks/useDownloads';
import { useRoutinePlaylist } from '@/hooks/useRoutinePlaylist';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AudioActionButtonsProps {
  audioId: string;
  audioTitle: string;
  variant?: 'default' | 'compact';
  className?: string;
  hideDownload?: boolean;
}

export function AudioActionButtons({ 
  audioId, 
  audioTitle, 
  variant = 'default',
  className = '',
  hideDownload = false
}: AudioActionButtonsProps) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isDownloaded, toggleDownload } = useDownloads();
  const { isAudioInRoutine, addAudioToRoutine, removeAudioFromRoutine } = useRoutinePlaylist();

  if (!user) {
    return null; // Não mostra botões se usuário não estiver logado
  }

  const isAudioFavorite = isFavorite(audioId);
  const isAudioDownloaded = isDownloaded(audioId);
  const isInRoutine = isAudioInRoutine(audioId);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const success = await toggleFavorite(audioId);
      if (success) {
        if (isAudioFavorite) {
          toast.success(`"${audioTitle}" removido dos favoritos`);
        } else {
          toast.success(`"${audioTitle}" adicionado aos favoritos`);
        }
      } else {
        toast.error('Erro ao atualizar favoritos');
      }
    } catch (error) {
      console.error('Erro ao favoritar:', error);
      toast.error('Erro inesperado');
    }
  };

  const handleToggleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const success = await toggleDownload(audioId);
      if (success) {
        if (isAudioDownloaded) {
          toast.success(`"${audioTitle}" removido dos downloads`);
        } else {
          toast.success(`"${audioTitle}" baixado com sucesso`);
        }
      } else {
        toast.error('Erro ao gerenciar download');
      }
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast.error('Erro inesperado');
    }
  };

  const handleToggleRoutine = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (isInRoutine) {
        const success = await removeAudioFromRoutine(audioId);
        if (success) {
          toast.success(`"${audioTitle}" removido da rotina`);
        } else {
          toast.error('Erro ao remover da rotina');
        }
      } else {
        const success = await addAudioToRoutine(audioId);
        if (success) {
          toast.success(`"${audioTitle}" adicionado à rotina`);
        } else {
          toast.error('Erro ao adicionar à rotina');
        }
      }
    } catch (error) {
      console.error('Erro ao gerenciar rotina:', error);
      toast.error('Erro inesperado');
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleFavorite}
          className={`p-2 ${isAudioFavorite ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
        >
          <Heart size={16} fill={isAudioFavorite ? 'currentColor' : 'none'} />
        </Button>
        {!hideDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleDownload}
            className={`p-2 ${isAudioDownloaded ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-green-500'}`}
          >
            <Download size={16} fill={isAudioDownloaded ? 'currentColor' : 'none'} />
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleRoutine}
          className={`p-2 ${isInRoutine ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}
        >
          {isInRoutine ? <Check size={16} /> : <Plus size={16} />}
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleFavorite}
        className={`${isAudioFavorite ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
        title={isAudioFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <Heart size={20} fill={isAudioFavorite ? 'currentColor' : 'none'} />
      </Button>
      
      {!hideDownload && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleDownload}
          className={`${isAudioDownloaded ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-green-500'}`}
          title={isAudioDownloaded ? 'Remover download' : 'Baixar áudio'}
        >
          <Download size={20} fill={isAudioDownloaded ? 'currentColor' : 'none'} />
        </Button>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleRoutine}
        className={`${isInRoutine ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}
        title={isInRoutine ? 'Remover da rotina' : 'Adicionar à rotina'}
      >
        {isInRoutine ? <Check size={20} /> : <Plus size={20} />}
      </Button>
    </div>
  );
}