"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface AdminForm {
  id: string;
  name: string;
  description?: string;
  form_type?: string;
  schema: Array<{ label: string; category_id: string }>;
  created_at: string;
  onboard_step?: number | null;
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
      } catch (e) {
        console.error(e);
        toast.error('Formulário não encontrado');
      }
    }
    if (formId) void load();
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

      {/* Preview */}
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

            {(form?.schema?.length || 0) > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form?.schema?.map((opt, idx) => {
                  const active = previewSelected === idx;
                  const base = 'w-full rounded-md border px-4 py-3 text-left transition-colors';
                  const normal = 'border-gray-800 bg-transparent hover:bg-gray-800/50';
                  const selected = 'border-blue-500 bg-gray-800';
                  return (
                    <button
                      key={idx}
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
            ) : (
              <p className="text-sm text-gray-500">Nenhuma opção adicionada ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


