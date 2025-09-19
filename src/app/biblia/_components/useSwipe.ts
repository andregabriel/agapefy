// CHANGELOG: Fase 7B – navegação por swipe
"use client";

import { useEffect, useRef } from 'react';

interface SwipeConfig {
  threshold: number;
  maxAngle: number;
  timeout: number;
  debounce?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function useSwipe(elementRef: React.RefObject<HTMLElement>, config: SwipeConfig) {
  const startPoint = useRef<TouchPoint | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Limpar timeout anterior se existir
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      startPoint.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now()
      };

      // Timeout para limpar o gesto se demorar muito
      timeoutRef.current = setTimeout(() => {
        startPoint.current = null;
        timeoutRef.current = null;
      }, config.timeout);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!startPoint.current) return;

      const deltaX = e.clientX - startPoint.current.x;
      const deltaY = e.clientY - startPoint.current.y;
      const deltaTime = Date.now() - startPoint.current.time;

      // Verificar se excedeu o timeout
      if (deltaTime > config.timeout) {
        startPoint.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Verificar se atingiu o threshold horizontal
      if (Math.abs(deltaX) >= config.threshold) {
        // Calcular ângulo: |dy/dx|
        const angle = Math.abs(deltaY / deltaX);
        
        // Verificar se é predominantemente horizontal
        if (angle <= config.maxAngle) {
          // Verificar se não está em debounce
          if (debounceRef.current) {
            return; // Ignorar se ainda em debounce
          }

          // Swipe válido detectado
          if (deltaX > 0) {
            // Swipe para direita
            console.log("[biblia:swipe]", "right");
            config.onSwipeRight?.();
          } else {
            // Swipe para esquerda
            console.log("[biblia:swipe]", "left");
            config.onSwipeLeft?.();
          }

          // Aplicar debounce se configurado
          if (config.debounce && config.debounce > 0) {
            debounceRef.current = setTimeout(() => {
              debounceRef.current = null;
            }, config.debounce);
          }

          // Limpar estado
          startPoint.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      }
    };

    const handlePointerUp = () => {
      // Limpar estado ao soltar
      startPoint.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handlePointerCancel = () => {
      // Limpar estado se o gesto for cancelado
      startPoint.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    // Adicionar listeners com passive: true
    element.addEventListener('pointerdown', handlePointerDown, { passive: true });
    element.addEventListener('pointermove', handlePointerMove, { passive: true });
    element.addEventListener('pointerup', handlePointerUp, { passive: true });
    element.addEventListener('pointercancel', handlePointerCancel, { passive: true });

    // Cleanup
    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerCancel);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [elementRef, config]);
}