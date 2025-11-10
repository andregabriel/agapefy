'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Music, BookOpen, Heart, Download, MessageSquare, Calendar, Target, FileText } from 'lucide-react';
import AdminHamburgerMenu from './AdminHamburgerMenu';

interface DashboardStats {
  totalUsers: number;
  totalAudios: number;
  totalPlaylists: number;
  totalCategories: number;
  totalFavorites: number;
  totalDownloads: number;
  totalIntentions: number;
  totalReflections: number;
  totalGoals: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAudios: 0,
    totalPlaylists: 0,
    totalCategories: 0,
    totalFavorites: 0,
    totalDownloads: 0,
    totalIntentions: 0,
    totalReflections: 0,
    totalGoals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('📊 Dashboard: Buscando estatísticas...');

        // Buscar estatísticas em paralelo
        const [
          usersResult,
          audiosResult,
          playlistsResult,
          categoriesResult,
          favoritesResult,
          downloadsResult,
          intentionsResult,
          reflectionsResult,
          goalsResult,
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('audios').select('*', { count: 'exact', head: true }),
          supabase.from('playlists').select('*', { count: 'exact', head: true }),
          supabase.from('categories').select('*', { count: 'exact', head: true }),
          supabase.from('user_favorites').select('*', { count: 'exact', head: true }),
          supabase.from('user_downloads').select('*', { count: 'exact', head: true }),
          supabase.from('user_intentions').select('*', { count: 'exact', head: true }),
          supabase.from('user_reflections').select('*', { count: 'exact', head: true }),
          supabase.from('user_goals').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          totalUsers: usersResult.count || 0,
          totalAudios: audiosResult.count || 0,
          totalPlaylists: playlistsResult.count || 0,
          totalCategories: categoriesResult.count || 0,
          totalFavorites: favoritesResult.count || 0,
          totalDownloads: downloadsResult.count || 0,
          totalIntentions: intentionsResult.count || 0,
          totalReflections: reflectionsResult.count || 0,
          totalGoals: goalsResult.count || 0,
        });

        console.log('✅ Dashboard: Estatísticas carregadas com sucesso');
      } catch (error) {
        console.error('❌ Dashboard: Erro ao buscar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statsCards = [
    {
      title: 'Usuários',
      value: stats.totalUsers,
      description: 'Total de usuários registrados',
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Áudios',
      value: stats.totalAudios,
      description: 'Total de áudios disponíveis',
      icon: Music,
      color: 'text-purple-600',
    },
    {
      title: 'Playlists',
      value: stats.totalPlaylists,
      description: 'Total de playlists criadas',
      icon: BookOpen,
      color: 'text-green-600',
    },
    {
      title: 'Categorias',
      value: stats.totalCategories,
      description: 'Total de categorias',
      icon: BookOpen,
      color: 'text-orange-600',
    },
    {
      title: 'Favoritos',
      value: stats.totalFavorites,
      description: 'Total de favoritos dos usuários',
      icon: Heart,
      color: 'text-red-600',
    },
    {
      title: 'Downloads',
      value: stats.totalDownloads,
      description: 'Total de downloads realizados',
      icon: Download,
      color: 'text-indigo-600',
    },
    {
      title: 'Intenções',
      value: stats.totalIntentions,
      description: 'Total de intenções de oração',
      icon: MessageSquare,
      color: 'text-pink-600',
    },
    {
      title: 'Reflexões',
      value: stats.totalReflections,
      description: 'Total de reflexões escritas',
      icon: Calendar,
      color: 'text-yellow-600',
    },
    {
      title: 'Metas',
      value: stats.totalGoals,
      description: 'Total de metas definidas',
      icon: Target,
      color: 'text-teal-600',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Conteúdo principal */}
      <div>
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Estatísticas Gerais</h2>
          <p className="text-gray-600">Visão geral dos dados da plataforma</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statsCards.map((card, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {card.value.toLocaleString()}
                </div>
                <CardDescription className="text-xs text-gray-500 mt-1">
                  {card.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Acesso Rápido</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/admin/usuarios"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Usuários</span>
            </a>
            <a
              href="/admin/audios"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              <Music className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">Áudios</span>
            </a>
            <a
              href="/admin/playlists"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              <BookOpen className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <span className="text-sm font-medium text-gray-900">Playlists</span>
            </a>
            <a
              href="/admin/categorias"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              <BookOpen className="h-6 w-6 mx-auto mb-2 text-orange-600" />
              <span className="text-sm font-medium text-gray-900">Categorias</span>
            </a>
            <a
              href="/admin/onboarding"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              <FileText className="h-6 w-6 mx-auto mb-2 text-sky-600" />
              <span className="text-sm font-medium text-gray-900">Onboarding</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}