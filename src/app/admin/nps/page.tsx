"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Users, MessageCircle, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface NPSData {
  totalResponses: number;
  npsScore: number;
  promoters: number;
  neutrals: number;
  detractors: number;
  averageRating: number;
  responsesByRating: Array<{ rating: number; count: number }>;
  trendData: Array<{ date: string; score: number; responses: number }>;
  recentFeedback: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    user_email?: string;
  }>;
}

export default function NPSPage() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NPSData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        setIsAdmin(profile?.role === 'admin');
      } catch (error) {
        console.error('Erro ao verificar status admin:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading]);

  const fetchNPSData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar todos os feedbacks
      const { data: feedbacks, error: feedbackError } = await supabase
        .from('user_feedback')
        .select(`
          id,
          rating,
          comment,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false });

      if (feedbackError) {
        throw feedbackError;
      }

      if (!feedbacks || feedbacks.length === 0) {
        setData({
          totalResponses: 0,
          npsScore: 0,
          promoters: 0,
          neutrals: 0,
          detractors: 0,
          averageRating: 0,
          responsesByRating: [],
          trendData: [],
          recentFeedback: []
        });
        return;
      }

      // Calcular métricas NPS
      const totalResponses = feedbacks.length;
      let promoters = 0;
      let neutrals = 0;
      let detractors = 0;
      let totalRating = 0;

      const ratingCounts: { [key: number]: number } = {};

      feedbacks.forEach(feedback => {
        const rating = feedback.rating;
        totalRating += rating;
        
        // Contar por rating
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
        
        // Classificar NPS
        if (rating >= 9) {
          promoters++;
        } else if (rating >= 7) {
          neutrals++;
        } else {
          detractors++;
        }
      });

      // Calcular NPS Score
      const npsScore = Math.round(((promoters - detractors) / totalResponses) * 100);
      const averageRating = totalRating / totalResponses;

      // Preparar dados para gráfico de ratings
      const responsesByRating = Array.from({ length: 11 }, (_, i) => ({
        rating: i,
        count: ratingCounts[i] || 0
      }));

      // Preparar dados de tendência (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentFeedbacks = feedbacks.filter(f => 
        new Date(f.created_at) >= thirtyDaysAgo
      );

      // Agrupar por dia para tendência
      const dailyData: { [key: string]: { ratings: number[], count: number } } = {};
      
      recentFeedbacks.forEach(feedback => {
        const date = new Date(feedback.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { ratings: [], count: 0 };
        }
        dailyData[date].ratings.push(feedback.rating);
        dailyData[date].count++;
      });

      const trendData = Object.entries(dailyData)
        .map(([date, data]) => {
          const dayPromotors = data.ratings.filter(r => r >= 9).length;
          const dayDetractors = data.ratings.filter(r => r <= 6).length;
          const dayNPS = data.count > 0 ? Math.round(((dayPromotors - dayDetractors) / data.count) * 100) : 0;
          
          return {
            date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            score: dayNPS,
            responses: data.count
          };
        })
        .sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime())
        .slice(-14); // Últimos 14 dias

      // Feedback recente com comentários
      const recentFeedback = feedbacks
        .filter(f => f.comment && f.comment.trim())
        .slice(0, 10)
        .map(f => ({
          id: f.id,
          rating: f.rating,
          comment: f.comment,
          created_at: f.created_at,
          user_email: 'Usuário anônimo' // Por privacidade
        }));

      setData({
        totalResponses,
        npsScore,
        promoters,
        neutrals,
        detractors,
        averageRating,
        responsesByRating,
        trendData,
        recentFeedback
      });

    } catch (err) {
      console.error('❌ Erro ao buscar dados NPS:', err);
      setError('Erro ao carregar dados do NPS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchNPSData();
    }
  }, [isAdmin]);

  // Função para obter cor do NPS
  const getNPSColor = (score: number) => {
    if (score >= 50) return 'text-green-500';
    if (score >= 0) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Função para obter ícone do NPS
  const getNPSIcon = (score: number) => {
    if (score >= 50) return <TrendingUp className="h-5 w-5" />;
    if (score >= 0) return <Minus className="h-5 w-5" />;
    return <TrendingDown className="h-5 w-5" />;
  };

  // Função para obter categoria do rating
  const getRatingCategory = (rating: number) => {
    if (rating >= 9) return { label: 'Promotor', color: 'bg-green-500' };
    if (rating >= 7) return { label: 'Neutro', color: 'bg-yellow-500' };
    return { label: 'Detrator', color: 'bg-red-500' };
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Carregando dados do NPS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Acesso Negado</h1>
          <p className="text-gray-400">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Acesso Restrito</h1>
          <p className="text-gray-400 mb-4">Apenas administradores podem acessar o dashboard de NPS.</p>
          <p className="text-gray-500 text-sm">Seu email: {user.email}</p>
          <p className="text-gray-500 text-sm">Para se tornar admin, execute o SQL no Supabase Dashboard.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Erro</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchNPSData} variant="outline" className="border-red-700 text-red-400">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Carregando...</p>
        </div>
      </div>
    );
  }

  // Cores para o gráfico de pizza
  const pieColors = ['#EF4444', '#F59E0B', '#10B981']; // Vermelho, Amarelo, Verde

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard NPS</h1>
          <p className="text-gray-400">Net Promoter Score - Análise de Satisfação</p>
        </div>
        <Button onClick={fetchNPSData} variant="outline" className="border-gray-700 text-gray-300">
          <RefreshCw size={16} className="mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">NPS Score</p>
                <p className={`text-3xl font-bold ${getNPSColor(data.npsScore)}`}>
                  {data.npsScore}
                </p>
              </div>
              <div className={getNPSColor(data.npsScore)}>
                {getNPSIcon(data.npsScore)}
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {data.npsScore >= 50 ? 'Excelente' : 
               data.npsScore >= 0 ? 'Bom' : 'Precisa melhorar'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Respostas</p>
                <p className="text-3xl font-bold text-white">{data.totalResponses}</p>
              </div>
              <Users className="text-blue-500" size={24} />
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Avaliações coletadas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Nota Média</p>
                <p className="text-3xl font-bold text-white">
                  {data.averageRating.toFixed(1)}
                </p>
              </div>
              <Star className="text-yellow-500" size={24} />
            </div>
            <p className="text-gray-500 text-xs mt-2">
              De 0 a 10
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Comentários</p>
                <p className="text-3xl font-bold text-white">{data.recentFeedback.length}</p>
              </div>
              <MessageCircle className="text-purple-500" size={24} />
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Com feedback escrito
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição NPS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Distribuição NPS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">Promotores (9-10)</span>
                </div>
                <span className="text-white font-bold">{data.promoters}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-gray-300">Neutros (7-8)</span>
                </div>
                <span className="text-white font-bold">{data.neutrals}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-300">Detratores (0-6)</span>
                </div>
                <span className="text-white font-bold">{data.detractors}</span>
              </div>
            </div>
            
            {data.totalResponses > 0 && (
              <div className="mt-6">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Detratores', value: data.detractors, color: '#EF4444' },
                        { name: 'Neutros', value: data.neutrals, color: '#F59E0B' },
                        { name: 'Promotores', value: data.promoters, color: '#10B981' }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {[data.detractors, data.neutrals, data.promoters].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index]} />
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por nota */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Distribuição por Nota</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.responsesByRating}>
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
                <Bar 
                  dataKey="count" 
                  fill="#3B82F6" 
                  name="Respostas"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tendência NPS */}
      {data.trendData.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Tendência NPS (Últimos 14 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.trendData}>
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
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="NPS Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Feedback recente */}
      {data.recentFeedback.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Feedback Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentFeedback.map((feedback) => {
                const category = getRatingCategory(feedback.rating);
                return (
                  <div key={feedback.id} className="border-b border-gray-800 pb-4 last:border-b-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge className={`${category.color} text-white`}>
                          {feedback.rating}/10
                        </Badge>
                        <span className="text-gray-400 text-sm">{category.label}</span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {formatDate(feedback.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm">
                      "{feedback.comment}"
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vazio */}
      {data.totalResponses === 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-12 text-center">
            <Star className="h-16 w-16 mx-auto mb-4 text-gray-500" />
            <h3 className="text-xl font-bold text-white mb-2">Nenhuma avaliação ainda</h3>
            <p className="text-gray-400 mb-4">
              As avaliações NPS dos usuários aparecerão aqui quando começarem a usar o widget.
            </p>
            <p className="text-gray-500 text-sm">
              O widget NPS está disponível na página /eu para usuários logados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}