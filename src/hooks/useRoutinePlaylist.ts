"use client";

import { useRoutine } from '@/contexts/RoutineContext';
import type { RoutinePlaylist } from '@/contexts/RoutineContext';

// Re-exportar o tipo para compatibilidade
export type { RoutinePlaylist } from '@/contexts/RoutineContext';

// Hook de compatibilidade que usa o contexto compartilhado
export function useRoutinePlaylist() {
  const context = useRoutine();
  
  return {
    routinePlaylist: context.routinePlaylist,
    loading: context.loading,
    error: context.error,
    addAudioToRoutine: context.addAudioToRoutine,
    removeAudioFromRoutine: context.removeAudioFromRoutine,
    isAudioInRoutine: context.isAudioInRoutine,
    refetch: context.refetch
  };
}
