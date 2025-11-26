"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: Profile;
}

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
  other_user?: Profile;
  last_message?: Message;
  unread_count?: number;
}

export function useMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Buscar conversas do usuário
  const fetchConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Evita logar e-mail do usuário no console; usa apenas o ID para debug
      console.log('🔍 Buscando conversas do usuário (id):', user.id);

      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select(`
          id,
          user1_id,
          user2_id,
          last_message_at,
          created_at
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ Erro ao buscar conversas', error);
        return;
      }

      console.log('✅ Conversas encontradas:', conversationsData?.length || 0);

      // Para cada conversa, buscar dados do outro usuário e última mensagem
      const conversationsWithDetails = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;

          // Buscar perfil do outro usuário
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', otherUserId)
            .maybeSingle();

          // Buscar última mensagem
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('id, content, created_at, sender_id, read')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Contar mensagens não lidas
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('read', false)
            .neq('sender_id', user.id);

          return {
            ...conv,
            other_user: profile,
            last_message: lastMessage,
            unread_count: unreadCount || 0
          };
        })
      );

      setConversations(conversationsWithDetails);

      // Calcular total de mensagens não lidas
      const total = conversationsWithDetails.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setTotalUnreadCount(total);

    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 Erro ao buscar conversas', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  // Buscar ou criar conversa com outro usuário
  const getOrCreateConversation = async (otherUserId: string): Promise<string | null> => {
    if (!user || user.id === otherUserId) return null;

    try {
      console.log('🔍 Buscando conversa com usuário:', otherUserId);

      // Verificar se já existe conversa
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingConv) {
        console.log('✅ Conversa existente encontrada:', existingConv.id);
        return existingConv.id;
      }

      // Criar nova conversa
      console.log('➕ Criando nova conversa');
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user1_id: user.id,
          user2_id: otherUserId
        })
        .select('id')
        .single();

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ Erro ao criar conversa', error);
        toast.error('Erro ao iniciar conversa');
        return null;
      }

      console.log('✅ Nova conversa criada:', newConv.id);
      
      // Atualizar lista de conversas
      fetchConversations();
      
      return newConv.id;

    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 Erro ao criar conversa', error);
      toast.error('Erro ao iniciar conversa');
      return null;
    }
  };

  // Buscar usuários para iniciar conversa
  const searchUsers = async (query: string): Promise<Profile[]> => {
    if (!query.trim() || query.length < 2) return [];

    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .neq('id', user?.id || '')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        return [];
      }

      return users || [];
    } catch (error) {
      console.error('💥 Erro ao buscar usuários:', error);
      return [];
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  return {
    conversations,
    loading,
    totalUnreadCount,
    fetchConversations,
    getOrCreateConversation,
    searchUsers
  };
}

// Hook para gerenciar mensagens de uma conversa específica
export function useConversationMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Buscar mensagens da conversa
  const fetchMessages = async () => {
    if (!conversationId || !user) return;

    try {
      setLoading(true);
      console.log('🔍 Buscando mensagens da conversa:', conversationId);

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          read,
          created_at,
          sender:profiles!sender_id(id, username, full_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ Erro ao buscar mensagens', error);
        return;
      }

      console.log('✅ Mensagens encontradas:', messagesData?.length || 0);
      setMessages(messagesData || []);

      // Marcar mensagens como lidas
      await markMessagesAsRead();

    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 Erro ao buscar mensagens', error);
    } finally {
      setLoading(false);
    }
  };

  // Enviar mensagem
  const sendMessage = async (content: string): Promise<boolean> => {
    if (!conversationId || !user || !content.trim()) return false;

    try {
      // Não logar o conteúdo da mensagem no console (dado sensível)
      console.log('📤 Enviando mensagem (tamanho):', content.length);

      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim()
        });

      if (error) {
        const { logDbError } = await import('@/lib/utils');
        logDbError('❌ Erro ao enviar mensagem', error);
        toast.error('Erro ao enviar mensagem');
        return false;
      }

      // Atualizar timestamp da conversa
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      console.log('✅ Mensagem enviada com sucesso');
      
      // Recarregar mensagens
      fetchMessages();
      
      return true;

    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('💥 Erro ao enviar mensagem', error);
      toast.error('Erro ao enviar mensagem');
      return false;
    }
  };

  // Marcar mensagens como lidas
  const markMessagesAsRead = async () => {
    if (!conversationId || !user) return;

    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('read', false)
        .neq('sender_id', user.id);

    } catch (error) {
      const { logDbError } = await import('@/lib/utils');
      logDbError('❌ Erro ao marcar mensagens como lidas', error);
    }
  };

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId]);

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages
  };
}