"use client";

import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface AnalyticsEvent {
  event_type: string;
  event_data?: Record<string, any>;
  user_id?: string;
  session_id?: string;
}

export function useAnalytics() {
  const { user } = useAuth();

  // Gerar session ID único para esta sessão
  const getSessionId = useCallback(() => {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }, []);

  // Função para registrar eventos
  const trackEvent = useCallback(async (eventType: string, eventData?: Record<string, any>) => {
    try {
      const event: AnalyticsEvent = {
        event_type: eventType,
        event_data: eventData || {},
        user_id: user?.id || null,
        session_id: getSessionId()
      };

      // Salvar no localStorage para backup (caso Supabase falhe)
      const localEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      localEvents.push({
        ...event,
        timestamp: new Date().toISOString()
      });
      
      // Manter apenas últimos 100 eventos localmente
      if (localEvents.length > 100) {
        localEvents.splice(0, localEvents.length - 100);
      }
      localStorage.setItem('analytics_events', JSON.stringify(localEvents));

      // Tentar salvar no Supabase (não bloquear se falhar)
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          event_type: eventType,
          event_data: eventData || {},
          user_id: user?.id || null,
          session_id: getSessionId(),
          created_at: new Date().toISOString()
        });

      if (error) {
        console.warn('⚠️ Analytics: Erro ao salvar evento (continuando normalmente):', error);
      } else {
        console.log('📊 Analytics: Evento registrado:', eventType, eventData);
      }

    } catch (error) {
      console.warn('⚠️ Analytics: Erro inesperado (continuando normalmente):', error);
    }
  }, [user, getSessionId]);

  // Eventos específicos da comunidade
  const trackCommunityEvent = useCallback((action: string, details?: Record<string, any>) => {
    trackEvent('community_action', {
      action,
      ...details,
      page: 'amigos'
    });
  }, [trackEvent]);

  // Track de performance
  const trackPerformance = useCallback((metric: string, value: number, context?: Record<string, any>) => {
    trackEvent('performance_metric', {
      metric,
      value,
      context: context || {},
      user_agent: navigator.userAgent,
      timestamp: Date.now()
    });
  }, [trackEvent]);

  // Track de erros
  const trackError = useCallback((error: string, context?: Record<string, any>) => {
    trackEvent('error_occurred', {
      error,
      context: context || {},
      url: window.location.href,
      user_agent: navigator.userAgent
    });
  }, [trackEvent]);

  // Track de engajamento
  const trackEngagement = useCallback((type: string, duration?: number, details?: Record<string, any>) => {
    trackEvent('user_engagement', {
      engagement_type: type,
      duration_seconds: duration,
      details: details || {},
      page: window.location.pathname
    });
  }, [trackEvent]);

  // Registrar visita à página automaticamente
  useEffect(() => {
    trackEvent('page_view', {
      page: window.location.pathname,
      referrer: document.referrer,
      user_agent: navigator.userAgent
    });

    // Track tempo na página
    const startTime = Date.now();
    
    const handleBeforeUnload = () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      trackEngagement('page_time', timeSpent, {
        page: window.location.pathname
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); // Track ao sair do componente
    };
  }, [trackEvent, trackEngagement]);

  return {
    trackEvent,
    trackCommunityEvent,
    trackPerformance,
    trackError,
    trackEngagement
  };
}