'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CreditCard, Save, Link as LinkIcon } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  DEFAULT_PAYWALL_CHECKOUT_LINKS,
  type PaywallCheckoutLinks,
  parsePaywallCheckoutLinks,
} from '@/constants/paywall';
import { toast } from 'sonner';
import AdminHamburgerMenu from '@/components/admin/AdminHamburgerMenu';

const LINK_FIELDS: Array<{
  key: keyof PaywallCheckoutLinks;
  label: string;
  description: string;
}> = [
  {
    key: 'offer_cta',
    label: 'Oferta (botão principal)',
    description: 'Botão "COMEÇAR POR R$ 1,90" da tela de oferta.',
  },
  {
    key: 'promo',
    label: 'Plano Promoção 1° Mês',
    description: 'CTA da tela de planos quando o usuário escolhe o plano promocional.',
  },
  {
    key: 'anual',
    label: 'Plano Anual (12x)',
    description: 'CTA da tela de planos para o plano anual parcelado.',
  },
  {
    key: 'mensal',
    label: 'Plano Mensal',
    description: 'CTA da tela de planos para o plano mensal.',
  },
  {
    key: 'anual_avista',
    label: 'Plano Anual à Vista',
    description: 'CTA da tela de planos para pagamento anual à vista.',
  },
  {
    key: 'familia',
    label: 'Plano Família Anual',
    description: 'CTA da tela de planos para o plano família.',
  },
];

export default function PaywallPage() {
  const { settings, loading, updateSetting } = useAppSettings();
  const [saving, setSaving] = useState(false);
  const [checkoutLinks, setCheckoutLinks] = useState<PaywallCheckoutLinks>(
    parsePaywallCheckoutLinks(settings.paywall_checkout_links),
  );
  const [showRatingsBadge, setShowRatingsBadge] = useState(
    (settings.paywall_show_ratings_badge ?? 'false') === 'true',
  );

  useEffect(() => {
    setCheckoutLinks(parsePaywallCheckoutLinks(settings.paywall_checkout_links));
    setShowRatingsBadge((settings.paywall_show_ratings_badge ?? 'false') === 'true');
  }, [settings.paywall_checkout_links, settings.paywall_show_ratings_badge]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: PaywallCheckoutLinks = {
        ...DEFAULT_PAYWALL_CHECKOUT_LINKS,
        ...checkoutLinks,
      };

      const res = await updateSetting('paywall_checkout_links', JSON.stringify(payload));
      const resBadge = await updateSetting(
        'paywall_show_ratings_badge',
        showRatingsBadge ? 'true' : 'false',
      );

      if (!res.success || !resBadge.success) {
        toast.error('Erro ao salvar links do paywall');
        return;
      }

      toast.success('Links do paywall salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar links do paywall:', error);
      toast.error('Erro ao salvar links do paywall');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p>Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <AdminHamburgerMenu />
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-purple-600" />
                Paywall
              </h1>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-purple-600" />
              Links de Checkout do Paywall
            </CardTitle>
          <CardDescription>
            Os textos do novo paywall estão fixos. Aqui você edita apenas os links dos botões de
            checkout.
          </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4 bg-gray-50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="show-ratings-badge">Mostrar selo de avaliação</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    Exibe o bloco "4.8 ESTRELAS · +50 MIL DOWNLOADS" na oferta.
                  </p>
                </div>
                <Switch
                  id="show-ratings-badge"
                  checked={showRatingsBadge}
                  onCheckedChange={setShowRatingsBadge}
                />
              </div>
            </div>

            {LINK_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <p className="text-xs text-gray-500">{field.description}</p>
                <Input
                  id={field.key}
                  placeholder="https://..."
                  value={checkoutLinks[field.key]}
                  onChange={(e) =>
                    setCheckoutLinks((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
