"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserIntention } from '@/hooks/useIntentions';

interface IntentionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, description?: string) => Promise<boolean>;
  intention?: UserIntention | null;
  mode: 'create' | 'edit';
}

export function IntentionModal({ 
  open, 
  onOpenChange, 
  onSave, 
  intention, 
  mode 
}: IntentionModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Resetar campos quando modal abrir/fechar ou intenção mudar
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && intention) {
        setTitle(intention.title);
        setDescription(intention.description || '');
      } else {
        setTitle('');
        setDescription('');
      }
    }
  }, [open, mode, intention]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const success = await onSave(title, description);
      if (success) {
        onOpenChange(false);
        setTitle('');
        setDescription('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setTitle('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'create' ? 'Nova Intenção' : 'Editar Intenção'}
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
              placeholder="Ex: Saúde da família, Paz interior..."
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              maxLength={100}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300">
              Descrição (opcional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva sua intenção com mais detalhes..."
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-[80px]"
              maxLength={500}
            />
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