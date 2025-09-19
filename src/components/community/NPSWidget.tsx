"use client";

import { useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface NPSWidgetProps {
  onClose?: () => void;
}

export default function NPSWidget({ onClose }: NPSWidgetProps) {
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
    trackCommunityEvent('nps_opened', { page: 'eu' });
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep('trigger');
    setRating(null);
    setComment('');
    onClose?.();
    trackCommunityEvent('nps_closed', { step, page: 'eu' });
  };

  const handleRating = (selectedRating: number) => {
    setRating(selectedRating);
    setStep('comment');
    
    // Classificar NPS
    let npsCategory = 'neutro';
    if (selectedRating >= 0 && selectedRating <= 6) {
      npsCategory = 'detrator';
    } else if (selectedRating >= 7 && selectedRating <= 8) {
      npsCategory = 'neutro';
    } else if (selectedRating >= 9 && selectedRating <= 10) {
      npsCategory = 'promotor';
    }
    
    trackCommunityEvent('nps_rating', { 
      rating: selectedRating,
      category: npsCategory,
      page: 'eu'
    });
  };

  const handleSubmit = async () => {
    if (rating === null) {
      toast.error('Por favor, selecione uma nota');
      return;
    }

    setLoading(true);
    try {
      // Classificar NPS
      let npsCategory = 'neutro';
      if (rating >= 0 && rating <= 6) {
        npsCategory = 'detrator';
      } else if (rating >= 7 && rating <= 8) {
        npsCategory = 'neutro';
      } else if (rating >= 9 && rating <= 10) {
        npsCategory = 'promotor';
      }

      // Preparar dados para inserção (garantir tipos corretos)
      const feedbackData = {
        user_id: user?.id || null,
        rating: Number(rating), // Garantir que é número
        comment: comment.trim() || null,
        page: 'eu',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      };

      console.log('📊 Enviando dados NPS:', feedbackData);

      // Salvar NPS no Supabase
      const { data: insertedData, error } = await supabase
        .from('user_feedback')
        .insert(feedbackData)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro detalhado ao salvar NPS:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Salvar localmente como backup
        const localNPS = JSON.parse(localStorage.getItem('pending_nps') || '[]');
        localNPS.push({
          ...feedbackData,
          nps_category: npsCategory,
          created_at: new Date().toISOString(),
          error_details: error.message
        });
        localStorage.setItem('pending_nps', JSON.stringify(localNPS));
        
        toast.error('Erro ao salvar. Dados salvos localmente.');
        
        // Continuar com o fluxo mesmo com erro
      } else {
        console.log('✅ NPS salvo com sucesso:', insertedData);
        toast.success('Avaliação enviada com sucesso!');
      }

      // Track do evento (independente do erro de salvamento)
      trackCommunityEvent('nps_submitted', { 
        rating,
        category: npsCategory,
        has_comment: !!comment.trim(),
        comment_length: comment.trim().length,
        page: 'eu',
        save_success: !error
      });

      setStep('thanks');
      
      // Auto-fechar após 3 segundos
      setTimeout(() => {
        handleClose();
      }, 3000);

    } catch (error) {
      console.error('💥 Erro inesperado ao enviar NPS:', error);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para obter cor da nota NPS
  const getNPSColor = (score: number) => {
    if (score >= 0 && score <= 6) return 'text-red-400'; // Detrator
    if (score >= 7 && score <= 8) return 'text-yellow-400'; // Neutro
    if (score >= 9 && score <= 10) return 'text-green-400'; // Promotor
    return 'text-gray-400';
  };

  // Função para obter categoria NPS
  const getNPSCategory = (score: number) => {
    if (score >= 0 && score <= 6) return 'Detrator';
    if (score >= 7 && score <= 8) return 'Neutro';
    if (score >= 9 && score <= 10) return 'Promotor';
    return '';
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Button
          onClick={handleOpen}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
          size="sm"
        >
          <MessageSquare size={16} className="mr-2" />
          Avaliar
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <Card className="bg-gray-900 border-gray-700 w-80 shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">
              {step === 'rating' && 'Net Promoter Score'}
              {step === 'comment' && 'Conte-nos mais'}
              {step === 'thanks' && 'Obrigado pela avaliação!'}
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
                De 0 a 10, qual a probabilidade de você recomendar a Agape para um amigo?
              </p>
              
              {/* Escala NPS 0-10 */}
              <div className="space-y-3">
                <div className="grid grid-cols-11 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <Button
                      key={score}
                      variant={rating === score ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleRating(score)}
                      className={`h-10 text-sm font-medium ${
                        rating === score 
                          ? `bg-blue-600 hover:bg-blue-700 text-white` 
                          : 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {score}
                    </Button>
                  ))}
                </div>
                
                {/* Labels da escala */}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Nada provável</span>
                  <span>Extremamente provável</span>
                </div>
              </div>
            </div>
          )}

          {step === 'comment' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Sua nota:</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-lg font-bold ${getNPSColor(rating!)}`}>
                    {rating}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    rating! >= 0 && rating! <= 6 ? 'bg-red-900/30 text-red-400' :
                    rating! >= 7 && rating! <= 8 ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-green-900/30 text-green-400'
                  }`}>
                    {getNPSCategory(rating!)}
                  </span>
                </div>
              </div>
              
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="O que motivou você a dar essa nota?"
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
              <div className="text-green-500 text-4xl">🎯</div>
              <p className="text-white">NPS registrado!</p>
              <p className="text-gray-400 text-sm">
                Sua opinião nos ajuda a melhorar continuamente
              </p>
              {rating !== null && (
                <div className="flex items-center justify-center space-x-2 mt-2">
                  <span className="text-gray-400 text-sm">Nota:</span>
                  <span className={`text-lg font-bold ${getNPSColor(rating)}`}>
                    {rating}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    rating >= 0 && rating <= 6 ? 'bg-red-900/30 text-red-400' :
                    rating >= 7 && rating <= 8 ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-green-900/30 text-green-400'
                  }`}>
                    {getNPSCategory(rating)}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}