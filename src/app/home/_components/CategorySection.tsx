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
}

export function CategorySection({ category, index }: CategorySectionProps) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Combinar e deduplicar conteúdo
  const raw = [
    ...category.playlists.map(p => ({ ...p, type: 'playlist' as const })),
    ...category.audios.map(a => ({ ...a, type: 'audio' as const }))
  ];
  const allContent = deduplicateById(raw);

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
  const layoutClasses = getLayoutClasses(category.layout_type || 'spotify');
  const isGridLayout = category.layout_type === 'grid_3_rows';

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

  // Detectar mudança de posição no carro
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || isGridLayout) return;

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft;
      const itemWidth = carousel.scrollWidth / allContent.length;
      const newIndex = Math.round(scrollLeft / itemWidth);
      setCurrentIndex(Math.max(0, Math.min(newIndex, allContent.length - 1)));
    };

    carousel.addEventListener('scroll', handleScroll);
    return () => carousel.removeEventListener('scroll', handleScroll);
  }, [allContent.length, isGridLayout]);

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
        
        <div className="relative">
          {/* Setas de navegação lateral - APENAS PARA LAYOUTS COM SCROLL */}
          {!isGridLayout && (
            <>
              <button
                onClick={() => scrollCarousel('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 hidden md:flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-gray-200"
                title="Rolar para a esquerda"
              >
                <ChevronLeft size={24} />
              </button>
              
              <button
                onClick={() => scrollCarousel('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-12 h-12 hidden md:flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-gray-200"
                title="Rolar para a direita"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <div 
            ref={!isGridLayout ? carouselRef : null}
            className={layoutClasses.containerClass}
            style={!isGridLayout ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}
          >
            {allContent.map((item) => (
              <ContentCard
                key={`${item.type}-${item.id}`}
                item={item}
                category={category}
                layoutClasses={layoutClasses}
              />
            ))}
          </div>

          {/* Indicadores de carrossel para mobile */}
          {!isGridLayout && (
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