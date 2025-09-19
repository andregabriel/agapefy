"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Target, Award } from 'lucide-react';
import { useUserGoals, type UserGoalsInput } from '@/hooks/useUserGoals';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const goalsSchema = z.object({
  weekly_goal: z.number().min(1, 'Meta semanal deve ser pelo menos 1').max(50, 'Meta semanal muito alta'),
  consecutive_goal: z.number().min(1, 'Meta de dias consecutivos deve ser pelo menos 1').max(365, 'Meta de dias consecutivos muito alta')
});

export function GoalsSettings() {
  const { goals, loading, updateGoals } = useUserGoals();
  const [open, setOpen] = useState(false);

  const form = useForm<UserGoalsInput>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      weekly_goal: goals?.weekly_goal || 7,
      consecutive_goal: goals?.consecutive_goal || 7
    }
  });

  // Atualizar valores do form quando as metas carregarem
  React.useEffect(() => {
    if (goals) {
      form.reset({
        weekly_goal: goals.weekly_goal,
        consecutive_goal: goals.consecutive_goal
      });
    }
  }, [goals, form]);

  const onSubmit = async (data: UserGoalsInput) => {
    try {
      const success = await updateGoals(data);
      
      if (success) {
        toast.success('Metas atualizadas com sucesso!');
        setOpen(false);
      } else {
        toast.error('Erro ao salvar metas. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
      toast.error('Erro inesperado ao salvar metas.');
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center">
            <Settings className="h-4 w-4 mr-2 text-blue-500" />
            Configurações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-800/50 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center">
              <Settings className="h-4 w-4 mr-2 text-blue-500" />
              Minhas Metas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 flex items-center">
                  <Target className="h-3 w-3 mr-1" />
                  Orações/semana
                </span>
                <span className="text-blue-400 font-bold">{goals?.weekly_goal || 7}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 flex items-center">
                  <Award className="h-3 w-3 mr-1" />
                  Dias consecutivos
                </span>
                <span className="text-yellow-400 font-bold">{goals?.consecutive_goal || 7}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Clique para editar</p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2 text-blue-500" />
            Configurar Metas de Oração
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="weekly_goal" className="text-sm font-medium text-gray-300">
                Meta de orações por semana
              </Label>
              <Input
                id="weekly_goal"
                type="number"
                min="1"
                max="50"
                {...form.register('weekly_goal', { valueAsNumber: true })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="Ex: 7"
              />
              {form.formState.errors.weekly_goal && (
                <p className="text-red-400 text-xs mt-1">
                  {form.formState.errors.weekly_goal.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="consecutive_goal" className="text-sm font-medium text-gray-300">
                Meta de dias consecutivos
              </Label>
              <Input
                id="consecutive_goal"
                type="number"
                min="1"
                max="365"
                {...form.register('consecutive_goal', { valueAsNumber: true })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="Ex: 7"
              />
              {form.formState.errors.consecutive_goal && (
                <p className="text-red-400 text-xs mt-1">
                  {form.formState.errors.consecutive_goal.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Metas'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}