"use client";

import { List, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Playlist } from '@/types/search';

interface PlaylistCardProps {
  playlist: Playlist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} min`;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 transition-colors"
    >
      <div className="flex items-start gap-4">
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            alt={playlist.title}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <List className="text-white" size={24} />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-lg mb-1 truncate hover:text-blue-400 transition-colors">
            {playlist.title}
          </h4>
          {playlist.description && (
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">
              {playlist.description}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {playlist.category && (
              <span className="bg-gray-800 px-2 py-1 rounded text-xs">
                {playlist.category.name}
              </span>
            )}
            {playlist.audio_count && (
              <span>{playlist.audio_count} áudios</span>
            )}
            {playlist.total_duration && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(playlist.total_duration)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}