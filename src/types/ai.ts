export interface AIGeneratorProps {
  onAudioGenerated?: (audioData: { text: string; audio_url: string }) => void;
  onReady?: (ready: boolean) => void;
}

export interface PrayerData {
  title: string;
  subtitle: string;
  preparation_text?: string;
  prayer_text: string;
  image_prompt: string;
  audio_description: string;
  final_message?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export type DebugApi = 'prayer' | 'audio' | 'image';
export type DebugType = 'request' | 'response' | 'error';

export interface DebugInfo {
  timestamp: string;
  type: DebugType;
  api: DebugApi;
  data: any;
}

export interface ElevenLabsVoice {
  id: string;
  name: string;
  gender: 'Masculina' | 'Feminina';
  description: string;
}

// API imperativa exposta pelo AIGenerator para reuso em /admin/gm
export interface AIGeneratorHandle {
  setCategoryById: (id: string) => void;
  setPrompt: (value: string) => void;
  setBiblicalBase: (value: string) => void;
  handleGenerateAllFields: () => Promise<void>;
  setTitle: (value: string) => void;
  waitForAudioUrl: (timeoutMs?: number) => Promise<string | null>;
  waitForImageUrl: (timeoutMs?: number) => Promise<string | null>;
  handleSaveToDatabase: () => Promise<string | null>;
  flushState: () => Promise<void>;
  getPrayerData: () => PrayerData | null;
}

