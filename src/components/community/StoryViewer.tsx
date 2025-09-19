"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { type UserIntention } from '@/hooks/useIntentions';

interface StoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  intentions: UserIntention[];
  initialIndex?: number;
}

export default function StoryViewer({ 
  isOpen, 
  onClose, 
  intentions, 
  initialIndex = 0 
}: StoryViewerProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);

  const currentIntention = intentions[currentIndex];

  // Função para fechar com delay para evitar setState durante render
  const handleClose = useCallback(() => {
    setTimeout(() => {
      onClose();
    }, 0);
  }, [onClose]);

  // Auto-progress para próximo story
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          // Ir para próximo story
          if (currentIndex < intentions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            return 0;
          } else {
            // Fechar se for o último - usando handleClose para evitar setState durante render
            handleClose();
            return 0;
          }
        }
        return prev + 2; // 5 segundos total (100/2 = 50 * 100ms)
      });
    }, 100);

    return () => clearInterval(timer);
  }, [isOpen, currentIndex, intentions.length, handleClose]);

  // Reset progress quando mudar story
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  // Reset index quando abrir
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setProgress(0);
    }
  }, [isOpen, initialIndex]);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < intentions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'agora';
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  if (!isOpen || !currentIntention) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-4 left-4 right-4 flex space-x-1 z-10">
        {intentions.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{ 
                width: index < currentIndex ? '100%' : 
                       index === currentIndex ? `${progress}%` : '0%' 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 border-2 border-white">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-gray-700 text-white">
              {user?.user_metadata?.full_name?.charAt(0) || 'Eu'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-medium">Sua Intenção</p>
            <p className="text-gray-300 text-sm">
              Você • {formatRelativeDate(currentIntention.created_at)}
            </p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/20"
        >
          <X size={24} />
        </Button>
      </div>

      {/* Navigation areas */}
      <div className="absolute inset-0 flex">
        {/* Left tap area */}
        <div 
          className="flex-1 cursor-pointer"
          onClick={goToPrevious}
        />
        {/* Right tap area */}
        <div 
          className="flex-1 cursor-pointer"
          onClick={goToNext}
        />
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-8 text-center min-h-[600px] flex flex-col justify-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          {currentIntention.title}
        </h2>
        
        {currentIntention.description && (
          <p className="text-white/90 text-lg leading-relaxed">
            {currentIntention.description}
          </p>
        )}
      </div>

      {/* Bottom action */}
      <div className="absolute bottom-8 left-4 right-4 z-10">
        <Button 
          className="w-full bg-white text-black hover:bg-gray-100 rounded-full py-3 font-medium"
          onClick={() => {
            // TODO: Implementar ação de interceder
            console.log('Interceder pela intenção:', currentIntention.id);
          }}
        >
          Interceder
        </Button>
      </div>

      {/* Navigation arrows (opcional) */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
        >
          <ChevronLeft size={24} />
        </Button>
      )}
      
      {currentIndex < intentions.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
        >
          <ChevronRight size={24} />
        </Button>
      )}
    </div>
  );
}