"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NotificationSettings {
  likes: boolean;
  comments: boolean;
  intercessions: boolean;
  daily_reminders: boolean;
  friend_activities: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'intercession' | 'friend_activity';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  related_post_id?: string;
  from_user_id?: string;
  from_user?: {
    full_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  likes: true,
  comments: true,
  intercessions: true,
  daily_reminders: true,
  friend_activities: false, // Para futuro sistema de amigos
};

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [novidadesEnabled, setNovidadesEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Carregar configuração de novidades do banco de dados
  const loadNovidadesSetting = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_novidades')
        .eq('id', user.id)
        .single();

      // Erros esperados que não devem ser logados:
      // - PGRST116: registro não encontrado (esperado para novos usuários)
      // - 42703: coluna não existe (esperado se migration não foi executada ainda)
      // - 42883: coluna não existe (outro código possível)
      const expectedErrors = ['PGRST116', '42703', '42883'];
      const errorCode = error?.code || error?.message?.match(/42703|42883/)?.[0];
      
      if (error && !expectedErrors.includes(errorCode)) {
        // Apenas logar erros reais e inesperados (sem quebrar UX)
        const { logDbError } = await import('@/lib/utils');
        logDbError('Erro ao carregar configuração de novidades', error);
        // Em caso de erro inesperado, usar padrão true
        setNovidadesEnabled(true);
        return;
      }

      // Se existe no banco, usar valor do banco; caso contrário, usar padrão true
      if (data?.notification_novidades !== undefined && data?.notification_novidades !== null) {
        setNovidadesEnabled(data.notification_novidades);
      } else {
        setNovidadesEnabled(true);
      }
    } catch (error: any) {
      // Verificar se é erro esperado de coluna não encontrada
      const errorMessage = error?.message || '';
      const isExpectedError = errorMessage.includes('42703') || 
                               errorMessage.includes('42883') ||
                               (errorMessage.includes('column') && errorMessage.includes('does not exist'));
      
      if (!isExpectedError) {
        // Apenas logar erros reais e inesperados (sem overlay vermelho)
        const { logDbError } = await import('@/lib/utils');
        logDbError('Erro ao carregar configuração de novidades (catch)', error);
      }
      
      // Em qualquer caso de erro, usar padrão true
      setNovidadesEnabled(true);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadNovidadesSetting();
      // Futuramente: podemos carregar configurações adicionais de notificação do banco, se necessário
    }
  }, [user, loadNovidadesSetting]);

  const updateNovidades = async (enabled: boolean) => {
    if (!user) return;

    setNovidadesEnabled(enabled);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          notification_novidades: enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (error) {
        // Verificar se é erro de coluna não existe (migration não executada)
        const errorMessage = error?.message || '';
        const errorCode = (error as any)?.code || '';
        const isColumnError =
          errorCode === '42703' ||
          errorCode === '42883' ||
          errorMessage.includes('42703') ||
          errorMessage.includes('42883') ||
          (errorMessage.includes('column') && errorMessage.includes('does not exist'));
        
        const { logDbError } = await import('@/lib/utils');

        if (isColumnError) {
          // Se a coluna ainda não existe, manter apenas em memória e não quebrar UX
          logDbError('Coluna notification_novidades ausente ao salvar configuração', error);
          return;
        }
        
        // Para outros erros, logar e reverter para o valor anterior
        logDbError('Erro ao salvar configuração de novidades', error);
        setNovidadesEnabled(!enabled);
        toast.error('Erro ao salvar configuração');
      } else {
        console.log('✅ Configuração de novidades salva no banco');
      }
    } catch (error: any) {
      // Verificar se é erro de coluna não existe
      const errorMessage = error?.message || '';
      const errorCode = (error as any)?.code || '';
      const isColumnError =
        errorCode === '42703' ||
        errorCode === '42883' ||
        errorMessage.includes('42703') ||
        errorMessage.includes('42883') ||
        (errorMessage.includes('column') && errorMessage.includes('does not exist'));
      
      const { logDbError } = await import('@/lib/utils');

      if (isColumnError) {
        // Se a coluna ainda não existe, apenas logar e manter em memória
        logDbError('Coluna notification_novidades ausente ao salvar configuração (catch)', error);
        return;
      }
      
      // Erro inesperado: logar e reverter para valor anterior
      logDbError('Erro inesperado ao salvar configuração de novidades', error);
      setNovidadesEnabled(!enabled);
      toast.error('Erro ao salvar configuração');
    }
  };

  // Buscar dados do usuário por ID
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Usuário não encontrado no profiles:', userId);
        return null;
      }

      return data;
    } catch (error) {
      console.log('Erro ao buscar dados do usuário:', error);
      return null;
    }
  }, []);

  // Buscar notificações do Supabase
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('🔍 Buscando notificações para usuário:', user.id);

      // Primeiro, buscar notificações simples
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('Erro na query de notificações', error);
        // Evitar poluir UX com toast quando a tabela não existir/sem dados
        return;
      }

      console.log('📬 Notificações encontradas:', notificationsData?.length || 0);

      if (!notificationsData || notificationsData.length === 0) {
        setNotifications([]);
        setUnreadCount(0);
        console.log('📭 Nenhuma notificação encontrada');
        return;
      }

      // Buscar dados dos usuários que enviaram as notificações
      const notificationsWithUsers = await Promise.all(
        notificationsData.map(async (notification) => {
          let fromUser = null;
          
          if (notification.from_user_id) {
            fromUser = await fetchUserData(notification.from_user_id);
          }

          return {
            ...notification,
            from_user: fromUser
          };
        })
      );

      setNotifications(notificationsWithUsers);
      
      // Contar não lidas
      const unread = notificationsWithUsers.filter(n => !n.read).length;
      setUnreadCount(unread);

      console.log(`✅ ${notificationsWithUsers.length} notificações carregadas, ${unread} não lidas`);
    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('Erro geral ao buscar notificações', error);
      // Evitar toast ruidoso
    } finally {
      setLoading(false);
    }
  }, [user, fetchUserData]);

  // Marcar notificação específica como lida
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('Erro ao marcar notificação como lida', error);
        return;
      }

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );

      // Atualizar contador
      setUnreadCount(prev => Math.max(0, prev - 1));

      console.log('✅ Notificação marcada como lida');
    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('Erro ao marcar notificação como lida', error);
    }
  }, [user]);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('Erro ao marcar todas como lidas', error);
        return;
      }

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );

      setUnreadCount(0);
      console.log('✅ Todas as notificações marcadas como lidas');
    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('Erro ao marcar todas como lidas', error);
    }
  }, [user]);

  // Carregar notificações quando usuário estiver disponível
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const saveSettings = useCallback((newSettings: NotificationSettings) => {
    if (user) {
      setSettings(newSettings);
      console.log('✅ Configurações de notificação salvas');
    }
  }, [user]);

  // Atualizar configuração específica
  const updateSetting = useCallback((key: keyof NotificationSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Mostrar toast de notificação
  const showNotificationToast = useCallback((
    type: 'like' | 'comment' | 'intercession',
    fromUserName: string,
    postType?: string
  ) => {
    // Verificar se o tipo de notificação está habilitado
    if (!settings[`${type}s` as keyof NotificationSettings]) {
      return;
    }

    let message = '';
    let emoji = '';

    switch (type) {
      case 'like':
        emoji = '❤️';
        message = `${fromUserName} curtiu ${postType ? `sua ${postType}` : 'seu post'}`;
        break;
      case 'comment':
        emoji = '💬';
        message = `${fromUserName} comentou ${postType ? `na sua ${postType}` : 'no seu post'}`;
        break;
      case 'intercession':
        emoji = '🙏';
        message = `${fromUserName} orou por você`;
        break;
    }

    toast(message, {
      icon: emoji,
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#1f2937',
        border: '1px solid #374151',
        color: '#f9fafb',
      },
    });

    console.log(`🔔 Notificação: ${message}`);
  }, [settings]);

  // Simular notificações (para demonstração)
  const simulateNotification = useCallback((type: 'like' | 'comment' | 'intercession') => {
    const mockUsers = ['Maria Silva', 'João Santos', 'Ana Costa', 'Pedro Lima'];
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const postTypes = ['intenção', 'oração'];
    const randomPostType = postTypes[Math.floor(Math.random() * postTypes.length)];
    
    showNotificationToast(type, randomUser, randomPostType);
  }, [showNotificationToast]);

  return {
    notifications,
    settings,
    novidadesEnabled,
    updateNovidades,
    unreadCount,
    loading,
    updateSetting,
    saveSettings,
    showNotificationToast,
    simulateNotification,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  };
}