"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export interface AdminForm {
  id: string;
  name: string;
  description?: string;
  form_type?: string;
  created_at: string;
}

export default function CreateFormModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (form: AdminForm) => void; }) {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  async function submit() {
    if (!name.trim()) {
      toast.error('Dê um nome ao formulário');
      return;
    }
    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from('admin_forms')
        .insert({ name, description, form_type: 'onboarding', schema: [] })
        .select('*')
        .single();
      if (error) throw error;
      const created = data as AdminForm;
      onCreated(created);
      toast.success('Formulário criado');
      setName("");
      setDescription("");
      onOpenChange(false);
      // Redirecionar para a página de edição do formulário recém-criado
      router.push(`/admin/forms/${created.id}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast.error('Não foi possível criar o formulário');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo formulário</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Onboarding 2025" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Explique o objetivo do formulário" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Criando...' : 'Criar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


