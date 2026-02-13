"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Crown } from 'lucide-react';

export function SubscriptionCard() {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleManageSubscription = () => {
    const manageUrl = 'https://digitalmanager.guru/myorders';
    window.open(manageUrl, '_blank', 'noopener,noreferrer');
  };

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
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <Button
              onClick={handleManageSubscription}
              className="w-full bg-gradient-to-r from-amber-200 via-emerald-200 to-cyan-200 text-black font-semibold shadow-[0_15px_50px_rgba(56,189,248,0.35)] hover:scale-[1.01] transition-transform"
            >
              <Crown className="h-4 w-4 mr-2" />
              Gerenciar assinatura
            </Button>
            <p className="text-sm text-gray-300">
              Use o e-mail da compra para fazer login. Depois, clique em Minhas assinaturas, abra a assinatura da Agapefy e clique em Alterar assinatura para gerenciar ou cancelar.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
