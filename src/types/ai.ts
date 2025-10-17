export interface AIGeneratorProps {
  onAudioGenerated?: (audioData: { text: string; audio_url: string }) => void;
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

