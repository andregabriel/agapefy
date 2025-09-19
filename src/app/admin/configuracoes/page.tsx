'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Save, BarChart3, Quote } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { toast } from 'sonner';
import AdminHamburgerMenu from '@/components/admin/AdminHamburgerMenu';

export default function ConfiguracoesPage() {
  const { settings, loading, updateSetting } = useAppSettings();
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  // Atualizar configurações locais quando as configurações carregarem
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Salvar todas as configurações modificadas
      const updates = Object.entries(localSettings).map(async ([key, value]) => {
        if (settings[key as keyof typeof settings] !== value) {
          return updateSetting(key as keyof typeof settings, value);
        }
        return { success: true };
      });

      const results = await Promise.all(updates);
      const hasError = results.some(result => !result.success);

      if (hasError) {
        toast.error('Erro ao salvar algumas configurações');
      } else {
        toast.success('Configurações salvas com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStats = (checked: boolean) => {
    setLocalSettings(prev => ({
      ...prev,
      show_prayer_stats: checked ? 'true' : 'false'
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
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
              <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          
          {/* Configurações de Exibição */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                Configurações de Exibição
              </CardTitle>
              <CardDescription>
                Controle o que é exibido para os usuários na aplicação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Toggle para Estatísticas de Prova Social */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base font-medium">
                    Estatísticas de Prova Social
                  </Label>
                  <p className="text-sm text-gray-600">
                    Exibir estatísticas dinâmicas na home (ex: "X minutos rezados na Agapefy por Y pessoas")
                  </p>
                </div>
                <Switch
                  checked={localSettings.show_prayer_stats === 'true'}
                  onCheckedChange={handleToggleStats}
                />
              </div>

            </CardContent>
          </Card>

          {/* Configurações de Conteúdo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Quote className="h-5 w-5 mr-2 text-purple-600" />
                Configurações de Conteúdo
              </CardTitle>
              <CardDescription>
                Personalize textos e citações exibidos na aplicação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Citação de Oração */}
              <div className="space-y-2">
                <Label htmlFor="prayer_quote_text">Citação de Oração</Label>
                <Textarea
                  id="prayer_quote_text"
                  value={localSettings.prayer_quote_text}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    prayer_quote_text: e.target.value
                  }))}
                  placeholder="Digite a citação de oração..."
                  rows={3}
                />
              </div>

              {/* Referência da Citação */}
              <div className="space-y-2">
                <Label htmlFor="prayer_quote_reference">Referência da Citação</Label>
                <Input
                  id="prayer_quote_reference"
                  value={localSettings.prayer_quote_reference}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    prayer_quote_reference: e.target.value
                  }))}
                  placeholder="Ex: Mateus 18:20"
                />
              </div>

            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}