"use client";

import { Button } from '@/components/ui/button';
import { History, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { getImageUrl } from '../_utils/imageUtils';

interface ActivitiesSectionProps {
  activities: any[];
  activitiesLoading: boolean;
  scrollCarousel: (ref: RefObject<HTMLDivElement>, direction: 'left' | 'right') => void;
  recentActivitiesCarouselRef: RefObject<HTMLDivElement>;
  formatRelativeDate: (dateString: string) => string;
  formatTime: (dateString: string) => string;
}

export function ActivitiesSection({
  activities,
  activitiesLoading,
  scrollCarousel,
  recentActivitiesCarouselRef,
  formatRelativeDate,
  formatTime
}: ActivitiesSectionProps) {
  const router = useRouter();

  // Garantir que cada áudio apareça apenas uma vez (mais recente primeiro)
  const uniqueActivities = (() => {
    const seenAudioIds = new Set<string>();
    const deduped: any[] = [];
    for (const activity of activities || []) {
      const audioId = activity?.audio?.id as string | undefined;
      if (!audioId) continue;
      if (seenAudioIds.has(audioId)) continue;
      seenAudioIds.add(audioId);
      deduped.push(activity);
    }
    return deduped;
  })();

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <History className="h-6 w-6 mr-2 text-green-500" />
            Orações Recentes
          </h2>
          <p className="text-sm text-gray-400">
            {uniqueActivities.length > 0 ? 
              `${uniqueActivities.length} atividades recentes` :
              'Suas atividades aparecerão aqui'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(recentActivitiesCarouselRef, 'left')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(recentActivitiesCarouselRef, 'right')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="relative">
        {activitiesLoading ? (
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
        ) : uniqueActivities.length > 0 ? (
          <div 
            ref={recentActivitiesCarouselRef}
            className="flex space-x-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {uniqueActivities.map((activity) => {
              // Obter URL da imagem usando a mesma lógica da home
              const imageUrl = getImageUrl(activity.audio, activity.audio.category);
              
              const fallbackContent = (
                <div className="w-full h-full bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center">
                  <div className="text-center">
                    <History className="w-8 h-8 text-white mx-auto mb-2" />
                    <p className="text-white text-xs font-medium px-2 text-center">
                      {activity.audio.category?.name || 'Áudio'}
                    </p>
                  </div>
                </div>
              );

              return (
                <Link 
                  key={activity.id}
                  href={`/player/audio/${activity.audio.id}`}
                  className="flex-shrink-0 w-48 snap-start cursor-pointer group"
                >
                  <div className="relative mb-4">
                    <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={activity.audio.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center">
                                <div class="text-center">
                                  <svg class="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                                  </svg>
                                  <p class="text-white text-xs font-medium px-2 text-center">${activity.audio.category?.name || 'Áudio'}</p>
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

                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
                      {formatTime(activity.created_at)}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base leading-tight truncate group-hover:underline">
                      {activity.audio.title}
                    </h3>
                    <p className="text-sm text-gray-300 truncate">
                      {activity.audio.subtitle || activity.audio.description}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatRelativeDate(activity.created_at)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <History className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Nenhuma atividade ainda</h3>
            <p className="text-sm mb-4">Suas atividades de oração aparecerão aqui</p>
            <Button
              onClick={() => router.push('/audios')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Começar a Orar
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}