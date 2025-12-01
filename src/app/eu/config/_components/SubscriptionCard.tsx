"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, XCircle, Loader2, Crown } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { toast } from 'sonner';
import { PaywallShowcase } from '@/components/paywall/PaywallShowcase';

export function SubscriptionCard() {
  const { hasActiveSubscription, hasActiveTrial, loading, refetch } = useSubscriptionStatus();
  const [cancelling, setCancelling] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleManageSubscription = () => {
    const manageUrl = 'https://digitalmanager.guru/myorders';
    window.open(manageUrl, '_blank', 'noopener,noreferrer');
    toast.info('Abrindo página de gerenciamento da assinatura');
  };

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
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-cyan-500/15 p-5 shadow-[0_18px_60px_rgba(16,185,129,0.25)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-emerald-500/20 border border-emerald-300/50 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-300 flex-shrink-0" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">
                          {hasActiveTrial ? 'Período de Teste Ativo' : 'Assinatura Premium Ativa'}
                        </h3>
                        <p className="text-sm text-emerald-100/80 mt-1">
                          {hasActiveTrial
                            ? 'Você está aproveitando o período de teste gratuito'
                            : 'Sua assinatura está ativa e você tem acesso completo a todos os recursos'}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white/10 text-emerald-100 px-3 py-1 text-xs font-semibold border border-emerald-300/30">
                      {hasActiveTrial ? 'Teste' : 'Premium'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <Button
                      onClick={handleManageSubscription}
                      className="w-full bg-gradient-to-r from-amber-200 via-emerald-200 to-cyan-200 text-black font-semibold shadow-[0_15px_50px_rgba(56,189,248,0.35)] hover:scale-[1.01] transition-transform"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Gerenciar assinatura
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="w-full border-red-600 text-red-300 hover:bg-red-900/30 hover:text-red-100"
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
                  </div>
                  <p className="text-xs text-emerald-100/80 text-center mt-3">
                    Sua assinatura continuará ativa até o fim do período atual
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <PaywallShowcase variant="inline" />
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
