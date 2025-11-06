"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Wand2, Volume2, Mic, RefreshCw, Image, Save, ChevronDown, ChevronUp, Bug, Copy, ExternalLink, Clock, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCategories, searchAudios, Audio as DBAudio } from '@/lib/supabase-queries';
import { useAppSettings } from '@/hooks/useAppSettings';
import { AIGeneratorProps, PrayerData, Category, DebugInfo, AIGeneratorHandle } from '@/types/ai';
import ELEVENLABS_VOICES from '@/constants/elevenlabsVoices';
import { normalizeSeconds, applyPacingBreaksToText, formatDuration } from '@/lib/ai/textPacing';
import { optimizeImagePrompt } from '@/lib/ai/imagePrompt';
import { getAudioDuration } from '@/lib/audio/duration';
import { copyToClipboard as copyToClipboardUtil } from '@/lib/clipboard';
import { uploadImageToSupabaseFromUrl } from '@/lib/services/storage';
import { generateField as gmanualGenerateField } from '@/lib/services/gmanual';
import { requestGenerateAudio } from '@/lib/services/aiAudio';
import { requestGenerateImage } from '@/lib/services/aiImage';
import { useDebugLogs } from '@/hooks/useDebugLogs';
import { useLocalDraft } from '@/hooks/useLocalDraft';
import { useAppPrompts } from '@/hooks/useAppPrompts';
import { AIEngineManager } from '@/components/admin/ai-generator/AIEngineManager';
import { CategorySelect } from '@/components/admin/ai-generator/CategorySelect';
import { VoiceSelector } from '@/components/admin/ai-generator/VoiceSelector';
import { PausesConfig } from '@/components/admin/ai-generator/PausesConfig';
import { DebugPanel } from '@/components/admin/ai-generator/DebugPanel';

// Tipos e vozes extraídos para arquivos dedicados

