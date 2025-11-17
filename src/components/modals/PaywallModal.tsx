"use client";

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Star } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { parsePaywallScreenConfig } from '@/constants/paywall';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type PlanKey = 'installments' | 'upfront';

export function PaywallModal() {
  const { settings, loading } = useAppSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('installments');
  const [thumbnails, setThumbnails] = useState<string[]>([]);

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

  // Buscar thumbnails reais de áudios (até 12 aleatórias)
  useEffect(() => {
    let cancelled = false;

    const loadThumbnails = async () => {
      try {
        const { data, error } = await supabase
          .from('audios')
          .select('id, cover_url')
          .not('cover_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(48);

        if (error) {
          // eslint-disable-next-line no-console
          console.warn('PaywallModal: erro ao carregar thumbnails de áudios', error);
          return;
        }

        const urls = (data || [])
          .map((row: any) => row.cover_url as string | null)
          .filter((url) => typeof url === 'string' && url.trim().length > 0) as string[];

        if (!urls.length || cancelled) return;

        // embaralhar e pegar até 12
        const shuffled = [...urls].sort(() => Math.random() - 0.5);
        const chosen = shuffled.slice(0, 12);
        if (!cancelled) {
          setThumbnails(chosen);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('PaywallModal: erro inesperado ao carregar thumbnails', e);
      }
    };

    void loadThumbnails();

    return () => {
      cancelled = true;
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
      <DialogContent
        className="
          bg-white text-black p-0 overflow-hidden gap-0
          fixed left-0 top-0 translate-x-0 translate-y-0
          w-full max-w-none h-[100svh] border-0 rounded-none
          sm:left-1/2 sm:top-1/2 sm:translate-x-[-50%] sm:translate-y-[-50%]
          sm:w-full sm:max-w-md sm:h-auto sm:rounded-3xl sm:border sm:border-gray-200
        "
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Tela de assinatura</DialogTitle>
        </DialogHeader>
        {/* Topo com thumbnails e botão X */}
        <div className="relative">
          <div className="h-[248px] sm:h-[264px] bg-white px-4 pt-5 pb-0">
            <div className="grid grid-cols-4 grid-rows-3 gap-2 h-full">
              {Array.from({ length: 12 }).map((_, index) => {
                const src = thumbnails[index];
                return (
                  <div
                    key={index}
                    className="rounded-[8px] overflow-hidden bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500"
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-3 inline-flex items-center justify-center rounded-full border border-white/70 bg-black/25 text-white hover:bg-black/40 backdrop-blur-sm w-8 h-8 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo principal */}
        <div className="px-6 pb-6">
          {/* Título */}
          <h2 className="text-center text-2xl font-bold leading-snug -mt-12 sm:mt-1 md:mt-3">
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


