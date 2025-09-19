"use client";

import { useState, useEffect } from 'react';
import { Users, Plus, MessageCircle, Heart, Loader2, Search, LogIn, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunityFeedOptimized, FeedFilter } from '@/hooks/useCommunityFeedOptimized';
import { useAnalytics } from '@/hooks/useAnalytics';
import IntentionStories from '@/components/community/IntentionStories';
import CommunityPost from '@/components/community/CommunityPost';
import CreatePostModal from '@/components/community/CreatePostModal';
import OnboardingCard from '@/components/community/OnboardingCard';
import PostSkeleton from '@/components/community/PostSkeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AmigosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { trackCommunityEvent, trackPerformance, trackEngagement } = useAnalytics();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Verificar se é guest mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const guestMode = localStorage.getItem('guestMode') === 'true';
      setIsGuestMode(guestMode);
      console.log('🔍 AmigosPage: Guest mode detectado:', guestMode);
    }
  }, []);

  const { 
    posts, 
    loading: feedLoading, 
    error,
    filter,
    changeFilter,
    toggleLike, 
    toggleIntercession, 
    fetchPostComments,
    addComment,
    formatRelativeDate,
    refetch 
  } = useCommunityFeedOptimized();

  // Track performance do carregamento do feed
  useEffect(() => {
    if (!feedLoading && posts.length > 0) {
      trackPerformance('feed_load_time', Date.now(), {
        posts_count: posts.length,
        filter: filter,
        has_error: !!error
      });
    }
  }, [feedLoading, posts.length, error, filter, trackPerformance]);

  // Verificar se é primeira visita do usuário
  useEffect(() => {
    if (user && posts.length === 0 && !feedLoading && !error && filter === 'all') {
      const hasSeenOnboarding = localStorage.getItem(`onboarding_seen_${user.id}`);
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
        trackCommunityEvent('onboarding_shown');
      }
    }
  }, [user, posts.length, feedLoading, error, filter, trackCommunityEvent]);

  const handleIntentionCreated = () => {
    trackCommunityEvent('intention_created_from_stories');
    refetch();
  };

  const handlePostCreated = () => {
    trackCommunityEvent('text_post_created');
    refetch();
  };

  const handleDismissOnboarding = () => {
    if (user) {
      localStorage.setItem(`onboarding_seen_${user.id}`, 'true');
    }
    setShowOnboarding(false);
    trackCommunityEvent('onboarding_dismissed');
  };

  const handleCreateIntention = () => {
    handleDismissOnboarding();
    trackCommunityEvent('onboarding_create_intention_clicked');
    window.location.href = '/oracao';
  };

  const handleCreatePost = () => {
    handleDismissOnboarding();
    trackCommunityEvent('onboarding_create_post_clicked');
    setShowCreateModal(true);
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    trackCommunityEvent('create_post_modal_opened', { source: 'header_button' });
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    trackCommunityEvent('create_post_modal_closed');
  };

  const handleFilterChange = (newFilter: FeedFilter) => {
    changeFilter(newFilter);
    trackCommunityEvent('feed_filter_changed', { 
      from: filter, 
      to: newFilter 
    });
  };

  // Wrapper para ações de posts com analytics
  const handleLikeWithAnalytics = async (postId: string) => {
    const startTime = Date.now();
    const result = await toggleLike(postId);
    const duration = Date.now() - startTime;
    
    trackCommunityEvent('post_liked', { 
      post_id: postId,
      response_time: duration,
      success: result,
      filter: filter
    });
    
    return result;
  };

  const handleIntercessionWithAnalytics = async (postId: string) => {
    const startTime = Date.now();
    const result = await toggleIntercession(postId);
    const duration = Date.now() - startTime;
    
    trackCommunityEvent('post_intercession', { 
      post_id: postId,
      response_time: duration,
      success: result,
      filter: filter
    });
    
    
    
    return result;
  };

  const handleCommentWithAnalytics = async (postId: string, content: string) => {
    const startTime = Date.now();
    const result = await addComment(postId, content);
    const duration = Date.now() - startTime;
    
    trackCommunityEvent('comment_added', { 
      post_id: postId,
      comment_length: content.length,
      response_time: duration,
      success: result,
      filter: filter
    });
    
    return result;
  };

  // Função para ir para login
  const handleGoToLogin = () => {
    // Limpar guest mode
    if (typeof window !== 'undefined') {
      localStorage.removeItem('guestMode');
    }
    trackCommunityEvent('guest_login_clicked', { source: 'amigos_page' });
    router.push('/login');
  };

  // Função para voltar
  const handleGoBack = () => {
    trackCommunityEvent('guest_back_clicked', { source: 'amigos_page' });
    router.back();
  };

  // LOADING: Ainda carregando autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
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
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-white text-xl">
              Amigos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-300">
              Para acessar a comunidade e interagir com outros usuários, você precisa fazer login.
            </p>
            
            <div className="space-y-3">
              <Button
                onClick={handleGoToLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
                  className="text-blue-400 hover:text-blue-300 underline"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // USUÁRIO LOGADO: Mostrar página normal
  return (
    <div className="px-4 py-6 pt-20 space-y-6 bg-gray-900 min-h-screen">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Amigos</h1>
          <p className="text-gray-400">Compartilhe sua jornada de fé</p>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/descobrir">
            <Button 
              size="icon" 
              variant="outline" 
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Search size={20} />
            </Button>
          </Link>
          <Button 
            size="icon" 
            variant="outline" 
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={handleOpenCreateModal}
          >
            <Plus size={20} />
          </Button>
        </div>
      </div>

      {/* Onboarding para novos usuários */}
      {showOnboarding && (
        <OnboardingCard
          onDismiss={handleDismissOnboarding}
          onCreatePost={handleCreatePost}
          onCreateIntention={handleCreateIntention}
        />
      )}

      {/* Stories de Intenções */}
      <IntentionStories onIntentionCreated={handleIntentionCreated} />

      {/* Filtros do Feed */}
      <div className="flex items-center space-x-2">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => handleFilterChange('all')}
          className={filter === 'all' 
            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
            : 'border-gray-700 text-gray-300 hover:bg-gray-800'
          }
        >
          <Users size={14} className="mr-1" />
          Todos
        </Button>
        <Button
          size="sm"
          variant={filter === 'following' ? 'default' : 'outline'}
          onClick={() => handleFilterChange('following')}
          className={filter === 'following' 
            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
            : 'border-gray-700 text-gray-300 hover:bg-gray-800'
          }
        >
          <Heart size={14} className="mr-1" />
          Seguindo
        </Button>
        <Link href="/descobrir">
          <Button
            size="sm"
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Search size={14} className="mr-1" />
            Descobrir
          </Button>
        </Link>
      </div>

      {/* Conteúdo do Feed */}
      <div className="space-y-4">
        {feedLoading && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={24} />
              <p className="text-gray-400 text-sm">
                Carregando {filter === 'all' ? 'todos os posts' : 'posts de quem você segue'}...
              </p>
            </div>
            {/* Skeleton loading */}
            {[...Array(3)].map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-400 mb-4">{error}</p>
              <Button
                onClick={() => {
                  trackCommunityEvent('feed_retry_clicked', { filter });
                  refetch();
                }}
                variant="outline"
                className="border-red-700 text-red-400 hover:bg-red-900/20"
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {!feedLoading && !error && posts.length === 0 && (
          <div className="text-center py-12">
            {filter === 'following' ? (
              <>
                <Heart className="mx-auto mb-4 text-gray-500" size={48} />
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  Nenhum post de quem você segue
                </h3>
                <p className="text-gray-500 mb-6">
                  Siga outros usuários para ver seus posts aqui
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/descobrir">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Search size={16} className="mr-2" />
                      Descobrir usuários
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    onClick={() => handleFilterChange('all')}
                  >
                    <Users size={16} className="mr-2" />
                    Ver todos os posts
                  </Button>
                </div>
              </>
            ) : !showOnboarding ? (
              <>
                <Heart className="mx-auto mb-4 text-gray-500" size={48} />
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  Sua jornada de fé começa aqui
                </h3>
                <p className="text-gray-500 mb-6">
                  Compartilhe uma reflexão, crie uma intenção ou ore com um áudio
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => {
                      trackCommunityEvent('empty_state_create_post_clicked');
                      setShowCreateModal(true);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus size={16} className="mr-2" />
                    Compartilhar reflexão
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    onClick={() => {
                      trackCommunityEvent('empty_state_create_intention_clicked');
                      window.location.href = '/oracao';
                    }}
                  >
                    <MessageCircle size={16} className="mr-2" />
                    Criar intenção
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {!feedLoading && !error && posts.length > 0 && (
          <div className="space-y-4">
            {/* Indicador do filtro ativo */}
            {filter === 'following' && (
              <div className="text-center">
                <Badge variant="secondary" className="bg-blue-900/30 text-blue-400 border-blue-800">
                  <Heart size={12} className="mr-1" />
                  Mostrando posts de quem você segue
                </Badge>
              </div>
            )}

            {posts.map((post) => (
              <CommunityPost
                key={post.id}
                post={post}
                onLike={handleLikeWithAnalytics}
                onIntercede={handleIntercessionWithAnalytics}
                fetchPostComments={fetchPostComments}
                addComment={handleCommentWithAnalytics}
                formatRelativeDate={formatRelativeDate}
              />
            ))}

            {/* Indicador de fim do feed */}
            <div className="text-center py-6">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-800 text-gray-400 text-sm">
                <Heart size={14} className="mr-2" />
                {filter === 'following' 
                  ? 'Você está em dia com quem segue' 
                  : 'Você está em dia com a comunidade'
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de criação de post */}
      <CreatePostModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}