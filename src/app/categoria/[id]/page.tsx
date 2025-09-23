"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCategoryContent, getRecentCategoryContent } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Heart, Download, Clock, Music, List, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { usePlayer } from '@/contexts/PlayerContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useDownloads } from '@/hooks/useDownloads';
import { useRoutinePlaylist } from '@/hooks/useRoutinePlaylist';
import { useUserActivity } from '@/hooks/useUserActivity';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Audio {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  duration?: number;
  audio_url: string;
  category?: {
    id: string;
    name: string;
    image_url?: string;
  };
}

interface Playlist {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  total_duration?: number;
  audio_count?: number;
  category?: {
    id: string;
    name: string;
    image_url?: string;
  };
}

interface Category {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
}

// Componente para card de áudio com thumbnail
function AudioCard({ audio, category }: { audio: Audio; category: Category }) {
  const { favorites, addToFavorites, removeFromFavorites } = useFavorites();
  const { downloads, addDownload } = useDownloads();

  const isFavorite = favorites.some(fav => fav.audio.id === audio.id);
  const isDownloaded = downloads.some(download => download.audio.id === audio.id);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} min`;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (isFavorite) {
        const success = await removeFromFavorites(audio.id);
        if (success) {
          toast.success(`"${audio.title}" removido dos favoritos`);
        }
      } else {
        const success = await addToFavorites(audio.id);
        if (success) {
          toast.success(`"${audio.title}" adicionado aos favoritos`);
        }
      }
    } catch (error) {
      console.error('Erro ao alterar favorito:', error);
      toast.error('Erro ao alterar favorito');
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const success = await addDownload({ audio_id: audio.id, download_url: audio.audio_url });
      if (success) {
        toast.success(`"${audio.title}" baixado com sucesso`);
      }
    } catch (error) {
      console.error('Erro ao baixar áudio:', error);
      toast.error('Erro ao baixar áudio');
    }
  };

  // Usar imagem da categoria como thumbnail
  const thumbnailUrl = audio.category?.image_url || category.image_url;

  return (
    <Link 
      href={`/player/audio/${audio.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-gray-800">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={audio.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `
                  <div class="w-full h-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                `;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
              <Play size={24} className="text-white" fill="currentColor" />
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg mb-1 truncate group-hover:text-green-400 transition-colors">
            {audio.title}
          </h3>
          {audio.subtitle && (
            <p className="text-gray-300 text-sm mb-2 truncate">
              {audio.subtitle}
            </p>
          )}
          {audio.description && (
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">
              {audio.description}
            </p>
          )}
          
          {audio.duration && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Clock size={12} />
              {formatDuration(audio.duration)}
            </div>
          )}
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleFavorite}
            className={`${
              isFavorite
                ? 'text-red-400 hover:text-red-300'
                : 'text-gray-400 hover:text-red-400'
            } hover:bg-red-900/20`}
          >
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>

          {!isDownloaded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
            >
              <Download size={16} />
            </Button>
          )}
        </div>
      </div>
    </Link>
  );
}

