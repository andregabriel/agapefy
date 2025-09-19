"use client";

import { Button } from '@/components/ui/button';
import { Heart, Play, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { getImageUrl } from '../_utils/imageUtils';

interface FavoritesSectionProps {
  favorites: any[];
  favoritesLoading: boolean;
  handleRemoveFromFavorites: (audioId: string, audioTitle: string) => void;
  scrollCarousel: (ref: RefObject<HTMLDivElement>, direction: 'left' | 'right') => void;
  favoritosCarouselRef: RefObject<HTMLDivElement>;
  formatDuration: (seconds: number) => string;
  formatFavoriteDate: (dateString: string) => string;
}

export function FavoritesSection({
  favorites,
  favoritesLoading,
  handleRemoveFromFavorites,
  scrollCarousel,
  favoritosCarouselRef,
  formatDuration,
  formatFavoriteDate
}: FavoritesSectionProps) {
  const router = useRouter();

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <Heart className="h-6 w-6 mr-2 text-red-500" />
            Favoritos
          </h2>
          <p className="text-sm text-gray-400">
            {favorites.length > 0 ? 
              `${favorites.length} áudios salvos nos favoritos` :
              'Seus áudios favoritos aparecerão aqui'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(favoritosCarouselRef, 'left')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(favoritosCarouselRef, 'right')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="relative">
        {favoritesLoading ? (
          <div className="flex space-x-6 pb-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-48 animate-pulse">
                <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-700 rounded"></div>
                  <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length > 0 ? (
          <div 
            ref={favoritosCarouselRef}
            className="flex space-x-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {favorites.map((favorite) => {
              // Obter URL da imagem usando a mesma lógica da home
              const imageUrl = getImageUrl(favorite.audio, favorite.audio.category);
              
              const fallbackContent = (
                <div className="w-full h-full bg-gradient-to-br from-red-600 to-pink-600 flex items-center justify-center">
                  <div className="text-center">
                    <Heart className="w-8 h-8 text-white mx-auto mb-2" />
                    <p className="text-white text-xs font-medium px-2 text-center">
                      {favorite.audio.category?.name || 'Áudio'}
                    </p>
                  </div>
                </div>
              );

              return (
                <Link 
                  key={favorite.id}
                  href={`/player/audio/${favorite.audio.id}`}
                  className="flex-shrink-0 w-48 snap-start cursor-pointer group"
                >
                  <div className="relative mb-4">
                    <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={favorite.audio.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-red-600 to-pink-600 flex items-center justify-center">
                                <div class="text-center">
                                  <svg class="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                  </svg>
                                  <p class="text-white text-xs font-medium px-2 text-center">${favorite.audio.category?.name || 'Áudio'}</p>
                                </div>
                              </div>
                            `;
                          }}
                        />
                      ) : (
                        fallbackContent
                      )}
                    </div>
                    
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-400 hover:scale-105 transition-all duration-200">
                        <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
                      </div>
                    </div>

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-8 h-8 p-0 rounded-full"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveFromFavorites(favorite.audio.id, favorite.audio.title);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
                      Favorito
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base leading-tight truncate group-hover:underline">
                      {favorite.audio.title}
                    </h3>
                    <p className="text-sm text-gray-300 truncate">
                      {favorite.audio.subtitle || favorite.audio.description}
                    </p>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{formatDuration(favorite.audio.duration || 0)}</span>
                      <span>{formatFavoriteDate(favorite.created_at)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Heart className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Nenhum favorito ainda</h3>
            <p className="text-sm mb-4">Adicione áudios aos favoritos para vê-los aqui</p>
            <Button
              onClick={() => router.push('/audios')}
              className="bg-red-600 hover:bg-red-700"
            >
              <Heart className="h-4 w-4 mr-2" />
              Explorar Áudios
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}