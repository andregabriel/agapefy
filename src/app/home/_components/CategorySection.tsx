import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentCard } from './ContentCard';
import { QuickAccessIcons } from './QuickAccessIcons';
import { CarouselIndicators } from './CarouselIndicators';
import { deduplicateById, getLayoutClasses } from '../_utils/homeUtils';
import { isRecentesCategoryName } from '@/lib/utils';
import type { Category, Audio, Playlist } from '@/lib/supabase-queries';

interface CategoryWithContent extends Category {
  audios: Audio[];
  playlists: Playlist[];
}

interface CategorySectionProps {
  category: CategoryWithContent;
  index: number;
  dailyAudioId?: string;
}

export function CategorySection({ category, index, dailyAudioId }: CategorySectionProps) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Combinar conteúdo (playlists + áudios) e aplicar ordenação
  const combined = [
    ...category.playlists.map(p => ({ ...p, type: 'playlist' as const })),
    ...category.audios.map(a => ({ ...a, type: 'audio' as const }))
  ];

  const sorted = [...combined].sort((a: any, b: any) => {
    const ao = typeof a.display_order === 'number' ? a.display_order : undefined;
    const bo = typeof b.display_order === 'number' ? b.display_order : undefined;

    if (ao !== undefined && bo !== undefined) {
      if (ao !== bo) return ao - bo;
    } else if (ao !== undefined) {
      return -1;
    } else if (bo !== undefined) {
      return 1;
    }

    const aCreated = a.created_at as string | undefined;
    const bCreated = b.created_at as string | undefined;
    if (aCreated && bCreated) {
      return new Date(bCreated).getTime() - new Date(aCreated).getTime();
    }

    return 0;
  });

  const allContent = deduplicateById(sorted);

  // DEBUG: Log detalhado para diagnosticar
  console.log(`🔍 DEBUG Categoria "${category.name}":`, {
    layout_type: category.layout_type,
    is_featured: category.is_featured,
    audios_count: category.audios.length,
    playlists_count: category.playlists.length,
    raw_content_count: raw.length,
    deduplicated_count: allContent.length,
    content_items: allContent.map(item => ({ id: item.id, title: item.title, type: item.type }))
  });

  // Obter classes de layout
  const layoutType = category.layout_type || 'spotify';
  const layoutClasses = getLayoutClasses(layoutType);
  const isScrollable = ['spotify', 'full', 'double_height', 'grid_3_rows'].includes(layoutType);

  // Função para scroll do carrossel
  const scrollCarousel = (direction: 'left' | 'right') => {
    const carousel = carouselRef.current;
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

  // Detectar mudança de posição no carrossel para indicadores (somente quando scrollable)
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || !isScrollable) return;

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft;
      const itemWidth = carousel.scrollWidth / allContent.length;
      const newIndex = Math.round(scrollLeft / itemWidth);
      setCurrentIndex(Math.max(0, Math.min(newIndex, allContent.length - 1)));
    };

    carousel.addEventListener('scroll', handleScroll);
    return () => carousel.removeEventListener('scroll', handleScroll);
  }, [allContent.length, isScrollable]);

  return (
    <div key={category.id}>
      <section>
        {/* Título da categoria - OCULTO para categoria em destaque */}
        {!category.is_featured && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{isRecentesCategoryName(category.name) ? 'Orações Recentes' : category.name}</h2>
            </div>
          </div>
        )}
        
        <div className="relative group">
          {/* Setas de navegação lateral - APENAS PARA LAYOUTS COM SCROLL */}
          {isScrollable && (
            <>
              <button
                onClick={() => scrollCarousel('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 hidden md:flex items-center justify-center shadow-lg hover:shadow-xl transition-opacity duration-200 border-2 border-gray-200 md:opacity-0 md:group-hover:opacity-100 md:pointer-events-none md:group-hover:pointer-events-auto"
                title="Rolar para a esquerda"
              >
                <ChevronLeft size={24} />
              </button>
              
              <button
                onClick={() => scrollCarousel('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 hidden md:flex items-center justify-center shadow-lg hover:shadow-xl transition-opacity duration-200 border-2 border-gray-200 md:opacity-0 md:group-hover:opacity-100 md:pointer-events-none md:group-hover:pointer-events-auto"
                title="Rolar para a direita"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <div 
            ref={isScrollable ? carouselRef : null}
            className={layoutClasses.containerClass}
            style={isScrollable ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}
          >
            {allContent.map((item) => (
              <ContentCard
                key={`${item.type}-${item.id}`}
                item={item}
                category={category}
                layoutClasses={layoutClasses}
                showDailyVerseBadge={item.type === 'audio' && item.id === dailyAudioId}
              />
            ))}
          </div>

          {/* Indicadores de carrossel para mobile */}
          {isScrollable && (
            <CarouselIndicators
              totalItems={allContent.length}
              currentIndex={currentIndex}
              containerRef={carouselRef}
            />
          )}
        </div>
      </section>

      {/* LINHA FIXA DE ÍCONES COM NAVEGAÇÃO - Apenas após a primeira categoria (destaque) */}
      {index === 0 && category.is_featured && <QuickAccessIcons />}
    </div>
  );
}