"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { saveFormResponse } from '@/lib/services/forms';
import { useAuth } from '@/contexts/AuthContext';

interface FormOption { label: string; category_id: string }
interface AdminForm { id: string; name: string; description?: string; schema: FormOption[]; onboard_step?: number | null }

export default function PublicFormPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const formId = useMemo(() => (params?.id as string) || '', [params]);
  const [form, setForm] = useState<AdminForm | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const nextUrl = formId ? `/forms/${formId}` : '/forms';
      router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
    }
  }, [loading, user, router, formId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from('admin_forms')
        .select('*')
        .eq('id', formId)
        .maybeSingle();
      if (mounted) setForm((data as AdminForm) || null);
    }
    if (formId && user) void load();
    return () => { mounted = false; };
  }, [formId, user]);

  async function submit() {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }
    if (!form || !selected) {
      toast.error('Selecione uma opção');
      return;
    }
    try {
      setSubmitting(true);
      await saveFormResponse({ formId: form.id, answers: { option: selected }, userId: user.id });
      toast.success('Resposta enviada');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível enviar');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user || !form) return null;

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

