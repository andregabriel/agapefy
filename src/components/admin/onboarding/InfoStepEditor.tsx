"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, X, Sparkles } from 'lucide-react';

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
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="info-title">Título</Label>
            {form.onboard_step && form.onboard_step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.getElementById('info-title') as HTMLInputElement;
                  if (input) {
                    const start = input.selectionStart || 0;
                    const end = input.selectionEnd || 0;
                    const newText = title.substring(0, start) + '{resposta1}' + title.substring(end);
                    setTitle(newText);
                    setTimeout(() => {
                      input.focus();
                      const newPos = start + '{resposta1}'.length;
                      input.setSelectionRange(newPos, newPos);
                    }, 0);
                  }
                }}
                className="h-7 text-xs"
                title="Inserir texto da resposta do passo 1"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Usar resposta do passo 1
              </Button>
            )}
          </div>
          <Input
            id="info-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: A oração é onde o coração encontra direção 🙏"
          />
          {form.onboard_step && form.onboard_step > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              💡 Use <code className="bg-gray-100 px-1 rounded">{'{resposta1}'}</code> para inserir o texto da opção selecionada no passo 1
            </p>
          )}
        </div>

        {/* Subtítulo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="info-subtitle">Subtítulo</Label>
            {form.onboard_step && form.onboard_step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const textarea = document.getElementById('info-subtitle') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart || 0;
                    const end = textarea.selectionEnd || 0;
                    const newText = subtitle.substring(0, start) + '{resposta1}' + subtitle.substring(end);
                    setSubtitle(newText);
                    setTimeout(() => {
                      textarea.focus();
                      const newPos = start + '{resposta1}'.length;
                      textarea.setSelectionRange(newPos, newPos);
                    }, 0);
                  }
                }}
                className="h-7 text-xs"
                title="Inserir texto da resposta do passo 1"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Usar resposta do passo 1
              </Button>
            )}
          </div>
          <Textarea
            id="info-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Ex.: Quando você fala com Deus sobre o que sente, o coração se acalma e a fé se fortalece."
            rows={2}
          />
          {form.onboard_step && form.onboard_step > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              💡 Use <code className="bg-gray-100 px-1 rounded">{'{resposta1}'}</code> para inserir o texto da opção selecionada no passo 1
            </p>
          )}
        </div>

        {/* Explicação */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="info-explanation">Explicação</Label>
            {form.onboard_step && form.onboard_step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const textarea = document.getElementById('info-explanation') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart || 0;
                    const end = textarea.selectionEnd || 0;
                    const newText = explanation.substring(0, start) + '{resposta1}' + explanation.substring(end);
                    setExplanation(newText);
                    setTimeout(() => {
                      textarea.focus();
                      const newPos = start + '{resposta1}'.length;
                      textarea.setSelectionRange(newPos, newPos);
                    }, 0);
                  }
                }}
                className="h-7 text-xs"
                title="Inserir texto da resposta do passo 1"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Usar resposta do passo 1
              </Button>
            )}
          </div>
          <Textarea
            id="info-explanation"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Ex.: Criamos uma série de orações guiadas para te ajudar a conversar com Deus sobre [tema escolhido] — um tempo especial para refletir, se fortalecer e renovar a esperança."
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-1">
            Você pode usar {"{tema escolhido}"} ou {"{category}"} para inserir dinamicamente o tema/categoria selecionada.
            {form.onboard_step && form.onboard_step > 1 && (
              <> • Use <code className="bg-gray-100 px-1 rounded">{'{resposta1}'}</code> para inserir o texto da opção selecionada no passo 1</>
            )}
          </p>
        </div>

        {/* Texto do botão */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="info-button">Texto do Botão</Label>
            {form.onboard_step && form.onboard_step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.getElementById('info-button') as HTMLInputElement;
                  if (input) {
                    const start = input.selectionStart || 0;
                    const end = input.selectionEnd || 0;
                    const newText = buttonText.substring(0, start) + '{resposta1}' + buttonText.substring(end);
                    setButtonText(newText);
                    setTimeout(() => {
                      input.focus();
                      const newPos = start + '{resposta1}'.length;
                      input.setSelectionRange(newPos, newPos);
                    }, 0);
                  }
                }}
                className="h-7 text-xs"
                title="Inserir texto da resposta do passo 1"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Usar resposta do passo 1
              </Button>
            )}
          </div>
          <Input
            id="info-button"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Ex.: Começar agora →"
          />
          {form.onboard_step && form.onboard_step > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              💡 Use <code className="bg-gray-100 px-1 rounded">{'{resposta1}'}</code> para inserir o texto da opção selecionada no passo 1
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

