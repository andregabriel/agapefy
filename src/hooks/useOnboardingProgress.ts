import { useEffect, useState } from 'react';
import { getOnboardingStepsOrder } from '@/lib/services/onboarding-steps';

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
        const steps = await getOnboardingStepsOrder();

        // Filtrar passos ativos e considerar a regra do preview (precisa de categoria)
        let activeSteps = steps.filter((s) => s.isActive);
        activeSteps = activeSteps.filter((s) => {
          if (s.type === 'static' && s.staticKind === 'preview') {
            return Boolean(categoryId);
          }
          return true;
        });

        // Ordenar por posição e calcular total
        const sorted = activeSteps.sort((a, b) => a.position - b.position);
        const totalSteps = sorted.length || 1;
        
        // Calcular porcentagem baseada no passo atual
        // Progresso mostra quanto já foi completado: passo 1 = início, último passo = 100%
        let percentage = 0;
        if (totalSteps === 0) {
          percentage = 0;
        } else if (totalSteps === 1) {
          // Se há apenas 1 passo e estamos nele, mostrar 100%
          percentage = currentStep >= 1 ? 100 : 0;
        } else {
          // Encontrar a posição do passo atual na sequência
          // Se o passo atual está na lista, usar sua posição
          // Se não está, encontrar o passo mais próximo menor ou igual
          let currentIndex = sorted.findIndex(step => step.position === currentStep);
          if (currentIndex === -1) {
            // Encontrar o último passo menor ou igual ao atual
            for (let i = sorted.length - 1; i >= 0; i--) {
              if (sorted[i].position <= currentStep) {
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
          percentage = Math.min(100, ((currentIndex + 1) / sorted.length) * 100);
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
