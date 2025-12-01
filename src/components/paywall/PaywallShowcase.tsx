"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, X, Loader2 } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { parsePaywallScreenConfig } from '@/constants/paywall';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type PlanKey = 'installments' | 'upfront';

interface PaywallShowcaseProps {
  variant?: 'modal' | 'inline';
  onClose?: () => void;
}

export function PaywallShowcase({
  variant = 'modal',
  onClose,
}: PaywallShowcaseProps) {
  const { settings, loading: settingsLoading } = useAppSettings();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('upfront');
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(true);

  const config = useMemo(
    () => parsePaywallScreenConfig(settings.paywall_screen_config),
    [settings.paywall_screen_config],
  );

  useEffect(() => {
    let cancelled = false;

    const loadThumbnails = async () => {
      setThumbnailsLoading(true);
      try {
        const { data, error } = await supabase
          .from('audios')
          .select('id, cover_url')
          .not('cover_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(48);

        if (error) {
          // eslint-disable-next-line no-console
          console.warn('PaywallShowcase: erro ao carregar thumbnails de áudios', error);
          return;
        }

        const urls = (data || [])
          .map((row: any) => row.cover_url as string | null)
          .filter((url) => typeof url === 'string' && url.trim().length > 0) as string[];

        if (!urls.length || cancelled) return;

        const shuffled = [...urls].sort(() => Math.random() - 0.5);
        const chosen = shuffled.slice(0, 12);
        if (!cancelled) {
          setThumbnails(chosen);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('PaywallShowcase: erro inesperado ao carregar thumbnails', e);
      } finally {
        if (!cancelled) {
          setThumbnailsLoading(false);
        }
      }
    };

    void loadThumbnails();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const showLoadingState = settingsLoading && thumbnailsLoading;

  return (
    <div
      className={
        variant === 'inline'
          ? 'bg-gradient-to-br from-emerald-400/30 via-green-500/20 to-cyan-500/25 p-[1px] rounded-3xl shadow-[0_25px_80px_rgba(34,197,94,0.25)]'
          : ''
      }
    >
      <div
        className={`${
          variant === 'inline'
            ? 'rounded-[22px] bg-white text-black overflow-hidden'
            : 'text-black'
        }`}
      >
        <div className="relative">
          <div
            className={`h-[248px] sm:h-[264px] bg-white px-4 pt-5 pb-0 ${
              variant === 'inline' ? 'rounded-t-[22px]' : ''
            }`}
          >
            <div className="grid grid-cols-4 grid-rows-3 gap-2 h-full">
              {Array.from({ length: 12 }).map((_, index) => {
                const src = thumbnails[index];
                return (
                  <div
                    key={index}
                    className="rounded-[8px] overflow-hidden bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 animate-[pulse_2s_ease-in-out_infinite]"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover animate-none"
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-3 inline-flex items-center justify-center rounded-full border border-white/70 bg-black/25 text-white hover:bg-black/40 backdrop-blur-sm w-9 h-9 transition-colors shadow-lg"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 pb-6 bg-white">
          <div
            className={`flex items-center justify-center ${
              variant === 'inline' ? 'mt-2 sm:mt-3' : '-mt-12 sm:mt-1 md:mt-3'
            }`}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-1 text-xs font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Acesso Premium
            </div>
          </div>

          <h2
            className={`text-center text-2xl font-bold leading-snug ${
              variant === 'inline' ? 'mt-4' : 'mt-3'
            }`}
          >
            {config.title}
          </h2>

          <div className="space-y-3 mt-4">
            <button
              type="button"
              onClick={() => setSelectedPlan('upfront')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                selectedPlan === 'upfront'
                  ? 'border-purple-500 bg-purple-50 shadow-[0_12px_30px_rgba(168,85,247,0.2)]'
                  : 'border-gray-300 bg-white hover:border-purple-200'
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

            <button
              type="button"
              onClick={() => setSelectedPlan('installments')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                selectedPlan === 'installments'
                  ? 'border-purple-500 bg-purple-50 shadow-[0_12px_30px_rgba(168,85,247,0.2)]'
                  : 'border-gray-300 bg-white hover:border-purple-200'
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
          </div>

          <p className="text-[11px] text-gray-700 mt-1 text-center">
            {config.description}
          </p>

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

          <div className="mt-4">
            <Button
              onClick={handleConfirm}
              className="w-full bg-black hover:bg-black text-white rounded-full py-3 text-sm font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
              disabled={showLoadingState}
            >
              {showLoadingState && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {config.cta_label}
            </Button>
          </div>

          <p className="mt-2 text-[11px] text-gray-700 text-center">
            {footerText}
          </p>
        </div>
      </div>
    </div>
  );
}
