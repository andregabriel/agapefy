\"use client\";

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Star } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { parsePaywallScreenConfig } from '@/constants/paywall';
import { toast } from 'sonner';

type PlanKey = 'installments' | 'upfront';

export function PaywallModal() {
  const { settings, loading } = useAppSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('installments');

  const config = useMemo(
    () => parsePaywallScreenConfig(settings.paywall_screen_config),
    [settings.paywall_screen_config],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      setIsOpen(true);
    };

    window.addEventListener('agapefy:paywall-open', handler as EventListener);
    return () => {
      window.removeEventListener('agapefy:paywall-open', handler as EventListener);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleConfirm = () => {
    const plan = config.plans[selectedPlan];
    if (!plan.checkout_url) {
      toast.error('URL de checkout não configurada para este plano.');
      return;
    }
    try {
      window.location.href = plan.checkout_url;
    } catch {
      toast.error('Não foi possível abrir a página de pagamento.');
    }
  };

  const footerText =
    selectedPlan === 'installments'
      ? config.plans.installments.footer_text
      : config.plans.upfront.footer_text;

  return (
    <Dialog open={isOpen && !loading} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md w-full bg-white text-black p-0 overflow-hidden rounded-3xl border border-gray-200">
        <DialogHeader className="sr-only">
          <DialogTitle>Tela de assinatura</DialogTitle>
        </DialogHeader>
        {/* Topo com thumbnails e botão X */}
        <div className="relative">
          <div className="grid grid-cols-3 gap-1 p-3 bg-white">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-16 rounded-md bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 overflow-hidden flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-md bg-white/20 border border-white/30" />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black w-8 h-8"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo principal */}
        <div className="px-6 pb-6 pt-1 space-y-4">
          {/* Título */}
          <h2 className="text-center text-2xl font-bold leading-snug mt-1">
            {config.title}
          </h2>

          {/* Opções de plano */}
          <div className="space-y-3 mt-4">
            {/* Pagamento em parcelas (default selecionado no print) */}
            <button
              type="button"
              onClick={() => setSelectedPlan('installments')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border ${
                selectedPlan === 'installments'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <div className="text-left">
                <p className="font-semibold text-[15px]">
                  {config.plans.installments.title}
                </p>
                <p className="text-[11px] text-gray-700">
                  {config.plans.installments.subtitle}
                </p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                  selectedPlan === 'installments'
                    ? 'border-purple-500'
                    : 'border-gray-300'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    selectedPlan === 'installments' ? 'bg-purple-500' : 'bg-transparent'
                  }`}
                />
              </div>
            </button>

            {/* Pagamento à vista */}
            <button
              type="button"
              onClick={() => setSelectedPlan('upfront')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border ${
                selectedPlan === 'upfront'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <div className="text-left">
                <p className="font-semibold text-[15px]">
                  {config.plans.upfront.title}
                </p>
                <p className="text-[11px] text-gray-700">
                  {config.plans.upfront.subtitle}
                </p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                  selectedPlan === 'upfront' ? 'border-purple-500' : 'border-gray-300'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    selectedPlan === 'upfront' ? 'bg-purple-500' : 'bg-transparent'
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Texto explicativo abaixo das opções */}
          <p className="text-[11px] text-gray-700 mt-1 text-center">
            {config.description}
          </p>

          {/* Depoimentos */}
          {config.testimonials.map((testimonial, index) => (
            <div key={index} className="mt-2">
              <div className="flex items-center gap-0.5 mb-1">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className="fill-purple-500 text-purple-500"
                  />
                ))}
              </div>
              <p className="text-xs font-semibold mb-1">
                {testimonial.title}
              </p>
              <p className="text-[11px] text-gray-700 leading-snug">
                {testimonial.text}
              </p>
            </div>
          ))}

          {/* Botão CTA */}
          <div className="mt-4">
            <Button
              onClick={handleConfirm}
              className="w-full bg-black hover:bg-black text-white rounded-full py-3 text-sm font-semibold"
            >
              {config.cta_label}
            </Button>
          </div>

          {/* Texto dinâmico abaixo do botão */}
          <p className="mt-2 text-[11px] text-gray-700 text-center">
            {footerText}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}


