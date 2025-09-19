"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MessageSquare, 
  Heart, 
  TrendingUp, 
  Calendar,
  Activity,
  BarChart3,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AnalyticsData {
  totalUsers: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalIntercessions: number;
  activeUsersToday: number;
  postsToday: number;
  recentEvents: any[];
  userGrowth: any[];
  engagementMetrics: any;
}

export default function CommunityAnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Verificar se usuário é admin
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');
    } catch (error) {
      console.error('Erro ao verificar status admin:', error);
    }
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Buscando dados reais de analytics...');

      // 1. Dados básicos da comunidade
      const [
        { count: totalUsers },
        { count: totalPosts },
        { count: totalLikes },
        { count: totalComments },
        { count: totalIntercessions }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('post_likes').select('*', { count: 'exact', head: true }),
        supabase.from('post_comments').select('*', { count: 'exact', head: true }),
        supabase.from('post_intercessions').select('*', { count: 'exact', head: true })
      ]);

      // 2. Atividade de hoje
      const today = new Date().toISOString().split('T')[0];
      
      const [
        { data: postsToday },
        { data: activeUsersToday }
      ] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lte('created_at', `${today}T23:59:59.999Z`),
        supabase
          .from('posts')
          .select('user_id')
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lte('created_at', `${today}T23:59:59.999Z`)
      ]);

      // 3. Eventos de analytics (se existirem)
      const { data: recentEvents } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // 4. Crescimento de usuários (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: userGrowth } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      // 5. Métricas de engajamento
      const { data: engagementData } = await supabase
        .from('posts')
        .select(`
          id,
          created_at,
          post_likes(count),
          post_comments(count),
          post_intercessions(count)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      // Processar dados de engajamento
      const engagementMetrics = engagementData?.reduce((acc, post) => {
        const likes = post.post_likes?.length || 0;
        const comments = post.post_comments?.length || 0;
        const intercessions = post.post_intercessions?.length || 0;
        
        acc.totalEngagements += likes + comments + intercessions;
        acc.avgLikesPerPost += likes;
        acc.avgCommentsPerPost += comments;
        acc.avgIntercessionsPerPost += intercessions;
        
        return acc;
      }, {
        totalEngagements: 0,
        avgLikesPerPost: 0,
        avgCommentsPerPost: 0,
        avgIntercessionsPerPost: 0
      });

      if (engagementMetrics && engagementData?.length) {
        engagementMetrics.avgLikesPerPost /= engagementData.length;
        engagementMetrics.avgCommentsPerPost /= engagementData.length;
        engagementMetrics.avgIntercessionsPerPost /= engagementData.length;
      }

      const analyticsData: AnalyticsData = {
        totalUsers: totalUsers || 0,
        totalPosts: totalPosts || 0,
        totalLikes: totalLikes || 0,
        totalComments: totalComments || 0,
        totalIntercessions: totalIntercessions || 0,
        activeUsersToday: new Set(activeUsersToday?.map(p => p.user_id)).size || 0,
        postsToday: postsToday?.length || 0,
        recentEvents: recentEvents || [],
        userGrowth: userGrowth || [],
        engagementMetrics: engagementMetrics || {}
      };

      console.log('✅ Dados reais carregados:', analyticsData);
      setData(analyticsData);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('❌ Erro ao carregar analytics:', error);
      setError('Erro ao carregar dados de analytics');
      toast.error('Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAnalyticsData();
    }
  }, [isAdmin]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-gray-400">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics da Comunidade</h1>
          <p className="text-gray-400">Dados reais de engajamento e atividade</p>
          {lastUpdate && (
            <p className="text-xs text-gray-500 mt-1">
              Última atualização: {lastUpdate.toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        <Button 
          onClick={fetchAnalyticsData}
          disabled={loading}
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={16} />
          Atualizar
        </Button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando dados reais...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Métricas Principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Usuários</p>
                    <p className="text-2xl font-bold text-white">{data.totalUsers}</p>
                  </div>
                  <Users className="text-blue-500" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Posts</p>
                    <p className="text-2xl font-bold text-white">{data.totalPosts}</p>
                  </div>
                  <MessageSquare className="text-green-500" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Likes</p>
                    <p className="text-2xl font-bold text-white">{data.totalLikes}</p>
                  </div>
                  <Heart className="text-red-500" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Comentários</p>
                    <p className="text-2xl font-bold text-white">{data.totalComments}</p>
                  </div>
                  <MessageSquare className="text-yellow-500" size={24} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Atividade Hoje */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Activity className="mr-2" size={20} />
                  Atividade Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Usuários ativos:</span>
                    <Badge variant="secondary">{data.activeUsersToday}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Posts criados:</span>
                    <Badge variant="secondary">{data.postsToday}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <TrendingUp className="mr-2" size={20} />
                  Engajamento Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Likes/post:</span>
                    <Badge variant="secondary">
                      {data.engagementMetrics.avgLikesPerPost?.toFixed(1) || '0'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Comentários/post:</span>
                    <Badge variant="secondary">
                      {data.engagementMetrics.avgCommentsPerPost?.toFixed(1) || '0'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Intercessões/post:</span>
                    <Badge variant="secondary">
                      {data.engagementMetrics.avgIntercessionsPerPost?.toFixed(1) || '0'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status dos Dados */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <BarChart3 className="mr-2" size={20} />
                Status dos Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800 rounded">
                  <div>
                    <p className="text-green-400 font-medium">✅ Dados Reais Confirmados</p>
                    <p className="text-green-300 text-sm">
                      Analytics capturando dados reais do Supabase
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Eventos de analytics:</p>
                    <p className="text-white">{data.recentEvents.length} eventos registrados</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Crescimento (7 dias):</p>
                    <p className="text-white">{data.userGrowth.length} novos usuários</p>
                  </div>
                </div>

                {data.recentEvents.length === 0 && (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ Nenhum evento de analytics registrado ainda. 
                      Os dados básicos são reais, mas eventos detalhados podem não estar sendo capturados.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gargalos Identificados */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <AlertCircle className="mr-2" size={20} />
                Gargalos Identificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.totalPosts === 0 && (
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded">
                    <p className="text-red-400 font-medium">🚨 Nenhum post criado</p>
                    <p className="text-red-300 text-sm">Usuários não estão criando conteúdo</p>
                  </div>
                )}
                
                {data.totalUsers > 0 && data.activeUsersToday === 0 && (
                  <div className="p-3 bg-orange-900/20 border border-orange-800 rounded">
                    <p className="text-orange-400 font-medium">⚠️ Baixa atividade diária</p>
                    <p className="text-orange-300 text-sm">Nenhum usuário ativo hoje</p>
                  </div>
                )}
                
                {data.totalPosts > 0 && data.totalLikes === 0 && (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded">
                    <p className="text-yellow-400 font-medium">💡 Baixo engajamento</p>
                    <p className="text-yellow-300 text-sm">Posts não estão recebendo likes</p>
                  </div>
                )}

                {data.totalUsers > 0 && data.totalPosts > 0 && data.totalLikes > 0 && (
                  <div className="p-3 bg-green-900/20 border border-green-800 rounded">
                    <p className="text-green-400 font-medium">✅ Comunidade saudável</p>
                    <p className="text-green-300 text-sm">Boa atividade e engajamento detectados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}