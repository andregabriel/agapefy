"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Save, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { toast } from 'sonner';

import CategoriesManagement from '@/components/admin/CategoriesManagement';
import { useCategories } from '@/hooks/useCategories';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function AdminCategoriasPage() {
  const { categories } = useCategories();
  const { settings, updateSetting, loading: settingsLoading } = useAppSettings();

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [quoteSettings, setQuoteSettings] = useState({
    prayer_quote_text: '',
    prayer_quote_reference: ''
  });

  useEffect(() => {
    if (!settingsLoading) {
      setQuoteSettings({
        prayer_quote_text: settings.prayer_quote_text,
        prayer_quote_reference: settings.prayer_quote_reference
      });
    }
  }, [settings, settingsLoading]);

  const handleSaveQuoteSettings = async () => {
    try {
      const textResult = await updateSetting('prayer_quote_text', quoteSettings.prayer_quote_text);
      const refResult = await updateSetting('prayer_quote_reference', quoteSettings.prayer_quote_reference);
      if (textResult.success && refResult.success) {
        toast.success('Configurações salvas com sucesso!');
        setShowSettingsDialog(false);
      } else {
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    }
  };

  const total = categories.length;
  const current = Number.parseInt(settings.prayer_quote_position || '0', 10);
  const quotePos = Number.isFinite(current) ? Math.max(0, Math.min(total, current)) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Settings size={16} className="mr-2" />
            Configurações
          </Button>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2 text-gray-900">
                <Heart className="text-blue-600" size={20} />
                <span>Frase Bíblica</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="quote-text" className="text-gray-700 font-medium">Texto da Frase</Label>
                <Textarea
                  id="quote-text"
                  value={quoteSettings.prayer_quote_text}
                  onChange={(e) => setQuoteSettings(prev => ({ ...prev, prayer_quote_text: e.target.value }))}
                  placeholder="Digite a frase bíblica..."
                  rows={3}
                  className="text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="quote-reference" className="text-gray-700 font-medium">Referência Bíblica</Label>
                <Input
                  id="quote-reference"
                  value={quoteSettings.prayer_quote_reference}
                  onChange={(e) => setQuoteSettings(prev => ({ ...prev, prayer_quote_reference: e.target.value }))}
                  placeholder="Ex: Mateus 18:20"
                  className="text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border">
                <p className="text-sm text-gray-500 mb-2">Preview:</p>
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Heart className="text-blue-600" size={16} />
                  </div>
                  <p className="text-gray-700 font-medium text-sm mb-1 italic">
                    {quoteSettings.prayer_quote_text || 'Texto da frase...'}
                  </p>
                  <p className="text-blue-600 font-semibold text-xs">
                    {quoteSettings.prayer_quote_reference || 'Referência...'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleSaveQuoteSettings} className="flex-1">
                  <Save size={16} className="mr-2" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Heart className="text-blue-600" size={18} />
              <span>Frase Bíblica</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const newPos = Math.max(0, quotePos - 1);
                  await updateSetting('prayer_quote_position', String(newPos));
                  toast.success('Posição atualizada!');
                }}
                disabled={quotePos <= 0}
                aria-label="Mover frase para cima"
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const newPos = Math.min(total, quotePos + 1);
                  await updateSetting('prayer_quote_position', String(newPos));
                  toast.success('Posição atualizada!');
                }}
                disabled={quotePos >= total}
                aria-label="Mover frase para baixo"
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettingsDialog(true)}
                title="Configurações da Frase Bíblica"
                aria-label="Abrir configurações da frase"
              >
                <Settings size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <CategoriesManagement />
    </div>
  );
}