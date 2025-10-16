"use client";

import { ArrowLeft, Plus, Download, MoreHorizontal, Shuffle, Play, Pause, Home, Search, Library, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState, use } from 'react';
import { getPlaylistWithAudios } from '@/lib/supabase-queries';
import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import type { Playlist, Audio } from '@/lib/supabase-queries';

interface PlaylistWithAudios extends Playlist {
  audios: Audio[];
}

interface PlayerPageProps {
  params: Promise<{
    playlistId: string;
  }>;
}

export default function PlayerPage({ params }: PlayerPageProps) {
  const [playlist, setPlaylist] = useState<PlaylistWithAudios | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { state, playQueue, play, pause } = usePlayer();
  
  // Unwrap params usando React.use()
  const { playlistId } = use(params);

  useEffect(() => {
    async function loadPlaylist() {
      try {
        console.log('🎵 Carregando playlist específica:', playlistId);
        
        const playlistData = await getPlaylistWithAudios(playlistId);
        
        if (playlistData) {
          console.log('✅ Playlist carregada:', playlistData.title);
          console.log('🎵 Áudios encontrados:', playlistData.audios?.length || 0);
          setPlaylist(playlistData);
        } else {
          console.error('❌ Playlist não encontrada:', playlistId);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar playlist:', error);
      } finally {
        setLoading(false);
      }
    }

    if (playlistId) {
      loadPlaylist();
    }
  }, [playlistId]);

  // Função para tocar/pausar playlist: se atual, alterna play/pause; senão inicia
  const handlePlayPlaylist = () => {
    if (!playlist || !playlist.audios || playlist.audios.length === 0) {
      console.log('⚠️ Playlist vazia ou sem áudios');
      return;
    }

    const firstAudioId = playlist.audios[0]?.id;
    const isCurrentFromThisPlaylist = state.queue.length > 0 && state.queue[0]?.id === firstAudioId;

    if (isCurrentFromThisPlaylist) {
      if (state.isPlaying) {
        pause();
      } else {
        play();
      }
    } else {
      console.log('🎵 Tocando playlist:', playlist.title, 'com', playlist.audios.length, 'áudios');
      playQueue(playlist.audios, 0);
    }
  };

  // Função para formatar duração em segundos para "Xh Ym"
  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}min`;
  };

  // Calcular estatísticas da playlist
  const audioCount = playlist?.audios?.length || 0;
  const totalDuration = playlist?.audios?.reduce((total, audio) => total + (audio.duration || 0), 0) || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando playlist...</p>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Playlist não encontrada</p>
          <Button variant="outline" onClick={() => router.back()}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-12">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-gray-800"
          onClick={() => router.back()}
        >
          <ArrowLeft size={24} />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pb-64">
        {/* Single Cover Image */}
        <div className="mb-6">
          <div className="aspect-square max-w-80 mx-auto">
            <div className="w-full h-full bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
              {playlist.cover_url ? (
                <img 
                  src={playlist.cover_url} 
                  alt={playlist.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 via-blue-600 to-green-500 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-white text-2xl font-bold mb-2">PLAYLIST</div>
                    <div className="text-white/80 text-lg font-medium">{playlist.title}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Playlist Info */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-3 leading-tight">
            {playlist.title}
          </h1>
          
          {playlist.description && (
            <div className="flex items-center mb-3">
              <span className="text-white font-medium">{playlist.description}</span>
            </div>
          )}

          <div className="flex items-center text-gray-400 text-sm">
            <span className="mr-1">🌐</span>
            <span>{audioCount} orações</span>
            <span className="mx-2">•</span>
            <span>{formatDuration(totalDuration)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-6">
            {/* Action Icons */}
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800">
              <Plus size={24} />
            </Button>
            
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800">
              <Download size={24} />
            </Button>
            
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800">
              <MoreHorizontal size={24} />
            </Button>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800">
              <Shuffle size={24} />
            </Button>
            
            <Button 
              size="icon" 
              className="bg-green-500 hover:bg-green-400 text-black w-14 h-14 rounded-full"
              onClick={handlePlayPlaylist}
            >
              {state.isLoading && state.queue.length > 0 ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : state.isPlaying && state.queue.length > 0 ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" className="ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Track List */}
        <div className="space-y-3">
          {playlist.audios?.map((audio, index) => (
            <div key={audio.id} className="flex items-center space-x-3 py-2">
              <div className="w-14 h-14 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                {audio.category?.image_url ? (
                  <img 
                    src={audio.category.image_url} 
                    alt={audio.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {audio.title.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate text-base">
                  {audio.title}
                </h3>
                <p className="text-gray-400 text-sm truncate">
                  {audio.subtitle || audio.description || 'Oração'}
                </p>
              </div>
              
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0">
                <MoreHorizontal size={20} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800">
        <div className="flex items-center justify-around py-3 px-4">
          <div className="flex flex-col items-center space-y-1">
            <Home size={24} className="text-white" />
            <span className="text-xs text-white font-medium">Home</span>
          </div>
          
          <div className="flex flex-col items-center space-y-1">
            <Search size={24} className="text-gray-400" />
            <span className="text-xs text-gray-400">Search</span>
          </div>
          
          <div className="flex flex-col items-center space-y-1">
            <Library size={24} className="text-gray-400" />
            <span className="text-xs text-gray-400">Your Library</span>
          </div>
          
          <div className="flex flex-col items-center space-y-1">
            <PlusCircle size={24} className="text-gray-400" />
            <span className="text-xs text-gray-400">Create</span>
          </div>
        </div>
      </div>

      {/* Mini Player */}
      <MiniPlayer />
    </div>
  );
}