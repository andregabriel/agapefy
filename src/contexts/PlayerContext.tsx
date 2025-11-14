"use client";

import React, { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react';
import { useUserActivity } from '@/hooks/useUserActivity';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { parsePaywallPermissions, type SubscriptionUserType } from '@/constants/paywall';

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

function buildFreePlayStorageKey(userKey: string) {
  return `agapefy_free_plays_v1_${userKey || 'anon'}`;
}

function checkAndIncrementFreePlay(
  userKey: string,
  maxFreePerDay: number,
): { allowed: boolean; count: number; max: number } {
  if (typeof window === 'undefined' || maxFreePerDay <= 0) {
    return { allowed: true, count: 0, max: maxFreePerDay };
  }

  try {
    const key = buildFreePlayStorageKey(userKey);
    const today = new Date().toISOString().slice(0, 10);
    const raw = window.localStorage.getItem(key);

    let data: { date: string; count: number } = { date: today, count: 0 };

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { date?: string; count?: number };
        if (parsed && parsed.date === today && typeof parsed.count === 'number') {
          data = { date: parsed.date, count: parsed.count };
        }
      } catch {
        // ignora e usa defaults
      }
    }

    if (data.date !== today) {
      data = { date: today, count: 0 };
    }

    if (data.count >= maxFreePerDay) {
      return { allowed: false, count: data.count, max: maxFreePerDay };
    }

    const next = { date: today, count: data.count + 1 };
    window.localStorage.setItem(key, JSON.stringify(next));

    return { allowed: true, count: next.count, max: maxFreePerDay };
  } catch {
    return { allowed: true, count: 0, max: maxFreePerDay };
  }
}