const AIGenerator = forwardRef<AIGeneratorHandle, AIGeneratorProps>(function AIGenerator(
  { onAudioGenerated, onReady, onProgress }: AIGeneratorProps,
  ref
) {
  const [prompt, setPrompt] = useState('');
  const defaultPrayerData: PrayerData = {
    title: '',
    subtitle: '',
    preparation_text: '',
    prayer_text: '',
    image_prompt: '',
    audio_description: '',
    final_message: ''
  };
  const [prayerData, setPrayerData] = useState<PrayerData | null>(defaultPrayerData);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioDuration, setAudioDuration] = useState<number | null>(null); // Nova state para duração
  const [imageUrl, setImageUrl] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(ELEVENLABS_VOICES[0].id);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  // Novos estados: Momento do dia e Objetivo espiritual
  const DAYPARTS = ['Wakeup', 'Lunch', 'Dinner', 'Sleep', 'Any'];
  const [dayPart, setDayPart] = useState<string>('Any');
  const [moments, setMoments] = useState<string[]>(DAYPARTS);
  const [spiritualGoal, setSpiritualGoal] = useState<string>('');
  const { settings, updateSetting: updateAppSetting } = useAppSettings();
  const [spiritualGoals, setSpiritualGoals] = useState<string[]>([]);
  // Motores de IA (admin pode gerenciar)
  const [aiEngines, setAiEngines] = useState<string[]>([]);
  const [selectedAiEngine, setSelectedAiEngine] = useState<string>("");
  const [newAiEngineName, setNewAiEngineName] = useState<string>("");
  const [editingAiEngineName, setEditingAiEngineName] = useState<string>("");
  const [newGoalName, setNewGoalName] = useState<string>('');
  const [editingGoalName, setEditingGoalName] = useState<string>('');
  const [isGeneratingPrayer, setIsGeneratingPrayer] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAndSaving, setIsGeneratingAndSaving] = useState(false);
  // Manter ID para atualização assíncrona de capa quando imagem chegar depois do insert
  const [pendingCoverUpdateId, setPendingCoverUpdateId] = useState<string | null>(null);
  // Sinal síncrono para indicar execução em lote (usado para bloquear auto-disparo de imagem)
  const isBatchRef = useRef<boolean>(false);
  const { showDebug, setShowDebug, debugLogs, addDebugLog, clearLogs } = useDebugLogs();
  const [lastVoiceIdUsed, setLastVoiceIdUsed] = useState<string>("");
  const [lastVoiceNameUsed, setLastVoiceNameUsed] = useState<string>("");
  // Estados para prompts do GManual
  const { localPrompts, setLocalPrompts, updateSetting: updatePromptsSetting } = useAppPrompts();
  // Removido editor colapsável — prompts agora são editados via modal por campo
  // Loaders por campo
  const [loadingField, setLoadingField] = useState<{[k: string]: boolean}>({});
  // Undo cache por campo
  const [undoCache, setUndoCache] = useState<{[k: string]: string}>({});
  // Modal de edição de prompt individual
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  type PromptField = keyof typeof localPrompts | 'pauses';
  const [promptModalField, setPromptModalField] = useState<PromptField | null>(null);
  const [promptModalValue, setPromptModalValue] = useState('');
  const [savingSinglePrompt, setSavingSinglePrompt] = useState(false);
  // Base bíblica (novo campo)
  const [biblicalBase, setBiblicalBase] = useState<string>('');
  const [autoDetectBiblicalBase, setAutoDetectBiblicalBase] = useState<boolean>(true);
  // Edição de oração existente
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);
  const [editingAudio, setEditingAudio] = useState<DBAudio | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<DBAudio[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  // Combobox dinâmico
  const [comboOpen, setComboOpen] = useState(false);
  const [allAudios, setAllAudios] = useState<DBAudio[]>([]);
  const [comboQuery, setComboQuery] = useState('');
  const [comboLoading, setComboLoading] = useState(false);
  // Versões do prompt
  const [promptHistory, setPromptHistory] = useState<Array<{ value: string; label?: string; date: string }>>([]);
  const [promptVersionLabel, setPromptVersionLabel] = useState('');
  // Template de geração da imagem (enviado ao DALL-E)
  const [imageGenTemplate, setImageGenTemplate] = useState<string>('');
  const [imageGenPromptModalOpen, setImageGenPromptModalOpen] = useState(false);
  const [savingImageGenTemplate, setSavingImageGenTemplate] = useState(false);
  // Histórico de versões do template DALL‑E
  const [imageGenTemplateHistory, setImageGenTemplateHistory] = useState<Array<{ value: string; label?: string; date: string }>>([]);
  const [imageGenTemplateVersionLabel, setImageGenTemplateVersionLabel] = useState('');
  // Modais para Objetivo espiritual (adicionar/renomear)
  const [addGoalModalOpen, setAddGoalModalOpen] = useState(false);
  const [renameGoalModalOpen, setRenameGoalModalOpen] = useState(false);
  const [tempGoalName, setTempGoalName] = useState('');
  // Modais para Momento (adicionar/renomear)
  const [addMomentModalOpen, setAddMomentModalOpen] = useState(false);
  const [renameMomentModalOpen, setRenameMomentModalOpen] = useState(false);
  const [tempMomentName, setTempMomentName] = useState('');
  // Estados para configuração de pausas
  const [pausesAutoEnabled, setPausesAutoEnabled] = useState(false);
  const [pauseComma, setPauseComma] = useState('0.3');
  const [pausePeriod, setPausePeriod] = useState('0.8');
  const [pauseBeforePrayer, setPauseBeforePrayer] = useState('1.0');
  const [pauseAfterPrayer, setPauseAfterPrayer] = useState('1.0');
  const [autoPausesPrompt, setAutoPausesPrompt] = useState('essa oração {texto} será escutada em voz alta para as pessoas que querem encontrar um momento íntimo de oração, coloque pausas onde você achar que será melhor para quem está escutando.');

  // Persistência leve de rascunho para evitar perda ao trocar de aba/alt-tab
  const DRAFT_KEY = 'admin.aiGenerator.draft.v1';

  // Restore/persist draft via hook
  useLocalDraft({
    key: DRAFT_KEY,
    value: {
        prompt,
        prayerData,
        selectedVoice,
        selectedCategory,
        imageUrl,
        audioUrl,
        audioDuration,
        dayPart,
        spiritualGoal,
        spiritualGoals,
      ts: Date.now(),
    },
    onRestore: (draft: any) => {
      if (typeof draft?.prompt === 'string') setPrompt(draft.prompt);
      if (draft?.prayerData && typeof draft.prayerData === 'object') {
        setPrayerData((prev) => ({ ...(prev || defaultPrayerData), ...draft.prayerData }));
      }
      if (typeof draft?.selectedVoice === 'string') setSelectedVoice(draft.selectedVoice);
      if (typeof draft?.selectedCategory === 'string') setSelectedCategory(draft.selectedCategory);
      if (typeof draft?.imageUrl === 'string') setImageUrl(draft.imageUrl);
      if (typeof draft?.audioUrl === 'string') setAudioUrl(draft.audioUrl);
      if (typeof draft?.audioDuration === 'number') setAudioDuration(draft.audioDuration);
      if (typeof draft?.dayPart === 'string') setDayPart(draft.dayPart);
      if (typeof draft?.spiritualGoal === 'string') setSpiritualGoal(draft.spiritualGoal);
      if (Array.isArray(draft?.spiritualGoals)) setSpiritualGoals(draft.spiritualGoals);
    },
  });

  // Carregar prompts e pausas do app_settings
  useEffect(() => {
    // prompts já carregados por useAppPrompts
    setAutoPausesPrompt((settings as any)?.gmanual_auto_pauses_prompt || 'essa oração {texto} será escutada em voz alta para as pessoas que querem encontrar um momento íntimo de oração, coloque pausas onde você achar que será melhor para quem está escutando.');
    setPausesAutoEnabled((settings as any)?.gmanual_pauses_auto_enabled === 'true');
    setPauseComma((settings as any)?.gmanual_pause_comma || '0.3');
    setPausePeriod((settings as any)?.gmanual_pause_period || '0.8');
    setPauseBeforePrayer((settings as any)?.gmanual_pause_before_prayer || '1.0');
    setPauseAfterPrayer((settings as any)?.gmanual_pause_after_prayer || '1.0');
    setImageGenTemplate((settings as any)?.gmanual_image_generate_template || '{imagem_descricao}');
  }, [settings]);

  const clearDraft = () => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {
      // ignore
    }
  };

  const handleGenerateAllFields = async (): Promise<boolean> => {
    if (isGeneratingAll) return false;
    setIsGeneratingAll(true);
    try {
      // 1) texto
      const textContent = await generateForField('text');
      
      // Debug log
      if (typeof window !== 'undefined' && window.localStorage.getItem('gm_debug') === '1') {
        console.log('[handleGenerateAllFields] text gerado:', { 
          length: (textContent || '').length,
          preview: (textContent || '').substring(0, 100)
        });
      }
      
      // 2) retorno da API já aguardado acima
      // 3) garantir flush de estado para {texto}
      const texto = (textContent?.trim() || prayerData?.prayer_text || '');
      await new Promise((r) => setTimeout(r, 0));

      // 4) Iniciar em paralelo os campos dependentes do texto
      const prepP = generateForField('preparation', { texto });
      const finalP = generateForField('final_message', { texto });
      const titleP = generateForField('title', { texto });
      const subtitleP = generateForField('subtitle', { texto });
      const descP = generateForField('description', { texto });
      const imageDescP = generateForField('image_prompt', { texto });

      // 5) Disparar geração da imagem assim que a descrição estiver pronta, sem bloquear o fluxo
      imageDescP.then(async (desc) => {
        if (typeof desc !== 'string') {
          addDebugLog('error', 'image', { nonStringDesc: desc });
          return;
        }
        const clean = desc.trim();
        if (clean.length >= 20) {
          try {
            await handleGenerateImage(clean as string);
          } catch (_) {
            // erros já são tratados dentro de handleGenerateImage
          }
        }
      });

      // 6) Assim que preparação e mensagem final estiverem prontas, gerar o áudio (independente da imagem)
      const [prepText, finalText] = await Promise.all([prepP, finalP]);
      try {
        await generateAudio(texto, {
          preparation: (prepText || prayerData?.preparation_text || ''),
          final_message: (finalText || prayerData?.final_message || '')
        });
      } catch (_) {
        // já tratamos toast internamente em generateAudio
      }

      // 7) Aguarda os demais campos de texto (título, subtítulo, descrição)
      await Promise.all([titleP, subtitleP, descP]);

      // 8) CRÍTICO: Aguardar flush final do estado para garantir que todos os setPrayerData foram executados
      // Isso é essencial para /admin/gm conseguir ler os valores via getPrayerData()
      await new Promise((r) => setTimeout(r, 100));

      // 9) Validar essenciais localmente para retorno consistente ao /admin/gm
      const prepOk = (prepText || prayerData?.preparation_text || '').trim().length > 0;
      const textOk = (texto || '').trim().length > 0;
      const finalOk = (finalText || prayerData?.final_message || '').trim().length > 0;
      const ok = prepOk && textOk && finalOk;
      
      // Debug log de validação
      if (typeof window !== 'undefined' && window.localStorage.getItem('gm_debug') === '1') {
        console.log('[handleGenerateAllFields] validação final:', { 
          prepOk, 
          textOk, 
          finalOk, 
          ok,
          prepLength: (prepText || prayerData?.preparation_text || '').length,
          textLength: texto.length,
          finalLength: (finalText || prayerData?.final_message || '').length
        });
      }
      
      if (ok) {
        toast.success('Campos gerados (texto + campos + áudio). Imagem sendo gerada em paralelo.');
      }
      return ok;
    } catch (err) {
      toast.error('Falha ao gerar todos os campos');
      return false;
    } finally {
      setIsGeneratingAll(false);
      // Garantir que o botão "Gerar imagem" fique clicável após o fluxo concluir
      setIsGeneratingImage(false);
    }
  };

  // Orquestrador determinístico para uso em /admin/gm
  const generateAllWithContext = async ({
    tema,
    base,
    titulo,
    categoryId,
  }: {
    tema: string; base: string; titulo?: string; categoryId?: string;
  }): Promise<{ ok: boolean; textoLen: number; prepLen: number; finalLen: number }> => {
    setIsGeneratingAll(true);
    isBatchRef.current = true;
    try {
      // reset leve preservando preferências externas
      setAutoDetectBiblicalBase(false);
      setPrayerData({ ...defaultPrayerData });
      setAudioUrl('');
      setImageUrl('');
      setIsGeneratingAudio(false);
      setIsGeneratingImage(false);
      if (categoryId) setSelectedCategory(categoryId);

      setPrompt(tema || '');
      setBiblicalBase(base || '');
      await new Promise(r => setTimeout(r, 0));

      // 1) Texto primeiro com contexto explícito
      const textContent = await generateForField('text', { tema_central: tema || '', base_biblica: base || '' });
      const texto = (textContent || '').trim();
      if (!texto) return { ok: false, textoLen: 0, prepLen: 0, finalLen: 0 };

      // 2) Demais campos em paralelo com {texto, base_biblica, tema_central}
      const ctx = { texto, base_biblica: base || '', tema_central: tema || '' } as Record<string,string>;
      const prepP = generateForField('preparation', ctx);
      const finalP = generateForField('final_message', ctx);
      const titleP = generateForField('title', ctx);
      const subtitleP = generateForField('subtitle', ctx);
      const descP = generateForField('description', ctx);
      const imgPromptP = generateForField('image_prompt', ctx);

      // 3) Áudio quando preparação+final disponíveis
      const [prepText, finalText] = await Promise.all([prepP, finalP]);
      const prep = (prepText || '').trim();
      const fin = (finalText || '').trim();
      let audioUrlGen: string | null = null;
      try {
        audioUrlGen = await generateAudio(texto, { preparation: prep, final_message: fin });
      } catch (_) { audioUrlGen = null; }

      // 4) Imagem quando a descrição estiver pronta (uma vez)
      try {
        const imgDesc = ((await imgPromptP) || '').trim();
        if (imgDesc.length >= 20 && !isGeneratingImage) {
          setIsGeneratingImage(true);
          await handleGenerateImage(imgDesc);
          setIsGeneratingImage(false);
        }
      } catch (_) {}

      // 5) Título/subtítulo/descrição
      await Promise.all([titleP, subtitleP, descP]);

      // 6) Título final vindo do GM
      if (titulo && titulo.trim()) {
        setPrayerData(prev => prev ? { ...prev, title: titulo } : prev);
        await new Promise(r => setTimeout(r, 0));
      }

      const ok = !!(texto && prep && fin && (audioUrlGen && audioUrlGen.trim().length > 0));
      return { ok, textoLen: texto.length, prepLen: prep.length, finalLen: fin.length };
    } finally {
      setIsGeneratingAll(false);
      isBatchRef.current = false;
    }
  };

  // Novo: Botão único que gera todos os campos e salva no banco
  const handleGenerateAndSave = async () => {
    if (isGeneratingAndSaving) return;
    // Pré-validação
    if (!selectedCategory) {
      toast.error('Por favor, selecione uma categoria');
      return;
    }
    setIsGeneratingAndSaving(true);
    try {
      // 1) Gera todos os campos incluindo imagem e áudio
      const ok = await handleGenerateAllFields();
      if (!ok) {
        toast.error('Geração incompleta: texto/preparação/final ausentes');
        return;
      }

      // 2) Aguarda de fato o término de geração de imagem/áudio
      // (handleGenerateAllFields já aguarda todas as promises internas,
      //  mas aqui garantimos que estados assíncronos tenham sido commitados)
      await new Promise((r) => setTimeout(r, 0));
      let ensuredAudioUrl = await waitForAudioUrl(60000);
      if (!ensuredAudioUrl && isGeneratingAudio) {
        // dar mais um pequeno tempo se ainda está gerando
        ensuredAudioUrl = await waitForAudioUrl(15000);
      }
      const ensuredImageUrl = await waitForImageUrl(15000);
      if (ensuredImageUrl && ensuredImageUrl !== imageUrl) {
        setImageUrl(ensuredImageUrl);
      }

      // 3) Valida pré-requisitos do salvamento
      if (!prayerData) {
        toast.error('Falha ao salvar: dados da oração não disponíveis');
        return;
      }
      if (!ensuredAudioUrl) {
        toast.error('Falha ao salvar: gere o áudio primeiro');
        addDebugLog('error', 'audio', { reason: 'audioUrl not available after wait', isGeneratingAudio });
        return;
      }

      // 4) Salva no banco (cria ou atualiza)
      if (editingAudioId) {
        await handleUpdateInDatabase();
      } else {
        await handleSaveToDatabase();
      }
    } catch (err) {
      toast.error('Falha ao gerar e salvar a oração');
    } finally {
      setIsGeneratingAndSaving(false);
    }
  };

  // Buscar orações (áudios) existentes por título/descrição
  const handleSearchAudios = async () => {
    const term = (searchQuery || '').trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const results = await searchAudios(term);
      setSearchResults(results || []);
    } catch (_) {
      toast.error('Erro ao buscar orações');
    } finally {
      setIsSearching(false);
    }
  };

  // Carregar uma oração existente no formulário para edição
  const loadAudioForEdit = async (audioId: string) => {
    try {
      const { data, error } = await supabase
        .from('audios')
        .select('*')
        .eq('id', audioId)
        .single();
      if (error || !data) {
        toast.error('Erro ao carregar oração selecionada');
        return;
      }

      const row = data as unknown as DBAudio & { ai_engine?: string | null; biblical_base?: string | null; time?: string | null; spiritual_goal?: string | null; };
      setEditingAudioId(row.id);
      setEditingAudio(row);

      // Mapear campos para o formulário do gerador
      setSelectedCategory(row.category_id || '');
      setDayPart((row as any).time || 'Any');
      setSpiritualGoal((row as any).spiritual_goal || '');
      if (typeof (row as any).ai_engine === 'string') setSelectedAiEngine((row as any).ai_engine || selectedAiEngine);
      if (typeof row.voice_id === 'string') setLastVoiceIdUsed(row.voice_id || '');
      if (typeof row.voice_name === 'string') setLastVoiceNameUsed(row.voice_name || '');
      setBiblicalBase(((row as any).biblical_base as string) || '');

      setPrayerData((prev) => ({
        title: row.title || '',
        subtitle: row.subtitle || '',
        preparation_text: '',
        // Sem separadores na base, carregamos o transcript inteiro em prayer_text
        prayer_text: (row.transcript as string) || '',
        image_prompt: '',
        audio_description: row.description || '',
        final_message: ''
      }));

      setAudioUrl(row.audio_url || '');
      setAudioDuration((row.duration as any) ?? null);
      // Exibir capa existente (se houver)
      const existingCover = (row as any).cover_url || (row as any).thumbnail_url || '';
      setImageUrl(existingCover || '');

      toast.success('Oração carregada para edição');
    } catch (_) {
      toast.error('Erro inesperado ao carregar oração');
    }
  };

  const clearEditingSelection = () => {
    setEditingAudioId(null);
    setEditingAudio(null);
  };

  // Atualizar oração existente (update)
  const handleUpdateInDatabase = async () => {
    if (!editingAudioId) return;
    if (!prayerData) return;
    if (!selectedCategory) {
      toast.error('Por favor, selecione uma categoria');
      return;
    }

    setIsSaving(true);
    try {
      const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === (lastVoiceIdUsed || selectedVoice));
      const finalDescription = `${prayerData.audio_description || ''}`;
      const preparation = (prayerData.preparation_text || '').trim();
      const prayer = (prayerData.prayer_text || '').trim();
      const finalMsg = (prayerData.final_message || '').trim();
      const transcriptFull = [preparation, prayer, finalMsg].filter(Boolean).join('\n\n');

      // Se uma imagem for uma URL direta, apenas persistimos; manteremos a já existente se o campo estiver vazio
      const coverPublicUrl = imageUrl || (editingAudio as any)?.cover_url || null;

      // Medir duração se ausente (fallback defensivo)
      let effectiveDuration: number | null = (audioDuration ? Math.round(audioDuration) : (editingAudio as any)?.duration || null);
      if (!effectiveDuration && (audioUrl || (editingAudio as any)?.audio_url)) {
        const urlToMeasure = audioUrl || (editingAudio as any)?.audio_url;
        try {
          const measured = await Promise.race([
            getAudioDuration(urlToMeasure),
            new Promise<number>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
          ]) as number;
          if (typeof measured === 'number' && Number.isFinite(measured)) {
            effectiveDuration = Math.round(measured);
            setAudioDuration(effectiveDuration);
          }
        } catch (_) {
          // mantém null se não conseguir medir
        }
      }

      const { error: updateError } = await supabase
        .from('audios')
        .update({
          title: prayerData.title,
          subtitle: prayerData.subtitle || null,
          description: finalDescription || null,
          audio_url: audioUrl || (editingAudio as any)?.audio_url || null,
          transcript: transcriptFull || null,
          duration: effectiveDuration,
          category_id: selectedCategory || null,
          cover_url: coverPublicUrl,
          ai_engine: 'gpt-5',
          voice_id: (lastVoiceIdUsed || selectedVoice) || null,
          voice_name: (lastVoiceNameUsed || selectedVoiceInfo?.name) || null,
          biblical_base: biblicalBase || null,
          time: dayPart || 'Any',
          spiritual_goal: spiritualGoal || null,
        })
        .eq('id', editingAudioId);

      if (updateError) {
        console.error('❌ Erro ao atualizar áudio:', updateError);
        toast.error('Erro ao atualizar no banco de dados');
        return;
      }

      toast.success('✅ Oração atualizada com sucesso');
      // Atualizar snapshot local
      setEditingAudio((prev) => prev ? ({ ...prev, title: prayerData.title, subtitle: prayerData.subtitle || null, description: finalDescription || null, audio_url: audioUrl || prev.audio_url, duration: (effectiveDuration as any) ?? (prev.duration as any) ?? null, category_id: selectedCategory || null, cover_url: coverPublicUrl as any, voice_id: (lastVoiceIdUsed || selectedVoice) || null, voice_name: (lastVoiceNameUsed || selectedVoiceInfo?.name) || null } as any) : prev);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro ao atualizar:', errorMessage);
      toast.error('❌ Erro ao atualizar no banco de dados');
    } finally {
      setIsSaving(false);
    }
  };

  // Carregar lista inicial para o combobox ao abrir
  const preloadAllAudios = async () => {
    if (allAudios.length > 0) return;
    try {
      setComboLoading(true);
      const { data, error } = await supabase
        .from('audios')
        .select('id,title')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!error && Array.isArray(data)) {
        setAllAudios((data as any[]).map((r: any) => ({ id: r.id, title: r.title } as any)) as DBAudio[]);
      }
    } finally {
      setComboLoading(false);
    }
  };

  // Busca dinâmica (remota) quando o usuário digita dentro do combobox
  useEffect(() => {
    let timer: any;
    if (comboQuery && comboQuery.trim().length >= 2) {
      setComboLoading(true);
      timer = setTimeout(async () => {
        try {
          const results = await searchAudios(comboQuery.trim());
          setSearchResults(results || []);
        } finally {
          setComboLoading(false);
        }
      }, 250);
    } else {
      // Limpa resultados para voltar ao preload
      setSearchResults([]);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [comboQuery]);

  const restoreDefaultPrompt = (key: PromptField) => {
    const defaults: any = {
      title: 'Escreva um título curto (máximo 60 caracteres), claro e inspirador, adequado para uma oração cristã brasileira. Use linguagem simples e reverente. Retorne apenas o título, sem aspas.',
      subtitle: 'Escreva um subtítulo (máximo 100 caracteres) que complemente o título com leveza e clareza, em tom reverente, sem repetir o título. Apenas o subtítulo, sem aspas.',
      description: 'Escreva 1–2 frases breves que descrevam o áudio da oração para uma lista de conteúdos (tom convidativo, claro e respeitoso). Evite emojis e hashtags. Retorne apenas o texto.',
      preparation: 'Escreva 1–3 frases curtas de preparação para o momento de oração, guiando a pessoa a se aquietar e focar em Deus (tom acolhedor e reverente).',
      text: 'Escreva o texto completo da oração (100–300 palavras), com estrutura tradicional: invocação, petição/gratidão e conclusão. Linguagem reverente, clara e próxima do brasileiro. Não use citações diretas extensas.',
      final_message: 'Escreva 1–2 frases de encerramento curtas que abençoem e encorajem a continuidade da vida de oração. Apenas o texto.',
      pauses: 'essa oração {texto} será escutada em voz alta para as pessoas que querem encontrar um momento íntimo de oração, coloque pausas onde você achar que será melhor para quem está escutando.',
      image_prompt: 'Escreva uma descrição detalhada, vívida e objetiva em português para gerar uma imagem relacionada a esta oração, incluindo elementos de ambiente, luz, composição, expressões e emoções. Evite nomes próprios e texto na imagem. Mínimo 20 caracteres. Retorne apenas a descrição.'
    };
    if (key === 'pauses') {
      setAutoPausesPrompt(defaults[key]);
      if (promptModalField === key) {
        setPromptModalValue(defaults[key]);
      }
    } else {
      setLocalPrompts(prev => ({ ...prev, [key]: defaults[key] }));
      // Se estiver com o modal aberto para o mesmo campo, atualiza o valor exibido também
      if (promptModalField === key) {
        setPromptModalValue(defaults[key]);
      }
    }
  };

  const openPromptModal = (key: keyof typeof localPrompts) => {
    setPromptModalField(key);
    setPromptModalValue((localPrompts as any)[key] || '');
    // Garante que o histórico exibido será apenas do campo atual
    setPromptHistory([]);
    setPromptModalOpen(true);
    // Carregar histórico salvo para o campo
    (async () => {
      try {
        const map: Record<string, string> = {
          title: 'gmanual_title_prompt',
          subtitle: 'gmanual_subtitle_prompt',
          description: 'gmanual_description_prompt',
          preparation: 'gmanual_preparation_prompt',
          text: 'gmanual_text_prompt',
          final_message: 'gmanual_final_message_prompt',
          image_prompt: 'gmanual_image_prompt_prompt',
        };
        const baseKey = map[key];
        const historyKey = `${baseKey}_history`;
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', historyKey)
          .limit(1)
          .maybeSingle();
        if (!error && data && typeof data.value === 'string') {
          try {
            const parsed = JSON.parse(data.value);
            if (Array.isArray(parsed)) {
              setPromptHistory(parsed.filter((v) => v && typeof v.value === 'string'));
            } else {
              setPromptHistory([]);
            }
          } catch (_) {
            setPromptHistory([]);
          }
        } else {
          setPromptHistory([]);
        }
      } catch (_) {
        setPromptHistory([]);
      }
    })();
  };

  const saveSinglePrompt = async () => {
    if (!promptModalField) return;
    setSavingSinglePrompt(true);
    try {
      const map: Record<string, any> = {
        title: 'gmanual_title_prompt',
        subtitle: 'gmanual_subtitle_prompt',
        description: 'gmanual_description_prompt',
        preparation: 'gmanual_preparation_prompt',
        text: 'gmanual_text_prompt',
        final_message: 'gmanual_final_message_prompt',
        pauses: 'gmanual_auto_pauses_prompt',
        image_prompt: 'gmanual_image_prompt_prompt',
      };
      const key = map[promptModalField];
      await updatePromptsSetting(key as any, promptModalValue);
      if (promptModalField === 'pauses') {
        setAutoPausesPrompt(promptModalValue);
      } else {
        setLocalPrompts(prev => ({ ...prev, [promptModalField]: promptModalValue }));
      }
      // Se houver um rótulo preenchido, também registra esta versão com o rótulo
      const labelTrimmed = (promptVersionLabel || '').trim();
      if (labelTrimmed) {
        const historyKey = `${key}_history` as any;
        const newEntry = { value: promptModalValue, label: labelTrimmed, date: new Date().toISOString() };
        const next = [newEntry, ...promptHistory].slice(0, 20);
        await updatePromptsSetting(historyKey, JSON.stringify(next));
        setPromptHistory(next);
        setPromptVersionLabel('');
      }
      toast.success('Prompt salvo!');
      setPromptModalOpen(false);
    } catch (e) {
      toast.error('Erro ao salvar prompt');
    } finally {
      setSavingSinglePrompt(false);
    }
  };

  const savePromptVersion = async () => {
    if (!promptModalField) return;
    try {
      const map: Record<string, string> = {
        title: 'gmanual_title_prompt',
        subtitle: 'gmanual_subtitle_prompt',
        description: 'gmanual_description_prompt',
        preparation: 'gmanual_preparation_prompt',
        text: 'gmanual_text_prompt',
        final_message: 'gmanual_final_message_prompt',
        pauses: 'gmanual_auto_pauses_prompt',
        image_prompt: 'gmanual_image_prompt_prompt',
      };
      const baseKey = map[promptModalField];
      const historyKey = `${baseKey}_history` as any;
      const newEntry = {
        value: promptModalValue,
        label: promptVersionLabel?.trim() || undefined,
        date: new Date().toISOString()
      };
      const next = [newEntry, ...promptHistory].slice(0, 20);
      await updatePromptsSetting(historyKey, JSON.stringify(next));
      setPromptHistory(next);
      setPromptVersionLabel('');
      toast.success('Versão salva');
    } catch (e) {
      toast.error('Erro ao salvar versão');
    }
  };

  const openAddGoalModal = () => {
    setTempGoalName('');
    setAddGoalModalOpen(true);
  };

  const openRenameGoalModal = () => {
    if (!spiritualGoal) {
      toast.error('Selecione um objetivo para renomear');
      return;
    }
    setTempGoalName(spiritualGoal);
    setRenameGoalModalOpen(true);
  };

  const saveAddGoal = async () => {
    await handleAddGoal(tempGoalName);
    setAddGoalModalOpen(false);
    setTempGoalName('');
  };

  const saveRenameGoal = async () => {
    await handleRenameSelectedGoal(tempGoalName);
    setRenameGoalModalOpen(false);
    setTempGoalName('');
  };

  const openAddMomentModal = () => {
    setTempMomentName('');
    setAddMomentModalOpen(true);
  };

  const openRenameMomentModal = () => {
    if (!dayPart) {
      toast.error('Selecione um momento para renomear');
      return;
    }
    setTempMomentName(dayPart);
    setRenameMomentModalOpen(true);
  };

  const saveAddMoment = () => {
    const name = tempMomentName.trim();
    if (!name) return;
    if (moments.includes(name)) {
      toast.error('Já existe um momento com esse nome');
      return;
    }
    const next = [...moments, name];
    setMoments(next);
    setDayPart(name);
    setAddMomentModalOpen(false);
    setTempMomentName('');
    toast.success('Momento adicionado');
  };

  const saveRenameMoment = () => {
    const name = tempMomentName.trim();
    if (!name || !dayPart) return;
    if (moments.includes(name) && name !== dayPart) {
      toast.error('Já existe um momento com esse nome');
      return;
    }
    const idx = moments.findIndex(m => m === dayPart);
    if (idx === -1) return;
    const next = [...moments];
    next[idx] = name;
    setMoments(next);
    setDayPart(name);
    setRenameMomentModalOpen(false);
    setTempMomentName('');
    toast.success('Momento renomeado');
  };

  const generateForField = async (field: 'title'|'subtitle'|'description'|'preparation'|'text'|'final_message'|'image_prompt', overrideCtx?: Record<string, string>): Promise<string | undefined> => {
    setLoadingField(prev => ({ ...prev, [field]: true }));
    try {
      // progresso: início de campo
      try { onProgress && onProgress({ scope: 'field', phase: 'start', name: field }); } catch (_) {}
      let generatedContent: string | undefined;
      const ctx = {
        titulo: prayerData?.title || '',
        subtitulo: prayerData?.subtitle || '',
        descricao: prayerData?.audio_description || '',
        preparacao: prayerData?.preparation_text || '',
        texto: prayerData?.prayer_text || '',
        mensagem_final: prayerData?.final_message || '',
        tema_central: prompt || '',
        objetivo_espiritual: spiritualGoal || '',
        momento_dia: (dayPart && dayPart !== 'Any') ? dayPart : '',
        categoria_nome: categories.find(c => c.id === selectedCategory)?.name || '',
        descricao_imagem_atual: prayerData?.image_prompt || '',
        base_biblica: biblicalBase || ''
      };
      const mergedCtx = { ...ctx, ...(overrideCtx || {}) };

      // Validação relaxada: permitir se override trouxer 'texto' OU se estamos no fluxo automático
      const needsText = field === 'subtitle' || field === 'description' || field === 'preparation' || field === 'final_message' || field === 'title' || field === 'image_prompt';
      const hasTextInOverride = overrideCtx?.texto && (overrideCtx.texto as string).trim().length > 0;
      if (needsText && !isGeneratingAll && !hasTextInOverride && !(mergedCtx.texto || '').trim()) {
        toast.error('Gere primeiro o Texto da Oração para usar neste campo.');
        return;
      }
      
      // Debug logs controlados por localStorage
      if (typeof window !== 'undefined' && window.localStorage.getItem('gm_debug') === '1') {
        console.log(`[generateForField] ${field}`, { 
          hasTextInOverride, 
          mergedCtxTextoLength: (mergedCtx.texto || '').length,
          overrideCtx,
          isGeneratingAll
        });
      }
      const { ok, content, error } = await gmanualGenerateField(field, mergedCtx);
      if (!ok) {
        toast.error(error || 'Falha ao gerar');
        try { onProgress && onProgress({ scope: 'field', phase: 'error', name: field, info: error || 'erro' }); } catch (_) {}
        return;
      }
      generatedContent = content;
      try { onProgress && onProgress({ scope: 'field', phase: 'success', name: field }); } catch (_) {}
      // Guardar valor anterior para undo e aplicar
      setUndoCache(prev => ({ ...prev, [field]:
        field === 'title' ? (prayerData?.title || '') :
        field === 'subtitle' ? (prayerData?.subtitle || '') :
        field === 'description' ? (prayerData?.audio_description || '') :
        field === 'preparation' ? (prayerData?.preparation_text || '') :
        field === 'text' ? (prayerData?.prayer_text || '') :
        field === 'final_message' ? (prayerData?.final_message || '') :
        (prayerData?.image_prompt || '')
      }));

      setPrayerData(prev => prev ? {
        ...prev,
        title: field === 'title' ? content : prev.title,
        subtitle: field === 'subtitle' ? content : prev.subtitle,
        audio_description: field === 'description' ? content : prev.audio_description,
        preparation_text: field === 'preparation' ? content : (prev.preparation_text || ''),
        prayer_text: field === 'text' ? content : prev.prayer_text,
        final_message: field === 'final_message' ? content : (prev.final_message || ''),
        image_prompt: field === 'image_prompt' ? content : prev.image_prompt,
      } : prev);

      toast.success('Conteúdo gerado. Desfazer?', {
        action: {
          label: 'Desfazer',
          onClick: () => {
            const prevVal = undoCache[field] || '';
            setPrayerData(prev => prev ? {
              ...prev,
              title: field === 'title' ? prevVal : prev.title,
              subtitle: field === 'subtitle' ? prevVal : prev.subtitle,
              audio_description: field === 'description' ? prevVal : prev.audio_description,
              preparation_text: field === 'preparation' ? prevVal : (prev.preparation_text || ''),
              prayer_text: field === 'text' ? prevVal : prev.prayer_text,
              final_message: field === 'final_message' ? prevVal : (prev.final_message || ''),
              image_prompt: field === 'image_prompt' ? prevVal : prev.image_prompt,
            } : prev);
          }
        },
        duration: 10000
      });
      // Auto-disparar geração de imagem quando a descrição da imagem for gerada isoladamente
      if (field === 'image_prompt') {
        // aguardar flush do estado antes de compilar o prompt
        await new Promise((r) => setTimeout(r, 0));
        // evitar duplicidade quando já estamos no fluxo em massa (GM) ou no Gerar tudo
        if (!isBatchRef.current && !isGeneratingAll) {
          await handleGenerateImage();
        }
      }
      return generatedContent;
    } catch (e) {
      toast.error('Erro ao gerar');
    } finally {
      setLoadingField(prev => ({ ...prev, [field]: false }));
    }
  };

  // getAudioDuration e formatDuration extraídos para módulos utilitários

  // uploadImageToSupabaseFromUrl extraído para serviço

  const handleCopyToClipboard = async (text: string) => {
    try {
      await copyToClipboardUtil(text);
      toast.success('URL copiada para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar URL');
    }
  };

  // optimizeImagePrompt extraído para util

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

  // Carregar objetivos espirituais do app_settings
  useEffect(() => {
    try {
      const raw = settings?.spiritual_goals;
      if (typeof raw === 'string' && raw.trim()) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          setSpiritualGoals(list.filter((g) => typeof g === 'string'));
        }
      }
    } catch (e) {
      console.warn('Falha ao parsear spiritual_goals do app_settings');
    }
  }, [settings?.spiritual_goals]);

  // Carregar motores de IA do app_settings
  useEffect(() => {
    try {
      const raw = (settings as any)?.audio_ai_engines as string | undefined;
      let list: string[] = [];
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed.filter((e) => typeof e === 'string');
      }
      if (!list || list.length === 0) {
        list = ['ElevenLabs', 'OpenAI Audio'];
      }
      setAiEngines(list);
      const preferred = list.includes('gpt-5') ? 'gpt-5' : (list[0] || '');
      if (!selectedAiEngine || !list.includes(selectedAiEngine)) {
        setSelectedAiEngine(preferred);
      }
    } catch (e) {
      console.warn('Falha ao parsear audio_ai_engines do app_settings');
      const fallback = ['ElevenLabs', 'OpenAI Audio'];
      setAiEngines(fallback);
      const preferred = fallback.includes('gpt-5') ? 'gpt-5' : fallback[0];
      if (!selectedAiEngine || !fallback.includes(selectedAiEngine)) setSelectedAiEngine(preferred);
    }
  }, [settings && (settings as any).audio_ai_engines]);

  // Helpers para gerenciar objetivos espirituais
  const persistGoals = async (list: string[]) => {
    setSpiritualGoals(list);
    await updateAppSetting('spiritual_goals', JSON.stringify(list));
  };

  // Helpers para gerenciar motores de IA
  const persistAiEngines = async (list: string[]) => {
    setAiEngines(list);
    await updateAppSetting('audio_ai_engines' as any, JSON.stringify(list));
  };

  const handleAddGoal = async (nameParam?: string) => {
    const name = (nameParam ?? newGoalName).trim();
    if (!name) return;
    if (spiritualGoals.includes(name)) {
      toast.error('Já existe um objetivo com esse nome');
      return;
    }
    const next = [...spiritualGoals, name];
    await persistGoals(next);
    setSpiritualGoal(name);
    setNewGoalName('');
    toast.success('Objetivo espiritual adicionado');
  };

  const handleRenameSelectedGoal = async (nextNameParam?: string) => {
    const selected = spiritualGoal?.trim();
    const nextName = (nextNameParam ?? editingGoalName).trim();
    if (!selected) {
      toast.error('Selecione um objetivo para renomear');
      return;
    }
    if (!nextName) return;
    const idx = spiritualGoals.findIndex((g) => g === selected);
    if (idx === -1) return;
    if (spiritualGoals.includes(nextName)) {
      toast.error('Já existe um objetivo com esse nome');
      return;
    }
    const next = [...spiritualGoals];
    next[idx] = nextName;
    await persistGoals(next);
    setSpiritualGoal(nextName);
    setEditingGoalName('');
    toast.success('Objetivo espiritual renomeado');
  };

  const handleAddAiEngine = async () => {
    const name = newAiEngineName.trim();
    if (!name) return;
    if (aiEngines.includes(name)) {
      toast.error('Já existe um motor com esse nome');
      return;
    }
    const next = [...aiEngines, name];
    await persistAiEngines(next);
    setSelectedAiEngine(name);
    setNewAiEngineName('');
    toast.success('Motor de IA adicionado');
  };

  const handleRenameSelectedAiEngine = async () => {
    const selected = selectedAiEngine?.trim();
    const nextName = editingAiEngineName.trim();
    if (!selected) {
      toast.error('Selecione um motor de IA para renomear');
      return;
    }
    if (!nextName) return;
    const idx = aiEngines.findIndex((g) => g === selected);
    if (idx === -1) return;
    if (aiEngines.includes(nextName)) {
      toast.error('Já existe um motor com esse nome');
      return;
    }
    const next = [...aiEngines];
    next[idx] = nextName;
    await persistAiEngines(next);
    setSelectedAiEngine(nextName);
    setEditingAiEngineName('');
    toast.success('Motor de IA renomeado');
  };

  const handleRemoveSelectedAiEngine = async () => {
    const selected = selectedAiEngine?.trim();
    if (!selected) return;
    const next = aiEngines.filter((e) => e !== selected);
    if (next.length === 0) {
      toast.error('Mantenha pelo menos um motor de IA');
      return;
    }
    await persistAiEngines(next);
    setSelectedAiEngine(next[0]);
    toast.success('Motor de IA removido');
  };

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

  // Formata texto com pausas configuráveis
  const normalizeSeconds = (value: string): string => {
    // Converte vírgula para ponto e remove espaços
    const normalized = (value || '').toString().trim().replace(',', '.');
    // Mantém apenas números e ponto
    const match = normalized.match(/^[0-9]+(?:\.[0-9]+)?$/);
    if (!match) return '0.0';
    return normalized;
  };

  const applyPacingBreaksToText = (input: string, commaTime: string, periodTime: string): string => {
    if (!input) return '';
    const comma = normalizeSeconds(commaTime);
    const period = normalizeSeconds(periodTime);
    let output = input;
    // Após cada vírgula que não esteja seguida de um <break>
    output = output.replace(/,(?!\s*<break\b)/g, `, <break time="${comma}s" />`);
    // Após ponto final que não seja parte de número decimal nem já seguido de <break>
    output = output.replace(/(^|[^0-9])\.(?![0-9]|\s*<break\b)/g, `$1. <break time="${period}s" />`);
    return output;
  };

  const generateAudio = async (
    overrideText?: string,
    overrideSegments?: { preparation?: string; final_message?: string }
  ) => {
    try { onProgress && onProgress({ scope: 'audio', phase: 'start' }); } catch (_) {}
    const prayerTextToUse = overrideText ?? prayerData?.prayer_text;
    if (!prayerTextToUse?.trim()) {
      toast.error('Primeiro gere uma oração para converter em áudio');
      return;
    }

    if (!selectedVoice) {
      toast.error('Por favor, selecione uma voz');
      return;
    }

    const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === selectedVoice);
    console.log('🎵 Gerando áudio com voz:', selectedVoiceInfo?.name);

    // Montar texto completo com pausas: Preparação, (break) Oração, (break) Mensagem final
    const preparationRaw = ((overrideSegments?.preparation ?? prayerData.preparation_text) || '').trim();
    const prayerRaw = (prayerTextToUse || '').trim();
    const finalMsgRaw = ((overrideSegments?.final_message ?? prayerData.final_message) || '').trim();

    let fullText = '';

    if (pausesAutoEnabled) {
      // Pausas automáticas via OpenAI
      try {
        const rawText = [preparationRaw, prayerRaw, finalMsgRaw].filter(Boolean).join('\n\n');
        const promptWithContext = autoPausesPrompt.replace(/{texto}/g, rawText);
        
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''}`,
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'Você é um assistente que adiciona marcações SSML de pausas (<break time="Xs" />) em textos de oração.' },
              { role: 'user', content: promptWithContext }
            ],
            temperature: 0.7,
          }),
        });

        if (!openAIResponse.ok) {
          throw new Error('Erro ao gerar pausas automáticas');
        }

        const openAIData = await openAIResponse.json();
        fullText = openAIData.choices?.[0]?.message?.content || rawText;
      } catch (err) {
        console.error('Erro ao aplicar pausas automáticas, usando pausas manuais:', err);
        toast.error('Erro ao aplicar pausas automáticas, usando pausas manuais');
        // fallback para pausas manuais
        const preparation = applyPacingBreaksToText(preparationRaw, pauseComma, pausePeriod);
        const prayer = applyPacingBreaksToText(prayerRaw, pauseComma, pausePeriod);
        const finalMsg = applyPacingBreaksToText(finalMsgRaw, pauseComma, pausePeriod);

        const segments: string[] = [];
        if (preparation) segments.push(preparation);
        if (prayer) {
          if (segments.length > 0) segments.push(`<break time="${pauseBeforePrayer}s" />`);
          segments.push(prayer);
          segments.push(`<break time="${pauseAfterPrayer}s" />`);
        }
        if (finalMsg) segments.push(finalMsg);
        fullText = segments.join('\n\n');
      }
    } else {
      // Pausas manuais configuradas
      const preparation = applyPacingBreaksToText(preparationRaw, pauseComma, pausePeriod);
      const prayer = applyPacingBreaksToText(prayerRaw, pauseComma, pausePeriod);
      const finalMsg = applyPacingBreaksToText(finalMsgRaw, pauseComma, pausePeriod);

      const segments: string[] = [];
      if (preparation) segments.push(preparation);
      if (prayer) {
        // Normaliza tempos antes/depois da oração
        const before = normalizeSeconds(pauseBeforePrayer);
        const after = normalizeSeconds(pauseAfterPrayer);
        if (segments.length > 0) segments.push(`<break time="${before}s" />`);
        segments.push(prayer);
        segments.push(`<break time="${after}s" />`);
      }
      if (finalMsg) segments.push(finalMsg);
      fullText = segments.join('\n\n');
    }

    setIsGeneratingAudio(true);
    const requestData = { 
      // Texto final que será enviado para ElevenLabs (com <break ... />)
      text: fullText,
      voice_id: selectedVoice
    };

    try {
      // Log completo para conferência no Debug
      addDebugLog('request', 'audio', { ...requestData, preview: fullText.substring(0, 400) + (fullText.length > 400 ? '...' : '') });

      const result = await requestGenerateAudio(requestData);
      addDebugLog('response', 'audio', { status: result.status, headers: result.headers, rawText: result.rawText, parsedData: result.data });
      if (!result.ok) {
        console.error('❌ Erro detalhado ao gerar áudio:', { status: result.status, statusText: result.statusText, data: result.data, rawResponse: result.rawText });
        addDebugLog('error', 'audio', { status: result.status, statusText: result.statusText, data: result.data, rawResponse: result.rawText });
        toast.error(`Erro ao gerar áudio: ${result.error}`);
        try { onProgress && onProgress({ scope: 'audio', phase: 'error', info: result.error }); } catch (_) {}
        return;
      }
      const data = result.data;

      if (data?.audio_url) {
        setAudioUrl(data.audio_url);
        // 🎵 Definir duração preferindo a enviada pelo servidor; se ausente, medir localmente
        (async () => {
          const durationFromServer = typeof (data?.duration_seconds) === 'number' ? Math.round(data.duration_seconds) : null;
          if (durationFromServer != null) {
            setAudioDuration(durationFromServer);
            console.log('✅ Duração (servidor):', durationFromServer, 'segundos');
            toast.success(`🎵 Áudio gerado com ${selectedVoiceInfo?.name}! Duração: ${formatDuration(durationFromServer)}`);
            return;
          }
          try {
            console.log('🕐 Medindo duração localmente...');
            const duration = await Promise.race([
              getAudioDuration(data.audio_url),
              new Promise<number>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
            ]);
            setAudioDuration(duration);
            console.log('✅ Duração (local):', duration, 'segundos');
            toast.success(`🎵 Áudio gerado com ${selectedVoiceInfo?.name}! Duração: ${formatDuration(duration)}`);
          } catch (durationError) {
            console.warn('⚠️ Duração do áudio indisponível:', durationError);
            setAudioDuration(null);
            toast.success(`🎵 Áudio gerado com ${selectedVoiceInfo?.name}!`);
          }
        })();

        const voiceUsed = data.voice_id_used || selectedVoice;
        const voiceUsedInfo = ELEVENLABS_VOICES.find(v => v.id === voiceUsed);
        setLastVoiceIdUsed(voiceUsed);
        setLastVoiceNameUsed(voiceUsedInfo?.name || "");
        // Persistir voz padrão para uso em /admin/gm
        try {
          await updateAppSetting('gmanual_default_voice_id' as any, voiceUsed || '');
          await updateAppSetting('gmanual_default_voice_name' as any, voiceUsedInfo?.name || '');
        } catch (_) {}
        
        console.log('✅ Áudio gerado com sucesso');
        try { onProgress && onProgress({ scope: 'audio', phase: 'success' }); } catch (_) {}
        
        if (onAudioGenerated) {
          onAudioGenerated({
            text: fullText,
            audio_url: data.audio_url
          });
        }
        return data.audio_url;
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

  // Wrapper compatível com onClick
  const handleGenerateAudio = async () => {
    await generateAudio();
  };

  const handleGenerateImage = async (overridePrompt?: string): Promise<string | null> => {
    // Usar a descrição editável combinada com o template configurável
    const rawPrompt = overridePrompt ?? (prayerData?.image_prompt as unknown);
    const originalPrompt = (typeof rawPrompt === 'string' ? rawPrompt : '').trim();

    if (!originalPrompt) {
      toast.error('Por favor, preencha a descrição da imagem');
      return null;
    }

    // Validar prompt mínimo
    if (originalPrompt.length < 20) {
      toast.error('Por favor, descreva a cena com mais detalhes (mínimo 20 caracteres)');
      return null;
    }

    // Montar contexto de variáveis para template
    const ctx = {
      imagem_descricao: originalPrompt,
      titulo: prayerData?.title || '',
      subtitulo: prayerData?.subtitle || '',
      descricao: prayerData?.audio_description || '',
      preparacao: prayerData?.preparation_text || '',
      texto: prayerData?.prayer_text || '',
      mensagem_final: prayerData?.final_message || '',
      tema_central: prompt || '',
      objetivo_espiritual: spiritualGoal || '',
      momento_dia: (dayPart && dayPart !== 'Any') ? dayPart : '',
      categoria_nome: categories.find(c => c.id === selectedCategory)?.name || '',
      base_biblica: biblicalBase || ''
    } as Record<string, string>;

    // Template atual ou padrão
    const template = (imageGenTemplate && imageGenTemplate.trim()) || '{imagem_descricao}';

    // Aplicar variáveis do template
    const compiled = template.replace(/\{([a-zA-Z_]+)\}/g, (_, key: string) => {
      const v = ctx[key];
      return typeof v === 'string' ? v : '';
    });

    // Otimizar prompt para DALL-E
    const optimizedPrompt = optimizeImagePrompt(compiled);

    console.log('🖼️ Iniciando geração de imagem com DALL-E 3...');
    try { onProgress && onProgress({ scope: 'image', phase: 'start' }); } catch (_) {}
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
        templateUsed: template,
        compiledPrompt: compiled,
        optimizedPrompt,
        requestPayload
      });

      const imageResult = await requestGenerateImage(requestPayload);
      addDebugLog('response', 'image', { status: imageResult.status, headers: imageResult.headers, rawText: imageResult.rawText, parsedData: imageResult.data });
      if (!imageResult.ok) {
        const apiErr = imageResult.error || 
                      (imageResult.data && (imageResult.data.error || imageResult.data.details?.error || imageResult.data.details?.message)) || 
                      'Erro desconhecido ao gerar imagem';
        // Log silencioso no painel de debug (evitar Console Error na UI)
        addDebugLog('error', 'image', {
          error: apiErr,
          status: imageResult.status,
          rawText: imageResult.rawText,
          data: imageResult.data
        });
        toast.message('Imagem indisponível. Salvaremos sem imagem.', { description: String(apiErr) });
        try { onProgress && onProgress({ scope: 'image', phase: 'error', info: String(apiErr) }); } catch (_) {}
        return null;
      }
      const responseData = imageResult.data;

      if (responseData?.image_url) {
        const generatedUrl = responseData.image_url as string;
        console.log('✅ Imagem gerada (URL temporária):', generatedUrl);

        try {
          const publicUrl = await uploadImageToSupabaseFromUrl(generatedUrl);
          setImageUrl(publicUrl);
          console.log('✅ Imagem copiada para Supabase Storage:', publicUrl);
          try { onProgress && onProgress({ scope: 'image', phase: 'success' }); } catch (_) {}
          return publicUrl || null;
        } catch (copyErr) {
          console.warn('⚠️ Falha ao copiar imagem para Supabase; mantendo URL original temporária.', copyErr);
          setImageUrl(generatedUrl);
          try { onProgress && onProgress({ scope: 'image', phase: 'success' }); } catch (_) {}
          return generatedUrl;
        }

        let successMessage = '🖼️ Imagem gerada com sucesso usando DALL-E 3!';
        if (responseData.model_used) {
          successMessage += ` (${responseData.model_used.toUpperCase()})`;
        }
        
        toast.success(successMessage);
        try { onProgress && onProgress({ scope: 'image', phase: 'success' }); } catch (_) {}
        return imageUrl || null;
      } else {
        console.error('❌ URL da imagem não encontrada na resposta');
        toast.error('Nenhuma imagem foi gerada');
        try { onProgress && onProgress({ scope: 'image', phase: 'error', info: 'no_image_url' }); } catch (_) {}
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      addDebugLog('error', 'image', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
      toast.message('Imagem indisponível. Salvaremos sem imagem.', { description: String(errorMessage) });
      try { onProgress && onProgress({ scope: 'image', phase: 'error', info: errorMessage }); } catch (_) {}
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  // Detecção automática da Base bíblica baseada no texto da oração
  useEffect(() => {
    if (!autoDetectBiblicalBase) return;
    const text = (prayerData?.prayer_text || '').trim();
    if (!text) {
      setBiblicalBase('');
      return;
    }
    // Primeiro: regex local instantânea para UX imediata
    const localRegex = /\b([1-3]?\s?[A-ZÁÂÃÀÉÊÍÓÔÕÚ][a-záâãàéêíóôõúç]+)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?/g;
    const localFound: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = localRegex.exec(text)) !== null) {
      const book = m[1];
      const chapter = m[2];
      const verse = m[3];
      const endVerse = m[4];
      let ref = `${book} ${chapter}`;
      if (verse) {
        ref += `:${verse}`;
        if (endVerse) ref += `-${endVerse}`;
      }
      if (!localFound.includes(ref)) localFound.push(ref);
      if (localFound.length >= 3) break;
    }
    if (localFound.length > 0) {
      setBiblicalBase(localFound.join('; '));
    }
    // Depois: chamada leve à API para manter a lógica centralizada e futura melhora
    (async () => {
      try {
        const resp = await fetch('/api/detect-biblical-base', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && typeof data?.joined === 'string') {
          setBiblicalBase((prev) => data.joined || prev || '');
        }
      } catch (_) {
        // silencioso para não poluir a UI
      }
    })();
  }, [prayerData?.prayer_text, autoDetectBiblicalBase]);

  const handleSaveToDatabase = async (
    overrideTitle?: string,
    overrideBase?: string,
    overrideCategoryId?: string,
    skipEnsureFields?: boolean
  ): Promise<{ id: string | null; error?: string }> => {
    // Congelar um snapshot dos estados usados no salvamento para evitar corrida entre itens do lote
    const snapshotPrayer = prayerData ? { ...prayerData } : null;
    // Forçar título vindo do GM se fornecido
    if (overrideTitle && snapshotPrayer) {
      const clean = (overrideTitle || '').trim();
      if (clean) {
        snapshotPrayer.title = clean;
        setPrayerData(prev => prev ? { ...prev, title: clean } : prev);
      }
    }
    // Usar refs reativas para evitar corrida entre itens do lote
    let snapshotAudioUrl = audioUrlRef.current || audioUrl;
    let snapshotImageUrl = imageUrlRef.current || imageUrl;
    // Micro-tique para permitir commit de estados em ambientes lentos
    if (!snapshotAudioUrl) {
      await new Promise(r => setTimeout(r, 0));
      snapshotAudioUrl = audioUrlRef.current || snapshotAudioUrl;
    }
    let snapshotCategory = overrideCategoryId || selectedCategory;
    if (!snapshotCategory) {
      // pequeno fallback para garantir categoria definida em execuções em lote
      await new Promise(r => setTimeout(r, 0));
      snapshotCategory = overrideCategoryId || selectedCategory;
    }
    const snapshotAudioDuration = audioDuration;
    const snapshotBiblicalBase = (overrideBase ?? biblicalBase) || null;
    const snapshotPrompt = (prompt || '').trim();
    const snapshotCategoryName = categories.find(c => c.id === snapshotCategory)?.name || '';

    if (!snapshotAudioUrl) {
      const msg = 'É necessário ter oração completa e áudio gerados para salvar';
      toast.error(msg);
      return { id: null, error: msg };
    }

    if (!snapshotCategory) {
      const msg = 'Por favor, selecione uma categoria';
      toast.error(msg);
      return { id: null, error: msg };
    }

    setIsSaving(true);
    try {
      // Garantia: se algum campo essencial estiver vazio, re-gerar automaticamente
      // Usamos o texto da oração como contexto principal para prompts específicos
      if (snapshotPrayer && !skipEnsureFields) {
        // Se não houver texto ainda por algum motivo, tenta gerar
        const baseTexto = (snapshotPrayer.prayer_text || '').trim();
        let ensuredTexto = baseTexto;
        if (!ensuredTexto) {
          const textoGerado = await generateForField('text');
          if (textoGerado && textoGerado.trim()) {
            ensuredTexto = textoGerado.trim();
            snapshotPrayer.prayer_text = ensuredTexto;
            setPrayerData(prev => prev ? { ...prev, prayer_text: ensuredTexto } : prev);
          }
        }

        const ensureField = async (field: 'title' | 'subtitle' | 'description') => {
          const currentVal =
            field === 'title' ? (snapshotPrayer.title || '') :
            field === 'subtitle' ? (snapshotPrayer.subtitle || '') :
            (snapshotPrayer.audio_description || '');
          if ((currentVal || '').trim()) return;
          const generated = await generateForField(field, {
            texto: ensuredTexto || snapshotPrayer.prayer_text || '',
            base_biblica: snapshotBiblicalBase || '',
            tema_central: snapshotPrompt || '',
            categoria_nome: snapshotCategoryName || ''
          });
          if (generated && generated.trim()) {
            const clean = generated.trim();
            if (field === 'title') {
              snapshotPrayer.title = clean;
              setPrayerData(prev => prev ? { ...prev, title: clean } : prev);
            } else if (field === 'subtitle') {
              snapshotPrayer.subtitle = clean;
              setPrayerData(prev => prev ? { ...prev, subtitle: clean } : prev);
            } else {
              snapshotPrayer.audio_description = clean;
              setPrayerData(prev => prev ? { ...prev, audio_description: clean } : prev);
            }
          }
        };

        await Promise.all([
          ensureField('title'),
          ensureField('subtitle'),
          ensureField('description')
        ]);

        // Garantir segmentos de preparação e mensagem final para compor a transcrição completa
        const ensureSegment = async (seg: 'preparation' | 'final_message') => {
          const currentVal = seg === 'preparation'
            ? (snapshotPrayer.preparation_text || '')
            : (snapshotPrayer.final_message || '');
          if ((currentVal || '').trim()) return;
          const generated = await generateForField(seg, {
            texto: ensuredTexto || snapshotPrayer.prayer_text || '',
            base_biblica: snapshotBiblicalBase || '',
            tema_central: snapshotPrompt || '',
            categoria_nome: snapshotCategoryName || ''
          });
          if (generated && generated.trim()) {
            const clean = generated.trim();
            if (seg === 'preparation') {
              snapshotPrayer.preparation_text = clean;
              setPrayerData(prev => prev ? { ...prev, preparation_text: clean } : prev);
            } else {
              snapshotPrayer.final_message = clean;
              setPrayerData(prev => prev ? { ...prev, final_message: clean } : prev);
            }
          }
        };

        await Promise.all([
          ensureSegment('preparation'),
          ensureSegment('final_message')
        ]);
      }

      // Obter usuário atual para preencher created_by
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ Erro ao obter usuário autenticado:', authError);
      }
      const currentUserId = authData?.user?.id || null;

      const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === selectedVoice);
      
      // Usar apenas a descrição editável do áudio, sem anexar informação da voz
      const finalDescription = `${snapshotPrayer?.audio_description || ''}`;

      // Reforçar snapshot com dados atuais do state caso algum campo esteja vazio
      const ensuredPrayer = (() => {
        const current = prayerData ? { ...prayerData } : null;
        if (!snapshotPrayer) return current;
        const merged: any = { ...snapshotPrayer };
        if ((!merged.title || !merged.title.trim()) && current?.title) merged.title = current.title;
        if ((!merged.subtitle || !merged.subtitle.trim()) && current?.subtitle) merged.subtitle = current.subtitle;
        if ((!merged.audio_description || !merged.audio_description.trim()) && current?.audio_description) merged.audio_description = current.audio_description;
        if ((!merged.preparation_text || !merged.preparation_text.trim()) && current?.preparation_text) merged.preparation_text = current.preparation_text;
        if ((!merged.prayer_text || !merged.prayer_text.trim()) && current?.prayer_text) merged.prayer_text = current.prayer_text;
        if ((!merged.final_message || !merged.final_message.trim()) && current?.final_message) merged.final_message = current.final_message;
        return merged as typeof snapshotPrayer;
      })();

      // Montar transcrição completa na ordem: Preparação, Oração, Mensagem final
      const preparation = (ensuredPrayer?.preparation_text || '').trim();
      const prayer = (ensuredPrayer?.prayer_text || '').trim();
      const finalMsg = (ensuredPrayer?.final_message || '').trim();
      let transcriptFull = [preparation, prayer, finalMsg].filter(Boolean).join('\n\n');
      if (!transcriptFull.trim()) {
        // Fallback: ao menos salvar o texto principal
        transcriptFull = prayer || '';
      }

      // Subtítulo: evitar NULL — usar derivado da base bíblica quando vazio
      const subtitleToSave = (() => {
        const cur = (ensuredPrayer?.subtitle || '').trim();
        if (cur) return cur;
        if (snapshotBiblicalBase) return `De ${snapshotBiblicalBase}`;
        return null;
      })();

      // Medir duração se ausente (fallback defensivo)
      let effectiveDuration: number | null = (snapshotAudioDuration ? Math.round(snapshotAudioDuration) : null);
      if (!effectiveDuration && snapshotAudioUrl) {
        try {
          const measured = await Promise.race([
            getAudioDuration(snapshotAudioUrl),
            new Promise<number>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
          ]) as number;
          if (typeof measured === 'number' && Number.isFinite(measured)) {
            effectiveDuration = Math.round(measured);
            setAudioDuration(effectiveDuration);
          }
        } catch (_) {
          // mantém null se não conseguir medir
        }
      }

      console.log('💾 Salvando oração no banco de dados...');
      console.log('📝 Dados a serem salvos:', {
        title: ensuredPrayer?.title,
        subtitle: subtitleToSave,
        description: finalDescription,
        audio_url: snapshotAudioUrl,
        transcript: transcriptFull?.substring(0, 120) + (transcriptFull.length > 120 ? '...' : ''),
        duration: effectiveDuration,
        category_id: snapshotCategory,
        biblical_base: snapshotBiblicalBase,
        image_present: !!snapshotImageUrl,
      });
      
      // Se houver imagem gerada, enviar para o Storage e obter URL pública
      let coverPublicUrl: string | null = null;
      if (snapshotImageUrl) {
        try {
          coverPublicUrl = await uploadImageToSupabaseFromUrl(snapshotImageUrl);
        } catch (e) {
          console.warn('⚠️ Prosseguindo sem cover_url devido a erro no upload da imagem.');
        }
      }

      // Salvar o áudio na tabela audios
      const { data: audioData, error: audioError } = await supabase
        .from('audios')
        .insert({
          title: ensuredPrayer?.title || '',
          subtitle: subtitleToSave,
          description: finalDescription,
          audio_url: snapshotAudioUrl,
          transcript: transcriptFull,
          duration: effectiveDuration,
          category_id: snapshotCategory,
          cover_url: coverPublicUrl,
          created_by: currentUserId,
          ai_engine: 'gpt-5',
          voice_id: (lastVoiceIdUsed || selectedVoice) || null,
          voice_name: (lastVoiceNameUsed || selectedVoiceInfo?.name) || null,
          biblical_base: snapshotBiblicalBase,
        })
        .select()
        .single();

      if (audioError) {
        console.error('❌ Erro ao salvar áudio:', audioError);
        const msg = (audioError as any)?.message || 'Erro ao salvar no banco de dados';
        toast.error(msg);
        return { id: null, error: msg };
      }

      console.log('✅ Áudio salvo com sucesso:', audioData);

      // Se não havia capa disponível no momento do insert, marcar para atualizar assim que a imagem for gerada
      if (!coverPublicUrl && audioData?.id) {
        setPendingCoverUpdateId(audioData.id as string);
      }

      // Tentar salvar diretamente nas colunas da tabela audios
      let savedDirectlyInTable = false;
      try {
        const { error: updateError } = await supabase
          .from('audios')
          .update({ time: dayPart || 'Any', spiritual_goal: spiritualGoal || null, ai_engine: 'gpt-5', voice_id: (lastVoiceIdUsed || selectedVoice) || null, voice_name: (lastVoiceNameUsed || (ELEVENLABS_VOICES.find(v => v.id === (lastVoiceIdUsed || selectedVoice))?.name)) || null, biblical_base: snapshotBiblicalBase })
          .eq('id', audioData.id);
        if (!updateError) {
          savedDirectlyInTable = true;
        } else {
          console.warn('⚠️ Erro ao atualizar colunas novas em audios:', updateError);
        }
      } catch (e) {
        console.warn('⚠️ Falha inesperada ao atualizar colunas novas em audios');
      }

      // Fallback: salvar metadados no app_settings caso as colunas não existam
      if (!savedDirectlyInTable) {
        try {
          const metaKey = `audio_meta:${audioData.id}`;
          const metaValue = JSON.stringify({ time: dayPart || 'Any', spiritual_goal: spiritualGoal || '', voice_id: (lastVoiceIdUsed || selectedVoice) || '', voice_name: (lastVoiceNameUsed || (ELEVENLABS_VOICES.find(v => v.id === (lastVoiceIdUsed || selectedVoice))?.name)) || '' });
          const { error: metaError } = await supabase
            .from('app_settings')
            .upsert({ key: metaKey, value: metaValue, type: 'text' }, { onConflict: 'key' });
          if (metaError) {
            console.warn('⚠️ Erro ao salvar metadados do áudio (fallback):', metaError);
          }
        } catch (e) {
          console.warn('⚠️ Falha inesperada ao salvar metadados do áudio (fallback)');
        }
      }
      
      let successMessage = '✅ Oração salva no banco de dados com sucesso!';
      if (audioDuration) {
        successMessage += ` Duração: ${formatDuration(audioDuration)}`;
      }
      
      toast.success(successMessage);
      
      // Capturar id salvo antes de limpar
      const savedId = audioData?.id || null;
      
      // Limpar formulário após salvar
      setPrompt('');
      setPrayerData(defaultPrayerData);
      setAudioUrl('');
      setAudioDuration(null);
      setImageUrl('');
      setSelectedCategory('');
      setDayPart('Any');
      setSpiritualGoal('');
      setSelectedAiEngine(aiEngines.includes('gpt-5') ? 'gpt-5' : (aiEngines[0] || ''));
      clearDraft();
      
      return { id: savedId };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro ao salvar:', errorMessage);
      toast.error('❌ Erro ao salvar no banco de dados');
      return { id: null, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };

  const selectedVoiceInfo = ELEVENLABS_VOICES.find(v => v.id === selectedVoice);

  // Ref para acessar o valor mais recente de audioUrl dentro de promises/loops assícronos
  const audioUrlRef = useRef<string>("");
  useEffect(() => { audioUrlRef.current = audioUrl; }, [audioUrl]);

  // Ref e espera para URL da imagem, semelhante ao áudio
  const imageUrlRef = useRef<string>("");
  useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);
  const waitForImageUrl = async (timeoutMs: number = 15000): Promise<string | null> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const current = imageUrlRef.current;
      if (current && current.trim().length > 0) return current;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  };

  const waitForAudioUrl = async (timeoutMs: number = 15000): Promise<string | null> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const current = audioUrlRef.current;
      if (current && current.trim().length > 0) return current;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  };

  // Expor API imperativa para /admin/gm
  useImperativeHandle(ref, () => ({
    setCategoryById: (id: string) => { setSelectedCategory(id || ''); },
    setPrompt: (value: string) => { setPrompt(value || ''); },
    setBiblicalBase: (value: string) => { setAutoDetectBiblicalBase(false); setBiblicalBase(value || ''); },
    handleGenerateAllFields,
    resetForBatchItem: () => {
      // garantir que não haverá detecção automática competindo com o valor informado pelo /admin/gm
      setAutoDetectBiblicalBase(false);
      // limpar estados dependentes do item anterior
      setPrayerData({ ...defaultPrayerData });
      setAudioUrl('');
      setImageUrl('');
      setIsGeneratingAudio(false);
      setIsGeneratingImage(false);
      setIsGeneratingAll(false);
    },
    generateAllWithContext,
    setTitle: (value: string) => { setPrayerData(prev => ({ ...(prev || defaultPrayerData), title: value || '' })); },
    waitForAudioUrl,
    waitForImageUrl,
    handleSaveToDatabase,
    flushState: async () => { await new Promise((r) => setTimeout(r, 0)); },
    getPrayerData: () => prayerData
  }));

  // Notificar prontidão do gerador
  useEffect(() => {
    if (onReady) onReady(true);
    return () => { if (onReady) onReady(false); };
  }, [onReady]);

  // Atualização assíncrona de cover_url quando a imagem fica pronta
  const coverUpdateInFlightRef = useRef<boolean>(false);
  useEffect(() => {
    const tryUpdateCover = async () => {
      if (coverUpdateInFlightRef.current) return;
      const url = (imageUrlRef.current || '').trim();
      const targetId = editingAudioId || pendingCoverUpdateId;
      if (!url || !targetId) return;
      coverUpdateInFlightRef.current = true;
      try {
        let publicUrl: string | null = null;
        try {
          publicUrl = await uploadImageToSupabaseFromUrl(url);
        } catch (e) {
          console.warn('⚠️ Falha ao enviar imagem ao Storage para cover_url:', e);
          publicUrl = null;
        }
        if (!publicUrl) return; // sem URL pública, não atualiza
        const { error } = await supabase
          .from('audios')
          .update({ cover_url: publicUrl })
          .eq('id', targetId);
        if (!error) {
          if (pendingCoverUpdateId) setPendingCoverUpdateId(null);
          if (editingAudio) setEditingAudio((prev) => prev ? ({ ...prev, cover_url: publicUrl } as any) : prev);
          addDebugLog('response', 'image', { action: 'cover_url_updated', audioId: targetId, cover_url: publicUrl });
        } else {
          console.warn('⚠️ Falha ao atualizar cover_url posterior:', error);
          addDebugLog('error', 'image', { action: 'cover_url_update_failed', audioId: targetId, error });
        }
      } finally {
        coverUpdateInFlightRef.current = false;
      }
    };
    tryUpdateCover();
  }, [imageUrl, pendingCoverUpdateId, editingAudioId]);

  return (
    <div className="space-y-6">
      <Card>
        {false && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Gerador de Orações com IA
            </CardTitle>
            <CardDescription>
              Use inteligência artificial para gerar orações completas: título, sub-título, texto, imagem e áudio
            </CardDescription>
          </CardHeader>
        )}
        <CardContent className="space-y-4 pt-4 sm:pt-6">
          <div className="mx-auto w-full max-w-2xl space-y-4">
          {/* Selecionar/editar oração existente (opcional) - Combobox dinâmico */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Editar oração existente (opcional)</label>
            <div className="flex items-center gap-2">
              <Popover open={comboOpen} onOpenChange={(o) => { setComboOpen(o); if (o) preloadAllAudios(); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={comboOpen} className="w-full justify-between">
                    {editingAudio?.title || 'Selecione ou pesquise uma oração...'}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[420px] sm:w-[520px]">
                  <Command>
                    <CommandInput value={comboQuery} onValueChange={setComboQuery} placeholder="Digite para filtrar..." />
                    <CommandList>
                      <CommandEmpty>{comboLoading ? 'Carregando...' : 'Nenhuma oração encontrada'}</CommandEmpty>
                      <CommandGroup heading="Resultados">
                        {((searchResults.length ? searchResults : allAudios) || []).map((a) => (
                          <CommandItem key={a.id} value={a.title || a.id} onSelect={() => { setComboOpen(false); loadAudioForEdit(a.id); setComboQuery(''); }}>
                            {a.title || 'Sem título'}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {editingAudioId && (
                <Button variant="ghost" onClick={clearEditingSelection}>Limpar</Button>
              )}
            </div>
            {editingAudio && (
              <div className="text-xs text-muted-foreground">Editando: <span className="font-medium">{editingAudio.title}</span></div>
            )}
          </div>
          {/* Input para o tema da oração (oculto no front-end, preservado para uso futuro) */}
          {false && (
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
          )}

          {/* Botão para gerar oração completa (oculto no front-end, preservado para uso futuro) */}
          {false && (
            <div className="flex sm:justify-end">
              <Button 
                onClick={handleGeneratePrayer}
                disabled={isGeneratingPrayer}
                className="w-full sm:w-auto"
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
            </div>
          )}

          {/* Campos iniciais: Categoria, Momento, Objetivo espiritual */}
          <CategorySelect categories={categories} selectedCategory={selectedCategory} onChange={setSelectedCategory} />

          {/* Tema central - logo após a categoria */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tema central
            </label>
            <Textarea
              placeholder="Ex: gratidão pela família, pedido de proteção, oração pela paz..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={1}
            />
          </div>

          {/* Objetivo espiritual */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Objetivo espiritual</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1">
                <Select value={spiritualGoal} onValueChange={setSpiritualGoal}>
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
                <Button variant="outline" onClick={openRenameGoalModal}>Renomear</Button>
                <Button variant="outline" onClick={openAddGoalModal}>Adicionar</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Você pode selecionar, criar ou renomear objetivos aqui.</p>
          </div>

          {/* Base bíblica */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                Base bíblica
              </label>
              <div className="flex items-center gap-2">
                <Checkbox id="auto-biblical-base" checked={autoDetectBiblicalBase} onCheckedChange={(v: any) => setAutoDetectBiblicalBase(!!v)} />
                <label htmlFor="auto-biblical-base" className="text-xs text-muted-foreground">Detectar automaticamente</label>
              </div>
            </div>
            <Input
              value={biblicalBase}
              onChange={(e) => setBiblicalBase(e.target.value)}
              placeholder="Ex: João 3:16; Salmo 23"
              disabled={autoDetectBiblicalBase}
            />
            <p className="text-xs text-muted-foreground mt-1">Quando ativado, detectamos automaticamente a base bíblica a partir do texto da oração.</p>
          </div>

          {/* Momento */}
          <div className="space-y-2">
            <label className="block text-sm font-medium mb-2">Momento</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1">
                <Select value={dayPart} onValueChange={setDayPart}>
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
                <Button variant="outline" onClick={openRenameMomentModal}>Renomear</Button>
                <Button variant="outline" onClick={openAddMomentModal}>Adicionar</Button>
              </div>
            </div>
          </div>

          

          {/* Editor colapsável de prompts removido — prompts acessíveis via modal por campo */}

          {/* Dados da oração gerada */}
          {prayerData && (
            <div className="space-y-4">
              {/* Botões de orquestração */}
              <div className="flex sm:justify-end flex-col sm:flex-row">
                <Button 
                  variant="default"
                  onClick={handleGenerateAllFields}
                  disabled={isGeneratingAll || isGeneratingAndSaving}
                  className="w-full sm:w-auto"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando todos os campos...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Gerar todos os campos (ordem inteligente)
                    </>
                  )}
                </Button>

                <Button
                  variant="default"
                  onClick={handleGenerateAndSave}
                  disabled={isGeneratingAndSaving || isGeneratingAll || isSaving}
                  className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2"
                >
                  {isGeneratingAndSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando oração...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Gerar oração
                    </>
                  )}
                </Button>
              </div>

              {/* Preparação para Orar - NOVO CAMPO */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Preparação para Orar
                </label>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => generateForField('preparation')} disabled={!!loadingField['preparation']}>
                    {loadingField['preparation'] ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Wand2 className="mr-2 h-3 w-3"/>Gerar</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { openPromptModal('preparation'); }}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt
                  </Button>
                </div>
                <Textarea
                  value={prayerData.preparation_text || ''}
                  onChange={(e) => setPrayerData({ ...prayerData, preparation_text: e.target.value })}
                  rows={4}
                  className="resize-none"
                  placeholder="Ex: Encontre um lugar tranquilo, respire fundo e entregue seus pensamentos a Deus."
                />
              </div>

              {/* Texto da oração */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Texto da Oração
                </label>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => generateForField('text')} disabled={!!loadingField['text']}>
                    {loadingField['text'] ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Wand2 className="mr-2 h-3 w-3"/>Gerar</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { openPromptModal('text'); }}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt
                  </Button>
                </div>
                <Textarea
                  value={prayerData.prayer_text}
                  onChange={(e) => setPrayerData({...prayerData, prayer_text: e.target.value})}
                  rows={8}
                  className="resize-none"
                />
              </div>

              {/* Base bíblica movida para o topo */}

              {/* Mensagem final - NOVO CAMPO */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Mensagem final
                </label>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => generateForField('final_message')} disabled={!!loadingField['final_message']}>
                    {loadingField['final_message'] ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Wand2 className="mr-2 h-3 w-3"/>Gerar</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { openPromptModal('final_message'); }}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt
                  </Button>
                </div>
                <Textarea
                  value={prayerData.final_message || ''}
                  onChange={(e) => setPrayerData({ ...prayerData, final_message: e.target.value })}
                  rows={4}
                  className="resize-none"
                  placeholder="Ex: Amém. Que a paz de Deus permaneça com você durante o seu dia."
                />
                <div className="text-xs text-muted-foreground mt-1">{(prayerData.final_message || '').length}/240</div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Título da Oração
                </label>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => generateForField('title')} disabled={!!loadingField['title']}>
                    {loadingField['title'] ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Wand2 className="mr-2 h-3 w-3"/>Gerar</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { openPromptModal('title'); }}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt
                  </Button>
                </div>
                <Input
                  value={prayerData.title}
                  onChange={(e) => setPrayerData({...prayerData, title: e.target.value})}
                  className="font-medium"
                />
                <div className="text-xs text-muted-foreground mt-1">{prayerData.title.length}/60</div>
              </div>

              {/* Sub-título */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Sub-título
                </label>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => generateForField('subtitle')} disabled={!!loadingField['subtitle']}>
                    {loadingField['subtitle'] ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Wand2 className="mr-2 h-3 w-3"/>Gerar</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { openPromptModal('subtitle'); }}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt
                  </Button>
                </div>
                <Input
                  value={prayerData.subtitle}
                  onChange={(e) => setPrayerData({...prayerData, subtitle: e.target.value})}
                />
                <div className="text-xs text-muted-foreground mt-1">{prayerData.subtitle.length}/100</div>
              </div>

              {/* Descrição do Áudio - NOVO CAMPO */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Descrição do Áudio
                </label>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => generateForField('description')} disabled={!!loadingField['description']}>
                    {loadingField['description'] ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Wand2 className="mr-2 h-3 w-3"/>Gerar</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { openPromptModal('description'); }}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt
                  </Button>
                </div>
                <Textarea
                  value={prayerData.audio_description}
                  onChange={(e) => setPrayerData({...prayerData, audio_description: e.target.value})}
                  rows={2}
                  placeholder="Descrição que aparecerá no áudio salvo no banco de dados..."
                />
                <div className="text-xs text-muted-foreground mt-1">{(prayerData.audio_description || '').length}/240</div>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Esta descrição será salva no banco de dados junto com a informação da voz selecionada
                </p>
              </div>

              {/* Thumbnail / Imagem: gerar descrição + editar prompt + gerar imagem */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Image className="inline h-4 w-4 mr-1" />
                  Thumbnail
                </label>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => generateForField('image_prompt')} disabled={!!loadingField['image_prompt']}>
                    {loadingField['image_prompt'] ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Wand2 className="mr-2 h-3 w-3"/>Gerar</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { openPromptModal('image_prompt' as any); }}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleGenerateImage()} disabled={isGeneratingImage}>
                    {isGeneratingImage ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Gerando...</>) : (<><Image className="mr-2 h-3 w-3"/>Gerar imagem</>)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setImageGenPromptModalOpen(true)}>
                    <Settings className="h-3 w-3 mr-1"/>Editar prompt DALL‑E
                  </Button>
                </div>
                {/* Campo da descrição da imagem (editável) que será enviada à DALL-E */}
                <Textarea
                  value={prayerData.image_prompt || ''}
                  onChange={(e) => setPrayerData({ ...prayerData, image_prompt: e.target.value })}
                  rows={3}
                  className="resize-none"
                  placeholder="Descreva a imagem que deseja gerar (este texto será enviado ao DALL-E)"
                />
                <div className="text-xs text-muted-foreground mt-1">{(prayerData.image_prompt || '').length} caracteres</div>
              </div>


              {/* Imagem gerada (mostrada vazia até gerar) */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Imagem Gerada (DALL-E 3 - HD)
                </label>
                <div className="border rounded-lg p-2">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt="Imagem da oração gerada por IA" 
                      className="w-full max-w-md mx-auto rounded-md"
                    />
                  ) : (
                    <div className="w-full max-w-md mx-auto rounded-md bg-white text-xs text-muted-foreground text-center py-16">
                      A imagem aparecerá aqui após gerar
                    </div>
                  )}
                </div>
                
                {/* URL da imagem (mostrada vazia até gerar) */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    URL da Imagem (será salva no banco de dados):
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={imageUrl || ''}
                      readOnly
                      className="text-xs font-mono bg-white"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => imageUrl && handleCopyToClipboard(imageUrl)}
                      className="shrink-0"
                      disabled={!imageUrl}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => imageUrl && window.open(imageUrl, '_blank')}
                      className="shrink-0"
                      disabled={!imageUrl}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Seletor de categoria - removido daqui (foi movido para o topo) */}

      {/* Momento do dia - removido daqui (foi movido para o topo) */}

      {/* Objetivo espiritual - removido daqui (foi movido para o topo) */}

              {/* Seletor de voz e botão para gerar áudio */}
              <VoiceSelector selectedVoice={selectedVoice} onChange={setSelectedVoice} />

                {/* Configuração de Pausas */}
              <PausesConfig
                pausesAutoEnabled={pausesAutoEnabled}
                setPausesAutoEnabled={(v) => {
                  setPausesAutoEnabled(v);
                  updateAppSetting('gmanual_pauses_auto_enabled', v ? 'true' : 'false');
                }}
                autoPausesPrompt={autoPausesPrompt}
                onEditAutoPrompt={() => {
                        setPromptModalField('pauses' as any);
                        setPromptModalValue(autoPausesPrompt);
                        setPromptHistory([]);
                        setPromptModalOpen(true);
                        (async () => {
                          try {
                            const { data, error } = await supabase
                              .from('app_settings')
                              .select('value')
                              .eq('key', 'gmanual_auto_pauses_prompt_history')
                              .limit(1)
                              .maybeSingle();
                            if (!error && data?.value) {
                              try {
                                const hist = JSON.parse(data.value);
                                if (Array.isArray(hist)) setPromptHistory(hist);
                              } catch (_) {}
                            }
                          } catch (_) {}
                        })();
                      }}
                pauseComma={pauseComma}
                setPauseComma={(v) => { setPauseComma(v); updateAppSetting('gmanual_pause_comma', v); }}
                pausePeriod={pausePeriod}
                setPausePeriod={(v) => { setPausePeriod(v); updateAppSetting('gmanual_pause_period', v); }}
                pauseBeforePrayer={pauseBeforePrayer}
                setPauseBeforePrayer={(v) => { setPauseBeforePrayer(v); updateAppSetting('gmanual_pause_before_prayer', v); }}
                pauseAfterPrayer={pauseAfterPrayer}
                setPauseAfterPrayer={(v) => { setPauseAfterPrayer(v); updateAppSetting('gmanual_pause_after_prayer', v); }}
              />

                {/* Botão para gerar áudio */}
                <div className="flex sm:justify-end">
                  <Button 
                    onClick={handleGenerateAudio}
                    disabled={isGeneratingAudio || !selectedVoice}
                    variant="outline"
                    className="w-full sm:w-auto"
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
            <div className="flex sm:justify-end">
              <Button 
                onClick={editingAudioId ? handleUpdateInDatabase : () => handleSaveToDatabase()}
                disabled={isSaving || !selectedCategory}
                className="w-full sm:w-auto"
                variant="default"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingAudioId ? 'Atualizando...' : 'Salvando...'}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editingAudioId ? 'Atualizar Oração' : 'Salvar Oração Completa no Banco'}
                    {audioDuration && (
                      <span className="ml-2 text-xs opacity-75">
                        (com duração: {formatDuration(audioDuration)})
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Seção de Debug */}
      <DebugPanel showDebug={showDebug} setShowDebug={setShowDebug} debugLogs={debugLogs} onClear={clearLogs} />

      {/* Modal de edição de Prompt individual */}
      <Dialog open={promptModalOpen} onOpenChange={setPromptModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-black">
              {promptModalField === 'title' && 'Editar Prompt: Título'}
              {promptModalField === 'subtitle' && 'Editar Prompt: Sub-título'}
              {promptModalField === 'description' && 'Editar Prompt: Descrição (áudio)'}
              {promptModalField === 'preparation' && 'Editar Prompt: Preparação'}
              {promptModalField === 'text' && 'Editar Prompt: Texto (oração)'}
              {promptModalField === 'final_message' && 'Editar Prompt: Mensagem final'}
              {promptModalField === 'pauses' && 'Editar Prompt: Pausas Automáticas'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={promptModalValue}
              onChange={(e) => setPromptModalValue(e.target.value)}
              rows={12}
              className="text-sm bg-white text-black placeholder:text-gray-500 dark:bg-neutral-900 dark:text-white dark:placeholder:text-gray-400"
            />
            <div className="text-sm text-muted-foreground break-words whitespace-normal">
              Variáveis: {`{titulo}`} {`{subtitulo}`} {`{descricao}`} {`{preparacao}`} {`{texto}`} {`{mensagem_final}`} {`{tema_central}`} {`{objetivo_espiritual}`} {`{momento_dia}`} {`{categoria_nome}`} {`{base_biblica}`}
            </div>
            {/* Controles de versão do prompt */}
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Rótulo (opcional) desta versão"
                  value={promptVersionLabel}
                  onChange={(e) => setPromptVersionLabel(e.target.value)}
                  className="bg-white text-black placeholder:text-gray-500 dark:bg-neutral-900 dark:text-white dark:placeholder:text-gray-400"
                />
                <Button variant="outline" onClick={savePromptVersion} className="bg-white text-black border-gray-300 hover:bg-gray-100">Salvar versão</Button>
              </div>
              {promptHistory.length > 0 && (
                <div className="border rounded-md p-2 bg-white text-black dark:bg-neutral-900 dark:text-white">
                  <div className="text-sm font-medium mb-1">Versões salvas</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {promptHistory.map((v, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                        <button
                          className="text-left flex-1 hover:underline"
                          onClick={() => setPromptModalValue(v.value)}
                          title={new Date(v.date).toLocaleString()}
                        >
                          {(v.label || 'Sem rótulo')} — {new Date(v.date).toLocaleDateString()} {new Date(v.date).toLocaleTimeString()}
                        </button>
                        <Button variant="outline" size="sm" className="bg-white text-black border-gray-300 hover:bg-gray-100 dark:bg-neutral-900 dark:text-white dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => setPromptModalValue(v.value)}>Restaurar</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2 w-full justify-end">
              {promptModalField && (
                <Button variant="outline" onClick={() => restoreDefaultPrompt(promptModalField!)} className="bg-white text-black border-gray-300 hover:bg-gray-100">
                  Restaurar padrão
                </Button>
              )}
              <Button onClick={saveSinglePrompt} disabled={savingSinglePrompt}>
                {savingSinglePrompt ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Salvando...</>) : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Edição do prompt usado para enviar ao DALL‑E */}
      <Dialog
        open={imageGenPromptModalOpen}
        onOpenChange={async (open) => {
          setImageGenPromptModalOpen(open);
          if (open) {
            try {
              // 1) Carregar histórico (aceita string JSON ou valor já como array)
              const { data: histData, error: histErr } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'gmanual_image_generate_template_history')
                .limit(1)
                .maybeSingle();
              if (!histErr && histData) {
                const v = (histData as any).value;
                try {
                  const parsed = typeof v === 'string' ? JSON.parse(v) : v;
                  if (Array.isArray(parsed)) {
                    setImageGenTemplateHistory(parsed.filter((e) => e && typeof e.value === 'string'));
                  } else {
                    setImageGenTemplateHistory([]);
                  }
                } catch (_) {
                  setImageGenTemplateHistory([]);
                }
              } else {
                setImageGenTemplateHistory([]);
              }

              // 2) Carregar template atual diretamente do banco
              const { data: curData, error: curErr } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'gmanual_image_generate_template')
                .limit(1)
                .maybeSingle();
              if (!curErr && curData) {
                const v = (curData as any).value;
                const value = typeof v === 'string' ? v : (v?.toString?.() ?? '');
                if (value) setImageGenTemplate(value);
              }

              // 3) Fallback: se não houver template ativo, usar a versão mais recente do histórico
              setTimeout(() => {
                setImageGenTemplate((prev) => {
                  if (prev && prev.trim()) return prev;
                  const latest = (imageGenTemplateHistory && imageGenTemplateHistory[0]?.value) || '';
                  return latest || '{imagem_descricao}';
                });
              }, 0);
            } catch (_) {
              setImageGenTemplateHistory([]);
            }
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-black">Editar Prompt para DALL‑E</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={imageGenTemplate}
              onChange={(e) => setImageGenTemplate(e.target.value)}
              rows={10}
              className="text-sm bg-white text-black placeholder:text-gray-500 dark:bg-neutral-900 dark:text-white dark:placeholder:text-gray-400"
            />
            <div className="text-sm text-muted-foreground break-words whitespace-normal">
              Variáveis disponíveis: {`{imagem_descricao}`} {`{titulo}`} {`{subtitulo}`} {`{descricao}`} {`{preparacao}`} {`{texto}`} {`{mensagem_final}`} {`{tema_central}`} {`{objetivo_espiritual}`} {`{momento_dia}`} {`{categoria_nome}`} {`{base_biblica}`}
            </div>
            <div className="text-xs text-muted-foreground">
              Dica: o padrão é {`{imagem_descricao}`}. Edite para acrescentar instruções antes/depois da variável.
            </div>
            {/* Controles de versão para o template DALL‑E */}
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Rótulo (opcional) desta versão"
                  value={imageGenTemplateVersionLabel}
                  onChange={(e) => setImageGenTemplateVersionLabel(e.target.value)}
                  className="bg-white text-black placeholder:text-gray-500 dark:bg-neutral-900 dark:text-white dark:placeholder:text-gray-400"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const newEntry = { value: imageGenTemplate, label: imageGenTemplateVersionLabel?.trim() || undefined, date: new Date().toISOString() };
                      const next = [newEntry, ...imageGenTemplateHistory].slice(0, 20);
                      await updatePromptsSetting('gmanual_image_generate_template_history' as any, JSON.stringify(next));
                      setImageGenTemplateHistory(next);
                      setImageGenTemplateVersionLabel('');
                      toast.success('Versão do prompt DALL‑E salva');
                    } catch (_) {
                      toast.error('Erro ao salvar versão');
                    }
                  }}
                  className="bg-white text-black border-gray-300 hover:bg-gray-100"
                >
                  Salvar versão
                </Button>
              </div>
              {imageGenTemplateHistory.length > 0 && (
                <div className="border rounded-md p-2 bg-white text-black dark:bg-neutral-900 dark:text-white">
                  <div className="text-sm font-medium mb-1">Versões salvas</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {imageGenTemplateHistory.map((v, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                        <button
                          className="text-left flex-1 hover:underline"
                          onClick={() => setImageGenTemplate(v.value)}
                          title={new Date(v.date).toLocaleString()}
                        >
                          {(v.label || 'Sem rótulo')} — {new Date(v.date).toLocaleDateString()} {new Date(v.date).toLocaleTimeString()}
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white text-black border-gray-300 hover:bg-gray-100 dark:bg-neutral-900 dark:text-white dark:border-neutral-700 dark:hover:bg-neutral-800"
                          onClick={() => setImageGenTemplate(v.value)}
                        >
                          Restaurar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2 w-full justify-end">
              <Button
                variant="outline"
                onClick={() => setImageGenTemplate('{imagem_descricao}')}
                className="bg-white text-black border-gray-300 hover:bg-gray-100"
              >
                Restaurar padrão
              </Button>
              <Button
                onClick={async () => {
                  try {
                    setSavingImageGenTemplate(true);
                    await updatePromptsSetting('gmanual_image_generate_template' as any, imageGenTemplate);
                    // Se houver rótulo, também salvar versão
                    const label = (imageGenTemplateVersionLabel || '').trim();
                    if (label) {
                      const newEntry = { value: imageGenTemplate, label, date: new Date().toISOString() };
                      const next = [newEntry, ...imageGenTemplateHistory].slice(0, 20);
                      await updatePromptsSetting('gmanual_image_generate_template_history' as any, JSON.stringify(next));
                      setImageGenTemplateHistory(next);
                      setImageGenTemplateVersionLabel('');
                    }
                    toast.success('Prompt DALL‑E salvo!');
                    setImageGenPromptModalOpen(false);
                  } catch (_) {
                    toast.error('Erro ao salvar prompt DALL‑E');
                  } finally {
                    setSavingImageGenTemplate(false);
                  }
                }}
                disabled={savingImageGenTemplate}
              >
                {savingImageGenTemplate ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Salvando...</>) : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Objetivo */}
      <Dialog open={addGoalModalOpen} onOpenChange={setAddGoalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo objetivo espiritual</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              placeholder="Nome do objetivo"
              value={tempGoalName}
              onChange={(e) => setTempGoalName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={saveAddGoal} disabled={!tempGoalName.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Renomear Objetivo */}
      <Dialog open={renameGoalModalOpen} onOpenChange={setRenameGoalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear objetivo</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              placeholder="Novo nome"
              value={tempGoalName}
              onChange={(e) => setTempGoalName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={saveRenameGoal} disabled={!tempGoalName.trim()}>Renomear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Momento */}
      <Dialog open={addMomentModalOpen} onOpenChange={setAddMomentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo momento</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              placeholder="Nome do momento"
              value={tempMomentName}
              onChange={(e) => setTempMomentName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={saveAddMoment} disabled={!tempMomentName.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Renomear Momento */}
      <Dialog open={renameMomentModalOpen} onOpenChange={setRenameMomentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear momento</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              placeholder="Novo nome"
              value={tempMomentName}
              onChange={(e) => setTempMomentName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={saveRenameMoment} disabled={!tempMomentName.trim()}>Renomear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default AIGenerator;