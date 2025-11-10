"use client";

import { useState, useEffect } from 'react';
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

  // Resetar estado quando o modal abrir ou o tipo mudar
  useEffect(() => {
    if (open) {
      setName('');
      setCustomStepNumber(null);
      setCreating(false);
    }
  }, [open, stepType]);

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
      
      // Verificar se já existe um passo DINÂMICO no banco com esse número
      // (passos estáticos não bloqueiam a criação de passos dinâmicos)
      const { data: existingDynamicStep, error: checkError } = await supabase
        .from('admin_forms')
        .select('id, onboard_step')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .eq('onboard_step', nextStep)
        .lt('onboard_step', 6); // Apenas passos dinâmicos (< 6)
      
      if (checkError) {
        throw new Error(`Erro ao verificar passo existente: ${checkError.message}`);
      }
      
      // Se existe um passo dinâmico com esse número, precisamos renumerar
      // TODOS os passos dinâmicos >= nextStep para abrir espaço
      // Os passos estáticos e hardcoded se ajustarão automaticamente na timeline
      if (existingDynamicStep && existingDynamicStep.length > 0) {
        // Buscar TODOS os passos dinâmicos >= nextStep (sem limite superior)
        // Isso garante que todos os passos sejam "empurrados" para baixo sequencialmente
        const { data: allFormsToRenumber, error: fetchError } = await supabase
          .from('admin_forms')
          .select('id, onboard_step')
          .eq('form_type', 'onboarding')
          .eq('is_active', true)
          .gte('onboard_step', nextStep)
          .not('onboard_step', 'is', null)
          .order('onboard_step', { ascending: true }); // Ordenar ascendente para garantir ordem correta
        
        if (fetchError) {
          throw new Error(`Erro ao buscar passos para renumerar: ${fetchError.message}`);
        }
        
        if (allFormsToRenumber && allFormsToRenumber.length > 0) {
          // Garantir que temos todos os passos: verificar se há passos em posições intermediárias
          // que não foram capturados (pode acontecer se houver lacunas)
          const stepsFound = new Set(allFormsToRenumber.map(f => f.onboard_step).filter((s): s is number => typeof s === 'number'));
          const maxStepFound = Math.max(...Array.from(stepsFound));
          
          // Buscar novamente todos os passos >= nextStep para garantir que não perdemos nenhum
          // Isso é importante porque pode haver passos criados entre a primeira busca e agora
          const { data: doubleCheckForms, error: doubleCheckError } = await supabase
            .from('admin_forms')
            .select('id, onboard_step')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .gte('onboard_step', nextStep)
            .not('onboard_step', 'is', null);
          
          if (!doubleCheckError && doubleCheckForms) {
            // Adicionar qualquer passo que não estava na lista original
            const originalIds = new Set(allFormsToRenumber.map(f => f.id));
            for (const form of doubleCheckForms) {
              if (!originalIds.has(form.id) && form.onboard_step && form.onboard_step >= nextStep) {
                allFormsToRenumber.push(form);
              }
            }
          }
          
          // Ordenar por onboard_step DESCENDENTE para renumerar do maior para o menor
          // Isso evita conflitos de constraint única
          allFormsToRenumber.sort((a, b) => (b.onboard_step || 0) - (a.onboard_step || 0));
          
          // Primeiro, renumerar TODOS para números temporários altos (900+) para evitar conflitos
          const tempOffset = 900;
          const tempSteps: Array<{ id: string; originalStep: number; tempStep: number }> = [];
          
          for (const form of allFormsToRenumber) {
            if (form.onboard_step && form.onboard_step >= nextStep) {
              const originalStep = form.onboard_step;
              // Se já está em um número temporário (>= tempOffset), usar um offset maior
              const tempStep = originalStep >= tempOffset ? originalStep + 1000 : originalStep + tempOffset;
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
          
          // Depois, renumerar para os números finais (+1 do original) em ordem DESCENDENTE
          // Ordenar por originalStep descendente para garantir ordem correta
          tempSteps.sort((a, b) => {
            const aOriginal = a.originalStep >= tempOffset ? a.originalStep - tempOffset : a.originalStep;
            const bOriginal = b.originalStep >= tempOffset ? b.originalStep - tempOffset : b.originalStep;
            return bOriginal - aOriginal; // Descendente: maior primeiro
          });
          
          // Renumerar todos os passos sequencialmente (+1)
          for (const item of tempSteps) {
            // Calcular o passo original (removendo offset temporário se aplicável)
            const originalStep = item.originalStep >= tempOffset ? item.originalStep - tempOffset : item.originalStep;
            const finalStep = originalStep + 1;
            
            const { error: updateError } = await supabase
              .from('admin_forms')
              .update({ onboard_step: finalStep })
              .eq('id', item.id);
            
            if (updateError) {
              if (updateError.code === '23505') {
                throw new Error(`Conflito ao renumerar passo ${originalStep} para ${finalStep}: já existe um passo nesta posição. Tente novamente.`);
              }
              throw new Error(`Erro ao renumerar passo ${originalStep} para ${finalStep}: ${updateError.message}`);
            }
          }
          
          toast.success(`Passos renumerados automaticamente. Todos os passos na posição ${nextStep} ou acima foram renumerados (+1).`);
        } else {
          // Não há passos dinâmicos para renumerar, mas existe um passo dinâmico com esse número
          toast.error(`Já existe um passo dinâmico com o número ${nextStep}. Escolha outro número.`);
          setCreating(false);
          return;
        }
      }
      // Se não existe passo dinâmico com esse número, podemos criar normalmente
      // (mesmo que exista um passo estático na timeline, isso não bloqueia)

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
          <div>
            <Label htmlFor="step-number">Número do Passo</Label>
            <Input
              id="step-number"
              type="number"
              min={1}
              value={customStepNumber !== null ? customStepNumber : suggestedStep}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (val === '') {
                  setCustomStepNumber(null);
                } else {
                  const numVal = Number(val);
                  if (!isNaN(numVal) && numVal > 0) {
                    setCustomStepNumber(numVal);
                  } else {
                    setCustomStepNumber(null);
                  }
                }
              }}
              placeholder={String(suggestedStep)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Sugestão: {suggestedStep}. Você pode escolher outro número para inserir entre passos existentes.
            </p>
            {(() => {
              const targetStep = customStepNumber !== null ? customStepNumber : suggestedStep;
              // Verificar se existe um passo dinâmico na timeline (não apenas estático)
              const dynamicStepExists = existingSteps.some(s => 
                s.stepNumber === targetStep && (s.type === 'form' || s.type === 'info')
              );
              const anyStepExists = existingSteps.some(s => s.stepNumber === targetStep);
              
              if (dynamicStepExists) {
                return (
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    ⚠️ Já existe um passo dinâmico com o número {targetStep}. Os passos dinâmicos existentes no passo {targetStep} ou acima serão renumerados automaticamente (+1) para abrir espaço.
                  </p>
                );
              } else if (anyStepExists) {
                return (
                  <p className="text-xs text-gray-500 mt-2">
                    ℹ️ Existe um passo estático na posição {targetStep}. Você pode criar um passo dinâmico nesta posição.
                  </p>
                );
              }
              return null;
            })()}
          </div>
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

