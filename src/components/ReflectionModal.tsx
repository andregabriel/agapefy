"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserReflection } from '@/hooks/useReflections';

interface ReflectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, content?: string) => Promise<boolean>;
  reflection?: UserReflection | null;
  mode: 'create' | 'edit';
}

export function ReflectionModal({ 
  open, 
  onOpenChange, 
  onSave, 
  reflection, 
  mode 
}: ReflectionModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Resetar campos quando modal abrir/fechar ou reflexão mudar
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && reflection) {
        setTitle(reflection.title);
        setContent(reflection.content || '');
      } else {
        setTitle('');
        setContent('');
      }
    }
  }, [open, mode, reflection]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const success = await onSave(title, content);
      if (success) {
        onOpenChange(false);
        setTitle('');
        setContent('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setTitle('');
    setContent('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'create' ? 'Nova Reflexão' : 'Editar Reflexão'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-300">
              Título *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Gratidão pelo dia, Momentos de silêncio..."
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              maxLength={100}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content" className="text-gray-300">
              Conteúdo (opcional)
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva sua reflexão, pensamentos, insights..."
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-[120px]"
              maxLength={2000}
            />
            <p className="text-xs text-gray-500">
              {content.length}/2000 caracteres
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Salvando...' : (mode === 'create' ? 'Criar' : 'Salvar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}