"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getCategories, 
  getCategoryContent,
  type Category, 
  type Playlist, 
  type Audio 
} from '@/lib/supabase-queries';

// Componentes modulares
import { LoadingState } from './_components/LoadingState';
import { ErrorState } from './_components/ErrorState';
import { EmptyState } from './_components/EmptyState';
import { CategorySection } from './_components/CategorySection';
import { LoadingIndicator } from './_components/LoadingIndicator';
import { PrayerStatsSection } from './_components/PrayerStatsSection';
import { PrayerQuoteSection } from '@/components/PrayerQuoteSection';

interface CategoryWithContent extends Category {
  audios: Audio[];
  playlists: Playlist[];
}

export default function HomePage() {
  const [categoriesWithContent, setCategoriesWithContent] = useState<CategoryWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs para controle de estado
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup no unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Função otimizada para carregar categorias com conteúdo
  const loadCategoriesWithContent = useCallback(async (isRefresh = false) => {
    // Evitar múltiplas chamadas simultâneas
    if (loadingRef.current && !isRefresh) {
      console.log('🔄 Carregamento já em andamento, ignorando...');
      return;
    }

    try {
      loadingRef.current = true;
      
      if (isRefresh) {
        setCategoriesLoading(true);
      } else {
        setLoading(true);
      }
      
      setError(null);
      console.log('🏠 Carregando categorias com conteúdo na home...');
      
      // Buscar categorias primeiro
      const categories = await getCategories();
      console.log('✅ Categorias encontradas:', categories.length);
      
      if (!mountedRef.current) return; // Componente foi desmontado
      
      if (categories.length === 0) {
        console.log('📭 Nenhuma categoria encontrada');
        setCategoriesWithContent([]);
        return;
      }
      
      // Processar categorias em lotes menores para evitar sobrecarga
      const batchSize = 3;
      const categoriesWithContentData: CategoryWithContent[] = [];
      
      for (let i = 0; i < categories.length; i += batchSize) {
        if (!mountedRef.current) return; // Verificar se ainda está montado
        
        const batch = categories.slice(i, i + batchSize);
        console.log(`🔄 Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(categories.length/batchSize)}`);
        
        try {
          const batchResults = await Promise.allSettled(
            batch.map(async (category) => {
              try {
                const { audios, playlists } = await getCategoryContent(category.id);
                console.log(`🎵 Categoria "${category.name}": ${audios.length} áudios + ${playlists.length} playlists`);
                return {
                  ...category,
                  audios: audios || [],
                  playlists: playlists || []
                };
              } catch (error) {
                console.warn(`⚠️ Erro ao carregar conteúdo da categoria "${category.name}":`, error);
                return {
                  ...category,
                  audios: [],
                  playlists: []
                };
              }
            })
          );
          
          // Processar resultados do lote
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              categoriesWithContentData.push(result.value);
            }
          });
          
          // Atualizar UI progressivamente para melhor UX
          if (i === 0 && categoriesWithContentData.length > 0) {
            const categoriesWithActualContent = categoriesWithContentData.filter(
              cat => cat.audios.length > 0 || cat.playlists.length > 0
            );
            if (mountedRef.current) {
              setCategoriesWithContent(categoriesWithActualContent);
              setLoading(false); // Mostrar primeiro lote rapidamente
            }
          }
          
        } catch (batchError) {
          console.warn(`⚠️ Erro no lote ${Math.floor(i/batchSize) + 1}:`, batchError);
        }
      }
      
      if (!mountedRef.current) return;
      
      // Filtrar apenas categorias que têm conteúdo (áudios ou playlists)
      const categoriesWithActualContent = categoriesWithContentData.filter(
        cat => cat.audios.length > 0 || cat.playlists.length > 0
      );
      
      setCategoriesWithContent(categoriesWithActualContent);
      console.log('✅ Categorias com conteúdo carregadas:', categoriesWithActualContent.length);
      
    } catch (error) {
      console.error('❌ Erro ao carregar categorias com conteúdo:', error);
      if (mountedRef.current) {
        setError('Erro ao carregar categorias. Tente novamente.');
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setCategoriesLoading(false);
      }
    }
  }, []);

  // Carregar dados na inicialização (apenas uma vez)
  useEffect(() => {
    console.log('🚀 Inicializando home page...');
    loadCategoriesWithContent(false);
  }, []); // Dependências vazias para executar apenas uma vez

  // Recarregar categorias quando a página ganha foco (debounced)
  useEffect(() => {
    let focusTimeout: NodeJS.Timeout;
    
    const handleFocus = () => {
      // Debounce para evitar múltiplas chamadas
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        if (mountedRef.current && !loadingRef.current) {
          console.log('👁️ Página ganhou foco, recarregando categorias...');
          loadCategoriesWithContent(true);
        }
      }, 1000); // 1 segundo de debounce
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(focusTimeout);
    };
  }, [loadCategoriesWithContent]);

  const handleRefreshCategories = async () => {
    console.log('🔄 Refresh manual das categorias...');
    await loadCategoriesWithContent(true);
  };

  // Estados de loading e erro
  if (loading && categoriesWithContent.length === 0) {
    return <LoadingState />;
  }

  if (error && categoriesWithContent.length === 0) {
    return <ErrorState error={error} onRetry={() => loadCategoriesWithContent(true)} />;
  }

  return (
    <div className="px-4 py-6 pt-6 space-y-8">
      {/* Conteúdo principal */}
      {categoriesWithContent.length === 0 ? (
        <EmptyState 
          categoriesLoading={categoriesLoading}
          onRefresh={handleRefreshCategories}
        />
      ) : (
        categoriesWithContent.map((category, index) => (
          <div key={category.id}>
            {/* Renderizar categoria */}
            <CategorySection
              category={category}
              index={index}
            />
            
            {/* Inserir frase bíblica na posição 2 (após primeira categoria) */}
            {index === 0 && (
              <div className="my-8">
                <PrayerQuoteSection />
              </div>
            )}
          </div>
        ))
      )}

      {/* Indicador de loading para refresh */}
      <LoadingIndicator show={categoriesLoading && categoriesWithContent.length > 0} />

      {/* Seção de estatísticas (sem frase bíblica) */}
      {categoriesWithContent.length > 0 && (
        <PrayerStatsSection />
      )}
    </div>
  );
}