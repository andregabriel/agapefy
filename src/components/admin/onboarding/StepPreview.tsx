"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface StepPreviewProps {
  stepNumber: number;
  formId?: string;
  staticKind?: 'preview' | 'whatsapp';
  onClose: () => void;
}

export default function StepPreview({ stepNumber, formId, staticKind, onClose }: StepPreviewProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [rootFormId, setRootFormId] = useState<string | null>(null);

  // Buscar primeira categoria disponível para preview dos passos 2 e 3
  // Buscar formId raiz para passos dinâmicos (4+)
  useEffect(() => {
    if (stepNumber === 2 || stepNumber === 3) {
      async function fetchFirstCategory() {
        try {
          const { data, error } = await supabase
            .from('categories')
            .select('id')
            .limit(1)
            .maybeSingle();
          if (!error && data) {
            setCategoryId(data.id);
          }
        } catch (e) {
          console.error('Erro ao buscar categoria para preview:', e);
        }
      }
      void fetchFirstCategory();
    }
    
    // Para passos dinâmicos (4+), buscar o formId raiz (passo 1) se não foi fornecido
    if (stepNumber >= 4 && !formId) {
      async function fetchRootFormId() {
        try {
          const { data, error } = await supabase
            .from('admin_forms')
            .select('id')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .eq('onboard_step', 1)
            .is('parent_form_id', null)
            .limit(1)
            .maybeSingle();
          if (!error && data) {
            setRootFormId(data.id);
          }
        } catch (e) {
          console.error('Erro ao buscar formId raiz para preview:', e);
        }
      }
      void fetchRootFormId();
    } else if (formId) {
      setRootFormId(formId);
    }
  }, [stepNumber, formId]);

  const getPreviewUrl = () => {
    const baseUrl = `/onboarding?step=${stepNumber}`;
    const params: string[] = [];
    
    // Passo 2 e 3 precisam de categoryId
    if ((stepNumber === 2 || stepNumber === 3) && categoryId) {
      params.push(`categoryId=${encodeURIComponent(categoryId)}`);
    }
    
    // Passos dinâmicos (4+) precisam de formId
    if (stepNumber >= 4 && rootFormId) {
      params.push(`formId=${encodeURIComponent(rootFormId)}`);
    }
    // Passos estáticos: indicar explicitamente qual tela renderizar
    if (staticKind === 'preview') {
      params.push('showStatic=preview');
    } else if (staticKind === 'whatsapp') {
      params.push('showStatic=whatsapp');
    }
    
    return params.length > 0 ? `${baseUrl}&${params.join('&')}` : baseUrl;
  };

  const handleOpenInNewTab = () => {
    window.open(getPreviewUrl(), '_blank');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Preview - Passo {stepNumber}</DialogTitle>
          <DialogDescription>
            Visualização do passo {stepNumber} do onboarding
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleOpenInNewTab} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Abrir em nova aba
            </Button>
          </div>
          <div className="flex-1 border rounded-lg overflow-hidden">
            <iframe
              src={getPreviewUrl()}
              className="w-full h-full"
              title={`Preview passo ${stepNumber}`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

