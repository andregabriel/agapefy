"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';

interface InfoStepEditorProps {
  form: {
    id: string;
    name: string;
    description?: string;
    schema: any;
    onboard_step?: number | null;
  };
  onSaved: () => void;
  onCancel: () => void;
}

export default function InfoStepEditor({ form, onSaved, onCancel }: InfoStepEditorProps) {
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState(form.name || '');
  
  // Extrair dados do schema (formato: { type: 'info', title, subtitle, explanation, buttonText })
  const infoData = form.schema && form.schema[0] && form.schema[0].type === 'info' 
    ? form.schema[0] 
    : { type: 'info', title: '', subtitle: '', explanation: '', buttonText: 'Começar agora →' };
  
  const [title, setTitle] = useState(infoData.title || '');
  const [subtitle, setSubtitle] = useState(infoData.subtitle || '');
  const [explanation, setExplanation] = useState(infoData.explanation || '');
  const [buttonText, setButtonText] = useState(infoData.buttonText || 'Começar agora →');

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('O nome do passo é obrigatório');
      return;
    }
    if (!title.trim()) {
      toast.error('O título é obrigatório');
      return;
    }

    try {
      setSaving(true);
      
      const updateData: any = {
        name: formName.trim(),
        description: form.description || null,
        onboard_step: form.onboard_step,
        schema: [{
          type: 'info',
          title: title.trim(),
          subtitle: subtitle.trim(),
          explanation: explanation.trim(),
          buttonText: buttonText.trim() || 'Começar agora →',
        }],
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
      
      toast.success('Passo informativo atualizado');
      onSaved();
    } catch (e: any) {
      console.error('Erro ao salvar passo informativo:', e);
      toast.error(`Não foi possível salvar: ${e.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Editar Passo Informativo</h4>
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
        {/* Nome do passo */}
        <div>
          <Label htmlFor="info-name">Nome do Passo</Label>
          <Input
            id="info-name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ex.: Passo 2 – Contexto espiritual"
          />
        </div>

        {/* Título */}
        <div>
          <Label htmlFor="info-title">Título</Label>
          <Input
            id="info-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: A oração é onde o coração encontra direção 🙏"
          />
        </div>

        {/* Subtítulo */}
        <div>
          <Label htmlFor="info-subtitle">Subtítulo</Label>
          <Textarea
            id="info-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Ex.: Quando você fala com Deus sobre o que sente, o coração se acalma e a fé se fortalece."
            rows={2}
          />
        </div>

        {/* Explicação */}
        <div>
          <Label htmlFor="info-explanation">Explicação</Label>
          <Textarea
            id="info-explanation"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Ex.: Criamos uma série de orações guiadas para te ajudar a conversar com Deus sobre [tema escolhido] — um tempo especial para refletir, se fortalecer e renovar a esperança."
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-1">
            Você pode usar {"{tema escolhido}"} ou {"{category}"} para inserir dinamicamente o tema/categoria selecionada.
          </p>
        </div>

        {/* Texto do botão */}
        <div>
          <Label htmlFor="info-button">Texto do Botão</Label>
          <Input
            id="info-button"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Ex.: Começar agora →"
          />
        </div>
      </div>
    </div>
  );
}