// Componente para card de playlist com thumbnail
function PlaylistCard({ playlist, category }: { playlist: Playlist; category: Category }) {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  // Usar cover da playlist ou imagem da categoria como fallback
  const thumbnailUrl = playlist.cover_url || playlist.category?.image_url || category.image_url;

  return (
    <Link 
      href={`/player/${playlist.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-gray-800">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={playlist.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `
                  <div class="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                  </div>
                `;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
              <List size={24} className="text-white" />
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <List size={16} className="text-green-400 flex-shrink-0" />
            <h3 className="font-bold text-lg truncate group-hover:text-green-400 transition-colors">
              {playlist.title}
            </h3>
          </div>
          
          {playlist.description && (
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">
              {playlist.description}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {playlist.audio_count && (
              <span className="flex items-center gap-1">
                <Music size={12} />
                {playlist.audio_count} {playlist.audio_count === 1 ? 'áudio' : 'áudios'}
              </span>
            )}
            {playlist.total_duration && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(playlist.total_duration)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CategoriaPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const categoryId = params.id as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [audios, setAudios] = useState<Audio[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hooks para categorias especiais
  const { favorites, loading: favoritesLoading } = useFavorites();
  const { downloads, loading: downloadsLoading } = useDownloads();
  const { routinePlaylist, loading: routineLoading } = useRoutinePlaylist();
  const { activities, loading: activitiesLoading } = useUserActivity();

  useEffect(() => {
    const fetchCategoryData = async () => {
      if (!categoryId) return;

      setLoading(true);
      setError(null);

      try {
        console.log('🔍 Carregando categoria:', categoryId);

        // Buscar dados da categoria
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('id', categoryId)
          .single();

        if (categoryError) {
          console.error('Erro ao buscar categoria:', categoryError);
          setError('Categoria não encontrada');
          return;
        }

        setCategory(categoryData);
        console.log('📋 Categoria encontrada:', categoryData.name);

        // Verificar se é uma categoria especial
        const isSpecialCategory = ['Favoritos', 'Downloads', 'Rotina', 'Recentes'].includes(categoryData.name);

        if (isSpecialCategory) {
          console.log('⭐ Categoria especial detectada:', categoryData.name);
          
          // Para categorias especiais, não buscar do banco
          // Os dados vêm dos hooks que já estão carregando
          setAudios([]);
          setPlaylists([]);
        } else {
          console.log('📂 Categoria normal, buscando conteúdo do banco...');
          
          // Buscar conteúdo da categoria (áudios e playlists)
          const { audios: categoryAudios, playlists: categoryPlaylists } = await getCategoryContent(categoryId);
          
          setAudios(categoryAudios);
          setPlaylists(categoryPlaylists);

          console.log(`✅ Categoria carregada: ${categoryAudios.length} áudios, ${categoryPlaylists.length} playlists`);
        }
      } catch (err) {
        console.error('Erro ao carregar categoria:', err);
        setError('Erro ao carregar categoria');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [categoryId]);

  // Função para obter conteúdo baseado no tipo de categoria
  const getSpecialCategoryContent = () => {
    if (!category) return { audios: [], playlists: [], loading: false };

    switch (category.name) {
      case 'Favoritos':
        return {
          audios: favorites.map(fav => fav.audio),
          playlists: [],
          loading: favoritesLoading
        };
      
      case 'Downloads':
        return {
          audios: downloads.map(download => download.audio),
          playlists: [],
          loading: downloadsLoading
        };
      
      case 'Rotina':
        return {
          audios: routinePlaylist?.audios || [],
          playlists: [],
          loading: routineLoading
        };
      
      case 'Recentes':
        return {
          audios: (activities || []).reduce((acc: any[], a: any) => {
            if (!acc.some(x => x.id === a.audio.id)) acc.push(a.audio);
            return acc;
          }, []),
          playlists,
          loading: activitiesLoading
        };
      
      default:
        return {
          audios,
          playlists,
          loading: false
        };
    }
  };

  const { audios: displayAudios, playlists: displayPlaylists, loading: specialLoading } = getSpecialCategoryContent();
  const isSpecialCategory = category && ['Favoritos', 'Downloads', 'Rotina', 'Recentes'].includes(category.name);
  const finalLoading = loading || (isSpecialCategory && specialLoading);

  if (finalLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="px-4 pt-8">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-8 h-8 bg-gray-800 rounded animate-pulse"></div>
            <div className="h-8 w-48 bg-gray-800 rounded animate-pulse"></div>
          </div>
          
          {/* Content skeleton */}
          <div className="space-y-8">
            <div>
              <div className="h-6 w-32 bg-gray-800 rounded mb-4 animate-pulse"></div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-800 rounded-lg animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-5 w-3/4 bg-gray-800 rounded mb-2 animate-pulse"></div>
                      <div className="h-4 w-1/2 bg-gray-800 rounded mb-2 animate-pulse"></div>
                      <div className="h-3 w-1/4 bg-gray-800 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Categoria não encontrada</h1>
          <p className="text-gray-400 mb-6">{error || 'A categoria solicitada não existe.'}</p>
          <Button onClick={() => router.back()} className="bg-green-600 hover:bg-green-700">
            <ArrowLeft size={16} className="mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // Para categorias especiais, verificar se usuário está logado
  if (isSpecialCategory && !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{category.name}</h1>
          <p className="text-gray-400 mb-6">Faça login para ver seu conteúdo personalizado</p>
          <Button onClick={() => router.push('/login')} className="bg-green-600 hover:bg-green-700">
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  const hasContent = displayAudios.length > 0 || displayPlaylists.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="px-4 pt-8 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-3xl font-bold text-white">{category.name === 'Recentes' ? 'Orações Recentes' : category.name}</h1>
        </div>

        {category.description && (
          <p className="text-gray-400 text-lg mb-6">{category.description}</p>
        )}
      </div>

      {/* Conteúdo */}
      <div className="px-4 pb-6">
        {!hasContent ? (
          <div className="text-center py-12">
            <Music className="h-16 w-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-bold mb-2">
              {isSpecialCategory ? 
                `Nenhum ${category.name.toLowerCase()} ainda` : 
                'Nenhum conteúdo encontrado'
              }
            </h2>
            <p className="text-gray-400">
              {isSpecialCategory ? 
                `Seus ${category.name.toLowerCase()} aparecerão aqui conforme você usar o app.` :
                'Esta categoria ainda não possui áudios ou playlists.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Seção de Áudios */}
            {displayAudios.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Music size={20} className="text-green-400" />
                  {isSpecialCategory ? category.name : 'Orações'} ({displayAudios.length})
                </h2>
                <div className="space-y-4">
                  {displayAudios.map((audio) => (
                    <AudioCard key={audio.id} audio={audio} category={category} />
                  ))}
                </div>
              </div>
            )}

            {/* Seção de Playlists */}
            {displayPlaylists.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <List size={20} className="text-green-400" />
                  Playlists ({displayPlaylists.length})
                </h2>
                <div className="space-y-4">
                  {displayPlaylists.map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} category={category} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}