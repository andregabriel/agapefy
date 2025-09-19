"use client";

import { Button } from '@/components/ui/button';
import { Download, Play, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { getImageUrl } from '../_utils/imageUtils';

interface DownloadsSectionProps {
  downloads: any[];
  downloadsLoading: boolean;
  handleRemoveDownload: (audioId: string, audioTitle: string) => void;
  scrollCarousel: (ref: RefObject<HTMLDivElement>, direction: 'left' | 'right') => void;
  downloadsCarouselRef: RefObject<HTMLDivElement>;
  formatDuration: (seconds: number) => string;
  formatFileSize: (bytes: number) => string;
  formatDownloadDate: (dateString: string) => string;
}

export function DownloadsSection({
  downloads,
  downloadsLoading,
  handleRemoveDownload,
  scrollCarousel,
  downloadsCarouselRef,
  formatDuration,
  formatFileSize,
  formatDownloadDate
}: DownloadsSectionProps) {
  const router = useRouter();

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <Download className="h-6 w-6 mr-2 text-purple-500" />
            Downloads
          </h2>
          <p className="text-sm text-gray-400">
            {downloads.length > 0 ? 
              `${downloads.length} áudios baixados` :
              'Seus downloads aparecerão aqui'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(downloadsCarouselRef, 'left')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollCarousel(downloadsCarouselRef, 'right')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="relative">
        {downloadsLoading ? (
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
        ) : downloads.length > 0 ? (
          <div 
            ref={downloadsCarouselRef}
            className="flex space-x-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {downloads.map((download) => {
              // Obter URL da imagem usando a mesma lógica da home
              const imageUrl = getImageUrl(download.audio, download.audio.category);
              
              const fallbackContent = (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                  <div className="text-center">
                    <Download className="w-8 h-8 text-white mx-auto mb-2" />
                    <p className="text-white text-xs font-medium px-2 text-center">
                      {download.audio.category?.name || 'Áudio'}
                    </p>
                  </div>
                </div>
              );

              return (
                <Link 
                  key={download.id}
                  href={`/player/audio/${download.audio.id}`}
                  className="flex-shrink-0 w-48 snap-start cursor-pointer group"
                >
                  <div className="relative mb-4">
                    <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={download.audio.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                                <div class="text-center">
                                  <svg class="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
                                  </svg>
                                  <p class="text-white text-xs font-medium px-2 text-center">${download.audio.category?.name || 'Áudio'}</p>
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
                          handleRemoveDownload(download.audio.id, download.audio.title);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
                      {formatFileSize(download.file_size)}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base leading-tight truncate group-hover:underline">
                      {download.audio.title}
                    </h3>
                    
                    <p className="text-sm text-gray-300 truncate">
                      {download.audio.subtitle || download.audio.description}
                    </p>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{formatDuration(download.audio.duration || 0)}</span>
                      <span>{formatDownloadDate(download.created_at)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Download className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Nenhum download ainda</h3>
            <p className="text-sm mb-4">Baixe áudios para ouvi-los offline</p>
            <Button
              onClick={() => router.push('/audios')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Explorar Áudios
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}