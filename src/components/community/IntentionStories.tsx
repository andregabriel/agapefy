"use client";

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IntentionModal } from '@/components/IntentionModal';
import { useIntentions } from '@/hooks/useIntentions';
import { useCommunityFeed } from '@/hooks/useCommunityFeed';
import { useAuth } from '@/contexts/AuthContext';
import StoryViewer from './StoryViewer';

interface IntentionStoriesProps {
  onIntentionCreated?: () => void;
}

export default function IntentionStories({ onIntentionCreated }: IntentionStoriesProps) {
  const { user } = useAuth();
  const { intentions, createIntention, refetch: refetchIntentions } = useIntentions();
  const { createIntentionPost } = useCommunityFeed();
  const [showIntentionModal, setShowIntentionModal] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);

  // Filtrar intenções recentes (últimas 24h)
  const recentIntentions = intentions.filter(intention => {
    const createdAt = new Date(intention.created_at);
    const now = new Date();
    const diffInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return diffInHours <= 24;
  });

  const hasRecentIntentions = recentIntentions.length > 0;

  const handleCreateIntention = async (title: string, description?: string): Promise<boolean> => {
    try {
      console.log('📝 Criando intenção:', title);
      
      // Criar intenção
      const success = await createIntention(title, description);
      if (!success) {
        console.error('❌ Falha ao criar intenção');
        return false;
      }

      console.log('✅ Intenção criada, recarregando lista...');
      
      // Recarregar intenções para pegar a nova
      await refetchIntentions();
      
      // Aguardar um pouco e buscar a intenção mais recente
      setTimeout(async () => {
        try {
          // Buscar a intenção mais recente do usuário atual
          const userIntentions = intentions.filter(i => i.user_id === user?.id);
          const latestIntention = userIntentions.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          
          if (latestIntention && latestIntention.title === title) {
            console.log('📤 Criando post no feed para intenção:', latestIntention.id);
            // Criar post no feed
            const postSuccess = await createIntentionPost(latestIntention.id);
            if (postSuccess) {
              console.log('✅ Post de intenção criado no feed');
            } else {
              console.error('❌ Falha ao criar post no feed');
            }
          } else {
            console.log('⏳ Intenção ainda não carregada, tentando buscar diretamente...');
            
            // Tentar buscar diretamente do banco
            const { supabase } = await import('@/lib/supabase');
            const { data: freshIntentions } = await supabase
              .from('user_intentions')
              .select('*')
              .eq('user_id', user?.id)
              .eq('title', title)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (freshIntentions && freshIntentions.length > 0) {
              const newIntention = freshIntentions[0];
              console.log('📤 Criando post no feed para intenção encontrada:', newIntention.id);
              const postSuccess = await createIntentionPost(newIntention.id);
              if (postSuccess) {
                console.log('✅ Post de intenção criado no feed');
              } else {
                console.error('❌ Falha ao criar post no feed');
              }
            } else {
              console.error('❌ Intenção não encontrada mesmo buscando diretamente');
            }
          }
        } catch (error) {
          console.error('💥 Erro ao buscar intenção:', error);
        }

        // Callback opcional
        onIntentionCreated?.();
      }, 1000); // Aumentar tempo para 1 segundo
      
      return true;
    } catch (error) {
      console.error('💥 Erro ao criar intenção:', error);
      return false;
    }
  };

  const handleStoryClick = () => {
    if (recentIntentions.length > 0) {
      setShowStoryViewer(true);
    } else {
      setShowIntentionModal(true);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 text-white">Intenções</h2>
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {/* Minha intenção - agrupada em uma bolinha */}
        <div className="flex flex-col items-center space-y-2 flex-shrink-0">
          <div className="relative">
            <Avatar 
              className={`h-16 w-16 border-2 cursor-pointer ${
                hasRecentIntentions ? 'border-green-500' : 'border-gray-600'
              }`}
              onClick={handleStoryClick}
            >
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-gray-700 text-white">
                {user?.user_metadata?.full_name?.charAt(0) || 'Eu'}
              </AvatarFallback>
            </Avatar>
            
            {/* Botão + para nova intenção */}
            <button
              onClick={() => setShowIntentionModal(true)}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
            >
              <Plus size={12} className="text-white" />
            </button>
            
            {/* Indicador de múltiplas intenções */}
            {recentIntentions.length > 1 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">
                  {recentIntentions.length}
                </span>
              </div>
            )}
          </div>
          
          <span className="text-xs text-gray-400 text-center">
            {hasRecentIntentions ? 'Suas intenções' : 'Nova intenção'}
          </span>
        </div>

        {/* Placeholder para outros usuários (futuro) */}
        <div className="flex flex-col items-center space-y-2 flex-shrink-0 opacity-50">
          <Avatar className="h-16 w-16 border-2 border-gray-600">
            <AvatarFallback className="bg-gray-700 text-gray-500">
              👥
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-500">Amigos</span>
        </div>
      </div>

      {/* Modal de nova intenção */}
      <IntentionModal
        open={showIntentionModal}
        onOpenChange={setShowIntentionModal}
        onSave={handleCreateIntention}
        mode="create"
      />

      {/* Visualizador de stories */}
      <StoryViewer
        isOpen={showStoryViewer}
        onClose={() => setShowStoryViewer(false)}
        intentions={recentIntentions}
        initialIndex={0}
      />
    </div>
  );
}