"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Edit, Eye, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import FormStepEditor from './FormStepEditor';
import StaticStepEditor from './StaticStepEditor';
import InfoStepEditor from './InfoStepEditor';
import StepPreview from './StepPreview';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StepData {
  id: string;
  stepNumber: number;
  type: 'form' | 'static' | 'hardcoded' | 'info';
  title: string;
  description?: string;
  isActive: boolean;
  formData?: any;
  staticData?: any;
}

interface StepCardProps {
  step: StepData;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function StepCard({ step, onUpdated, onDeleted }: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getTypeBadge = () => {
    switch (step.type) {
      case 'form':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Formulário</Badge>;
      case 'static':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Configurável</Badge>;
      case 'info':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Informativo</Badge>;
      case 'hardcoded':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">Hardcoded</Badge>;
      default:
        return null;
    }
  };

  const handleDelete = async () => {
    if ((step.type !== 'form' && step.type !== 'info') || !step.formData) return;

    try {
      setIsDeleting(true);
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('admin_forms')
        .delete()
        .eq('id', step.id);

      if (error) throw error;

      const { toast } = await import('sonner');
      toast.success('Passo excluído com sucesso');
      setShowDeleteDialog(false);
      onDeleted();
    } catch (e: any) {
      console.error(e);
      const { toast } = await import('sonner');
      toast.error('Não foi possível excluir o passo');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    if ((step.type !== 'form' && step.type !== 'info') || !step.formData) return;

    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('admin_forms')
        .update({ is_active: checked })
        .eq('id', step.id);

      if (error) throw error;

      const { toast } = await import('sonner');
      toast.success(checked ? 'Passo ativado' : 'Passo desativado');
      onUpdated();
    } catch (e) {
      console.error(e);
      const { toast } = await import('sonner');
      toast.error('Não foi possível atualizar o status');
    }
  };

  return (
    <>
      <Card className={`transition-all ${isExpanded ? 'shadow-lg' : 'shadow-sm'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-lg font-bold px-3 py-1 min-w-[60px] text-center">
                  {step.stepNumber}
                </Badge>
                {getTypeBadge()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                {step.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{step.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {(step.type === 'form' || step.type === 'info') && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Ativo</span>
                  <Switch
                    checked={step.isActive}
                    onCheckedChange={handleToggleActive}
                    aria-label={`Alternar ativo para passo ${step.stepNumber}`}
                  />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              {step.type !== 'hardcoded' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setIsExpanded(true);
                  }}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
              {(step.type === 'form' || step.type === 'info') && step.formData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="gap-2"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Recolher
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expandir
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            {isEditing && step.type === 'form' && step.formData && (
              <FormStepEditor
                form={step.formData}
                onSaved={() => {
                  setIsEditing(false);
                  setIsExpanded(false);
                  onUpdated();
                }}
                onCancel={() => {
                  setIsEditing(false);
                }}
              />
            )}
            {isEditing && step.type === 'static' && (
              <StaticStepEditor
                stepNumber={step.stepNumber}
                initialData={step.staticData}
                onSaved={() => {
                  setIsEditing(false);
                  setIsExpanded(false);
                  onUpdated();
                }}
                onCancel={() => {
                  setIsEditing(false);
                }}
              />
            )}
            {isEditing && step.type === 'info' && step.formData && (
              <InfoStepEditor
                form={step.formData}
                onSaved={() => {
                  setIsEditing(false);
                  setIsExpanded(false);
                  onUpdated();
                }}
                onCancel={() => {
                  setIsEditing(false);
                }}
              />
            )}
            {!isEditing && step.type === 'hardcoded' && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  Este passo é hardcoded no código e não pode ser editado ainda. 
                  Esta funcionalidade será implementada em uma fase futura.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Preview Modal */}
      {showPreview && (
        <StepPreview
          stepNumber={(step.formData?.onboard_step as any) || step.stepNumber}
          staticKind={step.type === 'static'
            ? (step.title?.toLowerCase().includes('preview') ? 'preview' : 'whatsapp')
            : undefined}
          formId={step.formData?.id || (step.type === 'form' || step.type === 'info' ? step.id : undefined)}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir passo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o passo {step.stepNumber}: "{step.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