function openPaywall(userType: SubscriptionUserType, reason: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('agapefy:paywall-open', {
        detail: { userType, reason },
      }),
    );
  } catch (e) {
    console.error('Erro ao disparar evento de paywall:', e);
  }
}

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
  const { settings } = useAppSettings();
  const { userType, hasActiveSubscription, hasActiveTrial } = useSubscriptionStatus();
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

  const canCurrentUserPlayAnotherAudio = useCallback((): boolean => {
    const effectiveUserType: SubscriptionUserType =
      userType || (user ? 'no_subscription' : 'anonymous');

    const permissions = parsePaywallPermissions(settings.paywall_permissions);

    // Assinantes/trial com acesso total
    if (effectiveUserType === 'active_subscription') {
      if (permissions.active_subscription.full_access_enabled || hasActiveSubscription) {
        return true;
      }
      // se acesso total estiver desligado, cai para regra de no_subscription
    }

    if (effectiveUserType === 'trial') {
      if (permissions.trial.full_access_enabled || hasActiveTrial) {
        return true;
      }
      // se acesso total estiver desligado, cai para regra de no_subscription
    }

    // Usuário não logado
    if (effectiveUserType === 'anonymous') {
      if (!permissions.anonymous.limit_enabled) return true;
      const userKey = 'anon';
      const result = checkAndIncrementFreePlay(
        userKey,
        permissions.anonymous.max_free_audios_per_day,
      );
      if (!result.allowed) {
        openPaywall(effectiveUserType, 'limit_reached');
      }
      return result.allowed;
    }

    // Usuário logado sem assinatura ativa OU assinante/trial com acesso total desligado
    if (effectiveUserType === 'no_subscription' || effectiveUserType === 'active_subscription' || effectiveUserType === 'trial') {
      if (!permissions.no_subscription.limit_enabled) return true;
      const userKey = user?.id || 'anon';
      const result = checkAndIncrementFreePlay(
        userKey,
        permissions.no_subscription.max_free_audios_per_day,
      );
      if (!result.allowed) {
        openPaywall(effectiveUserType, 'limit_reached');
      }
      return result.allowed;
    }

    return true;
  }, [
    userType,
    user,
    settings.paywall_permissions,
    hasActiveSubscription,
    hasActiveTrial,
  ]);

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
      const target = e.target as HTMLAudioElement;
      const error = target.error;
      
      // Ignorar erros quando o src está vazio (limpeza intencional)
      if (!target.src || target.src === window.location.href) {
        return;
      }
      
      // Logar apenas erros reais
      if (error) {
        let errorMessage = 'Erro desconhecido';
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Reprodução abortada';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Erro de rede';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Erro ao decodificar áudio';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Formato de áudio não suportado';
            break;
        }
        console.error('🎵 Erro no áudio:', errorMessage, error);
      }
      
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
    if (!audioRef.current) return;
    
    if (state.currentAudio) {
      // Pausar e resetar o áudio anterior antes de carregar o novo
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Só atualizar src se for diferente do atual
      const currentSrc = audioRef.current.src;
      const newSrc = state.currentAudio.audio_url;
      
      if (currentSrc !== newSrc) {
        console.log('🎵 Carregando novo áudio:', state.currentAudio.title);
        audioRef.current.src = newSrc;
        audioRef.current.load();
      }
      
      // Registrar nova reprodução
      if (lastLoggedAudioRef.current !== state.currentAudio.id) {
        logPlayActivity(state.currentAudio);
      }
    } else {
      // Se não há áudio atual, apenas pausar (não limpar src para evitar erros)
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [state.currentAudio]);

  // Controlar play/pause
  useEffect(() => {
    if (!audioRef.current) return;
    
    // Sempre pausar primeiro se não está tocando ou está carregando
    if (!state.isPlaying || state.isLoading) {
      if (!audioRef.current.paused) {
        console.log('🎵 Pausando áudio');
        audioRef.current.pause();
        
        // Registrar pausa se estava tocando
        if (state.currentAudio && activityStartTimeRef.current) {
          logEndActivity(state.currentAudio, false);
        }
      }
      return;
    }
    
    // Só reproduzir se está tocando, não está carregando e há um áudio atual
    if (state.isPlaying && !state.isLoading && state.currentAudio) {
      console.log('🎵 Reproduzindo áudio');
      audioRef.current.play().catch((error) => {
        console.error('🎵 Erro ao reproduzir:', error);
        dispatch({ type: 'PAUSE' });
      });
    }
  }, [state.isPlaying, state.isLoading, state.currentAudio]);

  // Controlar volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [state.volume]);

  const playAudio = (audio: Audio) => {
    // Verificar permissões antes de iniciar um novo áudio
    if (!canCurrentUserPlayAnotherAudio()) {
      console.log('🎵 Reprodução bloqueada pelo limite de áudios gratuitos');
      return;
    }
    // Pausar e resetar áudio atual antes de tocar novo
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Resetar estado de playing antes de definir novo áudio
    dispatch({ type: 'PAUSE' });
    console.log('🎵 Tocando áudio individual:', audio.title);
    dispatch({ type: 'SET_AUDIO', payload: audio });
    dispatch({ type: 'SET_QUEUE', payload: { queue: [audio], index: 0 } });
  };

  const playQueue = (queue: Audio[], startIndex = 0) => {
    // Verificar permissões apenas ao iniciar uma nova fila
    if (!canCurrentUserPlayAnotherAudio()) {
      console.log('🎵 Reprodução de playlist bloqueada pelo limite de áudios gratuitos');
      return;
    }
    // Pausar e resetar áudio atual antes de tocar nova playlist
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Resetar estado de playing antes de definir nova queue
    dispatch({ type: 'PAUSE' });
    console.log('🎵 Tocando playlist com', queue.length, 'áudios, iniciando no índice', startIndex);
    dispatch({ type: 'SET_QUEUE', payload: { queue, index: startIndex } });
  };

  const play = useCallback(() => {
    console.log('🎵 Comando: Play');
    dispatch({ type: 'PLAY' });
  }, []);

  const pause = useCallback(() => {
    console.log('🎵 Comando: Pause');
    dispatch({ type: 'PAUSE' });
  }, []);

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