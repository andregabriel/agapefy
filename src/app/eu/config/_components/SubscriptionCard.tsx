"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function SubscriptionCard() {
  const { hasActiveSubscription, hasActiveTrial, loading, refetch } = useSubscriptionStatus();
  const [cancelling, setCancelling] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Ela continuará ativa até o fim do período atual.')) {
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Erro ao cancelar assinatura');
      }

      toast.success('Assinatura cancelada com sucesso. Ela continuará ativa até o fim do período atual.');
      refetch();
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast.error('Erro ao cancelar assinatura');
    } finally {
      setCancelling(false);
    }
  };

  const handleUpgrade = () => {
    router.push('/');
    // Scroll para paywall ou modal de assinatura se necessário
    setTimeout(() => {
      const paywallElement = document.getElementById('paywall');
      if (paywallElement) {
        paywallElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
        >
          <div className="flex items-center space-x-3 text-left">
            <CreditCard className="h-6 w-6 text-green-500" />
            <div>
              <CardTitle className="text-white font-medium text-lg">Assinatura</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Gerencie sua assinatura</p>
            </div>
          </div>
          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t border-gray-800 pt-4">
            {hasActiveSubscription || hasActiveTrial ? (
              <div className="space-y-4">
                {/* Status Ativo */}
                <div className="flex items-center space-x-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-white font-medium">
                      {hasActiveTrial ? 'Período de Teste Ativo' : 'Assinatura Ativa'}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {hasActiveTrial 
                        ? 'Você está aproveitando o período de teste gratuito'
                        : 'Sua assinatura está ativa e você tem acesso completo a todos os recursos'}
                    </p>
                  </div>
                </div>

                {/* Botão Cancelar */}
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full border-red-600 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar Assinatura
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Sua assinatura continuará ativa até o fim do período atual
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mensagem de Engajamento */}
                <div className="p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-lg text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Desbloqueie Todo o Potencial da Agapefy
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Tenha acesso completo a todas as orações, reflexões e recursos para sua jornada espiritual
                  </p>
                  
                  {/* Benefícios */}
                  <div className="space-y-2 mb-6 text-left">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                      <span>Acesso ilimitado a todas as orações</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                      <span>Reflexões e intenções personalizadas</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                      <span>Rotina diária de oração</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                      <span>Suporte prioritário</span>
                    </div>
                  </div>

                  {/* Botão CTA */}
                  <Button
                    onClick={handleUpgrade}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Assinar Agora
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

