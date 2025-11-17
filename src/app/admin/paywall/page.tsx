'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, Save, Quote } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  DEFAULT_PAYWALL_SCREEN_CONFIG,
  PaywallScreenConfig,
  parsePaywallScreenConfig,
} from '@/constants/paywall';
import { toast } from 'sonner';
import AdminHamburgerMenu from '@/components/admin/AdminHamburgerMenu';

export default function PaywallPage() {
  const { settings, loading, updateSetting } = useAppSettings();
  const [saving, setSaving] = useState(false);
  const [screenConfig, setScreenConfig] = useState<PaywallScreenConfig>(
    parsePaywallScreenConfig(settings.paywall_screen_config),
  );

  useEffect(() => {
    setScreenConfig(parsePaywallScreenConfig(settings.paywall_screen_config));
  }, [settings.paywall_screen_config]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await updateSetting(
        'paywall_screen_config',
        JSON.stringify(screenConfig ?? DEFAULT_PAYWALL_SCREEN_CONFIG),
      );

      if (!res.success) {
        toast.error('Erro ao salvar tela de pagamento');
      } else {
        toast.success('Tela de pagamento salva com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar paywall:', error);
      toast.error('Erro ao salvar tela de pagamento');
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
      {/* Header */}
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

      {/* Conteúdo */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              Tela de pagamento (Paywall)
            </CardTitle>
            <CardDescription>
              Edite os textos, depoimentos e links de checkout mostrados quando o usuário chega ao
              limite de áudios gratuitos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="paywall-title">Título principal</Label>
              <Input
                id="paywall-title"
                value={screenConfig.title}
                onChange={(e) =>
                  setScreenConfig((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="paywall-description">Texto abaixo das opções</Label>
              <Textarea
                id="paywall-description"
                value={screenConfig.description}
                onChange={(e) =>
                  setScreenConfig((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {/* Planos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plano à vista */}
              <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-700" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Opção 1 – Pagamento à vista
                  </h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upfront-title">Título</Label>
                  <Input
                    id="upfront-title"
                    value={screenConfig.plans.upfront.title}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          upfront: {
                            ...prev.plans.upfront,
                            title: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upfront-subtitle">Subtítulo</Label>
                  <Textarea
                    id="upfront-subtitle"
                    value={screenConfig.plans.upfront.subtitle}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          upfront: {
                            ...prev.plans.upfront,
                            subtitle: e.target.value,
                          },
                        },
                      }))
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upfront-checkout">URL da página de checkout</Label>
                  <Input
                    id="upfront-checkout"
                    placeholder="https://..."
                    value={screenConfig.plans.upfront.checkout_url}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          upfront: {
                            ...prev.plans.upfront,
                            checkout_url: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upfront-footer">Texto explicativo abaixo do botão</Label>
                  <Textarea
                    id="upfront-footer"
                    value={screenConfig.plans.upfront.footer_text}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          upfront: {
                            ...prev.plans.upfront,
                            footer_text: e.target.value,
                          },
                        },
                      }))
                    }
                    rows={3}
                  />
                </div>
              </div>

              {/* Plano parcelado */}
              <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-700" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Opção 2 – Pagamento parcelado
                  </h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments-title">Título</Label>
                  <Input
                    id="installments-title"
                    value={screenConfig.plans.installments.title}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          installments: {
                            ...prev.plans.installments,
                            title: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments-subtitle">Subtítulo</Label>
                  <Textarea
                    id="installments-subtitle"
                    value={screenConfig.plans.installments.subtitle}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          installments: {
                            ...prev.plans.installments,
                            subtitle: e.target.value,
                          },
                        },
                      }))
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments-checkout">URL da página de checkout</Label>
                  <Input
                    id="installments-checkout"
                    placeholder="https://..."
                    value={screenConfig.plans.installments.checkout_url}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          installments: {
                            ...prev.plans.installments,
                            checkout_url: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments-footer">Texto explicativo abaixo do botão</Label>
                  <Textarea
                    id="installments-footer"
                    value={screenConfig.plans.installments.footer_text}
                    onChange={(e) =>
                      setScreenConfig((prev) => ({
                        ...prev,
                        plans: {
                          ...prev.plans,
                          installments: {
                            ...prev.plans.installments,
                            footer_text: e.target.value,
                          },
                        },
                      }))
                    }
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <Label htmlFor="paywall-cta">Texto do botão principal (CTA)</Label>
              <Input
                id="paywall-cta"
                value={screenConfig.cta_label}
                onChange={(e) =>
                  setScreenConfig((prev) => ({
                    ...prev,
                    cta_label: e.target.value,
                  }))
                }
              />
            </div>

            {/* Depoimentos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Depoimentos exibidos na tela
                </h3>
              </div>

              {screenConfig.testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg bg-white space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <Label className="text-sm">
                        Título do depoimento {index + 1}
                      </Label>
                      <span className="text-xs text-gray-500">
                        Avaliação: {testimonial.rating} estrelas
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() =>
                        setScreenConfig((prev) => ({
                          ...prev,
                          testimonials: prev.testimonials.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remover
                    </Button>
                  </div>
                  <Input
                    value={testimonial.title}
                    onChange={(e) =>
                      setScreenConfig((prev) => {
                        const next = [...prev.testimonials];
                        next[index] = { ...next[index], title: e.target.value };
                        return { ...prev, testimonials: next };
                      })
                    }
                  />
                  <div className="space-y-2">
                    <Label className="text-sm">Texto</Label>
                    <Textarea
                      value={testimonial.text}
                      rows={3}
                      onChange={(e) =>
                        setScreenConfig((prev) => {
                          const next = [...prev.testimonials];
                          next[index] = { ...next[index], text: e.target.value };
                          return { ...prev, testimonials: next };
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Estrelas (1 a 5)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={testimonial.rating}
                      onChange={(e) => {
                        const value = Math.min(5, Math.max(1, Number(e.target.value) || 1));
                        setScreenConfig((prev) => {
                          const next = [...prev.testimonials];
                          next[index] = { ...next[index], rating: value };
                          return { ...prev, testimonials: next };
                        });
                      }}
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setScreenConfig((prev) => ({
                    ...prev,
                    testimonials: [
                      ...prev.testimonials,
                      {
                        title: 'Novo depoimento',
                        text: '',
                        rating: 5,
                      },
                    ],
                  }))
                }
              >
                Adicionar depoimento
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


