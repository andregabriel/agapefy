"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type FeedFilter = 'all' | 'following';

interface Post {
  id: string;
  user_id: string;
  content: string;
  post_type: 'text' | 'audio' | 'intention';
  audio_id?: string;
  intention_id?: string;
  activity_log_id?: string;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
  audios?: {
    id: string;
    title: string;
    subtitle?: string;
    audio_url: string;
    duration?: number;
  };
  user_intentions?: {
    id: string;
    title: string;
    description?: string;
  };
  user_activity_log?: {
    id: string;
    activity_type: string;
    duration_listened?: number;
    completed?: boolean;
    audios: {
      id: string;
      title: string;
      subtitle?: string;
    };
  };
  post_likes: Array<{
    id: string;
    user_id: string;
  }>;
  post_comments: Array<{
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles: {
      username?: string;
      full_name?: string;
      avatar_url?: string;
    };
  }>;
  post_intercessions: Array<{
    id: string;
    user_id: string;
  }>;
  _counts: {
    likes: number;
    comments: number;
    intercessions: number;
  };
  _userInteractions: {
    hasLiked: boolean;
    hasInterceded: boolean;
  };
}

export function useCommunityFeedOptimized() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedFilter>('all');

  const fetchPosts = useCallback(async (feedFilter: FeedFilter = 'all') => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 Carregando feed: ${feedFilter}`);

      // Primeiro, verificar se a tabela user_follows existe
      let followingIds: string[] = [];
      
      if (feedFilter === 'following') {
        try {
          const { data: followingData, error: followError } = await supabase
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', user.id);

          if (followError) {
            console.warn('⚠️ Tabela user_follows não encontrada, usando feed completo:', followError);
            // Se a tabela não existe, usar feed completo
            feedFilter = 'all';
          } else {
            followingIds = followingData?.map(f => f.following_id) || [];
            
            if (followingIds.length === 0) {
              console.log('📭 Usuário não segue ninguém ainda');
              setPosts([]);
              setLoading(false);
              return;
            }
          }
        } catch (followTableError) {
          console.warn('⚠️ Erro ao acessar user_follows, usando feed completo:', followTableError);
          feedFilter = 'all';
        }
      }

      // Query base simplificada
      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          content,
          post_type,
          audio_id,
          intention_id,
          activity_log_id,
          created_at,
          updated_at
        `);

      // Aplicar filtro se for "following" e temos IDs
      if (feedFilter === 'following' && followingIds.length > 0) {
        query = query.in('user_id', followingIds);
      }

      const { data: postsData, error: postsError } = await query
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) {
        console.error('❌ Erro ao carregar posts:', postsError);
        setError(`Erro ao carregar posts: ${postsError.message || 'Erro desconhecido'}`);
        return;
      }

      if (!postsData || postsData.length === 0) {
        console.log('📭 Nenhum post encontrado');
        setPosts([]);
        setLoading(false);
        return;
      }

      console.log(`📝 ${postsData.length} posts básicos carregados`);

      // Buscar dados relacionados em paralelo
      const postIds = postsData.map(p => p.id);
      const userIds = [...new Set(postsData.map(p => p.user_id))];

      const [
        { data: profiles },
        { data: audios },
        { data: intentions },
        { data: activities },
        { data: likes },
        { data: comments },
        { data: intercessions }
      ] = await Promise.all([
        // Perfis dos usuários
        supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds),
        
        // Áudios relacionados
        supabase
          .from('audios')
          .select('id, title, subtitle, audio_url, duration')
          .in('id', postsData.filter(p => p.audio_id).map(p => p.audio_id!)),
        
        // Intenções relacionadas
        supabase
          .from('user_intentions')
          .select('id, title, description')
          .in('id', postsData.filter(p => p.intention_id).map(p => p.intention_id!)),
        
        // Atividades relacionadas
        supabase
          .from('user_activity_log')
          .select(`
            id, 
            activity_type, 
            duration_listened, 
            completed,
            audios!user_activity_log_audio_id_fkey (
              id, title, subtitle
            )
          `)
          .in('id', postsData.filter(p => p.activity_log_id).map(p => p.activity_log_id!)),
        
        // Likes
        supabase
          .from('post_likes')
          .select('id, user_id, post_id')
          .in('post_id', postIds),
        
        // Comentários
        supabase
          .from('post_comments')
          .select(`
            id, 
            user_id, 
            post_id, 
            content, 
            created_at,
            profiles!post_comments_user_id_fkey (
              username, full_name, avatar_url
            )
          `)
          .in('post_id', postIds)
          .order('created_at', { ascending: true }),
        
        // Intercessões
        supabase
          .from('post_intercessions')
          .select('id, user_id, post_id')
          .in('post_id', postIds)
      ]);

      // Criar mapas para lookup rápido
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const audiosMap = new Map(audios?.map(a => [a.id, a]) || []);
      const intentionsMap = new Map(intentions?.map(i => [i.id, i]) || []);
      const activitiesMap = new Map(activities?.map(a => [a.id, a]) || []);
      
      const likesByPost = new Map<string, any[]>();
      const commentsByPost = new Map<string, any[]>();
      const intercessionsByPost = new Map<string, any[]>();

      // Agrupar likes, comentários e intercessões por post
      likes?.forEach(like => {
        if (!likesByPost.has(like.post_id)) {
          likesByPost.set(like.post_id, []);
        }
        likesByPost.get(like.post_id)!.push(like);
      });

      comments?.forEach(comment => {
        if (!commentsByPost.has(comment.post_id)) {
          commentsByPost.set(comment.post_id, []);
        }
        commentsByPost.get(comment.post_id)!.push(comment);
      });

      intercessions?.forEach(intercession => {
        if (!intercessionsByPost.has(intercession.post_id)) {
          intercessionsByPost.set(intercession.post_id, []);
        }
        intercessionsByPost.get(intercession.post_id)!.push(intercession);
      });

      // Montar posts completos
      const processedPosts = postsData.map(post => {
        const profile = profilesMap.get(post.user_id);
        const audio = post.audio_id ? audiosMap.get(post.audio_id) : undefined;
        const intention = post.intention_id ? intentionsMap.get(post.intention_id) : undefined;
        const activity = post.activity_log_id ? activitiesMap.get(post.activity_log_id) : undefined;
        
        const postLikes = likesByPost.get(post.id) || [];
        const postComments = commentsByPost.get(post.id) || [];
        const postIntercessions = intercessionsByPost.get(post.id) || [];

        const hasLiked = postLikes.some(like => like.user_id === user.id);
        const hasInterceded = postIntercessions.some(intercession => intercession.user_id === user.id);

        return {
          ...post,
          profiles: profile || { id: post.user_id, username: 'Usuário', full_name: 'Usuário' },
          audios: audio,
          user_intentions: intention,
          user_activity_log: activity,
          post_likes: postLikes,
          post_comments: postComments,
          post_intercessions: postIntercessions,
          _counts: {
            likes: postLikes.length,
            comments: postComments.length,
            intercessions: postIntercessions.length
          },
          _userInteractions: {
            hasLiked,
            hasInterceded
          }
        };
      });

      console.log(`✅ ${processedPosts.length} posts completos carregados (${feedFilter})`);
      setPosts(processedPosts);

    } catch (error) {
      console.error('💥 Erro inesperado ao carregar feed:', error);
      setError(`Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Função para alterar filtro
  const changeFilter = useCallback((newFilter: FeedFilter) => {
    setFilter(newFilter);
    fetchPosts(newFilter);
  }, [fetchPosts]);

  // Toggle like
  const toggleLike = useCallback(async (postId: string) => {
    if (!user) return false;

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return false;

      const hasLiked = post._userInteractions.hasLiked;

      if (hasLiked) {
        // Remover like
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Atualizar estado local
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? {
                ...p,
                _counts: { ...p._counts, likes: p._counts.likes - 1 },
                _userInteractions: { ...p._userInteractions, hasLiked: false }
              }
            : p
        ));
      } else {
        // Adicionar like
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;

        // Atualizar estado local
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? {
                ...p,
                _counts: { ...p._counts, likes: p._counts.likes + 1 },
                _userInteractions: { ...p._userInteractions, hasLiked: true }
              }
            : p
        ));
      }

      return true;
    } catch (error) {
      console.error('Erro ao toggle like:', error);
      toast.error('Erro ao curtir post');
      return false;
    }
  }, [user, posts]);

  // Toggle intercession
  const toggleIntercession = useCallback(async (postId: string) => {
    if (!user) return false;

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return false;

      const hasInterceded = post._userInteractions.hasInterceded;

      if (hasInterceded) {
        // Remover intercessão
        const { error } = await supabase
          .from('post_intercessions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? {
                ...p,
                _counts: { ...p._counts, intercessions: p._counts.intercessions - 1 },
                _userInteractions: { ...p._userInteractions, hasInterceded: false }
              }
            : p
        ));
      } else {
        // Adicionar intercessão
        const { error } = await supabase
          .from('post_intercessions')
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? {
                ...p,
                _counts: { ...p._counts, intercessions: p._counts.intercessions + 1 },
                _userInteractions: { ...p._userInteractions, hasInterceded: true }
              }
            : p
        ));
      }

      return true;
    } catch (error) {
      console.error('Erro ao toggle intercessão:', error);
      toast.error('Erro ao interceder');
      return false;
    }
  }, [user, posts]);

  // Buscar comentários de um post
  const fetchPostComments = useCallback(async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          id,
          user_id,
          content,
          created_at,
          profiles!post_comments_user_id_fkey (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar comentários:', error);
      return [];
    }
  }, []);

  // Adicionar comentário
  const addComment = useCallback(async (postId: string, content: string) => {
    if (!user || !content.trim()) return false;

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim()
        });

      if (error) throw error;

      // Atualizar contador local
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, _counts: { ...p._counts, comments: p._counts.comments + 1 } }
          : p
      ));

      return true;
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast.error('Erro ao comentar');
      return false;
    }
  }, [user]);

  // Formatar data relativa
  const formatRelativeDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'agora';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: 'numeric', 
      month: 'short' 
    });
  }, []);

  // Refetch com filtro atual
  const refetch = useCallback(() => {
    fetchPosts(filter);
  }, [fetchPosts, filter]);

  // Carregar posts iniciais
  useEffect(() => {
    fetchPosts(filter);
  }, [fetchPosts, filter]);

  return {
    posts,
    loading,
    error,
    filter,
    changeFilter,
    toggleLike,
    toggleIntercession,
    fetchPostComments,
    addComment,
    formatRelativeDate,
    refetch
  };
}