"use client";

import { useState, useEffect } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';

interface StaticStepEditorProps {
  stepNumber: number;
  initialData?: {
    step2_title?: string;
    step2_subtitle?: string;
    step3_title?: string;
  };
  onSaved: () => void;
  onCancel: () => void;
}

export default function StaticStepEditor({
  stepNumber,
  initialData,
  onSaved,
  onCancel,
}: StaticStepEditorProps) {
  const { updateSetting, settings, refetch } = useAppSettings();
  const [saving, setSaving] = useState(false);
  
  const [step2Title, setStep2Title] = useState(initialData?.step2_title || settings.onboarding_step2_title || '');
  const [step2Subtitle, setStep2Subtitle] = useState(initialData?.step2_subtitle || settings.onboarding_step2_subtitle || '');
  const [step3Title, setStep3Title] = useState(initialData?.step3_title || settings.onboarding_step3_title || '');

  // Sincronizar valores quando settings mudarem
  useEffect(() => {
    if (stepNumber === 2) {
      setStep2Title(settings.onboarding_step2_title || '');
      setStep2Subtitle(settings.onboarding_step2_subtitle || '');
    } else if (stepNumber === 3) {
      setStep3Title(settings.onboarding_step3_title || '');
    }
  }, [settings, stepNumber]);

  const handleSave = async () => {
    try {
      setSaving(true);

      if (stepNumber === 2) {
        const result1 = await updateSetting('onboarding_step2_title', step2Title);
        const result2 = await updateSetting('onboarding_step2_subtitle', step2Subtitle);
        if (!result1.success || !result2.success) {
          throw new Error('Erro ao salvar configurações');
        }
      } else if (stepNumber === 3) {
        const result = await updateSetting('onboarding_step3_title', step3Title);
        if (!result.success) {
          throw new Error('Erro ao salvar configurações');
        }
      }

      toast.success('Configurações salvas com sucesso');
      // Recarregar settings para refletir mudanças
      await refetch();
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar as configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">
          Editar Passo {stepNumber}
        </h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {stepNumber === 2 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="step2-title">Título</Label>
            <Input
              id="step2-title"
              value={step2Title}
              onChange={(e) => setStep2Title(e.target.value)}
              placeholder="Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil."
            />
          </div>
          <div>
            <Label htmlFor="step2-subtitle">Subtítulo</Label>
            <Textarea
              id="step2-subtitle"
              value={step2Subtitle}
              onChange={(e) => setStep2Subtitle(e.target.value)}
              placeholder="Sua playlist foi criada, em breve você poderá escutar essas orações."
              rows={3}
            />
          </div>
        </div>
      )}

      {stepNumber === 3 && (
        <div>
          <Label htmlFor="step3-title">Título</Label>
          <Input
            id="step3-title"
            value={step3Title}
            onChange={(e) => setStep3Title(e.target.value)}
            placeholder="Conecte seu WhatsApp para receber uma mensagem diária para {category}."
          />
          <p className="text-xs text-gray-500 mt-1">
            Você pode usar {"{category}"} para inserir o nome da categoria selecionada.
          </p>
        </div>
      )}
    </div>
  );
}

