import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface OnboardingProgress {
  totalSteps: number;
  currentStep: number;
  percentage: number;
  loading: boolean;
}

export function useOnboardingProgress(currentStep: number, categoryId?: string | null): OnboardingProgress {
  const [progress, setProgress] = useState<OnboardingProgress>({
    totalSteps: 1,
    currentStep: 1,
    percentage: 0,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function calculateProgress() {
      try {
        // Buscar todos os formulários dinâmicos ativos
        let { data: activeForms, error: formsError } = await supabase
          .from('admin_forms')
          .select('id, onboard_step, is_active')
          .eq('form_type', 'onboarding')
          .eq('is_active', true)
          .not('onboard_step', 'is', null)
          .order('onboard_step', { ascending: true });

        // Fallback quando parent_form_id não existe
        if (formsError && (formsError.code === '42703' || /parent_form_id/i.test(String(formsError.message || '')))) {
          const fb = await supabase
            .from('admin_forms')
            .select('id, onboard_step, is_active')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .not('onboard_step', 'is', null)
            .order('onboard_step', { ascending: true });
          if (!fb.error) {
            activeForms = fb.data as any;
          }
        }

        // Buscar todos os formulários (ativos e inativos) para verificar quais passos estão ocupados
        const { data: allForms } = await supabase
          .from('admin_forms')
          .select('onboard_step, is_active')
          .eq('form_type', 'onboarding')
          .not('onboard_step', 'is', null);

        const occupiedSteps = new Set<number>();
        const activeSteps = new Set<number>();
        
        if (allForms) {
          allForms.forEach((f: any) => {
            if (f.onboard_step) {
              occupiedSteps.add(f.onboard_step);
              if (f.is_active) {
                activeSteps.add(f.onboard_step);
              }
            }
          });
        }

        // Lista de passos estáticos possíveis
        const staticSteps = [2, 3, 6, 7, 8];
        
        // Verificar quais passos estáticos estão disponíveis
        const availableStaticSteps: number[] = [];
        for (const stepNum of staticSteps) {
          // Se há um formulário dinâmico neste passo, o estático não está disponível
          if (occupiedSteps.has(stepNum)) {
            continue;
          }
          
          // Verificações específicas para cada passo estático
          if (stepNum === 2) {
            // Passo 2 (preview) só está disponível se tiver categoryId
            if (categoryId) {
              availableStaticSteps.push(stepNum);
            }
          } else {
            // Passos 3, 6, 7, 8 estão sempre disponíveis se não houver formulário dinâmico
            availableStaticSteps.push(stepNum);
          }
        }

        // Combinar passos dinâmicos ativos + passos estáticos disponíveis
        const allActiveSteps = new Set<number>();
        
        // Adicionar passos dinâmicos ativos
        if (activeForms) {
          activeForms.forEach((f: any) => {
            if (f.onboard_step) {
              allActiveSteps.add(f.onboard_step);
            }
          });
        }
        
        // Adicionar passos estáticos disponíveis
        availableStaticSteps.forEach(step => allActiveSteps.add(step));

        // Calcular total de passos ativos
        const totalSteps = allActiveSteps.size || 1;
        
        // Calcular porcentagem baseada no passo atual
        // Progresso mostra quanto já foi completado: passo 1 = início, último passo = 100%
        let percentage = 0;
        if (totalSteps === 0) {
          percentage = 0;
        } else if (totalSteps === 1) {
          // Se há apenas 1 passo e estamos nele, mostrar 100%
          percentage = currentStep >= 1 ? 100 : 0;
        } else {
          // Ordenar passos ativos
          const sortedSteps = Array.from(allActiveSteps).sort((a, b) => a - b);
          
          // Encontrar a posição do passo atual na sequência
          // Se o passo atual está na lista, usar sua posição
          // Se não está, encontrar o passo mais próximo menor ou igual
          let currentIndex = sortedSteps.findIndex(step => step === currentStep);
          if (currentIndex === -1) {
            // Encontrar o último passo menor ou igual ao atual
            for (let i = sortedSteps.length - 1; i >= 0; i--) {
              if (sortedSteps[i] <= currentStep) {
                currentIndex = i;
                break;
              }
            }
            // Se não encontrou nenhum passo menor, estamos antes do primeiro passo
            if (currentIndex === -1) {
              currentIndex = 0;
            }
          }
          
          // Calcular porcentagem: primeiro passo = ~0%, último passo = 100%
          // Usar (currentIndex + 1) / totalSteps para mostrar progresso até o passo atual
          percentage = Math.min(100, ((currentIndex + 1) / sortedSteps.length) * 100);
        }

        if (mounted) {
          setProgress({
            totalSteps,
            currentStep,
            percentage: Math.round(percentage),
            loading: false,
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Erro ao calcular progresso do onboarding:', error);
        if (mounted) {
          setProgress({
            totalSteps: 1,
            currentStep,
            percentage: 0,
            loading: false,
          });
        }
      }
    }

    void calculateProgress();

    return () => {
      mounted = false;
    };
  }, [currentStep, categoryId]);

  return progress;
}

