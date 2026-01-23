"use client";

import { ArrowLeft, Play, Pause, Home, Search, Library, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { AudioActionButtons } from '@/components/AudioActionButtons';
import type { Audio } from '@/lib/supabase-queries';
import { normalizeImageUrl } from '@/app/home/_utils/homeUtils';
import { copyToClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';

interface AudioWithCategory extends Audio {
  category?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    created_at: string;
  } | null;
}

interface AudioPlayerPageProps {
  params: Promise<{
    audioId: string;
  }>;
}

export default function AudioPlayerPage({ params }: AudioPlayerPageProps) {
  const [audio, setAudio] = useState<AudioWithCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { state, playQueue, play, pause } = usePlayer();
  
  // Unwrap params usando React.use()
  const { audioId } = use(params);

  useEffect(() => {
    async function loadAudio() {
      try {
        console.log('🎵 Carregando áudio específico:', audioId);
        
        const { data: audioData, error } = await supabase
          .from('audios')
          .select(`
            *,
            category:categories(
              id,
              name,
              description,
              image_url,
              created_at
            )
          `)
          .eq('id', audioId)
          .single();
        
        if (error) {
          console.error('❌ Erro ao carregar áudio:', error);
          throw error;
        }

        if (audioData) {
          console.log('✅ Áudio carregado:', audioData.title);
          setAudio(audioData);
        } else {
          console.error('❌ Áudio não encontrado:', audioId);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar áudio:', error);
      } finally {
        setLoading(false);
      }
    }

    if (audioId) {
      loadAudio();
    }
  }, [audioId]);

  // Função para tocar/pausar o áudio atual ou iniciar se for diferente
  const handlePlayAudio = () => {
    if (!audio) {
      console.log('⚠️ Áudio não encontrado');
      return;
    }

    const isCurrentAudio = state.currentAudio?.id === audio.id;

    if (isCurrentAudio) {
      if (state.isPlaying) {
        pause();
      } else {
        play();
      }
    } else {
      console.log('🎵 Tocando áudio:', audio.title);
      playQueue([audio], 0); // Inicia este áudio sem depender do estado anterior
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

  const handleShareAudio = async () => {
    if (!audio || typeof window === 'undefined') {
      return;
    }

    const shareUrl = window.location.href;
    const shareText = audio.subtitle || audio.description || 'Ouça esta oração na Agapefy.';
    const shareData = {
      title: audio.title,
      text: shareText,
      url: shareUrl
    };

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        toast.success('Compartilhado com sucesso!');
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    }

    try {
      await copyToClipboard(shareUrl);
      toast.success('Link copiado!');
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      toast.error('Não foi possível compartilhar.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando áudio...</p>
        </div>
      </div>
    );
  }

  if (!audio) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Áudio não encontrado</p>
          <Button variant="outline" onClick={() => router.back()}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const coverUrl = audio.cover_url || audio.category?.image_url || null;
  const cover1x = coverUrl
    ? normalizeImageUrl(coverUrl, { width: 320, height: 320, quality: 70 }) || coverUrl
    : null;
  const cover2x = coverUrl
    ? normalizeImageUrl(coverUrl, { width: 640, height: 640, quality: 70 }) || coverUrl
    : null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      <div className="px-4 pt-12">
        <div className="flex flex-col sm:grid sm:grid-cols-[auto,auto,1fr] sm:grid-rows-[auto,auto] sm:gap-x-8 sm:gap-y-6">
          <div className="order-1 sm:col-start-1 sm:row-start-1">
            <div className="absolute left-4 top-12 sm:static sm:mt-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-gray-800"
                onClick={() => router.back()}
              >
                <ArrowLeft size={24} />
              </Button>
            </div>
          </div>

          <div className="order-2 sm:col-start-2 sm:row-start-1">
            <div className="flex justify-center sm:justify-start w-full sm:w-auto">
              <div className="w-[159px] h-[159px] sm:w-56 sm:h-56 md:w-72 md:h-72 lg:w-80 lg:h-80">
                <div className="w-full h-full bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
                  {/** Preferir a capa do próprio áudio; fallback para imagem da categoria */}
                  {coverUrl ? (
                    <img
                      src={cover1x || undefined}
                      srcSet={cover1x && cover2x ? `${cover1x} 1x, ${cover2x} 2x` : undefined}
                      alt={audio.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 via-blue-600 to-green-500 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-white text-2xl font-bold mb-2">ORAÇÃO</div>
                        <div className="text-white/80 text-lg font-medium">{audio.title}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="order-3 mt-6 sm:mt-0 sm:col-start-3 sm:row-start-1 sm:row-span-2">
            <div className="space-y-3 sm:space-y-4">
              <div className="hidden sm:block text-sm font-semibold text-white/80 tracking-wide">Oração</div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                {audio.title}
              </h1>

              {audio.subtitle && (
                <div className="text-white font-medium">
                  {audio.subtitle}
                </div>
              )}

              {audio.description && (
                <div className="text-gray-300 text-sm leading-relaxed">
                  {audio.description}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center text-gray-400 text-sm">
              <span className="mr-1">🎵</span>
              <span>Oração</span>
              {audio.duration && (
                <>
                  <span className="mx-2">•</span>
                  <span>{formatDuration(audio.duration)}</span>
                </>
              )}
              {audio.category && (
                <>
                  <span className="mx-2">•</span>
                  <span>{audio.category.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="order-4 mt-6 sm:mt-4 sm:col-start-2 sm:row-start-2">
            <div className="flex items-center justify-between sm:justify-start sm:gap-4">
              <div className="order-1 sm:order-2">
                <AudioActionButtons 
                  audioId={audio.id}
                  audioTitle={audio.title}
                  variant="default"
                  hideDownload
                  showShare
                  onShare={handleShareAudio}
                  shareClassName="hidden sm:inline-flex"
                />
              </div>

              <div className="order-2 sm:order-1">
                <Button 
                  size="icon" 
                  className="bg-green-500 hover:bg-green-400 text-black w-14 h-14 rounded-full"
                  onClick={handlePlayAudio}
                >
                  {state.currentAudio?.id === audio.id && state.isLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : state.currentAudio?.id === audio.id && state.isPlaying ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" className="ml-1" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pb-64">

        {/* Audio Details */}
        <div className="mt-8 space-y-6">
          {/* Transcript Section */}
          {audio.transcript && (
            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">Oração</h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {audio.transcript}
              </p>
            </div>
          )}
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

    </div>
  );
}
