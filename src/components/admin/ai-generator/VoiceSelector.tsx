import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ELEVENLABS_VOICES from '@/constants/elevenlabsVoices';

export function VoiceSelector({
  selectedVoice,
  onChange,
}: {
  selectedVoice: string;
  onChange: (value: string) => void;
}) {
  const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === selectedVoice);
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        Escolha a Voz para o Áudio
      </label>
      <Select value={selectedVoice} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione uma voz" />
        </SelectTrigger>
        <SelectContent>
          {ELEVENLABS_VOICES.map((voice) => (
            <SelectItem key={voice.id} value={voice.id}>
              <div className="flex flex-col">
                <span className="font-medium">{voice.name}</span>
                <span className="text-xs text-muted-foreground">
                  {voice.gender} • {voice.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedVoiceInfo && (
        <div className="mt-2 p-2 bg-muted rounded-md">
          <p className="text-sm font-medium text-primary">
            ✓ Voz selecionada: {selectedVoiceInfo.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedVoiceInfo.gender} • {selectedVoiceInfo.description}
          </p>
        </div>
      )}
    </div>
  );
}


