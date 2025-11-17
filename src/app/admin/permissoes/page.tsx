'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Save } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { DEFAULT_PAYWALL_PERMISSIONS, PaywallPermissions, parsePaywallPermissions } from '@/constants/paywall';
import { toast } from 'sonner';
import AdminHamburgerMenu from '@/components/admin/AdminHamburgerMenu';

export default function PermissoesPage() {
  const { settings, loading, updateSetting } = useAppSettings();
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<PaywallPermissions>(
    parsePaywallPermissions(settings.paywall_permissions),
  );

  useEffect(() => {
    setPermissions(parsePaywallPermissions(settings.paywall_permissions));
  }, [settings.paywall_permissions]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const resPerm = await updateSetting(
        'paywall_permissions',
        JSON.stringify(permissions ?? DEFAULT_PAYWALL_PERMISSIONS),
      );

      if (!resPerm.success) {
        toast.error('Erro ao salvar permissões');
      } else {
        toast.success('Permissões salvas com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar permissões/paywall:', error);
      toast.error('Erro ao salvar configurações');
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
                <ShieldCheck className="h-6 w-6 text-amber-600" />
                Permissões de Acesso
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
        {/* Permissões por tipo de usuário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              Permissões por tipo de usuário
            </CardTitle>
            <CardDescription>
              Defina limites de áudios gratuitos por dia e acesso total para cada tipo de usuário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Usuário não logado */}
            <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Usuário não logado</h3>
                  <p className="text-sm text-gray-600">
                    Visitantes que acessam o app sem estar autenticados.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-gray-700">
                    Limitar áudios grátis por dia
                  </Label>
                  <Switch
                    checked={permissions.anonymous.limit_enabled}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({
                        ...prev,
                        anonymous: {
                          ...prev.anonymous,
                          limit_enabled: checked,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="max-w-xs">
                <Label htmlFor="anonymous-free-audios" className="text-sm">
                  Áudios de graça por dia
                </Label>
                <Input
                  id="anonymous-free-audios"
                  type="number"
                  min={0}
                  value={permissions.anonymous.max_free_audios_per_day}
                  onChange={(e) =>
                    setPermissions((prev) => ({
                      ...prev,
                      anonymous: {
                        ...prev.anonymous,
                        max_free_audios_per_day: Number(e.target.value) || 0,
                      },
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {/* Usuário logado sem assinatura ativa */}
            <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Usuário logado sem assinatura ativa
                  </h3>
                  <p className="text-sm text-gray-600">
                    Usuários autenticados, mas sem assinatura válida ou trial.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-gray-700">
                    Limitar áudios grátis por dia
                  </Label>
                  <Switch
                    checked={permissions.no_subscription.limit_enabled}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({
                        ...prev,
                        no_subscription: {
                          ...prev.no_subscription,
                          limit_enabled: checked,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="max-w-xs">
                <Label htmlFor="no-sub-free-audios" className="text-sm">
                  Áudios de graça por dia
                </Label>
                <Input
                  id="no-sub-free-audios"
                  type="number"
                  min={0}
                  value={permissions.no_subscription.max_free_audios_per_day}
                  onChange={(e) =>
                    setPermissions((prev) => ({
                      ...prev,
                      no_subscription: {
                        ...prev.no_subscription,
                        max_free_audios_per_day: Number(e.target.value) || 0,
                      },
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {/* Usuário com assinatura ativa */}
            <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Usuário com assinatura ativa
                  </h3>
                  <p className="text-sm text-gray-600">
                    Assinantes com pagamento em dia (acesso total recomendado).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-gray-700">
                    Acesso total
                  </Label>
                  <Switch
                    checked={permissions.active_subscription.full_access_enabled}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({
                        ...prev,
                        active_subscription: {
                          ...prev.active_subscription,
                          full_access_enabled: checked,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Se desativado, estes usuários passam a respeitar o mesmo limite configurado para
                &quot;Usuário logado sem assinatura ativa&quot;.
              </p>
            </div>

            {/* Usuário em trial */}
            <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Usuário em período de trial
                  </h3>
                  <p className="text-sm text-gray-600">
                    Usuários que estão usando os 30 dias de avaliação gratuita.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-gray-700">
                    Acesso total
                  </Label>
                  <Switch
                    checked={permissions.trial.full_access_enabled}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({
                        ...prev,
                        trial: {
                          ...prev.trial,
                          full_access_enabled: checked,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Quando o trial terminar, o usuário automaticamente passa a ser tratado como
                &quot;sem assinatura ativa&quot;.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


