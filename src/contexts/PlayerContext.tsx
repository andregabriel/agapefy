"use client";

import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { useUserActivity } from '@/hooks/useUserActivity';
import { useAuth } from '@/contexts/AuthContext';

interface Audio {
  id: string;
  title: string;
  description?: string | null;
  audio_url: string;
  duration?: number | null;
  cover_url?: string | null;
  category?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    created_at: string;
  };
}

interface PlayerState {
  currentAudio: Audio | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Audio[];
  currentIndex: number;
  isLoading: boolean;
}

type PlayerAction =
  | { type: 'SET_AUDIO'; payload: Audio }
  | { type: 'SET_QUEUE'; payload: { queue: Audio[]; index: number } }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: PlayerState = {
  currentAudio: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  queue: [],
  currentIndex: -1,
  isLoading: false,
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'SET_AUDIO':
      return {
        ...state,
        currentAudio: action.payload,
        currentTime: 0,
        isLoading: true,
        isPlaying: true, // Auto-play quando novo áudio é definido
      };
    case 'SET_QUEUE':
      return {
        ...state,
        queue: action.payload.queue,
        currentIndex: action.payload.index,
        currentAudio: action.payload.queue[action.payload.index] || null,
        currentTime: 0,
        isLoading: true,
        isPlaying: true, // Auto-play quando nova queue é definida
      };
    case 'PLAY':
      return { ...state, isPlaying: true };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'NEXT':
      if (state.currentIndex < state.queue.length - 1) {
        const nextIndex = state.currentIndex + 1;
        return {
          ...state,
          currentIndex: nextIndex,
          currentAudio: state.queue[nextIndex],
          currentTime: 0,
          isLoading: true,
          isPlaying: true, // Auto-play próximo áudio
        };
      }
      return state;
    case 'PREVIOUS':
      if (state.currentIndex > 0) {
        const prevIndex = state.currentIndex - 1;
        return {
          ...state,
          currentIndex: prevIndex,
          currentAudio: state.queue[prevIndex],
          currentTime: 0,
          isLoading: true,
          isPlaying: true, // Auto-play áudio anterior
        };
      }
      return state;
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

interface PlayerContextType {
  state: PlayerState;
  playAudio: (audio: Audio) => void;
  playQueue: (queue: Audio[], startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer deve ser usado dentro de PlayerProvider');
  }
  return context;
};

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const { logActivity } = useUserActivity();
  
  // Refs para controle de atividade
  const activityStartTimeRef = useRef<number | null>(null);
  const lastLoggedAudioRef = useRef<string | null>(null);

  // Registrar início de reprodução
  const logPlayActivity = async (audio: Audio) => {
    if (!user || !audio) return;
    
    try {
      console.log('🎵 Registrando início de reprodução:', audio.title);
      activityStartTimeRef.current = Date.now();
      lastLoggedAudioRef.current = audio.id;
      
      await logActivity({
        audio_id: audio.id,
        activity_type: 'play',
        duration_listened: 0,
        completed: false
      });
    } catch (error) {
      console.error('❌ Erro ao registrar atividade de play:', error);
    }
  };

  // Registrar fim de reprodução ou pausa
  const logEndActivity = async (audio: Audio, completed: boolean = false) => {
    if (!user || !audio || !activityStartTimeRef.current) return;
    
    try {
      const durationListened = Math.floor((Date.now() - activityStartTimeRef.current) / 1000);
      
      if (durationListened > 5) { // Só registra se ouviu por mais de 5 segundos
        console.log('🎵 Registrando fim de reprodução:', audio.title, 'Duração:', durationListened, 'Completo:', completed);
        
        await logActivity({
          audio_id: audio.id,
          activity_type: completed ? 'completed' : 'pause',
          duration_listened: durationListened,
          completed: completed
        });
      }
      
      activityStartTimeRef.current = null;
    } catch (error) {
      console.error('❌ Erro ao registrar atividade de fim:', error);
    }
  };

  // Inicializar elemento de áudio
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const handleLoadedMetadata = () => {
      dispatch({ type: 'SET_DURATION', payload: audio.duration });
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    const handleTimeUpdate = () => {
      dispatch({ type: 'SET_CURRENT_TIME', payload: audio.currentTime });
    };

    const handleEnded = () => {
      // Registrar como completo
      if (state.currentAudio) {
        logEndActivity(state.currentAudio, true);
      }
      
      // Auto-play próximo áudio se houver na playlist
      if (state.currentIndex < state.queue.length - 1) {
        console.log('🎵 Auto-play: Passando para próximo áudio da playlist');
        dispatch({ type: 'NEXT' });
      } else {
        console.log('🎵 Playlist finalizada - pausando reprodução');
        dispatch({ type: 'PAUSE' });
      }
    };

    const handleError = (e: Event) => {
      console.error('🎵 Erro no áudio:', e);
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'PAUSE' });
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [state.currentIndex, state.queue.length, state.currentAudio]);

  // Atualizar src do áudio quando currentAudio muda
  useEffect(() => {
    if (state.currentAudio && audioRef.current) {
      console.log('🎵 Carregando novo áudio:', state.currentAudio.title);
      audioRef.current.src = state.currentAudio.audio_url;
      audioRef.current.load();
      
      // Registrar nova reprodução
      if (lastLoggedAudioRef.current !== state.currentAudio.id) {
        logPlayActivity(state.currentAudio);
      }
    }
  }, [state.currentAudio]);

  // Controlar play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (state.isPlaying && !state.isLoading) {
        console.log('🎵 Reproduzindo áudio');
        audioRef.current.play().catch((error) => {
          console.error('🎵 Erro ao reproduzir:', error);
          dispatch({ type: 'PAUSE' });
        });
      } else {
        console.log('🎵 Pausando áudio');
        audioRef.current.pause();
        
        // Registrar pausa se estava tocando
        if (state.currentAudio && activityStartTimeRef.current) {
          logEndActivity(state.currentAudio, false);
        }
      }
    }
  }, [state.isPlaying, state.isLoading, state.currentAudio]);

  // Controlar volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [state.volume]);

  const playAudio = (audio: Audio) => {
    console.log('🎵 Tocando áudio individual:', audio.title);
    dispatch({ type: 'SET_AUDIO', payload: audio });
    dispatch({ type: 'SET_QUEUE', payload: { queue: [audio], index: 0 } });
  };

  const playQueue = (queue: Audio[], startIndex = 0) => {
    console.log('🎵 Tocando playlist com', queue.length, 'áudios, iniciando no índice', startIndex);
    dispatch({ type: 'SET_QUEUE', payload: { queue, index: startIndex } });
  };

  const play = () => {
    console.log('🎵 Comando: Play');
    dispatch({ type: 'PLAY' });
  };

  const pause = () => {
    console.log('🎵 Comando: Pause');
    dispatch({ type: 'PAUSE' });
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      console.log('🎵 Buscando posição:', time);
      audioRef.current.currentTime = time;
      dispatch({ type: 'SET_CURRENT_TIME', payload: time });
    }
  };

  const setVolume = (volume: number) => {
    console.log('🎵 Ajustando volume:', volume);
    dispatch({ type: 'SET_VOLUME', payload: volume });
  };

  const next = () => {
    console.log('🎵 Comando: Próximo');
    dispatch({ type: 'NEXT' });
  };

  const previous = () => {
    console.log('🎵 Comando: Anterior');
    dispatch({ type: 'PREVIOUS' });
  };

  const value = {
    state,
    playAudio,
    playQueue,
    play,
    pause,
    seekTo,
    setVolume,
    next,
    previous,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};