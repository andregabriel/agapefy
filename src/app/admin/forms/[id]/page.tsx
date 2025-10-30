"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Desabilita o preview no editor de formulário
const ENABLE_FORM_PREVIEW = false;

interface AdminForm {
  id: string;
  name: string;
  description?: string;
  form_type?: string;
  schema: Array<{ label: string; category_id: string }>;
  created_at: string;
  onboard_step?: number | null;
}

interface OnboardingStepSummary {
  id: string;
  name: string;
  onboard_step: number | null;
  is_active?: boolean | null;
}

export default function FormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const formId = useMemo(() => (params?.id as string) || '', [params]);
  const [form, setForm] = useState<AdminForm | null>(null);
  const [saving, setSaving] = useState(false);
  const { categories } = useCategories();
  const [newOption, setNewOption] = useState<{ label: string; category_id: string }>({ label: '', category_id: '' });
  const [previewSelected, setPreviewSelected] = useState<number | null>(null);
  const [allSteps, setAllSteps] = useState<OnboardingStepSummary[]>([]);
  const [loadingSteps, setLoadingSteps] = useState<boolean>(false);
  const [isActiveRootForm, setIsActiveRootForm] = useState<boolean>(false);
  const hasPreview = useMemo(() => {
    const items = form?.schema || [];
    return items.some(opt => (opt?.label || '').trim().length > 0);
  }, [form?.schema]);

  async function addNewStep(kind: 'multiple_choice' | 'short_text') {
    try {
      // Calcular próximo passo após os nativos (1 é formulário; 2 e 3 são virtuais)
      const dbSteps = allSteps.filter(s => typeof s.onboard_step === 'number');
      const maxDb = dbSteps.reduce((acc, s) => Math.max(acc, s.onboard_step || 0), 3);
      const nextStep = Math.max(3, maxDb) + 1;

      const base: any = {
        name: `Etapa ${nextStep}`,
        description: '',
        form_type: 'onboarding',
        is_active: true,
        onboard_step: nextStep,
        parent_form_id: formId,
      };
      if (kind === 'short_text') {
        (base as any).schema = [{ type: 'short_text' }];
      } else {
        (base as any).schema = [];
      }

      // Try insert with parent_form_id; if the column doesn't exist yet, fallback without it
      const attemptInsert = async (payload: any) =>
        supabase.from('admin_forms').insert(payload).select('id').single();

      let resp = await attemptInsert(base);
      if (
        resp.error &&
        (resp.error.code === '42703' || /parent_form_id/i.test(String(resp.error.message || '')))
      ) {
        // Column not available in the target database – retry without it
        delete (base as any).parent_form_id;
        resp = await attemptInsert(base);
      }
      if (resp.error) throw resp.error;
      const createdId = ((resp.data as any) || {}).id as string;
      toast.success(`Etapa ${nextStep} criada`);
      router.push(`/admin/forms/${createdId}`);
    } catch (e) {
      console.error('Erro ao criar nova etapa:', e);
      toast.error('Não foi possível criar a etapa');
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data, error } = await supabase
          .from('admin_forms')
          .select('*')
          .eq('id', formId)
          .maybeSingle();
        if (error) throw error;
        if (mounted) setForm((data as AdminForm) || null);
        // Detectar se este é o formulário raiz ativo (onboard_step = 1, is_active = true)
        try {
          const { data: root } = await supabase
            .from('admin_forms')
            .select('id')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .eq('onboard_step', 1)
            .maybeSingle();
          if (mounted) setIsActiveRootForm(Boolean(root && (root as any).id === formId));
        } catch {}
      } catch (e) {
        console.error(e);
        toast.error('Formulário não encontrado');
      }
    }
    if (formId) void load();
    return () => { mounted = false; };
  }, [formId]);

  // Carregar todas as etapas deste formulário (por parent_form_id)
  useEffect(() => {
    let mounted = true;
    async function loadSteps() {
      try {
        setLoadingSteps(true);
        // Limpar etapas anteriores imediatamente ao trocar de formulário
        setAllSteps([]);
        // Primary query: children linked via parent_form_id
        let { data, error } = await supabase
          .from('admin_forms')
          .select('id, name, onboard_step, is_active')
          .eq('form_type', 'onboarding')
          .eq('parent_form_id', formId)
          .not('onboard_step', 'is', null)
          .order('onboard_step', { ascending: true });

        // Fallback for environments where parent_form_id doesn't exist yet
        if (error && (error.code === '42703' || /parent_form_id/i.test(String(error.message || '')))) {
          const fallback = await supabase
            .from('admin_forms')
            .select('id, name, onboard_step, is_active')
            .eq('form_type', 'onboarding')
            .gte('onboard_step', 2)
            .order('onboard_step', { ascending: true });
          data = fallback.data as any;
          error = fallback.error as any;
        }

        if (error) throw error;
        if (mounted) setAllSteps(((data as any) || []) as unknown as OnboardingStepSummary[]);
      } catch (e) {
        console.error('Erro ao carregar etapas:', e);
      } finally {
        if (mounted) setLoadingSteps(false);
      }
    }
    if (formId) void loadSteps();
    return () => { mounted = false; };
  }, [formId]);

  async function save() {
    if (!form) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('admin_forms')
        .update({ name: form.name, description: form.description, schema: form.schema, onboard_step: form.onboard_step })
        .eq('id', form.id);
      if (error) throw error;
      toast.success('Formulário atualizado');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  function addOption() {
    if (!form) return;
    if (!newOption.label.trim() || !newOption.category_id) {
      toast.error('Informe o texto e a categoria');
      return;
    }
    setForm({ ...form, schema: [...(form.schema || []), { ...newOption }] });
    setNewOption({ label: '', category_id: '' });
  }

  function removeOption(index: number) {
    if (!form) return;
    const copy = [...(form.schema || [])];
    copy.splice(index, 1);
    setForm({ ...form, schema: copy });
  }

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/admin/forms')}>Voltar</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">Editar formulário</CardTitle>
          <CardDescription>Atualize o título, a descrição e adicione botões (texto + categoria).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={form?.name || ''}
            onChange={e => setForm(prev => prev ? { ...prev, name: e.target.value } : prev)}
            placeholder="Ex.: Onboarding 2025"
          />
          <Textarea
            value={form?.description || ''}
            onChange={e => setForm(prev => prev ? { ...prev, description: e.target.value } : prev)}
            placeholder="Explique o objetivo do formulário"
          />
          {/* Passo do onboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="font-semibold mb-2">Número do passo (onboarding)</p>
              <Input
                type="number"
                min={1}
                placeholder="1"
                value={form?.onboard_step ?? ''}
                onChange={e => setForm(prev => prev ? { ...prev, onboard_step: e.target.value ? Number(e.target.value) : null } : prev)}
              />
            </div>
          </div>

          {/* Opções: Texto do botão + Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold mb-2">Texto da caixa de seleção</p>
              <Input
                placeholder="Inserir texto"
                value={newOption.label}
                onChange={e => setNewOption(prev => ({ ...prev, label: e.target.value }))}
              />
            </div>
            <div>
              <p className="font-semibold mb-2">Selecionar Categoria</p>
              <Input
                list="categories-list"
                placeholder="Busque pelo nome da categoria"
                value={(() => categories.find(c => c.id === newOption.category_id)?.name || '')()}
                onChange={e => {
                  const match = categories.find(c => (c.name || '').toLowerCase() === e.target.value.toLowerCase());
                  setNewOption(prev => ({ ...prev, category_id: match?.id || '' }));
                }}
              />
              <datalist id="categories-list">
                {categories.map(c => (
                  <option key={c.id} value={c.name || ''} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={addOption}>Adicionar texto + categoria</Button>
          </div>

          {/* Lista de opções adicionadas */}
          {form?.schema && form.schema.length > 0 && (
            <div className="mt-2 space-y-2">
              {form.schema.map((opt, idx) => (
                <div key={idx} className="flex items-center justify-between rounded border border-gray-800 p-3">
                  <div className="text-sm text-gray-300">
                    <span className="font-medium text-white mr-2">{opt.label}</span>
                    <span className="text-gray-400">→ {categories.find(c => c.id === opt.category_id)?.name || 'Categoria'}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeOption(idx)}>Remover</Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview (desativado por padrão) */}
      {ENABLE_FORM_PREVIEW && hasPreview && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Preview</CardTitle>
              <CardDescription>Como o usuário verá este formulário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-white">{form?.name || 'Título do formulário'}</p>
                {form?.description && (
                  <p className="text-gray-300 mt-3 text-xl font-medium">{form.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form?.schema?.filter(opt => (opt?.label || '').trim()).map((opt, idx) => {
                  const active = previewSelected === idx;
                  const base = 'w-full rounded-md border px-4 py-3 text-left transition-colors';
                  const normal = 'border-gray-800 bg-transparent hover:bg-gray-800/50';
                  const selected = 'border-blue-500 bg-gray-800';
                  return (
                    <button
                      key={`${opt.category_id}-${idx}`}
                      type="button"
                      onClick={() => setPreviewSelected(idx)}
                      className={`${base} ${active ? selected : normal}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-4 w-4 rounded-full border ${active ? 'border-blue-500 bg-blue-500' : 'border-gray-500'}`}></span>
                        <span className="text-sm text-white">{opt.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Etapas configuradas (somente leitura) */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-gray-600">Etapas do Onboarding</CardTitle>
                <CardDescription>Lista de etapas configuradas para referência. Clique para editar.</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">Adicionar etapa</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => addNewStep('multiple_choice')}>Selecionar múltipla escolha</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNewStep('short_text')}>Texto curto</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingSteps ? (
              <p className="text-sm text-gray-500">Carregando etapas...</p>
            ) : (() => {
              // Etapas vinculadas a este formulário + passos virtuais 2 e 3 somente para o formulário raiz (passo 1)
              const presentSteps = new Set(allSteps.map(s => s.onboard_step || 0));
              const isRootForm =
                isActiveRootForm ||
                ((form as any)?.parent_form_id == null && Number(form?.onboard_step) === 1);
              const extras: OnboardingStepSummary[] = [];
              if (isRootForm && !presentSteps.has(2)) extras.push({ id: 'virtual-step-2', name: 'Preview da Categoria', onboard_step: 2, is_active: true });
              if (isRootForm && !presentSteps.has(3)) extras.push({ id: 'virtual-step-3', name: 'Conectar WhatsApp', onboard_step: 3, is_active: true });
              const combined = [...allSteps, ...extras].sort((a, b) => (a.onboard_step || 0) - (b.onboard_step || 0));

              if (combined.length === 0) return <p className="text-sm text-gray-500">Nenhuma etapa configurada.</p>;

              return combined.map(step => (
                <div key={step.id} className="flex items-center justify-between rounded border border-gray-800 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">Passo {step.onboard_step ?? '-'}</span>
                    <span className="text-sm text-white">{step.name}</span>
                    {typeof step.is_active === 'boolean' && (
                      <span className={`text-xs ${step.is_active ? 'text-green-400' : 'text-gray-500'}`}>{step.is_active ? 'Ativo' : 'Inativo'}</span>
                    )}
                  </div>
                  {String(step.id).startsWith('virtual-step-') ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (step.onboard_step === 2) router.push('/admin/configuracoes#onboarding');
                        else if (step.onboard_step === 3) router.push('/admin/whatsIA');
                      }}
                    >
                      Abrir
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/forms/${step.id}`)}>Abrir</Button>
                  )}
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


