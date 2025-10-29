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
  // Gera todos os campos e retorna true se os essenciais (preparação, texto, final) estiverem preenchidos
  handleGenerateAllFields: () => Promise<boolean>;
  // Limpa estado entre itens de lote, preservando preferências como categoria/voz
  resetForBatchItem: () => void;
  // Orquestrador determinístico para o fluxo do /admin/gm
  generateAllWithContext: (args: {
    tema: string;
    base: string;
    titulo?: string;
    categoryId?: string;
  }) => Promise<{ ok: boolean; textoLen: number; prepLen: number; finalLen: number }>;
  setTitle: (value: string) => void;
  waitForAudioUrl: (timeoutMs?: number) => Promise<string | null>;
  waitForImageUrl: (timeoutMs?: number) => Promise<string | null>;
  handleSaveToDatabase: (overrideTitle?: string) => Promise<{ id: string | null; error?: string }>;
  flushState: () => Promise<void>;
  getPrayerData: () => PrayerData | null;
}

