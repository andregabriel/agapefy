"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { toast } from 'sonner';
import StepCard from './StepCard';
import CreateStepModal from './CreateStepModal';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminForm {
  id: string;
  name: string;
  description?: string;
  form_type?: string;
  schema: Array<{ label: string; category_id: string; playlist_id?: string }>;
  created_at: string;
  onboard_step?: number | null;
  is_active?: boolean;
  parent_form_id?: string | null;
  allow_other_option?: boolean;
  other_option_label?: string | null;
}

interface StepData {
  id: string;
  stepNumber: number; // número exibido na timeline (sequencial, sem lacunas)
  type: 'form' | 'static' | 'hardcoded' | 'info';
  title: string;
  description?: string;
  isActive: boolean;
  formData?: AdminForm;
  staticData?: {
    step2_title?: string;
    step2_subtitle?: string;
    step3_title?: string;
  };
}

export default function OnboardingTimeline() {
  const { settings, loading: settingsLoading } = useAppSettings();
  const [forms, setForms] = useState<AdminForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createStepType, setCreateStepType] = useState<'multiple_choice' | 'short_text' | 'info' | null>(null);

  // Buscar todos os formulários de onboarding
  useEffect(() => {
    let isMounted = true;
    async function fetchForms() {
      try {
        setLoading(true);
        // Buscar TODOS os formulários (não apenas os com form_type = 'onboarding')
        // para garantir compatibilidade com dados existentes que podem não ter form_type definido
        const { data, error } = await supabase
          .from('admin_forms')
          .select('*')
          .order('onboard_step', { ascending: true, nullsFirst: true })
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        if (isMounted) setForms((data || []) as AdminForm[]);
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar formulários');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void fetchForms();
    return () => { isMounted = false; };
  }, []);

  // Organizar passos em ordem sequencial (1-8)
  const steps = useMemo<StepData[]>(() => {
    // Construiremos uma lista de entradas com uma posição "alvo" e depois
    // reindexaremos para números de exibição sequenciais (1..N), sem lacunas.
    type Entry = { position: number; data: Omit<StepData, 'stepNumber'> };
    const entries: Entry[] = [];

    // Passo 1: Formulário raiz
    // Primeiro tenta encontrar formulário com onboard_step = 1 e sem parent_form_id
    let rootForm = forms.find(f => f.onboard_step === 1 && (!f.parent_form_id || f.parent_form_id === null));
    
    // Se não encontrou, tenta encontrar o formulário mais antigo sem onboard_step definido
    // (compatibilidade com dados existentes que podem não ter onboard_step = 1)
    if (!rootForm) {
      rootForm = forms.find(f => 
        (!f.onboard_step || f.onboard_step === null) && 
        (!f.parent_form_id || f.parent_form_id === null)
      );
    }
    
    // Se ainda não encontrou, pega o primeiro formulário sem parent_form_id
    if (!rootForm) {
      rootForm = forms.find(f => !f.parent_form_id || f.parent_form_id === null);
    }
    
    if (rootForm) {
      entries.push({
        position: 1,
        data: {
          id: rootForm.id,
          type: 'form',
          title: rootForm.name,
          description: rootForm.description,
          isActive: rootForm.is_active ?? true,
          formData: rootForm,
        }
      });
    }

    // Passos informativos e formulários dinâmicos (>= 2)
    const dynamicForms = forms.filter(f => typeof f.onboard_step === 'number' && (f.onboard_step as number) >= 2);
    const occupied = new Set<number>(dynamicForms.map(f => f.onboard_step as number).concat(rootForm ? [1] : []));

    // Inserir entradas dinâmicas com a posição igual ao onboard_step original
    const childForms = dynamicForms;
    childForms.forEach(form => {
      if (form.onboard_step) {
        // Verificar se é um passo informativo (schema com type: 'info')
        const isInfoStep = form.schema && 
          Array.isArray(form.schema) && 
          form.schema.length > 0 && 
          form.schema[0]?.type === 'info';
        
        entries.push({
          position: form.onboard_step,
          data: {
            id: form.id,
            type: isInfoStep ? 'info' : 'form',
            title: form.name,
            description: form.description,
            isActive: form.is_active ?? true,
            formData: form,
          }
        });
      }
    });

    // Função util para alocar primeiro slot livre a partir de um baseline
    const findNextFree = (start: number) => {
      let s = start;
      while (occupied.has(s)) s += 1;
      occupied.add(s);
      return s;
    };

    // Alocar estáticos em slots livres a partir de seus baselines
    const previewSlot = findNextFree(2);
    entries.push({
      position: previewSlot,
      data: {
        id: 'static-step-preview',
        type: 'static',
        title: 'Preview da Categoria',
        description: settings.onboarding_step2_subtitle,
        isActive: true,
        staticData: {
          step2_title: settings.onboarding_step2_title,
          step2_subtitle: settings.onboarding_step2_subtitle,
        },
      }
    });

    const whatsappSlot = findNextFree(3);
    entries.push({
      position: whatsappSlot,
      data: {
        id: 'static-step-whatsapp',
        type: 'static',
        title: 'Conectar WhatsApp',
        description: settings.onboarding_step3_title,
        isActive: true,
        staticData: {
          step3_title: settings.onboarding_step3_title,
        },
      }
    });

    // Hardcoded (baselines 6, 7, 8) - deslocar se necessário
    const hard6 = findNextFree(6);
    entries.push({
      position: hard6,
      data: {
        id: 'hardcoded-step-6',
        type: 'hardcoded',
        title: 'Sua rotina está pronta',
        description: 'Tela de exibição da playlist da rotina criada',
        isActive: true,
      }
    });

    const hard7 = findNextFree(7);
    entries.push({
      position: hard7,
      data: {
        id: 'hardcoded-step-7',
        type: 'hardcoded',
        title: 'Conectar WhatsApp (final)',
        description: 'Tela de configuração do WhatsApp para receber versículos diários',
        isActive: true,
      }
    });

    const hard8 = findNextFree(8);
    entries.push({
      position: hard8,
      data: {
        id: 'hardcoded-step-8',
        type: 'hardcoded',
        title: 'Versículo Diário',
        description: 'Tela de opt-in para receber versículos diários via WhatsApp',
        isActive: true,
      }
    });

    // Ordenar por posição e reindexar stepNumber (exibição sequencial)
    const ordered = entries.sort((a, b) => a.position - b.position);
    const out: StepData[] = ordered.map((e, idx) => ({
      ...e.data,
      stepNumber: idx + 1,
    }));
    return out;
  }, [forms, settings]);

  const handleTestOnboarding = () => {
    window.open('/onboarding?step=1', '_blank');
  };

  const handleResetResponses = async () => {
    try {
      setResetting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Você precisa estar logado para resetar as respostas');
        return;
      }

      const response = await fetch('/api/onboarding/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao resetar respostas');
      }

      const result = await response.json();
      toast.success(result.message || 'Respostas resetadas com sucesso! Agora você pode testar o onboarding novamente.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível resetar as respostas');
    } finally {
      setResetting(false);
    }
  };

  const handleCreateStep = (type: 'multiple_choice' | 'short_text' | 'info') => {
    setCreateStepType(type);
    setCreateModalOpen(true);
  };

  const refreshForms = async () => {
    try {
      setLoading(true);
      // Buscar TODOS os formulários para garantir compatibilidade
      const { data, error } = await supabase
        .from('admin_forms')
        .select('*')
        .order('onboard_step', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setForms((data || []) as AdminForm[]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao recarregar formulários');
    } finally {
      setLoading(false);
    }
  };

  const handleStepCreated = () => {
    setCreateModalOpen(false);
    setCreateStepType(null);
    void refreshForms();
  };

  const handleStepUpdated = () => {
    void refreshForms();
  };

  const handleStepDeleted = () => {
    void refreshForms();
  };

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Carregando passos do onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com ações globais */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Timeline do Onboarding ({steps.length} passos)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie todos os passos do fluxo de onboarding em um único lugar
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetResponses}
            disabled={resetting}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? 'Resetando...' : 'Resetar minhas respostas'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleTestOnboarding}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Testar Onboarding
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Passo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreateStep('multiple_choice')}>
                Formulário de múltipla escolha
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateStep('short_text')}>
                Formulário de texto curto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateStep('info')}>
                Passo informativo (apenas texto)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Timeline de passos */}
      <div className="space-y-4">
        {steps.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <div className="text-center">
              <p className="text-sm">Nenhum passo configurado ainda.</p>
              <p className="text-xs mt-2">Clique em "Novo Passo" para começar.</p>
            </div>
          </div>
        ) : (
          steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              onUpdated={handleStepUpdated}
              onDeleted={handleStepDeleted}
            />
          ))
        )}
      </div>

      {/* Modal de criar passo */}
      {createModalOpen && createStepType && (
        <CreateStepModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          stepType={createStepType}
          existingSteps={steps}
          rootFormId={forms.find(f => f.onboard_step === 1 && !f.parent_form_id)?.id}
          onCreated={handleStepCreated}
        />
      )}
    </div>
  );
}

