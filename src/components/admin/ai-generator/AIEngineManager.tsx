import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AIEngineManager({
  aiEngines,
  selectedAiEngine,
  setSelectedAiEngine,
  newAiEngineName,
  setNewAiEngineName,
  editingAiEngineName,
  setEditingAiEngineName,
  onAdd,
  onRename,
  onRemove,
}: {
  aiEngines: string[];
  selectedAiEngine: string;
  setSelectedAiEngine: (v: string) => void;
  newAiEngineName: string;
  setNewAiEngineName: (v: string) => void;
  editingAiEngineName: string;
  setEditingAiEngineName: (v: string) => void;
  onAdd: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">IA utilizada</label>
      <Select value={selectedAiEngine} onValueChange={setSelectedAiEngine}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione o motor de IA" />
        </SelectTrigger>
        <SelectContent>
          {aiEngines.map((engine) => (
            <SelectItem key={engine} value={engine}>{engine}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Novo motor de IA"
            value={newAiEngineName}
            onChange={(e) => setNewAiEngineName(e.target.value)}
          />
          <Button variant="outline" onClick={onAdd}>Adicionar</Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Renomear selecionado"
            value={editingAiEngineName}
            onChange={(e) => setEditingAiEngineName(e.target.value)}
          />
          <Button variant="outline" onClick={onRename}>Renomear</Button>
          <Button variant="outline" onClick={onRemove}>Remover</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Gerencie e selecione o motor de IA utilizado. Será salvo no áudio.</p>
    </div>
  );
}


