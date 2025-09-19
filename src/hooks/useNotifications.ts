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
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Carregar configurações do localStorage
  useEffect(() => {
    if (user) {
      const savedSettings = localStorage.getItem(`notifications_${user.id}`);
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings));
        } catch (error) {
          console.error('Erro ao carregar configurações:', error);
        }
      }
    }
  }, [user]);

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
        console.error('Erro na query de notificações:', error);
        toast.error('Erro ao carregar notificações');
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
      console.error('Erro geral ao buscar notificações:', error);
      toast.error('Erro ao carregar notificações');
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
        console.error('Erro ao marcar notificação como lida:', error);
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
      console.error('Erro ao marcar notificação como lida:', error);
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
        console.error('Erro ao marcar todas como lidas:', error);
        return;
      }

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );

      setUnreadCount(0);
      console.log('✅ Todas as notificações marcadas como lidas');
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  }, [user]);

  // Carregar notificações quando usuário estiver disponível
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // Salvar configurações no localStorage
  const saveSettings = useCallback((newSettings: NotificationSettings) => {
    if (user) {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(newSettings));
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