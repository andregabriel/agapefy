"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Volume2, Plus, Trash2, Play, Pause, CheckCircle, XCircle, AlertCircle, Image } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCategories } from '@/lib/supabase-queries';
import { authFetch } from '@/lib/auth-fetch';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface VoiceSelection {
  id: string;
  voiceId: string;
  voiceName: string;
}

interface GenerationStep {
  name: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
}

interface GenerationProgress {
  total: number;
  completed: number;
  current: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  results: GenerationResult[];
}

interface GenerationResult {
  index: number;
  title: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
  steps: GenerationStep[];
}

// Vozes do ElevenLabs
const ELEVENLABS_VOICES = [
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Pastor Gabriel',
    gender: 'Masculina',
    description: 'Voz masculina solene e respeitosa'
  },
  {
    id: 'wBXNqKUATyqu0RtYt25i',
    name: 'Adam',
    gender: 'Masculina',
    description: 'Voz masculina clara e natural (ElevenLabs Adam)'
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',
    name: 'Padre Miguel',
    gender: 'Masculina', 
    description: 'Voz masculina serena e contemplativa'
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Pastora Maria',
    gender: 'Feminina',
    description: 'Voz feminina suave e acolhedora'
  },
  {
    id: 'ThT5KcBeYPX3keUQqHPh',
    name: 'Irmã Clara',
    gender: 'Feminina',
    description: 'Voz feminina doce e reverente'
  }
];

