"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Volume2, Mic, RefreshCw, Image, Save, ChevronDown, ChevronUp, Bug, Copy, ExternalLink, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCategories } from '@/lib/supabase-queries';

interface AIGeneratorProps {
  onAudioGenerated?: (audioData: { text: string; audio_url: string }) => void;
}

interface PrayerData {
  title: string;
  subtitle: string;
  prayer_text: string;
  image_prompt: string;
  audio_description: string; // Nova propriedade para descrição do áudio
}

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface DebugInfo {
  timestamp: string;
  type: 'request' | 'response' | 'error';
  api: 'prayer' | 'audio' | 'image';
  data: any;
}

// Vozes do ElevenLabs com IDs corretos e verificados
const ELEVENLABS_VOICES = [
  {
    id: 'pNInz6obpgDQGcFmaJgB', // Adam - Voz masculina profunda
    name: 'Pastor Gabriel',
    gender: 'Masculina',
    description: 'Voz masculina solene e respeitosa'
  },
  {
    id: 'VR6AewLTigWG4xSOukaG', // Arnold - Voz masculina madura
    name: 'Padre Miguel',
    gender: 'Masculina', 
    description: 'Voz masculina serena e contemplativa'
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL', // Bella - Voz feminina suave
    name: 'Pastora Maria',
    gender: 'Feminina',
    description: 'Voz feminina suave e acolhedora'
  },
  {
    id: 'ThT5KcBeYPX3keUQqHPh', // Dorothy - Voz feminina doce
    name: 'Irmã Clara',
    gender: 'Feminina',
    description: 'Voz feminina doce e reverente'
  }
];

