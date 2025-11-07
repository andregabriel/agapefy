"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Habilita o preview no editor de formulário
const ENABLE_FORM_PREVIEW = true;

interface AdminForm {
  id: string;
  name: string;
  description?: string;
  form_type?: string;
  schema: Array<{ label: string; category_id: string; playlist_id?: string }>;
  created_at: string;
  onboard_step?: number | null;
  allow_other_option?: boolean;
  other_option_label?: string | null;
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
  const [playlists, setPlaylists] = useState<Array<{ id: string; title: string; category_id: string | null }>>([]);
  const [newOption, setNewOption] = useState<{ label: string; category_id: string; playlist_id?: string }>({ label: '', category_id: '' });
  const [previewSelected, setPreviewSelected] = useState<number | null>(null);
  const [allSteps, setAllSteps] = useState<OnboardingStepSummary[]>([]);
  const [loadingSteps, setLoadingSteps] = useState<boolean>(false);
  const [isActiveRootForm, setIsActiveRootForm] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingOption, setEditingOption] = useState<{ label: string; category_id: string; playlist_id?: string }>({ label: '', category_id: '' });
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

  // Carregar playlists públicas para seleção
  useEffect(() => {
    let mounted = true;
    async function loadPlaylists() {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id,title,category_id')
          .eq('is_public', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (mounted) setPlaylists((data as any[])?.map(p => ({ id: p.id, title: p.title, category_id: p.category_id })) || []);
      } catch (e) {
        console.error('Erro ao carregar playlists', e);
      }
    }
    void loadPlaylists();
    return () => { mounted = false; };
  }, []);

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
      
      // Preparar dados para update, tentando incluir os novos campos apenas se existirem
      const updateData: any = {
        name: form.name,
        description: form.description,
        schema: form.schema,
        onboard_step: form.onboard_step,
      };

      // Tentar adicionar os novos campos (pode falhar se as migrations não foram executadas)
      try {
        updateData.allow_other_option = form.allow_other_option || false;
        updateData.other_option_label = form.other_option_label || null;
      } catch {
        // Ignorar se os campos não existirem ainda
      }

      const { error } = await supabase
        .from('admin_forms')
        .update(updateData)
        .eq('id', form.id);
        
      if (error) {
        // Se o erro for sobre coluna não existente, tentar sem os novos campos
        if (error.code === '42703' || error.message?.includes('allow_other_option') || error.message?.includes('other_option_label')) {
          console.warn('Campos allow_other_option/other_option_label não encontrados, salvando sem eles');
          const { error: retryError } = await supabase
            .from('admin_forms')
            .update({
              name: form.name,
              description: form.description,
              schema: form.schema,
              onboard_step: form.onboard_step,
            })
            .eq('id', form.id);
          
          if (retryError) throw retryError;
          toast.success('Formulário atualizado (alguns campos não estão disponíveis ainda)');
          return;
        }
        throw error;
      }
      
      toast.success('Formulário atualizado');
    } catch (e: any) {
      console.error('Erro ao salvar formulário:', e);
      const code = e?.code || e?.cause?.code || (e as any)?.code;
      const message = e?.message || String(e);
      
      if (String(code) === '23505') {
        toast.error('Já existe outro formulário com o mesmo "Número do passo". Escolha outro número.');
      } else if (code === '42703' || message?.includes('column') || message?.includes('does not exist')) {
        toast.error('Alguns campos não estão disponíveis. Execute as migrations SQL primeiro.');
        console.error('Detalhes do erro:', { code, message, error: e });
      } else {
        toast.error(`Não foi possível salvar: ${message || 'Erro desconhecido'}`);
        console.error('Erro completo:', e);
      }
    } finally {
      setSaving(false);
    }
  }

  function addOption() {
    if (!form) return;
    if (editingIndex !== null) {
      // Se está editando, salvar a edição
      saveEdit();
      return;
    }
    if (!newOption.label.trim() || !newOption.category_id) {
      toast.error('Informe o texto e a playlist');
      return;
    }
    setForm({ ...form, schema: [...(form.schema || []), { ...newOption }] });
    setNewOption({ label: '', category_id: '' });
  }

  function editOption(index: number) {
    if (!form || !form.schema) return;
    const opt = form.schema[index];
    setEditingIndex(index);
    setEditingOption({
      label: opt.label || '',
      category_id: opt.category_id || '',
      playlist_id: (opt as any).playlist_id || '',
    });
    // Preencher os campos de input com os valores da opção sendo editada
    setNewOption({
      label: opt.label || '',
      category_id: opt.category_id || '',
      playlist_id: (opt as any).playlist_id || '',
    });
  }

  function saveEdit() {
    if (!form || editingIndex === null) return;
    if (!editingOption.label.trim() || !editingOption.category_id) {
      toast.error('Informe o texto e a playlist');
      return;
    }
    const copy = [...(form.schema || [])];
    copy[editingIndex] = { ...editingOption };
    setForm({ ...form, schema: copy });
    setEditingIndex(null);
    setEditingOption({ label: '', category_id: '' });
    setNewOption({ label: '', category_id: '' });
    toast.success('Opção atualizada');
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditingOption({ label: '', category_id: '' });
    setNewOption({ label: '', category_id: '' });
  }

  function removeOption(index: number) {
    if (!form) return;
    if (editingIndex === index) {
      cancelEdit();
    }
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

          {/* Campo "Outros" */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-semibold">Permitir campo "Outros"</p>
                <p className="text-sm text-gray-500">Permite que usuários preencham manualmente uma opção customizada</p>
              </div>
              <Switch
                checked={form?.allow_other_option || false}
                onCheckedChange={(checked) => setForm(prev => prev ? { ...prev, allow_other_option: checked } : prev)}
              />
            </div>
            {form?.allow_other_option && (
              <div>
                <p className="font-semibold mb-2">Label do campo "Outros"</p>
                <Input
                  placeholder="Outros"
                  value={form?.other_option_label || ''}
                  onChange={e => setForm(prev => prev ? { ...prev, other_option_label: e.target.value || null } : prev)}
                />
                <p className="text-xs text-gray-500 mt-1">Deixe em branco para usar "Outros" como padrão</p>
              </div>
            )}
          </div>

          {/* Opções: Texto do botão + Playlist (gravando a categoria da playlist para compatibilidade) */}
          {editingIndex !== null && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-2">
              <p className="text-sm font-semibold text-blue-900 mb-2">Editando opção {editingIndex + 1}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold mb-2">Texto da caixa de seleção</p>
              <Input
                placeholder="Inserir texto"
                value={newOption.label}
                onChange={e => {
                  setNewOption(prev => ({ ...prev, label: e.target.value }));
                  if (editingIndex !== null) {
                    setEditingOption(prev => ({ ...prev, label: e.target.value }));
                  }
                }}
              />
            </div>
            <div>
              <p className="font-semibold mb-2">Selecionar Playlist</p>
              <Input
                list="playlists-list"
                placeholder="Busque pelo nome da playlist"
                value={(() => playlists.find(p => p.id === (newOption as any).playlist_id)?.title || '')()}
                onChange={e => {
                  const match = playlists.find(p => (p.title || '').toLowerCase() === e.target.value.toLowerCase());
                  const updated = {
                    category_id: match?.category_id || '',
                    playlist_id: match?.id || '',
                  };
                  setNewOption(prev => ({ ...prev, ...updated }));
                  if (editingIndex !== null) {
                    setEditingOption(prev => ({ ...prev, ...updated }));
                  }
                }}
              />
              <datalist id="playlists-list">
                {playlists.map(p => (
                  <option key={p.id} value={p.title || ''} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editingIndex !== null ? (
              <>
                <Button type="button" variant="default" onClick={saveEdit}>Salvar edição</Button>
                <Button type="button" variant="ghost" onClick={cancelEdit}>Cancelar</Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={addOption}>Adicionar texto + playlist</Button>
            )}
          </div>

          {/* Lista de opções adicionadas */}
          {form?.schema && form.schema.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-sm font-semibold text-gray-700 mb-2">Opções adicionadas:</p>
              {form.schema.map((opt, idx) => (
                <div key={idx} className={`flex items-center justify-between rounded border p-3 ${editingIndex === idx ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-900">{opt.label || `Opção ${idx + 1}`}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-700">{(() => {
                      const pl = playlists.find(p => p.id === (opt as any).playlist_id);
                      if (pl) return pl.title;
                      const cat = categories.find(c => c.id === opt.category_id);
                      return cat?.name || 'Playlist não selecionada';
                    })()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => editOption(idx)}
                      disabled={editingIndex !== null && editingIndex !== idx}
                    >
                      Editar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeOption(idx)}
                      disabled={editingIndex !== null && editingIndex !== idx}
                    >
                      Remover
                    </Button>
                  </div>
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
                <p className="text-xl font-bold text-gray-900">{form?.name || 'Título do formulário'}</p>
                {form?.description && (
                  <p className="text-base text-gray-700 mt-3 font-medium leading-relaxed">{form.description}</p>
                )}
              </div>

              {form?.schema && form.schema.length > 0 && (
                <div className="pt-2">
                  <p className="text-base font-semibold text-gray-800 mb-3">Marque a opção que você está mais precisando neste momento:</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form?.schema?.filter(opt => (opt?.label || '').trim()).map((opt, idx) => {
                  const active = previewSelected === idx;
                  const base = 'w-full rounded-md border px-4 py-3 text-left transition-colors';
                  const normal = 'border-gray-300 bg-white hover:bg-gray-50 shadow-sm';
                  const selected = 'border-blue-500 bg-blue-50 shadow-md';
                  return (
                    <button
                      key={`${opt.category_id}-${idx}`}
                      type="button"
                      onClick={() => setPreviewSelected(idx)}
                      className={`${base} ${active ? selected : normal}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-5 w-5 rounded-full border-2 flex-shrink-0 ${active ? 'border-blue-500 bg-blue-500' : 'border-gray-400'}`}>
                          {active && <span className="w-full h-full flex items-center justify-center text-white text-xs">✓</span>}
                        </span>
                        <span className="text-base font-medium text-gray-900">{opt.label}</span>
                      </div>
                    </button>
                  );
                })}
                {form?.allow_other_option && (
                  <div className="w-full rounded-md border border-gray-300 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-5 w-5 rounded-full border-2 border-gray-400 flex-shrink-0"></span>
                      <span className="text-base font-medium text-gray-900">{form?.other_option_label || 'Outros'}</span>
                    </div>
                    <Input 
                      placeholder="Digite sua opção..." 
                      className="mt-2" 
                      disabled 
                    />
                  </div>
                )}
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
                <div key={step.id} className="flex items-center justify-between rounded border border-gray-300 bg-gray-50 p-4 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-gray-900 min-w-[60px]">Passo {step.onboard_step ?? '-'}</span>
                    <span className="text-base font-semibold text-gray-800">{step.name}</span>
                    {typeof step.is_active === 'boolean' && (
                      <span className={`text-xs font-medium px-2 py-1 rounded ${step.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{step.is_active ? 'Ativo' : 'Inativo'}</span>
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
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Abrir
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => router.push(`/admin/forms/${step.id}`)}
                      className="font-medium text-gray-700 hover:text-gray-900"
                    >
                      Abrir
                    </Button>
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


