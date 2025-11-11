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
  stepId?: string; // Identificador único do passo (ex: 'static-step-preview', 'static-step-whatsapp')
  initialData?: {
    step2_title?: string;
    step2_subtitle?: string;
    step3_title?: string;
    step4_section_title?: string;
    step4_instruction?: string;
    step4_label?: string;
    step4_privacy_text?: string;
    step4_skip_button?: string;
    step4_complete_button?: string;
  };
  onSaved: () => void;
  onCancel: () => void;
}

export default function StaticStepEditor({
  stepNumber,
  stepId,
  initialData,
  onSaved,
  onCancel,
}: StaticStepEditorProps) {
  const { updateSetting, settings, refetch } = useAppSettings();
  const [saving, setSaving] = useState(false);
  
  // Identificar qual passo estático está sendo editado baseado no stepId
  const isPreviewStep = stepId === 'static-step-preview';
  const isWhatsAppStep = stepId === 'static-step-whatsapp';
  
  const [step2Title, setStep2Title] = useState(initialData?.step2_title || settings.onboarding_step2_title || '');
  const [step2Subtitle, setStep2Subtitle] = useState(initialData?.step2_subtitle || settings.onboarding_step2_subtitle || '');
  const [step3Title, setStep3Title] = useState(initialData?.step3_title || settings.onboarding_step3_title || '');
  
  // Step 4 (WhatsApp) fields
  const [step4SectionTitle, setStep4SectionTitle] = useState(initialData?.step4_section_title || settings.onboarding_step4_section_title || '');
  const [step4Instruction, setStep4Instruction] = useState(initialData?.step4_instruction || settings.onboarding_step4_instruction || '');
  const [step4Label, setStep4Label] = useState(initialData?.step4_label || settings.onboarding_step4_label || '');
  const [step4PrivacyText, setStep4PrivacyText] = useState(initialData?.step4_privacy_text || settings.onboarding_step4_privacy_text || '');
  const [step4SkipButton, setStep4SkipButton] = useState(initialData?.step4_skip_button || settings.onboarding_step4_skip_button || '');
  const [step4CompleteButton, setStep4CompleteButton] = useState(initialData?.step4_complete_button || settings.onboarding_step4_complete_button || '');

  // Sincronizar valores quando settings mudarem
  useEffect(() => {
    if (isPreviewStep) {
      setStep2Title(settings.onboarding_step2_title || '');
      setStep2Subtitle(settings.onboarding_step2_subtitle || '');
    } else if (isWhatsAppStep) {
      setStep3Title(settings.onboarding_step3_title || '');
      setStep4SectionTitle(settings.onboarding_step4_section_title || '');
      setStep4Instruction(settings.onboarding_step4_instruction || '');
      setStep4Label(settings.onboarding_step4_label || '');
      setStep4PrivacyText(settings.onboarding_step4_privacy_text || '');
      setStep4SkipButton(settings.onboarding_step4_skip_button || '');
      setStep4CompleteButton(settings.onboarding_step4_complete_button || '');
    }
  }, [settings, isPreviewStep, isWhatsAppStep]);

  const handleSave = async () => {
    try {
      setSaving(true);

      if (isPreviewStep) {
        const result1 = await updateSetting('onboarding_step2_title', step2Title);
        const result2 = await updateSetting('onboarding_step2_subtitle', step2Subtitle);
        if (!result1.success || !result2.success) {
          throw new Error('Erro ao salvar configurações');
        }
      } else if (isWhatsAppStep) {
        const results = await Promise.all([
          updateSetting('onboarding_step3_title', step3Title),
          updateSetting('onboarding_step4_section_title', step4SectionTitle),
          updateSetting('onboarding_step4_instruction', step4Instruction),
          updateSetting('onboarding_step4_label', step4Label),
          updateSetting('onboarding_step4_privacy_text', step4PrivacyText),
          updateSetting('onboarding_step4_skip_button', step4SkipButton),
          updateSetting('onboarding_step4_complete_button', step4CompleteButton),
        ]);
        if (results.some(r => !r.success)) {
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

      {isPreviewStep && (
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

      {isWhatsAppStep && (
        <div className="space-y-4">
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
          
          <div>
            <Label htmlFor="step4-section-title">Título da Seção</Label>
            <Input
              id="step4-section-title"
              value={step4SectionTitle}
              onChange={(e) => setStep4SectionTitle(e.target.value)}
              placeholder="Configuração do WhatsApp"
            />
          </div>
          
          <div>
            <Label htmlFor="step4-instruction">Instrução</Label>
            <Input
              id="step4-instruction"
              value={step4Instruction}
              onChange={(e) => setStep4Instruction(e.target.value)}
              placeholder="Informe seu número com DDD. Exemplo: +55 11 99999-9999"
            />
          </div>
          
          <div>
            <Label htmlFor="step4-label">Label do Campo</Label>
            <Input
              id="step4-label"
              value={step4Label}
              onChange={(e) => setStep4Label(e.target.value)}
              placeholder="Número do WhatsApp"
            />
          </div>
          
          <div>
            <Label htmlFor="step4-privacy-text">Texto de Privacidade</Label>
            <Input
              id="step4-privacy-text"
              value={step4PrivacyText}
              onChange={(e) => setStep4PrivacyText(e.target.value)}
              placeholder="seu número será usado apenas para enviar/receber mensagens."
            />
          </div>
          
          <div>
            <Label htmlFor="step4-skip-button">Texto do Botão Pular</Label>
            <Input
              id="step4-skip-button"
              value={step4SkipButton}
              onChange={(e) => setStep4SkipButton(e.target.value)}
              placeholder="Pular"
            />
          </div>
          
          <div>
            <Label htmlFor="step4-complete-button">Texto do Botão Concluir</Label>
            <Input
              id="step4-complete-button"
              value={step4CompleteButton}
              onChange={(e) => setStep4CompleteButton(e.target.value)}
              placeholder="Concluir"
            />
          </div>
        </div>
      )}
    </div>
  );
}

