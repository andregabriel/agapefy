"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

export interface CommunityPost {
  id: string;
  user_id: string;
  content?: string | null;
  post_type: 'prayer' | 'intention' | 'text';
  audio_id?: string | null;
  intention_id?: string | null;
  activity_log_id?: string | null;
  created_at: string;
  updated_at: string;
  
  // Dados relacionados
  user?: {
    id: string;
    full_name?: string;
    username?: string;
    avatar_url?: string;
  };
  audio?: {
    id: string;
    title: string;
    subtitle?: string;
  };
  intention?: {
    id: string;
    title: string;
    description?: string;
  };
  
  // Contadores
  likes_count: number;
  intercessions_count: number;
  comments_count: number;
  
  // Estado do usuário atual
  user_liked: boolean;
  user_interceded: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

export function useCommunityFeed() {
  const { user } = useAuth();
  const { showNotificationToast } = useNotifications();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar posts do feed
  const fetchFeed = useCallback(async () => {
    try {
      console.log('🔄 Buscando feed da comunidade...');
      setLoading(true);
      setError(null);

      // Query básica de posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsError) {
        console.error('❌ Erro ao buscar posts:', postsError);
        setError(`Erro ao carregar posts: ${postsError.message || 'Erro desconhecido'}`);
        return;
      }

      console.log('📊 Posts encontrados:', postsData?.length || 0);

      if (!postsData || postsData.length === 0) {
        console.log('📭 Nenhum post encontrado');
        setPosts([]);
        return;
      }

      // Processar posts e buscar dados relacionados
      const processedPosts: CommunityPost[] = await Promise.all(
        postsData.map(async (post: any) => {
          let userData = null;
          let audioData = null;
          let intentionData = null;

          // Buscar dados do usuário
          if (post.user_id) {
            const { data: userResult } = await supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url')
              .eq('id', post.user_id)
              .single();
            userData = userResult;
          }

          // Buscar dados do áudio se existir
          if (post.audio_id) {
            const { data: audioResult } = await supabase
              .from('audios')
              .select('id, title, subtitle')
              .eq('id', post.audio_id)
              .single();
            audioData = audioResult;
          }

          // Buscar dados da intenção se existir
          if (post.intention_id) {
            const { data: intentionResult } = await supabase
              .from('user_intentions')
              .select('id, title, description')
              .eq('id', post.intention_id)
              .single();
            intentionData = intentionResult;
          }

          // Buscar contadores
          const [likesData, intercessionsData, commentsData] = await Promise.all([
            supabase.from('post_likes').select('user_id').eq('post_id', post.id),
            supabase.from('post_intercessions').select('user_id').eq('post_id', post.id),
            supabase.from('post_comments').select('id').eq('post_id', post.id)
          ]);

          const currentUser = user;
          const userLiked = currentUser ? likesData.data?.some(like => like.user_id === currentUser.id) || false : false;
          const userInterceded = currentUser ? intercessionsData.data?.some(int => int.user_id === currentUser.id) || false : false;

          return {
            ...post,
            user: userData,
            audio: audioData,
            intention: intentionData,
            likes_count: likesData.data?.length || 0,
            intercessions_count: intercessionsData.data?.length || 0,
            comments_count: commentsData.data?.length || 0,
            user_liked: userLiked,
            user_interceded: userInterceded,
          };
        })
      );

      console.log('✅ Feed processado:', processedPosts.length, 'posts');
      setPosts(processedPosts);

    } catch (err) {
      console.error('💥 Erro inesperado ao buscar feed:', err);
      setError('Erro inesperado ao carregar feed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar comentários de um post
  const fetchPostComments = async (postId: string): Promise<PostComment[]> => {
    try {
      console.log('🔍 Buscando comentários para post:', postId);

      // Primeiro buscar os comentários
      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('❌ Erro ao buscar comentários:', commentsError);
        return [];
      }

      console.log('📝 Comentários encontrados:', commentsData?.length || 0);

      if (!commentsData || commentsData.length === 0) {
        return [];
      }

      // Buscar dados dos usuários para cada comentário
      const commentsWithUsers = await Promise.all(
        commentsData.map(async (comment: any) => {
          let userData = null;

          if (comment.user_id) {
            const { data: userResult } = await supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url')
              .eq('id', comment.user_id)
              .single();
            userData = userResult;
          }

          return {
            ...comment,
            user: userData
          };
        })
      );

      console.log('✅ Comentários processados:', commentsWithUsers.length);
      return commentsWithUsers as PostComment[];

    } catch (error) {
      console.error('💥 Erro inesperado ao buscar comentários:', error);
      return [];
    }
  };

  // Adicionar comentário
  const addComment = async (postId: string, content: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('➕ Adicionando comentário ao post:', postId);

      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim()
        });

      if (error) {
        console.error('❌ Erro ao adicionar comentário:', error);
        return false;
      }

      console.log('✅ Comentário adicionado');

      // Atualizar contador local
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, comments_count: p.comments_count + 1 }
          : p
      ));

      // Mostrar notificação para o autor do post (se não for o próprio usuário)
      const post = posts.find(p => p.id === postId);
      if (post && post.user_id !== user.id && post.user) {
        const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Alguém';
        const postType = post.post_type === 'intention' ? 'intenção' : 'oração';
        showNotificationToast('comment', userName, postType);
      }

      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao adicionar comentário:', error);
      return false;
    }
  };

  // NOVA FUNÇÃO: Criar post de texto livre
  const createTextPost = async (content: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('➕ Criando post de texto:', content.substring(0, 50) + '...');

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          post_type: 'text'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar post de texto:', error);
        return false;
      }

      console.log('✅ Post de texto criado:', data);
      
      // Recarregar feed
      await fetchFeed();
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao criar post de texto:', error);
      return false;
    }
  };

  // Criar post de oração
  const createPrayerPost = async (audioId: string, content?: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('➕ Criando post de oração:', audioId);

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content || null,
          post_type: 'prayer',
          audio_id: audioId
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar post de oração:', error);
        return false;
      }

      console.log('✅ Post de oração criado:', data);
      
      // Recarregar feed
      await fetchFeed();
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao criar post de oração:', error);
      return false;
    }
  };

  // Criar post de intenção
  const createIntentionPost = async (intentionId: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('➕ Criando post de intenção:', intentionId);

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          post_type: 'intention',
          intention_id: intentionId
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar post de intenção:', error);
        return false;
      }

      console.log('✅ Post de intenção criado:', data);
      
      // Recarregar feed
      await fetchFeed();
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao criar post de intenção:', error);
      return false;
    }
  };

  // Toggle like
  const toggleLike = async (postId: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return false;

      if (post.user_liked) {
        // Remover like
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) {
          console.error('❌ Erro ao remover like:', error);
          return false;
        }

        console.log('👎 Like removido');
      } else {
        // Adicionar like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });

        if (error) {
          console.error('❌ Erro ao adicionar like:', error);
          return false;
        }

        console.log('👍 Like adicionado');

        // Mostrar notificação para o autor do post (se não for o próprio usuário)
        if (post.user_id !== user.id && post.user) {
          const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Alguém';
          const postType = post.post_type === 'intention' ? 'intenção' : 'oração';
          showNotificationToast('like', userName, postType);
        }
      }

      // Atualizar estado local
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? {
              ...p,
              user_liked: !p.user_liked,
              likes_count: p.user_liked ? p.likes_count - 1 : p.likes_count + 1
            }
          : p
      ));

      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao toggle like:', error);
      return false;
    }
  };

  // Toggle intercessão
  const toggleIntercession = async (postId: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return false;

      if (post.user_interceded) {
        // Remover intercessão
        const { error } = await supabase
          .from('post_intercessions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) {
          console.error('❌ Erro ao remover intercessão:', error);
          return false;
        }

        console.log('🙏 Intercessão removida');
      } else {
        // Adicionar intercessão
        const { error } = await supabase
          .from('post_intercessions')
          .insert({
            post_id: postId,
            user_id: user.id
          });

        if (error) {
          console.error('❌ Erro ao adicionar intercessão:', error);
          return false;
        }

        console.log('🙏 Intercessão adicionada');

        // Mostrar notificação para o autor do post (se não for o próprio usuário)
        if (post.user_id !== user.id && post.user) {
          const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Alguém';
          showNotificationToast('intercession', userName);
        }
      }

      // Atualizar estado local
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? {
              ...p,
              user_interceded: !p.user_interceded,
              intercessions_count: p.user_interceded ? p.intercessions_count - 1 : p.intercessions_count + 1
            }
          : p
      ));

      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao toggle intercessão:', error);
      return false;
    }
  };

  // Formatar data relativa
  const formatRelativeDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        return diffInMinutes <= 1 ? 'agora' : `${diffInMinutes}min`;
      }
      return `${diffInHours}h`;
    } else if (diffInDays === 1) {
      return '1d';
    } else if (diffInDays < 7) {
      return `${diffInDays}d`;
    } else {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks}sem`;
    }
  }, []);

  // Carregar feed na inicialização
  useEffect(() => {
    fetchFeed();
  }, []);

  return {
    posts,
    loading,
    error,
    createTextPost, // NOVA FUNÇÃO ADICIONADA
    createPrayerPost,
    createIntentionPost,
    toggleLike,
    toggleIntercession,
    fetchPostComments,
    addComment,
    formatRelativeDate,
    refetch: fetchFeed
  };
}