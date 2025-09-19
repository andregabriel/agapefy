"use client";

import { useState } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, Send, X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';

interface FeedbackWidgetProps {
  onClose?: () => void;
}

export default function FeedbackWidget({ onClose }: FeedbackWidgetProps) {
  const { user } = useAuth();
  const { trackCommunityEvent } = useAnalytics();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'trigger' | 'rating' | 'comment' | 'thanks'>('trigger');
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    setStep('rating');
    trackCommunityEvent('feedback_opened');
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep('trigger');
    setRating(null);
    setComment('');
    onClose?.();
    trackCommunityEvent('feedback_closed', { step });
  };

  const handleRating = (selectedRating: number) => {
    setRating(selectedRating);
    setStep('comment');
    trackCommunityEvent('feedback_rating', { rating: selectedRating });
  };

  const handleSubmit = async () => {
    if (!rating) return;

    setLoading(true);
    try {
      const feedbackData = {
        user_id: user?.id || null,
        rating,
        comment: comment.trim() || null,
        page: 'amigos',
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      };

      // Salvar feedback no Supabase
      const { error } = await supabase
        .from('user_feedback')
        .insert(feedbackData);

      if (error) {
        console.error('❌ Erro ao salvar feedback:', error);
        // Salvar localmente como backup
        const localFeedback = JSON.parse(localStorage.getItem('pending_feedback') || '[]');
        localFeedback.push(feedbackData);
        localStorage.setItem('pending_feedback', JSON.stringify(localFeedback));
      }

      trackCommunityEvent('feedback_submitted', { 
        rating, 
        has_comment: !!comment.trim(),
        comment_length: comment.trim().length 
      });

      setStep('thanks');
      
      // Auto-fechar após 2 segundos
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (error) {
      console.error('💥 Erro inesperado ao enviar feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleOpen}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
          size="sm"
        >
          <MessageSquare size={16} className="mr-2" />
          Feedback
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="bg-gray-900 border-gray-700 w-80 shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">
              {step === 'rating' && 'Como está sendo sua experiência?'}
              {step === 'comment' && 'Conte-nos mais (opcional)'}
              {step === 'thanks' && 'Obrigado pelo feedback!'}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </Button>
          </div>

          {step === 'rating' && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Sua opinião nos ajuda a melhorar a comunidade
              </p>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRating(star)}
                    className="text-gray-400 hover:text-yellow-500 p-1"
                  >
                    <Star 
                      size={24} 
                      className={rating && rating >= star ? 'fill-yellow-500 text-yellow-500' : ''} 
                    />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {step === 'comment' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-1 mb-2">
                <span className="text-sm text-gray-300">Sua avaliação:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star}
                      size={16} 
                      className={rating && rating >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600'} 
                    />
                  ))}
                </div>
              </div>
              
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="O que você mais gosta? O que poderia melhorar? Sugestões?"
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 min-h-[80px]"
                maxLength={500}
              />
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('rating')}
                  className="border-gray-700 text-gray-300"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={14} className="mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'thanks' && (
            <div className="text-center space-y-3">
              <div className="text-green-500 text-4xl">✨</div>
              <p className="text-white">Feedback recebido!</p>
              <p className="text-gray-400 text-sm">
                Sua opinião é muito importante para nós
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}