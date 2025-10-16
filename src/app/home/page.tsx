"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getCategories, 
  getCategoriesContentFastBulk,
  getCategoryBannerLinks,
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
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserActivity } from '@/hooks/useUserActivity';
import { isRecentesCategoryName } from '@/lib/utils';
import { ActivitiesSection } from '@/app/eu/_components/ActivitiesSection';
import { BannerSection } from './_components/BannerSection';

interface CategoryWithContent extends Category {
  audios: Audio[];
  playlists: Playlist[];
}

export default function HomePage() {
  const [categoriesWithContent, setCategoriesWithContent] = useState<CategoryWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useAppSettings();
  const { activities, loading: activitiesLoading, formatRelativeDate, formatTime } = useUserActivity();
  const [bannerLinks, setBannerLinks] = useState<Record<string, string>>({});
  
  // Refs para controle de estado
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const recentActivitiesCarouselRef = useRef<HTMLDivElement | null>(null);

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    const carousel = ref.current;
    if (!carousel) return;
    const scrollAmount = 200;
    const currentScroll = carousel.scrollLeft;
    const targetScroll = direction === 'left' 
      ? currentScroll - scrollAmount 
      : currentScroll + scrollAmount;
    carousel.scrollTo({ left: targetScroll, behavior: 'smooth' });
  };

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
      let categories = await getCategories();
      // Buscar links de banners em paralelo
      const bannerLinksPromise = getCategoryBannerLinks();

      // Respeitar visibilidade na Home (default: true). Todas as categorias devem estar na home exceto as ocultas
      categories = categories.filter((cat) => (cat as any).is_visible !== false);

      console.log('✅ Categorias encontradas:', categories.length);
      
      if (!mountedRef.current) return; // Componente foi desmontado
      
      if (categories.length === 0) {
        console.log('📭 Nenhuma categoria encontrada');
        setCategoriesWithContent([]);
        return;
      }
      
      // Buscar conteúdo em lote e leve (2 queries totais)
      const ids = categories.map(c => c.id);
      const contentMap = await getCategoriesContentFastBulk(ids);

      const resolvedBannerLinks = await bannerLinksPromise;
      setBannerLinks(resolvedBannerLinks);

      if (!mountedRef.current) return;

      // Montar estrutura final respeitando visibilidade e layouts
      const categoriesWithActualContent = categories.map((cat) => {
        if (isRecentesCategoryName(cat.name)) {
          // Recentes usa activities para áudios e não precisa de stats
          return { ...cat, audios: (activities || []).map((a: any) => a.audio), playlists: [] } as CategoryWithContent;
        }
        if (cat.layout_type === 'banner') {
          return { ...cat, audios: [], playlists: [] } as CategoryWithContent;
        }
        const content = contentMap[cat.id] || { audios: [], playlists: [] };
        return { ...cat, audios: content.audios || [], playlists: content.playlists || [] } as CategoryWithContent;
      })
      // Não esconder categorias vazias: o admin pediu que todas (não ocultas) apareçam
      // Mantemos todas as categorias, inclusive vazias
      
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
  }, [activities]);

  // Atualizar "Recentes" quando atividades mudarem
  useEffect(() => {
    if (!mountedRef.current) return;

    setCategoriesWithContent(prev => {
      const hasRecentes = prev.some(c => isRecentesCategoryName(c.name));
      if (!hasRecentes) return prev;

      return prev.map(c => 
        isRecentesCategoryName(c.name)
          ? { ...c, audios: (activities || []).map((a: any) => a.audio) }
          : c
      );
    });
  }, [activities]);

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
          // Não limpar conteúdo existente para evitar "pisca"
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
      {/* Conteúdo principal (inclui Recentes na posição definida pelo admin) */}
      {categoriesWithContent.length === 0 ? (
        <EmptyState 
          categoriesLoading={categoriesLoading}
          onRefresh={handleRefreshCategories}
        />
      ) : (
        (() => {
          // Agora renderizamos a lista completa de categorias respeitando a ordem do admin.
          // Quando a categoria for "Recentes", mostramos a ActivitiesSection no lugar dela.
          const total = categoriesWithContent.length;
          const effectiveQuotePos = (() => {
            const rawPos = Number.parseInt(settings.prayer_quote_position || '0', 10);
            return Number.isFinite(rawPos)
              ? Math.max(0, Math.min(total, rawPos))
              : 0;
          })();

          const hasRecentesCategory = categoriesWithContent.some(c => isRecentesCategoryName(c.name));

          return (
            <>
              {/* Fallback: mostra "Orações Recentes" no topo se não houver categoria configurada */}
              {!hasRecentesCategory && (
                <ActivitiesSection
                  activities={activities}
                  activitiesLoading={activitiesLoading}
                  scrollCarousel={scrollCarousel}
                  recentActivitiesCarouselRef={recentActivitiesCarouselRef}
                  formatRelativeDate={formatRelativeDate}
                  formatTime={formatTime}
                />
              )}

              {categoriesWithContent.map((category, index) => (
                <div key={category.id}>
                  {isRecentesCategoryName(category.name) ? (
                    <ActivitiesSection
                      activities={activities}
                      activitiesLoading={activitiesLoading}
                      scrollCarousel={scrollCarousel}
                      recentActivitiesCarouselRef={recentActivitiesCarouselRef}
                      formatRelativeDate={formatRelativeDate}
                      formatTime={formatTime}
                    />
                  ) : category.layout_type === 'banner' && bannerLinks[category.id] && category.image_url ? (
                    <BannerSection
                      title={category.name}
                      imageUrl={category.image_url}
                      href={bannerLinks[category.id]}
                    />
                  ) : (
                    <CategorySection
                      category={category}
                      index={index}
                    />
                  )}

                  {/* Inserir frase bíblica na posição dinâmica baseada na lista completa */}
                  {index === effectiveQuotePos && (
                    <div className="hidden my-8">
                      <PrayerQuoteSection />
                    </div>
                  )}
                </div>
              ))}
            </>
          );
        })()
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