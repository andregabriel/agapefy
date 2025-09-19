"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export function useUserFollow(targetUserId?: string) {
  const { user } = useAuth();
  const [stats, setStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false
  });
  const [loading, setLoading] = useState(false);

  // Buscar estatísticas de follow
  const fetchFollowStats = async () => {
    if (!targetUserId) return;

    try {
      // Contar seguidores
      const { count: followersCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId);

      // Contar seguindo
      const { count: followingCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetUserId);

      // Verificar se usuário atual segue o target
      let isFollowing = false;
      if (user && user.id !== targetUserId) {
        const { data } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .single();

        isFollowing = !!data;
      }

      setStats({
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        isFollowing
      });

    } catch (error) {
      console.error('Erro ao buscar stats de follow:', error);
    }
  };

  // Seguir usuário
  const followUser = async () => {
    if (!user || !targetUserId || user.id === targetUserId) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: user.id,
          following_id: targetUserId
        });

      if (error) {
        console.error('Erro ao seguir usuário:', error);
        toast.error('Erro ao seguir usuário');
        return false;
      }

      setStats(prev => ({
        ...prev,
        followersCount: prev.followersCount + 1,
        isFollowing: true
      }));

      toast.success('Usuário seguido!');
      return true;

    } catch (error) {
      console.error('Erro ao seguir usuário:', error);
      toast.error('Erro ao seguir usuário');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Deixar de seguir usuário
  const unfollowUser = async () => {
    if (!user || !targetUserId) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);

      if (error) {
        console.error('Erro ao deixar de seguir:', error);
        toast.error('Erro ao deixar de seguir');
        return false;
      }

      setStats(prev => ({
        ...prev,
        followersCount: prev.followersCount - 1,
        isFollowing: false
      }));

      toast.success('Deixou de seguir');
      return true;

    } catch (error) {
      console.error('Erro ao deixar de seguir:', error);
      toast.error('Erro ao deixar de seguir');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Toggle follow/unfollow
  const toggleFollow = async () => {
    if (stats.isFollowing) {
      return await unfollowUser();
    } else {
      return await followUser();
    }
  };

  useEffect(() => {
    fetchFollowStats();
  }, [targetUserId, user]);

  return {
    stats,
    loading,
    followUser,
    unfollowUser,
    toggleFollow,
    refetch: fetchFollowStats
  };
}

// Hook para buscar usuários para descoberta
export function useUserDiscovery() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestedUsers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Buscar usuários que o usuário atual não segue
      const { data: followingIds } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const excludeIds = [user.id, ...(followingIds?.map(f => f.following_id) || [])];

      const { data: suggestedUsers } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          full_name,
          avatar_url,
          bio
        `)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(10);

      setUsers(suggestedUsers || []);

    } catch (error) {
      console.error('Erro ao buscar usuários sugeridos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestedUsers();
  }, [user]);

  return {
    users,
    loading,
    refetch: fetchSuggestedUsers
  };
}