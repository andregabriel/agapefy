import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PausesConfig({
  pausesAutoEnabled,
  setPausesAutoEnabled,
  autoPausesPrompt,
  onEditAutoPrompt,
  pauseComma,
  setPauseComma,
  pausePeriod,
  setPausePeriod,
  pauseBeforePrayer,
  setPauseBeforePrayer,
  pauseAfterPrayer,
  setPauseAfterPrayer,
}: {
  pausesAutoEnabled: boolean;
  setPausesAutoEnabled: (v: boolean) => void;
  autoPausesPrompt: string;
  onEditAutoPrompt: () => void;
  pauseComma: string;
  setPauseComma: (v: string) => void;
  pausePeriod: string;
  setPausePeriod: (v: string) => void;
  pauseBeforePrayer: string;
  setPauseBeforePrayer: (v: string) => void;
  pauseAfterPrayer: string;
  setPauseAfterPrayer: (v: string) => void;
}) {
  return (
    <div className="border-t pt-4 space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="pauses-auto" 
          checked={pausesAutoEnabled}
          onCheckedChange={(checked) => setPausesAutoEnabled(!!checked)}
        />
        <label 
          htmlFor="pauses-auto" 
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Deixar a OpenAI decidir as pausas
        </label>
        <Button variant="ghost" size="sm" onClick={onEditAutoPrompt}>
          Editar prompt
        </Button>
      </div>

      {!pausesAutoEnabled && (
        <div className="grid grid-cols-2 gap-3 pl-6">
          <div>
            <label className="block text-xs font-medium mb-1">Pausa após vírgula (s)</label>
            <Input type="number" step="0.1" min="0" value={pauseComma} onChange={(e) => setPauseComma(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Pausa após ponto final (s)</label>
            <Input type="number" step="0.1" min="0" value={pausePeriod} onChange={(e) => setPausePeriod(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Pausa antes da oração (s)</label>
            <Input type="number" step="0.1" min="0" value={pauseBeforePrayer} onChange={(e) => setPauseBeforePrayer(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Pausa depois da oração (s)</label>
            <Input type="number" step="0.1" min="0" value={pauseAfterPrayer} onChange={(e) => setPauseAfterPrayer(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}


