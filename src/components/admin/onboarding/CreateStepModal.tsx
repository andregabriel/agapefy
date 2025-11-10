"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface StepData {
  id: string;
  stepNumber: number;
  type: 'form' | 'static' | 'hardcoded';
}

interface CreateStepModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepType: 'multiple_choice' | 'short_text' | 'info';
  existingSteps: StepData[];
  rootFormId?: string;
  onCreated: () => void;
}

export default function CreateStepModal({
  open,
  onOpenChange,
  stepType,
  existingSteps,
  rootFormId,
  onCreated,
}: CreateStepModalProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [customStepNumber, setCustomStepNumber] = useState<number | null>(null);

  const calculateNextStep = () => {
    // Se não há passo 1, criar como passo 1
    const hasStep1 = existingSteps.some(s => s.stepNumber === 1);
    if (!hasStep1) {
      return 1;
    }
    
    // Para passos informativos, sugerir passo 2 se disponível (para inserir entre passo 1 e 3)
    if (stepType === 'info') {
      const hasStep2 = existingSteps.some(s => s.stepNumber === 2);
      if (!hasStep2) {
        return 2;
      }
    }
    
    // Caso contrário, calcular próximo passo após os existentes
    const dbSteps = existingSteps.filter(s => s.type === 'form' || s.type === 'info');
    const maxDb = dbSteps.reduce((acc, s) => Math.max(acc, s.stepNumber), 3);
    return Math.max(3, maxDb) + 1;
  };

  const suggestedStep = customStepNumber !== null ? customStepNumber : calculateNextStep();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Digite um nome para o passo');
      return;
    }

    try {
      setCreating(true);
      const nextStep = customStepNumber !== null ? customStepNumber : calculateNextStep();
      
      // Verificar se o passo já existe
      const stepExists = existingSteps.some(s => s.stepNumber === nextStep);
      
      if (stepExists) {
        // Renumerar automaticamente todos os passos dinâmicos >= nextStep para abrir espaço
        // Passos estáticos (2 e 3) e hardcoded (6, 7, 8) não são renumerados porque são hardcoded
        // Mas os passos dinâmicos (formulários) >= nextStep devem ser renumerados (+1)
        
        // Buscar todos os formulários dinâmicos que precisam ser renumerados
        // Passos >= nextStep que são formulários dinâmicos (não estáticos, não hardcoded)
        const { data: formsToRenumber, error: fetchError } = await supabase
          .from('admin_forms')
          .select('id, onboard_step')
          .eq('form_type', 'onboarding')
          .eq('is_active', true)
          .gte('onboard_step', nextStep)
          .lt('onboard_step', 6); // Não renumerar passos hardcoded (6, 7, 8)
        
        if (fetchError) {
          throw new Error(`Erro ao buscar passos para renumerar: ${fetchError.message}`);
        }
        
        if (formsToRenumber && formsToRenumber.length > 0) {
          // Ordenar por onboard_step descendente para renumerar do maior para o menor
          formsToRenumber.sort((a, b) => (b.onboard_step || 0) - (a.onboard_step || 0));
          
          // Primeiro, renumerar para números temporários altos (900+) para evitar conflitos de constraint única
          // Isso garante que não haverá duplicatas durante o processo
          const tempOffset = 900;
          const tempSteps: Array<{ id: string; originalStep: number; tempStep: number }> = [];
          
          for (const form of formsToRenumber) {
            if (form.onboard_step && form.onboard_step >= nextStep) {
              const originalStep = form.onboard_step;
              const tempStep = originalStep + tempOffset;
              tempSteps.push({ id: form.id, originalStep, tempStep });
              
              const { error: updateError } = await supabase
                .from('admin_forms')
                .update({ onboard_step: tempStep })
                .eq('id', form.id);
              
              if (updateError) {
                throw new Error(`Erro ao renumerar passo ${originalStep} (fase temporária): ${updateError.message}`);
              }
            }
          }
          
          // Depois, renumerar para os números finais (+1 do original)
          for (const item of tempSteps) {
            const finalStep = item.originalStep + 1;
            const { error: updateError } = await supabase
              .from('admin_forms')
              .update({ onboard_step: finalStep })
              .eq('id', item.id);
            
            if (updateError) {
              throw new Error(`Erro ao renumerar passo ${item.originalStep} para ${finalStep}: ${updateError.message}`);
            }
          }
          
          toast.success(`Passos renumerados automaticamente (passo ${nextStep} → ${nextStep + 1}, ${nextStep + 1} → ${nextStep + 2}, etc.)`);
        } else {
          // Não há passos dinâmicos para renumerar, mas o passo existe (provavelmente estático/hardcoded)
          toast.error(`Já existe um passo com o número ${nextStep}. Escolha outro número.`);
          setCreating(false);
          return;
        }
      }

      const base: any = {
        name: name.trim(),
        description: '',
        form_type: 'onboarding',
        is_active: true,
        onboard_step: nextStep,
      };

      // Se for passo 1, não precisa de parent_form_id
      // Se for passo 2 (informativo), também não precisa de parent_form_id (é independente)
      // Se for passo 4+, precisa de parent_form_id apontando para o passo 1
      if (nextStep === 1) {
        base.parent_form_id = null;
      } else if (nextStep === 2 && stepType === 'info') {
        // Passo 2 informativo não precisa de parent_form_id
        base.parent_form_id = null;
      } else {
        // Para passos 3+, tentar buscar o rootFormId, mas não bloquear se não encontrar
        // (pode ser que o passo 1 não tenha onboard_step definido ainda)
        if (rootFormId) {
          base.parent_form_id = rootFormId;
        } else {
          // Tentar buscar o formulário raiz diretamente
          let rootForm = await supabase
            .from('admin_forms')
            .select('id')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .or('onboard_step.eq.1,onboard_step.is.null')
            .is('parent_form_id', null)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          
          // Se a coluna parent_form_id não existir, buscar sem esse filtro
          if (rootForm.error && (rootForm.error.code === '42703' || /parent_form_id/i.test(String(rootForm.error.message || '')))) {
            rootForm = await supabase
              .from('admin_forms')
              .select('id')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .or('onboard_step.eq.1,onboard_step.is.null')
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
          }
          
          if (rootForm.data?.id) {
            base.parent_form_id = rootForm.data.id;
          } else {
            // Se não encontrou, deixar null (pode ser um passo independente)
            base.parent_form_id = null;
          }
        }
      }

      if (stepType === 'short_text') {
        base.schema = [{ type: 'short_text' }];
      } else if (stepType === 'info') {
        base.schema = [{ 
          type: 'info', 
          title: '', 
          subtitle: '', 
          explanation: '', 
          buttonText: 'Começar agora →' 
        }];
      } else {
        base.schema = [];
      }

      let { data, error } = await supabase
        .from('admin_forms')
        .insert(base)
        .select('id')
        .single();

      // Se der erro de coluna não encontrada (parent_form_id), tentar inserir sem esse campo
      if (error && (error.code === '42703' || /parent_form_id/i.test(String(error.message || '')))) {
        // Remover parent_form_id do objeto base
        const baseWithoutParent = { ...base };
        delete baseWithoutParent.parent_form_id;
        
        // Tentar inserir novamente sem parent_form_id
        const retryResult = await supabase
          .from('admin_forms')
          .insert(baseWithoutParent)
          .select('id')
          .single();
        
        if (retryResult.error) {
          error = retryResult.error;
        } else {
          data = retryResult.data;
          error = null;
        }
      }

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe um passo com este número. Tente novamente.');
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Passo ${nextStep} criado com sucesso`);
      setName('');
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      console.error('Erro ao criar passo:', e);
      toast.error(`Não foi possível criar o passo: ${e.message || 'Erro desconhecido'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Passo</DialogTitle>
          <DialogDescription>
            Criar um novo passo do tipo: {
              stepType === 'multiple_choice' ? 'Formulário de múltipla escolha' : 
              stepType === 'short_text' ? 'Formulário de texto curto' : 
              'Passo informativo (apenas texto)'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="step-name">Nome do Passo</Label>
            <Input
              id="step-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Etapa ${suggestedStep}`}
            />
          </div>
          {stepType === 'info' && (
            <div>
              <Label htmlFor="step-number">Número do Passo</Label>
              <Input
                id="step-number"
                type="number"
                min={1}
                value={customStepNumber !== null ? customStepNumber : suggestedStep}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setCustomStepNumber(val);
                }}
                placeholder={String(suggestedStep)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Sugestão: {suggestedStep}. Você pode escolher outro número para inserir entre passos existentes.
              </p>
              {(() => {
                const targetStep = customStepNumber !== null ? customStepNumber : suggestedStep;
                const stepExists = existingSteps.some(s => s.stepNumber === targetStep);
                if (stepExists && targetStep === 2) {
                  return (
                    <p className="text-xs text-blue-600 mt-2 font-medium">
                      ⚠️ O passo 2 estático (Preview da Categoria) já existe. Ao criar este passo informativo como passo 2, os passos dinâmicos (formulários) existentes no passo 2 ou acima serão renumerados automaticamente (+1). O passo 2 estático continuará sendo passo 2, mas aparecerá depois deste passo informativo no fluxo.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
          {stepType !== 'info' && (
            <p className="text-xs text-gray-500">
              Este passo será criado como passo {suggestedStep}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'Criando...' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

