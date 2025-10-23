"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { saveFormResponse } from '@/lib/services/forms';
import { useAuth } from '@/contexts/AuthContext';

interface FormOption { label: string; category_id: string }
interface AdminForm { id: string; name: string; description?: string; schema: FormOption[]; onboard_step?: number | null }

export default function OnboardingPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const desiredStep = useMemo(() => {
    const stepParam = searchParams?.get('step');
    const parsed = stepParam ? Number(stepParam) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [searchParams]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('admin_forms')
          .select('*')
          .eq('form_type', 'onboarding')
          .eq('is_active', true)
          .eq('onboard_step', desiredStep)
          .maybeSingle();
        if (error) throw error;
        if (mounted) setForm((data as AdminForm) || null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        toast.error('Onboarding não disponível no momento');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [desiredStep]);

  async function submit() {
    if (!form || !selected) {
      toast.error('Selecione uma opção');
      return;
    }
    try {
      setSubmitting(true);
      await saveFormResponse({ formId: form.id, answers: { option: selected }, userId: user?.id ?? null });
      toast.success('Resposta enviada');
      // Se houver próximos passos, tentar avançar automaticamente
      const nextStep = (form.onboard_step || desiredStep) + 1;
      // Verificar se existe próximo formulário; se não existir, redirecionar para home
      const { data } = await supabase
        .from('admin_forms')
        .select('id')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .eq('onboard_step', nextStep)
        .maybeSingle();
      if (data) {
        router.replace(`/onboarding?step=${nextStep}`);
      } else {
        router.replace('/');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast.error('Não foi possível enviar');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!form) return null;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{form.name}</CardTitle>
            {typeof form.onboard_step === 'number' && (
              <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo {form.onboard_step}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.description && (
            <p className="text-gray-400">{form.description}</p>
          )}

          <div className="space-y-2">
            {form.schema?.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-3">
                <Input
                  type="radio"
                  name="option"
                  checked={selected === opt.category_id}
                  onChange={() => setSelected(opt.category_id)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


