"use client";

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, MessageCircle, Heart, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AnalyticsData {
  totalUsers: number;
  totalPosts: number;
  totalInteractions: number;
  dailyActivity: Array<{ date: string; posts: number; interactions: number }>;
  postTypes: Array<{ type: string; count: number; color: string }>;
  userFeedback: Array<{ rating: number; count: number }>;
  topEngagementActions: Array<{ action: string; count: number }>;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar dados básicos
      const [usersResult, postsResult, likesResult, commentsResult, intercessionsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('posts').select('id, post_type, created_at', { count: 'exact' }),
        supabase.from('post_likes').select('id', { count: 'exact' }),
        supabase.from('post_comments').select('id', { count: 'exact' }),
        supabase.from('post_intercessions').select('id', { count: 'exact' })
      ]);

      // Buscar feedback
      const feedbackResult = await supabase
        .from('user_feedback')
        .select('rating');

      // Buscar eventos de analytics (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const analyticsResult = await supabase
        .from('analytics_events')
        .select('event_type, event_data, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Processar dados
      const totalUsers = usersResult.count || 0;
      const totalPosts = postsResult.count || 0;
      const totalInteractions = (likesResult.count || 0) + (commentsResult.count || 0) + (intercessionsResult.count || 0);

      // Processar tipos de posts
      const postTypeCounts = (postsResult.data || []).reduce((acc: any, post: any) => {
        acc[post.post_type] = (acc[post.post_type] || 0) + 1;
        return acc;
      }, {});

      const postTypes = [
        { type: 'Texto', count: postTypeCounts.text || 0, color: '#3B82F6' },
        { type: 'Oração', count: postTypeCounts.prayer || 0, color: '#10B981' },
        { type: 'Intenção', count: postTypeCounts.intention || 0, color: '#F59E0B' }
      ];

      // Processar feedback
      const feedbackCounts = (feedbackResult.data || []).reduce((acc: any, fb: any) => {
        acc[fb.rating] = (acc[fb.rating] || 0) + 1;
        return acc;
      }, {});

      const userFeedback = [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: feedbackCounts[rating] || 0
      }));

      // Processar atividade diária (últimos 7 dias)
      const dailyActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayPosts = (postsResult.data || []).filter((post: any) => 
          post.created_at.startsWith(dateStr)
        ).length;

        const dayEvents = (analyticsResult.data || []).filter((event: any) => 
          event.created_at.startsWith(dateStr) && 
          ['community_action'].includes(event.event_type)
        ).length;

        dailyActivity.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          posts: dayPosts,
          interactions: dayEvents
        });
      }

      // Processar ações de engajamento
      const engagementActions = (analyticsResult.data || [])
        .filter((event: any) => event.event_type === 'community_action')
        .reduce((acc: any, event: any) => {
          const action = event.event_data?.action || 'unknown';
          acc[action] = (acc[action] || 0) + 1;
          return acc;
        }, {});

      const topEngagementActions = Object.entries(engagementActions)
        .map(([action, count]) => ({ action, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setData({
        totalUsers,
        totalPosts,
        totalInteractions,
        dailyActivity,
        postTypes,
        userFeedback,
        topEngagementActions
      });

    } catch (err) {
      console.error('❌ Erro ao buscar analytics:', err);
      setError('Erro ao carregar dados de analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Analytics da Comunidade</h2>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-gray-900 border-gray-800 animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="outline" className="border-red-700 text-red-400">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Analytics da Comunidade</h2>
        <Button onClick={fetchAnalytics} variant="outline" className="border-gray-700 text-gray-300">
          <RefreshCw size={16} className="mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="text-blue-500 mr-3" size={24} />
              <div>
                <p className="text-gray-400 text-sm">Usuários</p>
                <p className="text-2xl font-bold text-white">{data.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center">
              <MessageCircle className="text-green-500 mr-3" size={24} />
              <div>
                <p className="text-gray-400 text-sm">Posts</p>
                <p className="text-2xl font-bold text-white">{data.totalPosts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Heart className="text-red-500 mr-3" size={24} />
              <div>
                <p className="text-gray-400 text-sm">Interações</p>
                <p className="text-2xl font-bold text-white">{data.totalInteractions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="text-purple-500 mr-3" size={24} />
              <div>
                <p className="text-gray-400 text-sm">Engajamento</p>
                <p className="text-2xl font-bold text-white">
                  {data.totalPosts > 0 ? Math.round((data.totalInteractions / data.totalPosts) * 100) / 100 : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividade diária */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Atividade dos Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }} 
                />
                <Bar dataKey="posts" fill="#3B82F6" name="Posts" />
                <Bar dataKey="interactions" fill="#10B981" name="Interações" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tipos de posts */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Tipos de Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.postTypes}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ type, count }) => `${type}: ${count}`}
                >
                  {data.postTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Feedback dos usuários */}
      {data.userFeedback.some(f => f.count > 0) && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Feedback dos Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.userFeedback}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="rating" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }} 
                />
                <Bar dataKey="count" fill="#F59E0B" name="Avaliações" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}