"use client";

import { Button } from '@/components/ui/button';
import { Play, Heart, Download, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Audio } from '@/types/search';

interface AudioCardProps {
  audio: Audio;
  isFavorite: boolean;
  isDownloaded: boolean;
  onPlay: (audio: Audio) => void;
  onToggleFavorite: (audio: Audio) => void;
  onDownload: (audio: Audio) => void;
}

export function AudioCard({ 
  audio, 
  isFavorite, 
  isDownloaded, 
  onPlay, 
  onToggleFavorite, 
  onDownload 
}: AudioCardProps) {
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} min`;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <Link 
            href={`/player/audio/${audio.id}`}
            className="block hover:text-green-400 transition-colors"
          >
            <h4 className="font-bold text-lg mb-1 truncate">
              {audio.title}
            </h4>
            {audio.subtitle && (
              <p className="text-gray-300 text-sm mb-2 truncate">
                {audio.subtitle}
              </p>
            )}
            {audio.description && (
              <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                {audio.description}
              </p>
            )}
          </Link>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {audio.category && (
              <span className="bg-gray-800 px-2 py-1 rounded text-xs">
                {audio.category.name}
              </span>
            )}
            {audio.duration && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(audio.duration)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPlay(audio)}
            className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
          >
            <Play size={16} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleFavorite(audio)}
            className={`${
              isFavorite
                ? 'text-red-400 hover:text-red-300'
                : 'text-gray-400 hover:text-red-400'
            } hover:bg-red-900/20`}
          >
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>

          {!isDownloaded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload(audio)}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
            >
              <Download size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}