export default function AIGenerator({ onAudioGenerated }: AIGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [prayerData, setPrayerData] = useState<PrayerData | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioDuration, setAudioDuration] = useState<number | null>(null); // Nova state para duração
  const [imageUrl, setImageUrl] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(ELEVENLABS_VOICES[0].id);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isGeneratingPrayer, setIsGeneratingPrayer] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);

  // Função para obter duração real do áudio
  const getAudioDuration = (audioDataUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      console.log('🎵 Iniciando análise de duração do áudio...');
      
      const audio = new Audio();
      
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        console.log('✅ Duração do áudio obtida:', duration, 'segundos');
        console.log('🕐 Duração formatada:', Math.round(duration), 'segundos');
        resolve(duration);
      };
      
      audio.onerror = (error) => {
        console.error('❌ Erro ao carregar áudio para análise de duração:', error);
        reject(error);
      };
      
      audio.ontimeupdate = () => {
        // Remover listener após obter duração
        audio.ontimeupdate = null;
      };
      
      console.log('📡 Carregando áudio para análise...');
      audio.src = audioDataUrl;
    });
  };

  // Função para formatar duração em minutos e segundos
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Função para adicionar log de debug
  const addDebugLog = (type: 'request' | 'response' | 'error', api: 'prayer' | 'audio' | 'image', data: any) => {
    const newLog: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      api,
      data
    };
    setDebugLogs(prev => [newLog, ...prev].slice(0, 10)); // Manter apenas os 10 últimos logs
  };

  // Upload da imagem gerada (URL temporária) para o Supabase Storage e retorna URL pública
  const uploadImageToSupabaseFromUrl = async (temporaryUrl: string): Promise<string> => {
    try {
      console.log('⬆️ Baixando imagem temporária via proxy para upload no Supabase...', temporaryUrl);
      const response = await fetch('/api/image-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: temporaryUrl })
      });
      if (!response.ok) {
        throw new Error(`Falha ao baixar imagem: HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const blob = await response.blob();

      // Determinar extensão
      let ext = 'png';
      if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
      if (contentType.includes('webp')) ext = 'webp';
      if (temporaryUrl.match(/\.jpe?g($|\?)/)) ext = 'jpg';
      if (temporaryUrl.match(/\.png($|\?)/)) ext = 'png';
      if (temporaryUrl.match(/\.webp($|\?)/)) ext = 'webp';

      // Bucket e prefixo compatíveis com seu projeto
      const BUCKET = 'media';
      const PREFIX = 'app-26/images';
      const fileName = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType,
        });

      if (uploadError) {
        console.error('❌ Erro ao fazer upload da imagem no Supabase:', uploadError);
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      if (!publicData?.publicUrl) {
        throw new Error('Não foi possível obter URL pública da imagem');
      }

      console.log('✅ Imagem hospedada no Supabase:', publicData.publicUrl);
      return publicData.publicUrl;
    } catch (err) {
      console.error('❌ Falha ao hospedar imagem no Supabase:', err);
      throw err;
    }
  };

  // Função para copiar URL para clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('URL copiada para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar URL');
    }
  };

  // Função para otimizar prompt para DALL-E
  const optimizeImagePrompt = (originalPrompt: string): string => {
    // Remove comandos em português e otimiza para inglês
    let optimizedPrompt = originalPrompt
      .replace(/^(gere a imagem de|crie uma imagem de|faça uma imagem de)/i, '')
      .trim();

    // Adiciona prefixo para contexto religioso cristão
    const prefix = 'Religious Christian scene:';
    
    // Adiciona sufixo para qualidade e estilo
    const suffix = 'photorealistic, soft warm lighting, peaceful atmosphere, high quality, inspirational, beautiful composition';
    
    return `${prefix} ${optimizedPrompt}, ${suffix}`;
  };

  // Carregar categorias ao montar o componente
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await getCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);
      }
    };
    loadCategories();
  }, []);

  const handleGeneratePrayer = async () => {
    if (!prompt.trim()) {
      toast.error('Por favor, insira um tema para a oração');
      return;
    }

    setIsGeneratingPrayer(true);
    const requestData = { prompt: prompt.trim() };
    
    try {
      addDebugLog('request', 'prayer', requestData);
      
      const response = await fetch('/api/generate-prayer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      addDebugLog('response', 'prayer', { status: response.status, data });

      if (!response.ok) {
        console.error('Erro ao gerar oração:', data.error);
        addDebugLog('error', 'prayer', data);
        toast.error(data.error || 'Erro ao gerar oração');
        return;
      }

      if (data?.title && data?.subtitle && data?.prayer_text && data?.image_prompt) {
        // Gerar descrição automática baseada no sub-título
        const autoDescription = `${data.subtitle} - Uma oração inspiradora sobre ${prompt.toLowerCase()}.`;
        
        setPrayerData({
          ...data,
          audio_description: autoDescription // Adicionar descrição automática
        });
        
        // Limpar áudio e imagem anteriores quando nova oração é gerada
        setAudioUrl('');
        setAudioDuration(null); // Limpar duração anterior
        setImageUrl('');
        toast.success('Oração completa gerada com sucesso!');
      } else {
        toast.error('Dados da oração incompletos');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao gerar oração:', errorMessage);
      addDebugLog('error', 'prayer', { error: errorMessage });
      toast.error('Erro ao gerar oração');
    } finally {
      setIsGeneratingPrayer(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!prayerData?.prayer_text.trim()) {
      toast.error('Primeiro gere uma oração para converter em áudio');
      return;
    }

    if (!selectedVoice) {
      toast.error('Por favor, selecione uma voz');
      return;
    }

    const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === selectedVoice);
    console.log('🎵 Gerando áudio com voz:', selectedVoiceInfo?.name);

    setIsGeneratingAudio(true);
    const requestData = { 
      text: prayerData.prayer_text.trim(),
      voice_id: selectedVoice
    };

    try {
      addDebugLog('request', 'audio', requestData);

      console.log('📡 Enviando requisição para /api/generate-audio...');
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('📡 Status da resposta:', response.status);
      console.log('📡 Headers da resposta:', Object.fromEntries(response.headers.entries()));

      let data;
      let responseText = '';
      
      try {
        responseText = await response.text();
        console.log('📦 Texto bruto da resposta:', responseText.substring(0, 200) + '...');
        
        if (responseText) {
          data = JSON.parse(responseText);
        } else {
          data = { error: 'Resposta vazia do servidor' };
        }
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse da resposta:', parseError);
        data = { 
          error: 'Erro ao fazer parse da resposta',
          rawResponse: responseText.substring(0, 500),
          parseError: parseError instanceof Error ? parseError.message : 'Erro desconhecido'
        };
      }

      addDebugLog('response', 'audio', { 
        status: response.status, 
        headers: Object.fromEntries(response.headers.entries()),
        rawText: responseText.substring(0, 200),
        parsedData: data 
      });

      if (!response.ok) {
        console.error('❌ Erro detalhado ao gerar áudio:', {
          status: response.status,
          statusText: response.statusText,
          data,
          rawResponse: responseText.substring(0, 500)
        });
        addDebugLog('error', 'audio', { 
          status: response.status, 
          statusText: response.statusText,
          data,
          rawResponse: responseText.substring(0, 500)
        });
        
        const errorMessage = data?.error || `Erro HTTP ${response.status}: ${response.statusText}`;
        toast.error(`Erro ao gerar áudio: ${errorMessage}`);
        return;
      }

      console.log('📦 Dados do áudio recebidos:', data);

      if (data?.audio_url) {
        setAudioUrl(data.audio_url);
        
        // 🎵 NOVO: Obter duração real do áudio
        try {
          console.log('🕐 Iniciando análise de duração do áudio...');
          const duration = await getAudioDuration(data.audio_url);
          setAudioDuration(duration);
          console.log('✅ Duração obtida e salva:', duration, 'segundos');
          
          toast.success(`🎵 Áudio gerado com ${selectedVoiceInfo?.name}! Duração: ${formatDuration(duration)}`);
        } catch (durationError) {
          console.error('❌ Erro ao obter duração do áudio:', durationError);
          setAudioDuration(null);
          toast.success(`🎵 Áudio gerado com ${selectedVoiceInfo?.name}! (Duração não detectada)`);
        }
        
        const voiceUsed = data.voice_id_used || selectedVoice;
        const voiceUsedInfo = ELEVENLABS_VOICES.find(v => v.id === voiceUsed);
        
        console.log('✅ Áudio gerado com sucesso');
        
        if (onAudioGenerated) {
          onAudioGenerated({
            text: prayerData.prayer_text,
            audio_url: data.audio_url
          });
        }
      } else {
        console.error('❌ URL do áudio não encontrada na resposta');
        toast.error('Nenhum áudio foi gerado');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro na requisição de áudio:', errorMessage);
      console.error('🔍 Stack trace:', error);
      addDebugLog('error', 'audio', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
      toast.error(`Erro ao gerar áudio: ${errorMessage}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!prayerData?.image_prompt?.trim()) {
      toast.error('Descrição da imagem não encontrada');
      return;
    }

    // Validar prompt mínimo
    const originalPrompt = prayerData.image_prompt.trim();
    if (originalPrompt.length < 20) {
      toast.error('Por favor, descreva a cena com mais detalhes (mínimo 20 caracteres)');
      return;
    }

    // Otimizar prompt para DALL-E
    const optimizedPrompt = optimizeImagePrompt(originalPrompt);

    console.log('🖼️ Iniciando geração de imagem com DALL-E 3...');
    console.log('📝 Prompt original:', originalPrompt);
    console.log('🎯 Prompt otimizado:', optimizedPrompt);
    
    setIsGeneratingImage(true);
    
    // Objeto completo que será enviado para a API
    const requestPayload = { 
      prompt: optimizedPrompt
    };

    try {
      addDebugLog('request', 'image', {
        originalPrompt,
        optimizedPrompt,
        requestPayload
      });

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('📡 Status da resposta:', response.status);
      console.log('📡 Headers da resposta:', Object.fromEntries(response.headers.entries()));

      let responseData;
      let responseText = '';
      
      try {
        responseText = await response.text();
        console.log('📦 Texto bruto da resposta:', responseText);
        
        if (responseText) {
          responseData = JSON.parse(responseText);
        } else {
          responseData = { error: 'Resposta vazia do servidor' };
        }
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse da resposta:', parseError);
        responseData = { 
          error: 'Erro ao fazer parse da resposta',
          rawResponse: responseText,
          parseError: parseError instanceof Error ? parseError.message : 'Erro desconhecido'
        };
      }

      addDebugLog('response', 'image', { 
        status: response.status, 
        headers: Object.fromEntries(response.headers.entries()),
        rawText: responseText,
        parsedData: responseData 
      });

      if (!response.ok) {
        console.error('❌ Erro detalhado ao gerar imagem:', responseData);
        const errorMessage = responseData?.error || `Erro HTTP ${response.status}`;
        toast.error(`Erro ao gerar imagem: ${errorMessage}`);
        return;
      }

      console.log('📦 Dados da imagem recebidos:', responseData);

      if (responseData?.image_url) {
        setImageUrl(responseData.image_url);
        console.log('✅ Imagem gerada com sucesso (DALL-E 3):', responseData.image_url);
        
        let successMessage = '🖼️ Imagem gerada com sucesso usando DALL-E 3!';
        if (responseData.model_used) {
          successMessage += ` (${responseData.model_used.toUpperCase()})`;
        }
        
        toast.success(successMessage);
      } else {
        console.error('❌ URL da imagem não encontrada na resposta');
        toast.error('Nenhuma imagem foi gerada');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro na requisição de imagem:', errorMessage);
      console.error('🔍 Stack trace:', error);
      addDebugLog('error', 'image', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
      toast.error(`Erro ao gerar imagem: ${errorMessage}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!prayerData || !audioUrl) {
      toast.error('É necessário ter oração completa e áudio gerados para salvar');
      return;
    }

    if (!selectedCategory) {
      toast.error('Por favor, selecione uma categoria');
      return;
    }

    setIsSaving(true);
    try {
      // Obter usuário atual para preencher created_by
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ Erro ao obter usuário autenticado:', authError);
      }
      const currentUserId = authData?.user?.id || null;

      const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === selectedVoice);
      
      // Usar a descrição editável do áudio com informação da voz
      const finalDescription = `${prayerData.audio_description} (Voz: ${selectedVoiceInfo?.name || 'Desconhecida'})`;
      
      console.log('💾 Salvando oração no banco de dados...');
      console.log('📝 Dados a serem salvos:', {
        title: prayerData.title,
        subtitle: prayerData.subtitle,
        description: finalDescription,
        audio_url: audioUrl,
        transcript: prayerData.prayer_text,
        duration: audioDuration ? Math.round(audioDuration) : null, // NOVO: Salvar duração
        category_id: selectedCategory,
        image_present: !!imageUrl,
      });
      
      // Se houver imagem gerada, enviar para o Storage e obter URL pública
      let coverPublicUrl: string | null = null;
      if (imageUrl) {
        try {
          coverPublicUrl = await uploadImageToSupabaseFromUrl(imageUrl);
        } catch (e) {
          console.warn('⚠️ Prosseguindo sem cover_url devido a erro no upload da imagem.');
        }
      }

      // Salvar o áudio na tabela audios
      const { data: audioData, error: audioError } = await supabase
        .from('audios')
        .insert({
          title: prayerData.title,
          subtitle: prayerData.subtitle,
          description: finalDescription,
          audio_url: audioUrl,
          transcript: prayerData.prayer_text,
          duration: audioDuration ? Math.round(audioDuration) : null, // NOVO: Salvar duração em segundos
          category_id: selectedCategory,
          cover_url: coverPublicUrl,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (audioError) {
        console.error('❌ Erro ao salvar áudio:', audioError);
        toast.error('Erro ao salvar no banco de dados');
        return;
      }

      console.log('✅ Áudio salvo com sucesso:', audioData);
      
      let successMessage = '✅ Oração salva no banco de dados com sucesso!';
      if (audioDuration) {
        successMessage += ` Duração: ${formatDuration(audioDuration)}`;
      }
      
      toast.success(successMessage);
      
      // Limpar formulário após salvar
      setPrompt('');
      setPrayerData(null);
      setAudioUrl('');
      setAudioDuration(null);
      setImageUrl('');
      setSelectedCategory('');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro ao salvar:', errorMessage);
      toast.error('❌ Erro ao salvar no banco de dados');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === selectedVoice);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Gerador de Orações com IA
          </CardTitle>
          <CardDescription>
            Use inteligência artificial para gerar orações completas: título, sub-título, texto, imagem e áudio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input para o tema da oração */}
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium mb-2">
              Tema da Oração
            </label>
            <Textarea
              id="prompt"
              placeholder="Ex: gratidão pela família, pedido de proteção, oração pela paz..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botão para gerar oração completa */}
          <Button 
            onClick={handleGeneratePrayer}
            disabled={isGeneratingPrayer || !prompt.trim()}
            className="w-full"
          >
            {isGeneratingPrayer ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando oração completa...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Gerar Oração Completa
              </>
            )}
          </Button>

          {/* Dados da oração gerada */}
          {prayerData && (
            <div className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Título da Oração
                </label>
                <Input
                  value={prayerData.title}
                  onChange={(e) => setPrayerData({...prayerData, title: e.target.value})}
                  className="font-medium"
                />
              </div>

              {/* Sub-título */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Sub-título
                </label>
                <Input
                  value={prayerData.subtitle}
                  onChange={(e) => setPrayerData({...prayerData, subtitle: e.target.value})}
                />
              </div>

              {/* Descrição do Áudio - NOVO CAMPO */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Descrição do Áudio
                </label>
                <Textarea
                  value={prayerData.audio_description}
                  onChange={(e) => setPrayerData({...prayerData, audio_description: e.target.value})}
                  rows={2}
                  placeholder="Descrição que aparecerá no áudio salvo no banco de dados..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Esta descrição será salva no banco de dados junto com a informação da voz selecionada
                </p>
              </div>

              {/* Texto da oração */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Texto da Oração
                </label>
                <Textarea
                  value={prayerData.prayer_text}
                  onChange={(e) => setPrayerData({...prayerData, prayer_text: e.target.value})}
                  rows={8}
                  className="resize-none"
                />
              </div>

              {/* Descrição da imagem */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Image className="inline h-4 w-4 mr-1" />
                  Descrição para Imagem
                </label>
                <Textarea
                  value={prayerData.image_prompt}
                  onChange={(e) => setPrayerData({...prayerData, image_prompt: e.target.value})}
                  rows={3}
                  placeholder="Descreva a cena com riqueza de detalhes. Ex: 'Uma família serena reunida em oração, com luz dourada suave, mãos unidas, expressões de paz e gratidão, ambiente acolhedor'. Mínimo 20 caracteres para melhor qualidade."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Dica: Descreva detalhes como iluminação, expressões, ambiente e emoções para melhores resultados
                </p>
              </div>

              {/* Botão para gerar imagem */}
              <Button 
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || !prayerData.image_prompt?.trim() || prayerData.image_prompt.trim().length < 20}
                variant="outline"
                className="w-full"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando imagem com DALL-E 3...
                  </>
                ) : imageUrl ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerar Imagem (DALL-E 3)
                  </>
                ) : (
                  <>
                    <Image className="mr-2 h-4 w-4" />
                    Gerar Imagem (DALL-E 3)
                    {prayerData.image_prompt?.trim() && prayerData.image_prompt.trim().length < 20 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (mín. 20 chars)
                      </span>
                    )}
                  </>
                )}
              </Button>

              {/* Imagem gerada */}
              {imageUrl && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Imagem Gerada (DALL-E 3 - HD)
                  </label>
                  <div className="border rounded-lg p-2">
                    <img 
                      src={imageUrl} 
                      alt="Imagem da oração gerada por IA" 
                      className="w-full max-w-md mx-auto rounded-md"
                    />
                  </div>
                  
                  {/* URL da imagem */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      URL da Imagem (será salva no banco de dados):
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={imageUrl}
                        readOnly
                        className="text-xs font-mono bg-white"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(imageUrl)}
                        className="shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(imageUrl, '_blank')}
                        className="shrink-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Seletor de categoria */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Categoria da Oração
                
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de voz e botão para gerar áudio */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Mic className="inline h-4 w-4 mr-1" />
                    Escolha a Voz para o Áudio
                  </label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
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

                {/* Botão para gerar áudio */}
                <Button 
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio || !selectedVoice}
                  variant="outline"
                  className="w-full"
                >
                  {isGeneratingAudio ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando áudio com {selectedVoiceInfo?.name}...
                    </>
                  ) : audioUrl ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerar Áudio com {selectedVoiceInfo?.name}
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-4 w-4" />
                      Gerar Áudio com {selectedVoiceInfo?.name}
                    </>
                  )}
                </Button>
              </div>

              {/* Player de áudio */}
              {audioUrl && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Áudio Gerado
                    {selectedVoiceInfo && (
                      <span className="text-sm text-muted-foreground ml-2">
                        (Voz: {selectedVoiceInfo.name})
                      </span>
                    )}
                    {audioDuration && (
                      <span className="text-sm text-green-600 ml-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Duração: {formatDuration(audioDuration)}
                      </span>
                    )}
                  </label>
                  <audio controls className="w-full" key={audioUrl}>
                    <source src={audioUrl} type="audio/mpeg" />
                    Seu navegador não suporta o elemento de áudio.
                  </audio>
                  
                  {/* Informações do áudio */}
                  {audioDuration && (
                    <div className="mt-2 p-2 bg-green-50 rounded-md border border-green-200">
                      <p className="text-xs text-green-700 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ✅ Duração detectada: {Math.round(audioDuration)} segundos ({formatDuration(audioDuration)})
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Botão para salvar no banco */}
          {prayerData && audioUrl && (
            <Button 
              onClick={handleSaveToDatabase}
              disabled={isSaving || !selectedCategory}
              className="w-full"
              variant="default"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Oração Completa no Banco
                  {audioDuration && (
                    <span className="ml-2 text-xs opacity-75">
                      (com duração: {formatDuration(audioDuration)})
                    </span>
                  )}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Seção de Debug */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Debug API - Input/Output
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          <CardDescription>
            Visualize as requisições e respostas das APIs em tempo real
          </CardDescription>
        </CardHeader>
        {showDebug && (
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {debugLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum log de debug ainda. Execute uma ação para ver os dados.
                </p>
              ) : (
                debugLogs.map((log, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.type === 'request' ? 'bg-blue-100 text-blue-800' :
                        log.type === 'response' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                        {log.api.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp}
                      </span>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
            {debugLogs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDebugLogs([])}
                className="mt-4"
              >
                Limpar Logs
              </Button>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}