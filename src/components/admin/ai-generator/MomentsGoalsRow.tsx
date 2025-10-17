import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function MomentsGoalsRow({
  moments,
  dayPart,
  onChangeDayPart,
  onRenameMoment,
  onAddMoment,
  spiritualGoals,
  spiritualGoal,
  onChangeSpiritualGoal,
  onRenameGoal,
  onAddGoal,
}: {
  moments: string[];
  dayPart: string;
  onChangeDayPart: (value: string) => void;
  onRenameMoment: () => void;
  onAddMoment: () => void;
  spiritualGoals: string[];
  spiritualGoal: string;
  onChangeSpiritualGoal: (value: string) => void;
  onRenameGoal: () => void;
  onAddGoal: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-medium mb-2">Momento</label>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1">
            <Select value={dayPart} onValueChange={onChangeDayPart}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o momento" />
              </SelectTrigger>
              <SelectContent>
                {moments.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRenameMoment}>Renomear</Button>
            <Button variant="outline" onClick={onAddMoment}>Adicionar</Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Objetivo espiritual</label>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1">
            <Select value={spiritualGoal} onValueChange={onChangeSpiritualGoal}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um objetivo espiritual" />
              </SelectTrigger>
              <SelectContent>
                {spiritualGoals.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRenameGoal}>Renomear</Button>
            <Button variant="outline" onClick={onAddGoal}>Adicionar</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Você pode selecionar, criar ou renomear objetivos aqui.</p>
      </div>
    </>
  );
}