export default function BatchGenerator() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMode, setCategoryMode] = useState<'new' | 'existing'>('new');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [prayerCount, setPrayerCount] = useState(5);
  const [voiceSelections, setVoiceSelections] = useState<VoiceSelection[]>([]);
  const [progress, setProgress] = useState<GenerationProgress>({
    total: 0,
    completed: 0,
    current: '',
    status: 'idle',
    results: []
  });

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

  // Inicializar seleções de voz quando quantidade muda
  useEffect(() => {
    const newSelections: VoiceSelection[] = [];
    for (let i = 0; i < prayerCount; i++) {
      const existingSelection = voiceSelections[i];
      newSelections.push({
        id: `prayer-${i}`,
        voiceId: existingSelection?.voiceId || ELEVENLABS_VOICES[0].id,
        voiceName: existingSelection?.voiceName || ELEVENLABS_VOICES[0].name
      });
    }
    setVoiceSelections(newSelections);
  }, [prayerCount]);

  const updateVoiceSelection = (index: number, voiceId: string) => {
    const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId);
    if (!voice) return;

    setVoiceSelections(prev => prev.map((selection, i) => 
      i === index 
        ? { ...selection, voiceId, voiceName: voice.name }
        : selection
    ));
  };

  const updateStepStatus = (
    prayerIndex: number, 
    stepName: string, 
    status: 'pending' | 'generating' | 'completed' | 'error',
    error?: string
  ) => {
    setProgress(prev => ({
      ...prev,
      results: prev.results.map(result => 
        result.index === prayerIndex + 1
          ? {
              ...result,
              steps: result.steps.map(step =>
                step.name === stepName
                  ? { ...step, status, error }
                  : step
              )
            }
          : result
      )
    }));
  };

  const generateSinglePrayer = async (
    categoryName: string, 
    categoryId: string, 
    voiceId: string, 
    index: number
  ): Promise<{ success: boolean; title?: string; error?: string }> => {
    try {
      // 1. Gerar conteúdo da oração com OpenAI
      updateStepStatus(index, 'Conteúdo', 'generating');
      const prayerPrompt = `Crie uma oração relacionada ao tema "${categoryName}". A oração deve ser única e específica para este contexto.`;
      
      const prayerResponse = await authFetch('/api/generate-prayer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prayerPrompt }),
      });

      if (!prayerResponse.ok) {
        updateStepStatus(index, 'Conteúdo', 'error', 'Erro ao gerar conteúdo');
        throw new Error('Erro ao gerar oração');
      }

      const prayerData = await prayerResponse.json();
      updateStepStatus(index, 'Conteúdo', 'completed');

      // 2. Gerar áudio com ElevenLabs
      updateStepStatus(index, 'Áudio', 'generating');
      const audioResponse = await authFetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: prayerData.prayer_text,
          voice_id: voiceId
        }),
      });

      if (!audioResponse.ok) {
        updateStepStatus(index, 'Áudio', 'error', 'Erro ao gerar áudio');
        throw new Error('Erro ao gerar áudio');
      }

      const audioData = await audioResponse.json();
      updateStepStatus(index, 'Áudio', 'completed');

      // 3. Gerar imagem com DALL-E
      updateStepStatus(index, 'Imagem', 'generating');
      const imagePrompt = `Uma imagem religiosa serena e contemplativa relacionada ao tema "${categoryName}" e à oração "${prayerData.title}". Estilo artístico, cores suaves, atmosfera espiritual.`;
      
      const imageResponse = await authFetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt }),
      });

      let imageUrl = null;
      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        imageUrl = imageData.image_url;
        updateStepStatus(index, 'Imagem', 'completed');
      } else {
        updateStepStatus(index, 'Imagem', 'error', 'Erro ao gerar imagem');
        console.warn('Erro ao gerar imagem, continuando sem imagem');
      }

      // 4. Se imagem existir, transferir para Supabase Storage e obter URL pública
      let coverPublicUrl: string | null = null;
      if (imageUrl) {
        try {
          const resp = await authFetch('/api/image-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl })
          });
          if (resp.ok) {
            const contentType = resp.headers.get('content-type') || 'image/png';
            const blob = await resp.blob();

            let ext = 'png';
            if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
            if (contentType.includes('webp')) ext = 'webp';
            // Bucket e prefixo conforme o projeto
            const BUCKET = 'media';
            const PREFIX = 'app-26/images';
            const fileName = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from(BUCKET)
              .upload(fileName, blob, { cacheControl: '3600', upsert: false, contentType });

            if (!uploadError) {
              const { data: publicData } = supabase.storage
                .from(BUCKET)
                .getPublicUrl(fileName);
              coverPublicUrl = publicData?.publicUrl || null;
            } else {
              console.warn('Falha ao subir imagem de lote para Supabase:', uploadError);
            }
          }
        } catch (e) {
          console.warn('Erro ao transferir imagem para Supabase (lote):', e);
        }
      }

      // 5. Salvar no banco de dados
      updateStepStatus(index, 'Salvando', 'generating');
      // Obter usuário atual para preencher created_by
      let currentUserId: string | null = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        currentUserId = authData?.user?.id || null;
      } catch {}
      const usedVoice = ELEVENLABS_VOICES.find(v => v.id === voiceId);
      const { error: saveError } = await supabase
        .from('audios')
        .insert({
          title: prayerData.title,
          subtitle: prayerData.subtitle,
          description: prayerData.subtitle,
          audio_url: audioData.audio_url,
          transcript: prayerData.prayer_text,
          category_id: categoryId,
          cover_url: coverPublicUrl,
          created_by: currentUserId,
          voice_id: voiceId,
          voice_name: usedVoice?.name || null,
        });

      if (saveError) {
        updateStepStatus(index, 'Salvando', 'error', 'Erro ao salvar no banco');
        throw new Error('Erro ao salvar no banco de dados');
      }

      updateStepStatus(index, 'Salvando', 'completed');
      return { success: true, title: prayerData.title };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  };

  const handleStartBatchGeneration = async () => {
    if (categoryMode === 'new' && !newCategoryName.trim()) {
      toast.error('Por favor, insira o nome da nova categoria');
      return;
    }

    if (categoryMode === 'existing' && !selectedCategoryId) {
      toast.error('Por favor, selecione uma categoria existente');
      return;
    }

    if (prayerCount < 1 || prayerCount > 20) {
      toast.error('Quantidade deve ser entre 1 e 20 orações');
      return;
    }

    let targetCategoryId = selectedCategoryId;
    let categoryName = '';

    // Criar nova categoria se necessário
    if (categoryMode === 'new') {
      try {
        // Buscar a maior posição atual para colocar a nova categoria no final
        const { data: maxPositionData } = await supabase
          .from('categories')
          .select('order_position')
          .order('order_position', { ascending: false })
          .limit(1);

        const nextPosition = (maxPositionData?.[0]?.order_position || 0) + 1;

        const { data: newCategory, error: categoryError } = await supabase
          .from('categories')
          .insert({
            name: newCategoryName.trim(),
            description: newCategoryDescription.trim() || null,
            order_position: nextPosition,
          })
          .select()
          .single();

        if (categoryError) {
          toast.error('Erro ao criar nova categoria');
          return;
        }

        targetCategoryId = newCategory.id;
        categoryName = newCategory.name;
        
        // Atualizar lista de categorias
        setCategories(prev => [...prev, newCategory]);
        
      } catch (error) {
        toast.error('Erro ao criar categoria');
        return;
      }
    } else {
      const category = categories.find(c => c.id === selectedCategoryId);
      categoryName = category?.name || '';
    }

    // Inicializar progresso com steps detalhados
    const initialResults: GenerationResult[] = [];
    for (let i = 0; i < prayerCount; i++) {
      initialResults.push({
        index: i + 1,
        title: `Oração ${i + 1}`,
        status: 'pending',
        steps: [
          { name: 'Conteúdo', status: 'pending' },
          { name: 'Áudio', status: 'pending' },
          { name: 'Imagem', status: 'pending' },
          { name: 'Salvando', status: 'pending' }
        ]
      });
    }

    setProgress({
      total: prayerCount,
      completed: 0,
      current: 'Iniciando geração em lote...',
      status: 'generating',
      results: initialResults
    });

    // Gerar orações uma por uma
    for (let i = 0; i < prayerCount; i++) {
      const voiceSelection = voiceSelections[i];
      
      setProgress(prev => ({
        ...prev,
        current: `Gerando oração ${i + 1} de ${prayerCount} (${voiceSelection.voiceName})`,
        results: prev.results.map(result => 
          result.index === i + 1 
            ? { ...result, status: 'generating' }
            : result
        )
      }));

      const result = await generateSinglePrayer(
        categoryName,
        targetCategoryId,
        voiceSelection.voiceId,
        i
      );

      setProgress(prev => ({
        ...prev,
        completed: prev.completed + 1,
        results: prev.results.map(resultItem => 
          resultItem.index === i + 1 
            ? { 
                ...resultItem, 
                status: result.success ? 'completed' : 'error',
                title: result.title || resultItem.title,
                error: result.error
              }
            : resultItem
        )
      }));

      // Pequena pausa entre gerações para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setProgress(prev => ({
      ...prev,
      status: 'completed',
      current: 'Geração em lote concluída!'
    }));

    const successCount = progress.results.filter(r => r.status === 'completed').length;
    toast.success(`✅ Geração concluída! ${successCount} de ${prayerCount} orações geradas com sucesso.`);
  };

  const resetGeneration = () => {
    setProgress({
      total: 0,
      completed: 0,
      current: '',
      status: 'idle',
      results: []
    });
    
    if (categoryMode === 'new') {
      setNewCategoryName('');
      setNewCategoryDescription('');
    }
  };

  const isGenerating = progress.status === 'generating';
  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Geração em Lote de Orações
          </CardTitle>
          <CardDescription>
            Gere múltiplas orações automaticamente para uma categoria nova ou existente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seleção do modo de categoria */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Tipo de Categoria
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={categoryMode === 'new' ? 'default' : 'outline'}
                onClick={() => setCategoryMode('new')}
                disabled={isGenerating}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <Plus className="h-5 w-5" />
                <span>Nova Categoria</span>
              </Button>
              <Button
                variant={categoryMode === 'existing' ? 'default' : 'outline'}
                onClick={() => setCategoryMode('existing')}
                disabled={isGenerating}
                className="h-auto p-4 flex flex-col items-center space-y-2"
              >
                <Volume2 className="h-5 w-5" />
                <span>Categoria Existente</span>
              </Button>
            </div>
          </div>

          {/* Configuração da categoria */}
          {categoryMode === 'new' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nome da Nova Categoria
                </label>
                <Input
                  placeholder="Ex: Orações de Gratidão, Pedidos de Proteção..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Descrição da Categoria (Opcional)
                </label>
                <Input
                  placeholder="Descrição da categoria..."
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">
                Categoria Existente
              </label>
              <Select 
                value={selectedCategoryId} 
                onValueChange={setSelectedCategoryId}
                disabled={isGenerating}
              >
                <SelectTrigger>
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
          )}

          {/* Quantidade de orações */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Quantidade de Orações (1-20)
            </label>
            <Input
              type="number"
              min="1"
              max="20"
              value={prayerCount}
              onChange={(e) => setPrayerCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              disabled={isGenerating}
            />
          </div>

          {/* Seleção de vozes */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Vozes para cada Oração
            </label>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {voiceSelections.map((selection, index) => (
                <div key={selection.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <span className="text-sm font-medium w-20">
                    Oração {index + 1}:
                  </span>
                  <Select
                    value={selection.voiceId}
                    onValueChange={(voiceId) => updateVoiceSelection(index, voiceId)}
                    disabled={isGenerating}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
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
                </div>
              ))}
            </div>
          </div>

          {/* Botão de geração */}
          <div className="flex space-x-4">
            <Button
              onClick={handleStartBatchGeneration}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando Lote...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Iniciar Geração em Lote
                </>
              )}
            </Button>
            
            {progress.status !== 'idle' && (
              <Button
                variant="outline"
                onClick={resetGeneration}
                disabled={isGenerating}
              >
                Resetar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progresso da geração */}
      {progress.status !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Progresso da Geração</span>
              <span className="text-sm font-normal">
                {progress.completed} / {progress.total}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barra de progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.current}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Lista de resultados com steps detalhados */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {progress.results.map((result) => (
                <div key={result.index} className="border rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex-shrink-0">
                      {result.status === 'pending' && (
                        <AlertCircle className="h-5 w-5 text-gray-400" />
                      )}
                      {result.status === 'generating' && (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      )}
                      {result.status === 'completed' && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {result.status === 'error' && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      {result.error && (
                        <p className="text-xs text-red-600 truncate">{result.error}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Steps detalhados */}
                  <div className="grid grid-cols-4 gap-2">
                    {result.steps.map((step) => (
                      <div key={step.name} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                        <div className="flex-shrink-0">
                          {step.status === 'pending' && (
                            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                          )}
                          {step.status === 'generating' && (
                            <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
                          )}
                          {step.status === 'completed' && (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                          {step.status === 'error' && (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        <span className="text-xs font-medium truncate">{step.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
