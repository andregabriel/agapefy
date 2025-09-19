import Link from 'next/link';
import { Play, List } from 'lucide-react';
import { normalizeImageUrl, formatDuration, formatAudioCount } from '../_utils/homeUtils';
import type { Audio, Playlist } from '@/lib/supabase-queries';

interface ContentCardProps {
  item: (Audio | Playlist) & { type: 'audio' | 'playlist' };
  category: { name: string; image_url?: string | null };
  layoutClasses: {
    cardClass: string;
    thumbnailClass: string;
  };
}

export function ContentCard({ item, category, layoutClasses }: ContentCardProps) {
  const isPlaylist = item.type === 'playlist';
  
  // Determinar URL da imagem com prioridade correta
  const imageUrl = isPlaylist
    ? normalizeImageUrl((item as Playlist).cover_url) ||
      normalizeImageUrl(category.image_url) ||
      null
    : normalizeImageUrl((item as Audio).thumbnail_url) ||
      normalizeImageUrl((item as Audio).cover_url) ||
      normalizeImageUrl(category.image_url) ||
      null;

  const href = isPlaylist 
    ? `/player/${item.id}` 
    : `/player/audio/${item.id}`;

  const fallbackContent = (
    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
      <div className="text-center">
        {isPlaylist ? (
          <List size={32} className="text-white mx-auto mb-2" />
        ) : (
          <Play size={32} className="text-white mx-auto mb-2" fill="currentColor" />
        )}
        <p className="text-white text-xs font-medium px-2 text-center line-clamp-2">
          {category.name}
        </p>
      </div>
    </div>
  );

  return (
    <Link 
      key={`${item.type}-${item.id}`}
      href={href}
      className={layoutClasses.cardClass}
    >
      {/* Thumbnail Container */}
      <div className="relative mb-4">
        <div className={layoutClasses.thumbnailClass}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `
                  <div class="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <div class="text-center">
                      ${isPlaylist 
                        ? '<svg class="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>'
                        : '<svg class="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
                      }
                      <p class="text-white text-xs font-medium px-2 text-center">${category.name}</p>
                    </div>
                  </div>
                `;
              }}
            />
          ) : (
            fallbackContent
          )}
        </div>
        
        {/* Play Button Overlay */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-400 hover:scale-105 transition-all duration-200">
            {isPlaylist ? (
              <List size={16} className="text-black" />
            ) : (
              <Play size={16} className="text-black ml-0.5" fill="currentColor" />
            )}
          </div>
        </div>
      </div>
      
      {/* Título, Sub-título e Duração/Contagem */}
      <div className="space-y-1">
        <h3 className="font-bold text-white text-base leading-tight truncate group-hover:underline">
          {item.title}
        </h3>
        
        {isPlaylist ? (
          <p className="text-sm text-gray-400">
            {formatAudioCount((item as Playlist).audio_count)}
          </p>
        ) : (
          <>
            {(item as Audio).subtitle && (
              <p className="text-sm text-gray-300 truncate">
                {(item as Audio).subtitle}
              </p>
            )}
            <p className="text-sm text-gray-400">
              {formatDuration((item as Audio).duration)}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}