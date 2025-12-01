"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Edit, Eye, Trash, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import FormStepEditor from './FormStepEditor';
import StaticStepEditor from './StaticStepEditor';
import InfoStepEditor from './InfoStepEditor';
import StepPreview from './StepPreview';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StepData {
  id: string;
  stepNumber: number;
  type: 'form' | 'static' | 'hardcoded' | 'info';
  title: string;
  description?: string;
  isActive: boolean;
  formData?: any;
  staticData?: any;
}

interface StepCardProps {
  step: StepData;
  steps: StepData[];
  onUpdated: () => void;
  onDeleted: () => void;
  onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
}

export default function StepCard({ step, steps, onUpdated, onDeleted, onMoveStep }: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localIsActive, setLocalIsActive] = useState(step.isActive);
  const { settings, updateSetting } = useAppSettings();
  const [otherDestination, setOtherDestination] = useState((settings as any).onboarding_other_destination || 'home');
  const [otherStepPosition, setOtherStepPosition] = useState((settings as any).onboarding_other_step_position || '');
  const [otherTitle, setOtherTitle] = useState((settings as any).onboarding_other_title || '');
  const [otherSubtitle, setOtherSubtitle] = useState((settings as any).onboarding_other_subtitle || '');
  const [otherButtonLabel, setOtherButtonLabel] = useState((settings as any).onboarding_other_button_label || '');
  const [savingOtherConfig, setSavingOtherConfig] = useState(false);

  // Sincronizar estado local quando step.isActive mudar (após refresh)
  useEffect(() => {
    setLocalIsActive(step.isActive);
  }, [step.isActive]);

  useEffect(() => {
    setOtherDestination((settings as any).onboarding_other_destination || 'home');
    setOtherStepPosition((settings as any).onboarding_other_step_position || '');
    setOtherTitle((settings as any).onboarding_other_title || '');
    setOtherSubtitle((settings as any).onboarding_other_subtitle || '');
    setOtherButtonLabel((settings as any).onboarding_other_button_label || '');
  }, [settings]);

  const getTypeBadge = () => {
    switch (step.type) {
      case 'form':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Formulário</Badge>;
      case 'static':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Configurável</Badge>;
      case 'info':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Informativo</Badge>;
      case 'hardcoded':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">Hardcoded</Badge>;
      default:
        return null;
    }
  };

  const handleDelete = async () => {
    if ((step.type !== 'form' && step.type !== 'info') || !step.formData) return;

    try {
      setIsDeleting(true);
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('admin_forms')
        .delete()
        .eq('id', step.id);

      if (error) throw error;

      const { toast } = await import('sonner');
      toast.success('Passo excluído com sucesso');
      setShowDeleteDialog(false);
      onDeleted();
    } catch (e: any) {
      console.error(e);
      const { toast } = await import('sonner');
      toast.error('Não foi possível excluir o passo');
    } finally {
      setIsDeleting(false);
    }
  };

  const canMoveUp = () => {
    const prevStep = steps.find(s => s.stepNumber === step.stepNumber - 1);
    return !!prevStep; // Pode mover para cima se houver um passo anterior
  };

  const canMoveDown = () => {
    const nextStep = steps.find(s => s.stepNumber === step.stepNumber + 1);
    return !!nextStep; // Pode mover para baixo se houver um passo seguinte
  };

  const handleMoveUp = () => {
    if (canMoveUp()) {
      onMoveStep(step.id, 'up');
    }
  };

  const handleMoveDown = () => {
    if (canMoveDown()) {
      onMoveStep(step.id, 'down');
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    // Atualização otimista: atualizar UI imediatamente
    setLocalIsActive(checked);
    
    try {
      // Para passos dinâmicos (form e info), atualizar no banco
      if ((step.type === 'form' || step.type === 'info') && step.formData) {
        const { supabase } = await import('@/lib/supabase');
        const { error } = await supabase
          .from('admin_forms')
          .update({ is_active: checked })
          .eq('id', step.id);

        if (error) throw error;
      } else if (step.type === 'static') {
        // Para passos estáticos, atualizar em app_settings
        let settingKey: string;
        if (step.id === 'static-step-preview') {
          settingKey = 'onboarding_static_preview_active';
        } else if (step.id === 'static-step-whatsapp') {
          settingKey = 'onboarding_static_whatsapp_active';
        } else {
          return;
        }

        const result = await updateSetting(settingKey as any, checked ? 'true' : 'false');
        if (!result.success) {
          throw new Error(result.error || 'Erro ao atualizar');
        }
      } else if (step.type === 'hardcoded') {
        // Para passos hardcoded, atualizar em app_settings
        let settingKey: string;
        if (step.id === 'hardcoded-step-6') {
          settingKey = 'onboarding_hardcoded_6_active';
        } else if (step.id === 'hardcoded-step-7') {
          settingKey = 'onboarding_hardcoded_7_active';
        } else if (step.id === 'hardcoded-step-8') {
          settingKey = 'onboarding_hardcoded_8_active';
        } else {
          return;
        }

        const result = await updateSetting(settingKey as any, checked ? 'true' : 'false');
        if (!result.success) {
          throw new Error(result.error || 'Erro ao atualizar');
        }
      } else {
        return;
      }

      const { toast } = await import('sonner');
      toast.success(checked ? 'Passo ativado' : 'Passo desativado');
      onUpdated();
    } catch (e) {
      console.error(e);
      // Reverter atualização otimista em caso de erro
      setLocalIsActive(!checked);
      const { toast } = await import('sonner');
      toast.error('Não foi possível atualizar o status');
    }
  };

  const handleSaveOtherConfig = async () => {
    try {
      setSavingOtherConfig(true);
      const entries: Array<[keyof typeof settings, string]> = [
        ['onboarding_other_destination', otherDestination || 'home'],
        ['onboarding_other_step_position', otherStepPosition || ''],
        ['onboarding_other_title', otherTitle || ''],
        ['onboarding_other_subtitle', otherSubtitle || ''],
        ['onboarding_other_button_label', otherButtonLabel || ''],
      ];

      const results = await Promise.all(entries.map(([key, value]) => updateSetting(key, value)));
      const failed = results.find(r => !r.success);
      const { toast } = await import('sonner');
      if (failed) {
        toast.error('Não foi possível salvar as configurações do "Outros".');
      } else {
        toast.success('Configurações do "Outros" salvas.');
        onUpdated();
      }
    } catch (e) {
      console.error(e);
      const { toast } = await import('sonner');
      toast.error('Erro ao salvar as configurações do "Outros".');
    } finally {
      setSavingOtherConfig(false);
    }
  };

  return (
    <>
      <Card className={`transition-all ${isExpanded ? 'shadow-lg' : 'shadow-sm'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-lg font-bold px-3 py-1 min-w-[60px] text-center">
                  {step.stepNumber}
                </Badge>
                {getTypeBadge()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                {step.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{step.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {/* Botões de mover posição (para todos os tipos de passos) */}
              <div className="flex flex-col gap-0.5 mr-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMoveUp}
                  disabled={!canMoveUp()}
                  className="h-6 w-6 p-0"
                  title="Mover para cima"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMoveDown}
                  disabled={!canMoveDown()}
                  className="h-6 w-6 p-0"
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              {/* Mostrar toggle para todos os tipos de passo */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Ativo</span>
                <Switch
                  checked={localIsActive}
                  onCheckedChange={handleToggleActive}
                  aria-label={`Alternar ativo para passo ${step.stepNumber}`}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              {step.type !== 'hardcoded' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setIsExpanded(true);
                  }}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
              {(step.type === 'form' || step.type === 'info') && step.formData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="gap-2"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Recolher
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expandir
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            {isEditing && step.type === 'form' && step.formData && (
              <FormStepEditor
                form={step.formData}
                onSaved={() => {
                  setIsEditing(false);
                  setIsExpanded(false);
                  onUpdated();
                }}
                onCancel={() => {
                  setIsEditing(false);
                }}
              />
            )}
            {isEditing && step.type === 'static' && (
              <StaticStepEditor
                stepNumber={step.stepNumber}
                stepId={step.id}
                initialData={step.staticData}
                onSaved={() => {
                  setIsEditing(false);
                  setIsExpanded(false);
                  onUpdated();
                }}
                onCancel={() => {
                  setIsEditing(false);
                }}
              />
            )}
            {isEditing && step.type === 'info' && step.formData && (
              <InfoStepEditor
                form={step.formData}
                onSaved={() => {
                  setIsEditing(false);
                  setIsExpanded(false);
                  onUpdated();
                }}
                onCancel={() => {
                  setIsEditing(false);
                }}
              />
            )}
            {!isEditing && step.type === 'hardcoded' && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  Este passo é hardcoded no código e não pode ser editado ainda. 
                  Esta funcionalidade será implementada em uma fase futura.
                </p>
              </div>
            )}

            {step.stepNumber === 1 && (
              <div className="mt-6 border-t pt-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Configurações do &quot;Outros&quot;</h4>
                    <p className="text-xs text-gray-500">
                      Defina para onde o usuário vai após preencher o campo Outros e o texto de agradecimento.
                    </p>
                  </div>
                  <Badge variant="secondary">Fluxo especial</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <Label htmlFor="other-destination">Destino ao escolher &quot;Outros&quot;</Label>
                    <select
                      id="other-destination"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={otherDestination}
                      onChange={(e) => setOtherDestination(e.target.value)}
                    >
                      <option value="home">Agradecer e ir para Home</option>
                      <option value="next">Agradecer e continuar fluxo (próximo passo ativo)</option>
                      <option value="step">Agradecer e ir para um passo específico</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      Escolha &quot;Passo específico&quot; para redirecionar para um passo (ex.: 9 - Outros).
                    </p>
                  </div>
                  {otherDestination === 'step' && (
                    <div className="space-y-2">
                      <Label htmlFor="other-step-position">Passo de destino</Label>
                      <Input
                        id="other-step-position"
                        type="number"
                        min={1}
                        placeholder="Ex.: 9"
                        value={otherStepPosition}
                        onChange={(e) => setOtherStepPosition(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">Use o número de posição exibido na timeline.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="other-title">Título da tela de agradecimento</Label>
                    <Input
                      id="other-title"
                      value={otherTitle}
                      onChange={(e) => setOtherTitle(e.target.value)}
                      placeholder="Obrigado por compartilhar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="other-button">Texto do botão</Label>
                    <Input
                      id="other-button"
                      value={otherButtonLabel}
                      onChange={(e) => setOtherButtonLabel(e.target.value)}
                      placeholder="Continuar"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="other-subtitle">Texto/descrição da tela</Label>
                    <Textarea
                      id="other-subtitle"
                      value={otherSubtitle}
                      onChange={(e) => setOtherSubtitle(e.target.value)}
                      placeholder="Mensagem curta de agradecimento ou instruções."
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveOtherConfig} disabled={savingOtherConfig}>
                    {savingOtherConfig ? 'Salvando...' : 'Salvar configurações do "Outros"'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Preview Modal */}
      {showPreview && (
        <StepPreview
          stepNumber={(step.formData?.onboard_step as any) || step.stepNumber}
          staticKind={step.type === 'static'
            ? (step.title?.toLowerCase().includes('preview') ? 'preview' : 'whatsapp')
            : undefined}
          formId={step.formData?.id || (step.type === 'form' || step.type === 'info' ? step.id : undefined)}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir passo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o passo {step.stepNumber}: "{step.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
