"use client";

import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { formatDuration } from '@/lib/utils';
import { useState } from 'react';

export const MiniPlayer = () => {
  const { state, play, pause, next, previous, seekTo, setVolume } = usePlayer();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  if (!state.currentAudio) {
    return null;
  }

  const progressPercentage = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const handleSeek = (value: number[]) => {
    const newTime = (value[0] / 100) * state.duration;
    seekTo(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100);
  };

  return (
    <div
      className="fixed left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 z-30"
      style={{ bottom: 'var(--tabbar-h, 0px)' }}
    >
      {/* Barra de progresso */}
      <div className="mb-3">
        <Slider
          value={[progressPercentage]}
          onValueChange={handleSeek}
          max={100}
          step={0.1}
          className="w-full"
          trackClassName="bg-black"
          rangeClassName="bg-white"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatDuration(Math.floor(state.currentTime))}</span>
          <span>{formatDuration(Math.floor(state.duration))}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Informações da música */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
            <Play size={16} className="text-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-white text-sm font-medium truncate">
              {state.currentAudio.title}
            </h4>
            <p className="text-gray-400 text-xs truncate">
              {state.currentAudio.description || 'Oração'}
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={previous}
            disabled={state.currentIndex <= 0}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <SkipBack size={20} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={state.isPlaying ? pause : play}
            disabled={state.isLoading}
            className="text-white hover:text-gray-300"
          >
            {state.isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : state.isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={next}
            disabled={state.currentIndex >= state.queue.length - 1}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <SkipForward size={20} />
          </Button>

          {/* Controle de volume */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="text-gray-400 hover:text-white"
            >
              <Volume2 size={20} />
            </Button>
            
            {showVolumeSlider && (
              <div className="absolute bottom-full right-0 mb-2 bg-gray-800 p-3 rounded-lg shadow-lg">
                <Slider
                  value={[state.volume * 100]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  orientation="vertical"
                  className="h-20"
                  trackClassName="bg-black"
                  rangeClassName="bg-white"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
