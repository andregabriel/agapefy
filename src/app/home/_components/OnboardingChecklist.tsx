"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, MessageSquareText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRoutinePlaylist } from '@/hooks/useRoutinePlaylist';

// Feature flag: checklist escondida na home (pode ser reativada futuramente)
const ONBOARDING_CHECKLIST_ENABLED = false;

interface FormStep {
  id: string;
  name: string;
  onboard_step: number;
}

interface ChecklistItem {
  key: string;
  label: string;
  stepNumber: number;
  completed: boolean;
  isWhatsApp?: boolean;
}

export default function OnboardingChecklist() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const { routinePlaylist } = useRoutinePlaylist();

  useEffect(() => {
    if (!ONBOARDING_CHECKLIST_ENABLED) {
      setItems([]);
      setLoading(false);
      return;
    }

    let aborted = false;
    async function load() {
      try {
        if (!user) {
          if (!aborted) setItems([]);
          return;
        }

        const res = await fetch('/api/onboarding/checklist', { headers: { 'x-user-id': user.id } });
        if (!res.ok) {
          if (!aborted) setItems([]);
          return;
        }
        const json = await res.json();
        const apiItems: ChecklistItem[] = (json?.steps || []).map((s: any) => ({
          key: `step-${s.stepNumber}`,
          label: String(s.label || `Passo ${s.stepNumber}`),
          stepNumber: Number(s.stepNumber),
          completed: Boolean(s.completed),
          isWhatsApp: s.stepNumber === 3 || s.stepNumber === 7,
        }));

        // Garantir exibição ordenada e presença dos 8 passos
        const normalized = Array.from({ length: 8 }, (_, i) => i + 1).map((n) => {
          const found = apiItems.find((x) => x.stepNumber === n);
          if (found) return found;
          return { key: `step-${n}`, label: `Passo ${n}`, stepNumber: n, completed: true } as ChecklistItem;
        });

        if (!aborted) setItems(normalized);
      } catch {
        if (!aborted) setItems([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    void load();
    return () => { aborted = true; };
  }, [user, routinePlaylist]);

  const pendingItems = useMemo(() => items.filter(i => !i.completed), [items]);
  const nextStep = useMemo(() => pendingItems[0]?.stepNumber, [pendingItems]);

  if (!ONBOARDING_CHECKLIST_ENABLED) return null;
  if (loading) return null;
  if (!items.length) return null;
  // Não mostrar se tudo completo
  if (pendingItems.length === 0) return null;

  const goToNext = () => {
    if (!nextStep) return;
    router.push(`/onboarding?step=${nextStep}`);
  };

  return (
    <Card className="bg-gray-900 border border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <MessageSquareText className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-200">Você tem etapas de configuração pendentes</p>
              <Button size="sm" variant="secondary" onClick={goToNext}>
                Continuar
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {items.map(item => (
                <div key={item.key} className="flex items-center gap-2">
                  {item.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-500" />
                  )}
                  <span className={item.completed ? 'text-white line-through text-sm' : 'text-gray-200 text-sm'}>
                    {item.label}
                  </span>
                  {!item.completed && (
                    <span className="ml-2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 uppercase tracking-wide">
                      Faltando
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

