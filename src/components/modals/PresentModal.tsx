"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gift, Heart, Star, X } from 'lucide-react';
import { toast } from 'sonner';

interface PresentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PresentModal({ isOpen, onClose }: PresentModalProps) {
  const [loading, setLoading] = useState(false);

  const handleGiftSubscription = async () => {
    setLoading(true);
    
    try {
      // Simular processo de presente (aqui você integraria com sistema de pagamento)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Em breve você poderá presentear amigos com a Agapefy!');
      onClose();
    } catch (error) {
      toast.error('Erro ao processar presente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md mx-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Gift className="text-yellow-400" size={24} />
              Presente Agapefy
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Card do presente */}
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift size={32} className="text-yellow-400" />
            </div>
            
            <h3 className="text-lg font-bold mb-2">
              Presenteie Amigos e Familiares<br />
              com 1 ano de assinatura da Agapefy
            </h3>
            
            <p className="text-gray-300 text-sm mb-4">
              Leve a luz e paz das orações para quem você ama
            </p>

            {/* Benefícios */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Star size={16} className="text-yellow-400" />
                <span>Acesso completo por 12 meses</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Heart size={16} className="text-red-400" />
                <span>Todas as orações e funcionalidades</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Gift size={16} className="text-green-400" />
                <span>Experiência premium completa</span>
              </div>
            </div>

            {/* Preço */}
            <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
              <div className="text-2xl font-bold text-yellow-400">R$ 149,90/ano</div>
              <div className="text-sm text-gray-400">(igual à R$ 12,49/mês)</div>
            </div>
          </div>

          {/* Botões */}
          <div className="space-y-3">
            <Button
              onClick={handleGiftSubscription}
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                  Processando...
                </div>
              ) : (
                <>
                  <Gift size={20} className="mr-2" />
                  Presentear Agora
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full border-gray-600 text-gray-900 hover:bg-gray-800 hover:text-gray-300"
            >
              Talvez mais tarde
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            O presente será enviado por email para seu amigo
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}