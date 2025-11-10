'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Save, BarChart3, Quote } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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

  const DEFAULT_AI_PROMPT = `Você é um curador bíblico. Escolha um único versículo da Bíblia que seja claro, edificante, compreensível para leigos e autocontido. Evite genealogias, leis rituais, profecias e visões enigmáticas ou trechos violentos/duros sem contexto. Prefira trechos que transmitam esperança, encorajamento, sabedoria prática ou conforto. Não repita nenhum dos últimos 30 versículos informados.`;

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
            <CardContent className="space-y-8">
              {/* Automação */}
              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-white">
                <h3 className="text-base font-semibold text-gray-900">Automação</h3>
                <p className="text-sm text-gray-600">Quando ativo, a citação é definida automaticamente diariamente.</p>
                <div className="flex items-center justify-between">
                  <Label>Atualização diária automática</Label>
                  <Switch
                    checked={(localSettings.prayer_quote_auto_enabled ?? 'true') === 'true'}
                    onCheckedChange={(checked) => setLocalSettings(prev => ({
                      ...prev,
                      prayer_quote_auto_enabled: checked ? 'true' : 'false'
                    }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="prayer_quote_auto_time">Horário da atualização</Label>
                    <Input
                      id="prayer_quote_auto_time"
                      type="time"
                      step={60}
                      value={localSettings.prayer_quote_auto_time || '07:00'}
                      onChange={(e) => setLocalSettings(prev => ({
                        ...prev,
                        prayer_quote_auto_time: e.target.value
                      }))}
                    />
                    <p className="text-xs text-gray-500">Formato 24h. A automação roda uma vez por dia no horário escolhido.</p>
                  </div>
                </div>
              </div>

              {/* Manual (Redefinir agora) */}
              <div className="space-y-6 p-4 border border-gray-200 rounded-lg bg-white">
                <h3 className="text-base font-semibold text-gray-900">Manual (Redefinir agora)</h3>

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

                {/* Avançado (IA) - colapsável */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="ai-advanced">
                    <AccordionTrigger>Opções avançadas (IA)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Seleção via IA (OpenAI)</Label>
                          <Switch
                            checked={(localSettings.prayer_quote_ai_enabled ?? 'false') === 'true'}
                            onCheckedChange={(checked) => setLocalSettings(prev => ({
                              ...prev,
                              prayer_quote_ai_enabled: checked ? 'true' : 'false'
                            }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="prayer_quote_ai_prompt_template">Prompt da IA (curadoria do versículo)</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setLocalSettings(prev => ({
                                ...prev,
                                prayer_quote_ai_prompt_template: DEFAULT_AI_PROMPT
                              }))}
                            >
                              Restaurar padrão
                            </Button>
                          </div>
                          <Textarea
                            id="prayer_quote_ai_prompt_template"
                            value={localSettings.prayer_quote_ai_prompt_template || ''}
                            onChange={(e) => setLocalSettings(prev => ({
                              ...prev,
                              prayer_quote_ai_prompt_template: e.target.value
                            }))}
                            placeholder="Texto do prompt que orienta a IA na escolha do versículo"
                            rows={5}
                          />
                          <p className="text-xs text-gray-500">A IA usa este prompt como instrução inicial. O texto oficial do versículo sempre vem do Supabase.</p>
                        </div>
                        <div>
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                // Salvar silenciosamente as configs relevantes antes de acionar a atualização
                                const pending: Promise<any>[] = [];
                                if (settings.prayer_quote_ai_enabled !== (localSettings.prayer_quote_ai_enabled ?? 'false')) {
                                  pending.push(updateSetting('prayer_quote_ai_enabled', localSettings.prayer_quote_ai_enabled ?? 'false'));
                                }
                                if ((settings.prayer_quote_ai_prompt_template ?? '') !== (localSettings.prayer_quote_ai_prompt_template ?? '')) {
                                  pending.push(updateSetting('prayer_quote_ai_prompt_template', localSettings.prayer_quote_ai_prompt_template ?? ''));
                                }
                                await Promise.all(pending);

                                const res = await fetch('/api/daily-quote?force=true', { method: 'POST' });
                                const data = await res.json();
                                if (res.ok) {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    prayer_quote_text: data.text ?? prev.prayer_quote_text,
                                    prayer_quote_reference: data.reference ?? prev.prayer_quote_reference
                                  }));
                                  const mode = data.mode === 'ai' ? 'via IA' : 'via heurística';
                                  toast.success(`Citação atualizada (${mode})!`);
                                } else {
                                  toast.error(data?.error || 'Falha ao atualizar');
                                }
                              } catch (e) {
                                toast.error('Falha ao atualizar');
                              }
                            }}
                          >
                            Gerar por IA agora
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Aplicar manualmente agora */}
                <div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        // Aplicação manual: só persistir texto e referência atuais
                        await Promise.all([
                          updateSetting('prayer_quote_text', localSettings.prayer_quote_text ?? ''),
                          updateSetting('prayer_quote_reference', localSettings.prayer_quote_reference ?? '')
                        ]);
                        toast.success('Citação aplicada manualmente!');
                      } catch (e) {
                        toast.error('Falha ao aplicar manualmente');
                      }
                    }}
                  >
                    Aplicar manualmente agora
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}