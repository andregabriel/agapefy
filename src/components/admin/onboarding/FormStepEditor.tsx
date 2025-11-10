"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';
import StepOptionEditor from './StepOptionEditor';

interface AdminForm {
  id: string;
  name: string;
  description?: string;
  schema: Array<{ label: string; category_id: string; playlist_id?: string }>;
  onboard_step?: number | null;
  allow_other_option?: boolean;
  other_option_label?: string | null;
}

interface FormStepEditorProps {
  form: AdminForm;
  onSaved: () => void;
  onCancel: () => void;
}

export default function FormStepEditor({ form, onSaved, onCancel }: FormStepEditorProps) {
  const { categories } = useCategories();
  const [playlists, setPlaylists] = useState<Array<{ id: string; title: string; category_id: string | null }>>([]);
  const [formData, setFormData] = useState<AdminForm>(form);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Carregar playlists
  useEffect(() => {
    async function loadPlaylists() {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id,title,category_id')
          .eq('is_public', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setPlaylists((data as any[])?.map(p => ({ id: p.id, title: p.title, category_id: p.category_id })) || []);
      } catch (e) {
        console.error('Erro ao carregar playlists', e);
      }
    }
    void loadPlaylists();
  }, []);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('O nome do formulário é obrigatório');
      return;
    }

    try {
      setSaving(true);
      
      const updateData: any = {
        name: formData.name,
        description: formData.description || null,
        schema: formData.schema,
        onboard_step: formData.onboard_step,
        allow_other_option: formData.allow_other_option || false,
        other_option_label: formData.other_option_label || null,
      };

      const { error } = await supabase
        .from('admin_forms')
        .update(updateData)
        .eq('id', form.id);
        
      if (error) {
        if (String(error.code) === '23505') {
          toast.error('Já existe outro formulário com o mesmo "Número do passo". Escolha outro número.');
        } else {
          throw error;
        }
        return;
      }
      
      toast.success('Formulário atualizado');
      onSaved();
    } catch (e: any) {
      console.error('Erro ao salvar formulário:', e);
      toast.error(`Não foi possível salvar: ${e.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddOption = (option: { label: string; category_id: string; playlist_id?: string }) => {
    setFormData(prev => ({
      ...prev,
      schema: [...(prev.schema || []), option]
    }));
    setEditingIndex(null);
  };

  const handleUpdateOption = (index: number, option: { label: string; category_id: string; playlist_id?: string }) => {
    const copy = [...(formData.schema || [])];
    copy[index] = option;
    setFormData(prev => ({ ...prev, schema: copy }));
    setEditingIndex(null);
  };

  const handleRemoveOption = (index: number) => {
    const copy = [...(formData.schema || [])];
    copy.splice(index, 1);
    setFormData(prev => ({ ...prev, schema: copy }));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Editar Formulário</h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Nome */}
        <div>
          <Label htmlFor="form-name">Nome do Formulário</Label>
          <Input
            id="form-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex.: O que mais você quer a benção de Deus, hoje?"
          />
        </div>

        {/* Descrição */}
        <div>
          <Label htmlFor="form-description">Descrição (opcional)</Label>
          <Textarea
            id="form-description"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Explique o objetivo do formulário"
            rows={3}
          />
        </div>

        {/* Número do passo */}
        <div>
          <Label htmlFor="form-step">Número do Passo</Label>
          <Input
            id="form-step"
            type="number"
            min={1}
            value={formData.onboard_step ?? ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              onboard_step: e.target.value ? Number(e.target.value) : null 
            }))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Passo 1 é o formulário raiz. Passos 4+ são formulários filhos.
          </p>
        </div>

        {/* Opções do schema */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Opções do Formulário</Label>
            {editingIndex === null && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingIndex(formData.schema?.length || 0)}
              >
                Adicionar Opção
              </Button>
            )}
          </div>

          {/* Lista de opções existentes */}
          {formData.schema && formData.schema.length > 0 && (
            <div className="space-y-2">
              {formData.schema.map((opt, idx) => (
                <div key={idx} className="p-3 bg-white rounded border border-gray-200">
                  {editingIndex === idx ? (
                    <StepOptionEditor
                      option={opt}
                      categories={categories}
                      playlists={playlists}
                      onSave={(option) => handleUpdateOption(idx, option)}
                      onCancel={() => setEditingIndex(null)}
                      onDelete={() => handleRemoveOption(idx)}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm text-gray-600">
                          {(() => {
                            const pl = playlists.find(p => p.id === (opt as any).playlist_id);
                            if (pl) return pl.title;
                            const cat = categories.find(c => c.id === opt.category_id);
                            return cat?.name || 'Categoria não selecionada';
                          })()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingIndex(idx)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOption(idx)}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Editor de nova opção */}
          {editingIndex === (formData.schema?.length || 0) && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <StepOptionEditor
                option={{ label: '', category_id: '' }}
                categories={categories}
                playlists={playlists}
                onSave={(option) => {
                  handleAddOption(option);
                }}
                onCancel={() => setEditingIndex(null)}
              />
            </div>
          )}
        </div>

        {/* Campo "Outros" */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Permitir campo "Outros"</Label>
              <p className="text-sm text-gray-500">
                Permite que usuários preencham manualmente uma opção customizada
              </p>
            </div>
            <Switch
              checked={formData.allow_other_option || false}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_other_option: checked }))}
            />
          </div>
          {formData.allow_other_option && (
            <div>
              <Label htmlFor="other-label">Label do campo "Outros"</Label>
              <Input
                id="other-label"
                placeholder="Outros"
                value={formData.other_option_label || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, other_option_label: e.target.value || null }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Deixe em branco para usar "Outros" como padrão
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

