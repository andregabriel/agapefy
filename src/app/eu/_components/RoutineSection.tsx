"use client";

import { Button } from '@/components/ui/button';
import { Clock, Play, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { RefObject } from 'react';
import { getImageUrl } from '../_utils/imageUtils';

interface RoutineSectionProps {
  routinePlaylist: any;
  routineLoading: boolean;
  handlePlayRoutine: () => void;
  handleRemoveFromRoutine: (audioId: string, audioTitle: string) => void;
  setShowAddAudioModal: (show: boolean) => void;
  scrollCarousel: (ref: RefObject<HTMLDivElement>, direction: 'left' | 'right') => void;
  rotinaCarouselRef: RefObject<HTMLDivElement>;
  formatDuration: (seconds: number) => string;
}

export function RoutineSection({
  routinePlaylist,
  routineLoading,
  handlePlayRoutine,
  handleRemoveFromRoutine,
  setShowAddAudioModal,
  scrollCarousel,
  rotinaCarouselRef,
  formatDuration
}: RoutineSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <Clock className="h-6 w-6 mr-2 text-blue-500" />
            Minha Rotina
          </h2>
          <p className="text-sm text-gray-400">
            {routinePlaylist ? 
              `${routinePlaylist.audios.length} áudios na sua rotina personalizada` :
              'Crie sua rotina personalizada de orações'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          {routinePlaylist && routinePlaylist.audios.length > 0 && (
            <Button
              size="sm"
              onClick={handlePlayRoutine}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-1" />
              Tocar Rotina
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowAddAudioModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(rotinaCarouselRef, 'left')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(rotinaCarouselRef, 'right')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="relative">
        {routineLoading ? (
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
        ) : routinePlaylist && routinePlaylist.audios.length > 0 ? (
          <div 
            ref={rotinaCarouselRef}
            className="flex space-x-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {routinePlaylist.audios.map((audio: any) => {
              // Obter URL da imagem usando a mesma lógica da home
              const imageUrl = getImageUrl(audio, audio.category);
              
              const fallbackContent = (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-8 h-8 text-white mx-auto mb-2" />
                    <p className="text-white text-xs font-medium px-2 text-center">
                      {audio.category?.name || 'Áudio'}
                    </p>
                  </div>
                </div>
              );

              return (
                <Link 
                  key={audio.id}
                  href={`/player/audio/${audio.id}`}
                  className="flex-shrink-0 w-48 snap-start cursor-pointer group"
                >
                  <div className="relative mb-4">
                    <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={audio.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                                <div class="text-center">
                                  <svg class="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                  <p class="text-white text-xs font-medium px-2 text-center">${audio.category?.name || 'Áudio'}</p>
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
                          handleRemoveFromRoutine(audio.id, audio.title);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
                      Rotina
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base leading-tight truncate group-hover:underline">
                      {audio.title}
                    </h3>
                    <p className="text-sm text-gray-300 truncate">
                      {audio.subtitle || audio.description}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatDuration(audio.duration || 0)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Sua rotina está vazia</h3>
            <p className="text-sm mb-4">Adicione áudios para criar sua rotina personalizada de orações</p>
            <Button
              onClick={() => setShowAddAudioModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Áudio
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}