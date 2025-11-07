'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FileText, Plus, Trash, Play, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface OnboardForm {
  id: string;
  name: string;
  description?: string;
  form_type?: string;
  created_at: string;
  onboard_step?: number | null;
  is_active?: boolean;
}

export default function FormsManagement() {
  const [forms, setForms] = useState<OnboardForm[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    async function fetchForms() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('admin_forms')
          .select('*')
          // Ordena primeiro por passo do onboard (nulos primeiro), depois por data de criação mais antiga
          .order('onboard_step', { ascending: true, nullsFirst: true })
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (isMounted) setForms((data || []) as unknown as OnboardForm[]);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        toast.error('Erro ao carregar formulários');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void fetchForms();
    return () => { isMounted = false; };
  }, []);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Forms</h1>
            <p className="text-gray-500">Gerencie formulários administrativos, como o onboarding.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
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
              }}
              disabled={resetting}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {resetting ? 'Resetando...' : 'Resetar minhas respostas'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                window.open('/onboarding?step=1', '_blank');
              }}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Testar Onboarding
            </Button>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-gray-600">Formulário de Onboard</CardTitle>
            <CardDescription>Crie perguntas e fluxo para onboarding de usuários</CardDescription>
          </div>
          <Button size="sm" className="gap-2" onClick={async () => {
            try {
              setLoading(true);
              const { data, error } = await supabase
                .from('admin_forms')
                .insert({ name: 'Novo formulário', description: '', form_type: 'onboarding', schema: [] })
                .select('*')
                .single();
              if (error) throw error;
              const created = data as unknown as OnboardForm & { id: string };
              router.push(`/admin/forms/${created.id}`);
            } catch (e) {
              console.error(e);
              toast.error('Não foi possível criar o formulário');
            } finally {
              setLoading(false);
            }
          }} disabled={loading}>
            <Plus className="h-4 w-4" />
            {loading ? 'Criando...' : 'Novo formulário'}
          </Button>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Nenhum formulário criado ainda.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {forms.map((form) => (
                <li key={form.id} className="py-3 flex items-center justify-between gap-3">
                  <Link href={`/admin/forms/${form.id}`} className="flex-1 min-w-0">
                    <div>
                      <p className="font-medium text-gray-900 hover:underline">{form.name}</p>
                      {form.description && (
                        <p className="text-sm text-gray-500 truncate">{form.description}</p>
                      )}
                    </div>
                  </Link>
                  <div className="text-sm text-gray-400 ml-4 whitespace-nowrap flex items-center gap-3">
                    {typeof form.onboard_step === 'number' && (
                      <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-200">Passo {form.onboard_step}</span>
                    )}
                    <span>{new Date(form.created_at).toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Ativo</span>
                      <Switch
                        checked={form.is_active ?? true}
                        onCheckedChange={async (checked) => {
                          try {
                            setForms(prev => prev.map(f => f.id === form.id ? { ...f, is_active: checked } : f));
                            const { error } = await supabase
                              .from('admin_forms')
                              .update({ is_active: checked })
                              .eq('id', form.id);
                            if (error) throw error;
                          } catch (e) {
                            console.error(e);
                            toast.error('Não foi possível atualizar');
                            setForms(prev => prev.map(f => f.id === form.id ? { ...f, is_active: !(checked) } : f));
                          }
                        }}
                        aria-label={`Alternar ativo para ${form.name}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          if (!confirm(`Deseja realmente excluir o formulário "${form.name}"?`)) return;
                          const { error } = await supabase
                            .from('admin_forms')
                            .delete()
                            .eq('id', form.id);
                          if (error) throw error;
                          setForms(prev => prev.filter(f => f.id !== form.id));
                          toast.success('Formulário excluído');
                        } catch (e) {
                          console.error(e);
                          toast.error('Não foi possível excluir');
                        }
                      }}
                      aria-label={`Excluir ${form.name}`}
                      title="Excluir"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


