"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import NPSWidget from '@/components/community/NPSWidget';
import { User, LogIn, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

// Componentes extraídos
import { ProfileHeader } from './_components/ProfileHeader';
import { RoutineSection } from './_components/RoutineSection';
import { ActivitiesSection } from './_components/ActivitiesSection';
import { FavoritesSection } from './_components/FavoritesSection';
import { DownloadsSection } from './_components/DownloadsSection';
import { IntentionsSection } from './_components/IntentionsSection';
// import { WhatsAppDailyVerseCard } from './_components/WhatsAppDailyVerseCard';

// Modais e componentes existentes
import { AddAudioToRoutineModal } from '@/components/AddAudioToRoutineModal';
import { IntentionModal } from '@/components/IntentionModal';
import { ReflectionModal } from '@/components/ReflectionModal';

// Hooks existentes
import { useRoutinePlaylist } from '@/hooks/useRoutinePlaylist';
import { useUserActivity } from '@/hooks/useUserActivity';
import { useFavorites } from '@/hooks/useFavorites';
import { useDownloads } from '@/hooks/useDownloads';
import { useIntentions } from '@/hooks/useIntentions';
import { useReflections } from '@/hooks/useReflections';

// Ícones
import { Plus, ChevronRight as ChevronRightIcon, Edit, Trash2 } from 'lucide-react';

export default function EuPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Verificar se é guest mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const guestMode = localStorage.getItem('guestMode') === 'true';
      setIsGuestMode(guestMode);
      console.log('🔍 EuPage: Guest mode detectado:', guestMode);
    }
  }, []);

  const { routinePlaylist, loading: routineLoading, removeAudioFromRoutine } = useRoutinePlaylist();
  const { activities, loading: activitiesLoading, formatRelativeDate, formatTime } = useUserActivity();
  const { favorites, loading: favoritesLoading, removeFromFavorites } = useFavorites();
  const { downloads, loading: downloadsLoading, removeDownload, formatFileSize, formatDownloadDate } = useDownloads();
  const { intentions, loading: intentionsLoading, createIntention, updateIntention, deleteIntention, formatRelativeDate: formatIntentionDate } = useIntentions();
  const { reflections, loading: reflectionsLoading, createReflection, updateReflection, deleteReflection, formatRelativeDate: formatReflectionDate } = useReflections();
  const { playQueue, playAudio } = usePlayer();

  // Estados para modais
  const [showAddAudioModal, setShowAddAudioModal] = useState(false);
  const [showIntentionModal, setShowIntentionModal] = useState(false);
  const [intentionModalMode, setIntentionModalMode] = useState<'create' | 'edit'>('create');
  const [editingIntention, setEditingIntention] = useState<any>(null);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [reflectionModalMode, setReflectionModalMode] = useState<'create' | 'edit'>('create');
  const [editingReflection, setEditingReflection] = useState<any>(null);

  // Refs para os carrosséis
  const rotinaCarouselRef = useRef<HTMLDivElement | null>(null);
  const recentActivitiesCarouselRef = useRef<HTMLDivElement | null>(null);
  const favoritosCarouselRef = useRef<HTMLDivElement | null>(null);
  const downloadsCarouselRef = useRef<HTMLDivElement | null>(null);

  // Função para ir para login
  const handleGoToLogin = () => {
    // Limpar guest mode
    if (typeof window !== 'undefined') {
      localStorage.removeItem('guestMode');
    }
    router.push('/login');
  };

  // Função para voltar
  const handleGoBack = () => {
    router.back();
  };

  // LOADING: Ainda carregando autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Carregando...</p>
        </div>
      </div>
    );
  }

  // GUEST MODE: Usuário convidado tentando acessar área restrita
  if (!user && isGuestMode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-white text-xl">
              Meu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-300">
              Para acessar seu perfil pessoal e suas atividades espirituais, você precisa fazer login.
            </p>
            
            <div className="space-y-3">
              <Button
                onClick={handleGoToLogin}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Fazer Login
              </Button>
              
              <Button
                onClick={handleGoBack}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400">
                Ainda não tem uma conta?{' '}
                <Link 
                  href="/login" 
                  className="text-green-400 hover:text-green-300 underline"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('guestMode');
                    }
                  }}
                >
                  Criar conta grátis
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // NÃO LOGADO: Usuário não está em guest mode e não está logado
  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Removido: métricas do dashboard espiritual

  // Função para formatar duração em minutos
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    if (remaining === 0) return `${minutes} min`;
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
  };

  // Funções para scroll dos carrosséis
  const scrollCarousel = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    const carousel = ref.current;
    if (carousel) {
      const scrollAmount = 200;
      const currentScroll = carousel.scrollLeft;
      const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      carousel.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  // Tocar playlist da rotina
  const handlePlayRoutine = () => {
    if (routinePlaylist && routinePlaylist.audios.length > 0) {
      playQueue(routinePlaylist.audios, 0);
      toast.success('Reproduzindo sua rotina de oração');
    } else {
      toast.info('Adicione áudios à sua rotina primeiro');
    }
  };

  // Remover áudio da rotina
  const handleRemoveFromRoutine = async (audioId: string, audioTitle: string) => {
    try {
      const success = await removeAudioFromRoutine(audioId);
      if (success) {
        toast.success(`"${audioTitle}" removido da rotina`);
      } else {
        toast.error('Erro ao remover áudio da rotina');
      }
    } catch (error) {
      console.error('Erro ao remover áudio:', error);
      toast.error('Erro inesperado');
    }
  };

  // Remover áudio dos favoritos
  const handleRemoveFromFavorites = async (audioId: string, audioTitle: string) => {
    try {
      const success = await removeFromFavorites(audioId);
      if (success) {
        toast.success(`"${audioTitle}" removido dos favoritos`);
      } else {
        toast.error('Erro ao remover áudio dos favoritos');
      }
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
      toast.error('Erro inesperado');
    }
  };

  // Remover download
  const handleRemoveDownload = async (audioId: string, audioTitle: string) => {
    try {
      const success = await removeDownload(audioId);
      if (success) {
        toast.success(`"${audioTitle}" removido dos downloads`);
      } else {
        toast.error('Erro ao remover download');
      }
    } catch (error) {
      console.error('Erro ao remover download:', error);
      toast.error('Erro inesperado');
    }
  };

  // Formatar data de favorito
  const formatFavoriteDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Hoje';
    } else if (diffInDays === 1) {
      return 'Ontem';
    } else if (diffInDays < 7) {
      return `Há ${diffInDays} dias`;
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'short' 
      });
    }
  };

  // Funções para intenções
  const handleCreateIntention = () => {
    setIntentionModalMode('create');
    setEditingIntention(null);
    setShowIntentionModal(true);
  };

  const handleEditIntention = (intention: any) => {
    setIntentionModalMode('edit');
    setEditingIntention(intention);
    setShowIntentionModal(true);
  };

  const handleSaveIntention = async (title: string, description?: string): Promise<boolean> => {
    try {
      let success = false;
      
      if (intentionModalMode === 'create') {
        success = await createIntention(title, description);
        if (success) {
          toast.success('Intenção criada com sucesso');
        }
      } else if (editingIntention) {
        success = await updateIntention(editingIntention.id, title, description);
        if (success) {
          toast.success('Intenção atualizada com sucesso');
        }
      }
      
      if (!success) {
        toast.error('Erro ao salvar intenção');
      }
      
      return success;
    } catch (error) {
      console.error('Erro ao salvar intenção:', error);
      toast.error('Erro inesperado');
      return false;
    }
  };

  const handleDeleteIntention = async (intention: any) => {
    try {
      const success = await deleteIntention(intention.id);
      if (success) {
        toast.success(`"${intention.title}" removida`);
      } else {
        toast.error('Erro ao remover intenção');
      }
    } catch (error) {
      console.error('Erro ao remover intenção:', error);
      toast.error('Erro inesperado');
    }
  };

  // Funções para reflexões
  const handleCreateReflection = () => {
    setReflectionModalMode('create');
    setEditingReflection(null);
    setShowReflectionModal(true);
  };

  const handleEditReflection = (reflection: any) => {
    setReflectionModalMode('edit');
    setEditingReflection(reflection);
    setShowReflectionModal(true);
  };

  const handleSaveReflection = async (title: string, content?: string): Promise<boolean> => {
    try {
      let success = false;
      
      if (reflectionModalMode === 'create') {
        success = await createReflection(title, content);
        if (success) {
          toast.success('Reflexão criada com sucesso');
        }
      } else if (editingReflection) {
        success = await updateReflection(editingReflection.id, title, content);
        if (success) {
          toast.success('Reflexão atualizada com sucesso');
        }
      }
      
      if (!success) {
        toast.error('Erro ao salvar reflexão');
      }
      
      return success;
    } catch (error) {
      console.error('Erro ao salvar reflexão:', error);
      toast.error('Erro inesperado');
      return false;
    }
  };

  const handleDeleteReflection = async (reflection: any) => {
    try {
      const success = await deleteReflection(reflection.id);
      if (success) {
        toast.success(`"${reflection.title}" removida`);
      } else {
        toast.error('Erro ao remover reflexão');
      }
    } catch (error) {
      console.error('Erro ao remover reflexão:', error);
      toast.error('Erro inesperado');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-4 py-6 pt-20 space-y-6">
        {/* Cabeçalho compacto do perfil */}
        <ProfileHeader user={user} />

        {/* Preferências rápidas - card de Versículo diário ocultado */}
        {/* <WhatsAppDailyVerseCard defaultSendTime="09:00" /> */}

        {/* Dashboard de Métricas Espirituais ocultado */}

        {/* Seções de conteúdo */}
        <div className="space-y-8">
          {/* Minha Rotina */}
          <RoutineSection
            routinePlaylist={routinePlaylist}
            routineLoading={routineLoading}
            handlePlayRoutine={handlePlayRoutine}
            handleRemoveFromRoutine={handleRemoveFromRoutine}
            setShowAddAudioModal={setShowAddAudioModal}
            scrollCarousel={scrollCarousel}
            rotinaCarouselRef={rotinaCarouselRef}
            formatDuration={formatDuration}
          />

          {/* Atividades Recentes */}
          <ActivitiesSection
            activities={activities}
            activitiesLoading={activitiesLoading}
            scrollCarousel={scrollCarousel}
            recentActivitiesCarouselRef={recentActivitiesCarouselRef}
            formatRelativeDate={formatRelativeDate}
            formatTime={formatTime}
          />

          {/* Favoritos */}
          <FavoritesSection
            favorites={favorites}
            favoritesLoading={favoritesLoading}
            handleRemoveFromFavorites={handleRemoveFromFavorites}
            scrollCarousel={scrollCarousel}
            favoritosCarouselRef={favoritosCarouselRef}
            formatDuration={formatDuration}
            formatFavoriteDate={formatFavoriteDate}
          />

          {/* Downloads (oculto apenas no front-end) */}
          <div className="hidden">
            <DownloadsSection
              downloads={downloads}
              downloadsLoading={downloadsLoading}
              handleRemoveDownload={handleRemoveDownload}
              scrollCarousel={scrollCarousel}
              downloadsCarouselRef={downloadsCarouselRef}
              formatDuration={formatDuration}
              formatFileSize={formatFileSize}
              formatDownloadDate={formatDownloadDate}
            />
          </div>

          {/* Intenções */}
          <IntentionsSection
            intentions={intentions}
            intentionsLoading={intentionsLoading}
            handleCreateIntention={handleCreateIntention}
            handleEditIntention={handleEditIntention}
            handleDeleteIntention={handleDeleteIntention}
            formatIntentionDate={formatIntentionDate}
          />

          {/* Reflexões */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center">
                Reflexões
                <ChevronRightIcon className="h-6 w-6 ml-2 text-gray-400" />
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateReflection}
                className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {reflectionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse p-3 rounded-lg">
                      <div className="h-4 bg-gray-700 rounded mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/3"></div>
                    </div>
                  ))}
                </div>
              ) : reflections.length > 0 ? (
                reflections.map((reflection) => (
                  <div 
                    key={reflection.id}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-white mb-1">{reflection.title}</h3>
                        {reflection.content && (
                          <p className="text-sm text-gray-400 mb-2 line-clamp-3">
                            {reflection.content}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatReflectionDate(reflection.created_at)}
                        </p>
                      </div>
                      <div className="flex space-x-1 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditReflection(reflection)}
                          className="text-gray-400 hover:text-white hover:bg-gray-700 w-8 h-8"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteReflection(reflection)}
                          className="text-gray-400 hover:text-red-400 hover:bg-gray-700 w-8 h-8"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                    <h3 className="font-medium mb-2">Nenhuma reflexão ainda</h3>
                    <p className="text-sm mb-4">Escreva suas primeiras reflexões espirituais</p>
                    <Button
                      onClick={handleCreateReflection}
                      variant="outline"
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar primeira reflexão
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Widget NPS */}
        <NPSWidget />
      </div>

      {/* Modais */}
      <AddAudioToRoutineModal
        open={showAddAudioModal}
        onOpenChange={setShowAddAudioModal}
      />

      <IntentionModal
        open={showIntentionModal}
        onOpenChange={setShowIntentionModal}
        mode={intentionModalMode}
        intention={editingIntention}
        onSave={handleSaveIntention}
      />

      <ReflectionModal
        open={showReflectionModal}
        onOpenChange={setShowReflectionModal}
        mode={reflectionModalMode}
        reflection={editingReflection}
        onSave={handleSaveReflection}
      />
    </div>
  );
}