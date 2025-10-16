import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Category } from '@/types/category';
import { isRecentesCategoryName, isRotinaCategoryName } from '@/lib/utils';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('is_featured', { ascending: false })
        // Ordena nulos por último para não interferirem no admin
        .order('order_position', { ascending: true, nullsFirst: false });

      if (error) throw error;

      let list = data || [];

      // Garantir que exista uma categoria para "Orações Recentes" para permitir ordenação na Home
      // Não cria se já houver uma com nome equivalente (ex.: "Recentes" ou "Orações Recentes")
      const hasRecentes = list.some((c) => isRecentesCategoryName(c.name as any));
      if (!hasRecentes) {
        try {
          const { data: created, error: insertError } = await supabase
            .from('categories')
            .insert({
              name: 'Orações Recentes',
              description: 'Seção dinâmica com suas atividades e orações recentes',
              // Deixe order_position nulo para o trigger atribuir automaticamente a próxima posição
              order_position: null,
              is_featured: false,
              is_visible: true,
              // Mantém layout padrão existente (não utilizado para Recentes, render é por nome)
              layout_type: 'spotify',
              image_url: null
            })
            .select()
            .single();

          if (insertError) {
            console.error('Erro ao criar categoria "Orações Recentes":', insertError);
          } else if (created) {
            // Recarregar lista ordenada após criação para refletir posição correta
            const { data: refetched, error: refetchError } = await supabase
              .from('categories')
              .select('*')
              .order('is_featured', { ascending: false })
              .order('order_position', { ascending: true, nullsFirst: false });
            if (!refetchError) {
              list = refetched || list;
            } else {
              list = [...list, created];
            }
          }
        } catch (e) {
          console.error('Falha ao garantir categoria de Recentes:', e);
        }
      }

      // Garantir que exista uma categoria para "Rotina" (Minha Rotina) para permitir ordenação na Home
      const hasRotina = list.some((c) => isRotinaCategoryName(c.name as any));
      if (!hasRotina) {
        try {
          const { data: createdRotina, error: insertRotinaError } = await supabase
            .from('categories')
            .insert({
              name: 'Rotina',
              description: 'Sua seção de rotina personalizada',
              order_position: null,
              is_featured: false,
              is_visible: true,
              layout_type: 'spotify',
              image_url: null
            })
            .select()
            .single();

          if (insertRotinaError) {
            console.error('Erro ao criar categoria "Rotina":', insertRotinaError);
          } else if (createdRotina) {
            // Recarregar lista para refletir posição correta
            const { data: refetched2, error: refetchError2 } = await supabase
              .from('categories')
              .select('*')
              .order('is_featured', { ascending: false })
              .order('order_position', { ascending: true, nullsFirst: false });
            if (!refetchError2) {
              list = refetched2 || list;
            } else {
              list = [...list, createdRotina];
            }
          }
        } catch (e) {
          console.error('Falha ao garantir categoria de Rotina:', e);
        }
      }

      setCategories(list);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const updateCategoryOrder = async (categoryId: string, newPosition: number) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ order_position: newPosition })
        .eq('id', categoryId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar ordem da categoria:', error);
      throw error;
    }
  };

  const toggleFeaturedCategory = async (categoryId: string, currentFeatured: boolean) => {
    try {
      console.log('🌟 Alterando categoria fixa:', { categoryId, currentFeatured });

      if (!currentFeatured) {
        // Se está marcando como fixa, primeiro remover featured de todas as outras
        console.log('🔄 Removendo featured de outras categorias...');
        const { error: unfeaturedError } = await supabase
          .from('categories')
          .update({ is_featured: false })
          .neq('id', categoryId);

        if (unfeaturedError) {
          console.error('Erro ao remover featured de outras categorias:', unfeaturedError);
          throw unfeaturedError;
        }
      }

      // Atualizar a categoria atual
      console.log('⭐ Atualizando categoria atual...');
      const { error } = await supabase
        .from('categories')
        .update({ is_featured: !currentFeatured, order_position: currentFeatured ? null : undefined })
        .eq('id', categoryId);

      if (error) {
        console.error('Erro ao atualizar categoria featured:', error);
        throw error;
      }

      console.log('✅ Categoria featured atualizada com sucesso');
      
      // Atualizar estado local
      setCategories(prevCategories => 
        prevCategories.map(cat => ({
          ...cat,
          is_featured: cat.id === categoryId ? !currentFeatured : false
        }))
      );

      // Recarregar para garantir ordem correta
      await fetchCategories();
      
      toast.success(
        !currentFeatured 
          ? 'Categoria fixada em primeiro lugar!' 
          : 'Categoria removida da posição fixa!'
      );

    } catch (error) {
      console.error('Erro ao alterar categoria fixa:', error);
      toast.error('Erro ao alterar categoria fixa');
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      console.log('🗑️ Iniciando exclusão da categoria:', categoryId);

      // Buscar informações da categoria antes de deletar
      const categoryToDelete = categories.find(cat => cat.id === categoryId);
      if (!categoryToDelete) {
        console.error('❌ Categoria não encontrada no estado local');
        toast.error('Categoria não encontrada');
        return;
      }

      console.log('📋 Categoria a ser deletada:', {
        id: categoryToDelete.id,
        name: categoryToDelete.name,
        is_featured: categoryToDelete.is_featured
      });

      // Confirmar exclusão
      const confirmMessage = `Tem certeza que deseja excluir a categoria "${categoryToDelete.name}"?\n\nEsta ação não pode ser desfeita.`;
      
      if (!confirm(confirmMessage)) {
        console.log('❌ Usuário cancelou a exclusão');
        return;
      }

      // Verificar se há áudios vinculados à categoria
      console.log('🔍 Verificando áudios vinculados...');
      const { data: audiosData, error: audiosError } = await supabase
        .from('audios')
        .select('id, title')
        .eq('category_id', categoryId);

      if (audiosError) {
        console.error('❌ Erro ao verificar áudios:', audiosError);
        toast.error('Erro ao verificar áudios vinculados');
        return;
      }

      console.log('✅ Áudios encontrados:', audiosData?.length || 0);

      // Verificar se há playlists vinculadas à categoria
      console.log('🔍 Verificando playlists vinculadas...');
      const { data: playlistsData, error: playlistsError } = await supabase
        .from('playlists')
        .select('id, title')
        .eq('category_id', categoryId);

      if (playlistsError) {
        console.error('❌ Erro ao verificar playlists:', playlistsError);
        toast.error('Erro ao verificar playlists vinculadas');
        return;
      }

      console.log('✅ Playlists encontradas:', playlistsData?.length || 0);

      // Se há conteúdo vinculado, avisar o usuário
      const totalItems = (audiosData?.length || 0) + (playlistsData?.length || 0);
      if (totalItems > 0) {
        const items = [];
        if (audiosData && audiosData.length > 0) {
          items.push(`${audiosData.length} oração(ões)`);
        }
        if (playlistsData && playlistsData.length > 0) {
          items.push(`${playlistsData.length} playlist(s)`);
        }

        const warningMessage = `Esta categoria possui ${items.join(' e ')} vinculada(s).\n\nAo excluir a categoria, estes itens ficarão sem categoria.\n\nDeseja continuar?`;

        if (!confirm(warningMessage)) {
          console.log('❌ Usuário cancelou devido ao conteúdo vinculado');
          return;
        }

        // Remover a categoria dos áudios
        if (audiosData && audiosData.length > 0) {
          console.log('🔄 Removendo categoria dos áudios vinculados...');
          const { error: updateAudiosError } = await supabase
            .from('audios')
            .update({ category_id: null })
            .eq('category_id', categoryId);

          if (updateAudiosError) {
            console.error('❌ Erro ao atualizar áudios:', updateAudiosError);
            toast.error('Erro ao remover categoria dos áudios');
            return;
          }

          console.log('✅ Áudios atualizados com sucesso');
        }

        // Remover a categoria das playlists
        if (playlistsData && playlistsData.length > 0) {
          console.log('🔄 Removendo categoria das playlists vinculadas...');
          const { error: updatePlaylistsError } = await supabase
            .from('playlists')
            .update({ category_id: null })
            .eq('category_id', categoryId);

          if (updatePlaylistsError) {
            console.error('❌ Erro ao atualizar playlists:', updatePlaylistsError);
            toast.error('Erro ao remover categoria das playlists');
            return;
          }

          console.log('✅ Playlists atualizadas com sucesso');
        }
      }

      // Agora excluir a categoria
      console.log('🗑️ Excluindo categoria do banco...');
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (deleteError) {
        console.error('❌ Erro ao excluir categoria:', deleteError);
        
        // Tratamento específico de erros
        let errorMessage = 'Erro ao excluir categoria';
        
        if (deleteError.code === '42501') {
          errorMessage = 'Você não tem permissão para excluir esta categoria. Faça login como administrador.';
        } else if (deleteError.code === '23503') {
          errorMessage = 'Esta categoria ainda possui itens vinculados. Tente novamente.';
        } else if (deleteError.message) {
          errorMessage = `Erro: ${deleteError.message}`;
        }

        toast.error(errorMessage);
        return;
      }

      console.log('✅ Categoria excluída com sucesso');
      
      // Atualizar estado local removendo a categoria
      setCategories(prevCategories => prevCategories.filter(cat => cat.id !== categoryId));
      
      // Mostrar mensagem de sucesso
      toast.success(`Categoria "${categoryToDelete.name}" excluída com sucesso!`);

      // Recarregar categorias para reorganizar posições
      await fetchCategories();

    } catch (error: any) {
      console.error('❌ ERRO GERAL na exclusão:', error);
      
      let errorMessage = 'Erro inesperado ao excluir categoria';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    setCategories,
    fetchCategories,
    updateCategoryOrder,
    toggleFeaturedCategory,
    deleteCategory
  };
}