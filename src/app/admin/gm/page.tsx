"use client";

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Pause, Play, XCircle, CheckCircle, AlertCircle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCategories, type Category, ensurePlaylistByTitleInsensitive, addAudioToPlaylist } from '@/lib/supabase-queries';
import AIGenerator from '@/components/admin/AIGenerator';
import type { AIGeneratorHandle, AIGeneratorProps } from '@/types/ai';
import type { AIGProgressEvent } from '@/types/ai';

type BatchLine = {
  titulo: string;
  base: string;
  tema: string;
  playlists: string[];
  raw: string;
  error?: string;
};

type StepStatus = 'pending' | 'running' | 'success' | 'error';

type ItemProgress = {
  idx: number;
  titulo: string;
  steps: { name: string; status: StepStatus; message?: string }[];
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  audioId?: string | null;
};

const MAX_ITEMS = 30;

export default function GmPage() {
  const aiRef = useRef<AIGeneratorHandle | null>(null);
  const AIGeneratorWithRef = AIGenerator as unknown as React.ForwardRefExoticComponent<React.PropsWithoutRef<AIGeneratorProps> & React.RefAttributes<AIGeneratorHandle>>;
  const [aiReady, setAiReady] = useState<boolean>(false);

  // Categoria
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDescription, setNewCategoryDescription] = useState<string>('');

  // Input NDJSON
  const [input, setInput] = useState<string>('');
  const [lines, setLines] = useState<BatchLine[]>([]);
  const [validLines, setValidLines] = useState<BatchLine[]>([]);

  // Execução
  const [isValidating, setIsValidating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isCancelledRef = useRef(false);

  const [progress, setProgress] = useState<{
    total: number;
    completed: number;
    current: string;
    items: ItemProgress[];
  }>({ total: 0, completed: 0, current: '', items: [] });

  // Progresso fino por evento do gerador
  const currentItemIdxRef = useRef<number | null>(null);
  const handleGeneratorProgress = useCallback((ev: AIGProgressEvent) => {
    const idx = currentItemIdxRef.current;
    if (!idx) return;
    if (ev.scope === 'field') {
      if (ev.phase === 'start') updateItemStep(idx, 'Gerar campos', { status: 'running', message: `Gerando ${ev.name}` });
      if (ev.phase === 'success') updateItemStep(idx, 'Gerar campos', { status: 'success', message: `${ev.name} pronto` });
      if (ev.phase === 'error') updateItemStep(idx, 'Gerar campos', { status: 'error', message: `${ev.name}: ${ev.info || 'erro'}` });
    } else if (ev.scope === 'audio') {
      if (ev.phase === 'start') updateItemStep(idx, 'Áudio/Imagem', { status: 'running', message: 'Gerando áudio' });
      if (ev.phase === 'success') updateItemStep(idx, 'Áudio/Imagem', { status: 'success', message: 'Áudio ok' });
      if (ev.phase === 'error') updateItemStep(idx, 'Áudio/Imagem', { status: 'error', message: `Áudio: ${ev.info || 'erro'}` });
    } else if (ev.scope === 'image') {
      if (ev.phase === 'start') updateItemStep(idx, 'Áudio/Imagem', { status: 'running', message: 'Gerando imagem' });
      if (ev.phase === 'success') updateItemStep(idx, 'Áudio/Imagem', { status: 'success', message: 'Imagem ok' });
      if (ev.phase === 'error') updateItemStep(idx, 'Áudio/Imagem', { status: 'error', message: `Imagem indisponível (${ev.info || 'erro'})` });
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // aiReady agora é dirigido pelo callback do AIGenerator (onReady)

  const parseNdjson = useCallback((text: string): BatchLine[] => {
    const rawLines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const out: BatchLine[] = [];
    for (const raw of rawLines) {
      try {
        const obj = JSON.parse(raw);
        const titulo = obj['Título da Oração'] ?? obj['Titulo da Oração'] ?? obj['Titulo'] ?? obj['Título'];
        const base = obj['Base bíblica'] ?? obj['Base Biblica'] ?? obj['Base'] ?? '';
        const tema = obj['Tema central'] ?? obj['Tema'] ?? '';
        const playlistVal = obj['Playlist'] ?? '';
        let playlists: string[] = [];
        if (Array.isArray(playlistVal)) {
          playlists = (playlistVal as any[])
            .map(v => (typeof v === 'string' ? v.trim() : ''))
            .filter(Boolean);
        } else if (typeof playlistVal === 'string' && playlistVal.trim().length > 0) {
          playlists = [playlistVal.trim()];
        }
        if (!titulo || !base || !tema) {
          out.push({ raw, titulo: titulo || '', base: base || '', tema: tema || '', playlists, error: 'Campos obrigatórios ausentes' });
          continue;
        }
        out.push({ raw, titulo: String(titulo), base: String(base), tema: String(tema), playlists });
      } catch (e) {
        out.push({ raw, titulo: '', base: '', tema: '', playlists: [], error: 'JSON inválido' });
      }
    }
    return out;
  }, []);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const parsed = parseNdjson(input);
      if (parsed.length > MAX_ITEMS) {
        toast.error(`Máximo de ${MAX_ITEMS} itens por lote`);
      }
      setLines(parsed);
      setValidLines(parsed.filter(l => !l.error).slice(0, MAX_ITEMS));
      toast.success(`Validação concluída. Válidos: ${parsed.filter(l => !l.error).length}.`);
    } finally {
      setIsValidating(false);
    }
  };

  const ensureCategory = async (): Promise<string | null> => {
    if (categoryMode === 'existing') {
      if (!selectedCategoryId) {
        toast.error('Selecione uma categoria');
        return null;
      }
      return selectedCategoryId;
    }
    // Criar nova categoria
    if (!newCategoryName.trim()) {
      toast.error('Informe o nome da nova categoria');
      return null;
    }
    const { data: maxPositionData } = await supabase
      .from('categories')
      .select('order_position')
      .order('order_position', { ascending: false })
      .limit(1);

    const nextPosition = (maxPositionData?.[0]?.order_position || 0) + 1;
    const { data: newCat, error: catErr } = await supabase
      .from('categories')
      .insert({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || null,
        order_position: nextPosition,
      })
      .select()
      .single();
    if (catErr || !newCat?.id) {
      toast.error('Erro ao criar categoria');
      return null;
    }
    setCategories(prev => [...prev, newCat as any]);
    setSelectedCategoryId(newCat.id);
    setCategoryMode('existing');
    return newCat.id as string;
  };

  const baseSteps = useMemo(() => ([
    { name: 'Gerar campos', status: 'pending' as StepStatus },
    { name: 'Título ajustado', status: 'pending' as StepStatus },
    { name: 'Áudio/Imagem', status: 'pending' as StepStatus },
    { name: 'Salvar', status: 'pending' as StepStatus },
    { name: 'Playlist', status: 'pending' as StepStatus },
  ]), []);

  const updateItemStep = (itemIdx: number, stepName: string, next: Partial<{ status: StepStatus; message?: string }>) => {
    setProgress(prev => ({
      ...prev,
      items: prev.items.map(item => item.idx === itemIdx
        ? {
            ...item,
            steps: item.steps.map(s => s.name === stepName ? { ...s, ...next } : s)
          }
        : item
      )
    }));
  };

  const updateItemStatus = (itemIdx: number, status: ItemProgress['status'], error?: string) => {
    setProgress(prev => ({
      ...prev,
      items: prev.items.map(item => item.idx === itemIdx ? { ...item, status, error } : item)
    }));
  };

  const runBatch = async () => {
    if (isRunning) return;
    if (validLines.length === 0) {
      toast.error('Nenhuma linha válida para processar');
      return;
    }
    if (!aiReady) {
      toast.error('Gerador não está pronto ainda. Tente novamente em instantes.');
      return;
    }
    const api = aiRef.current as AIGeneratorHandle;
    const {
      setCategoryById,
      generateAllWithContext,
      resetForBatchItem,
      setTitle,
      waitForAudioUrl,
      waitForImageUrl,
      handleSaveToDatabase
    } = api;
    if (!setCategoryById || !generateAllWithContext || !resetForBatchItem || !setTitle || !waitForAudioUrl || !waitForImageUrl || !handleSaveToDatabase) {
      toast.error('Gerador indisponível. Recarregue a página.');
      return;
    }
    const categoryId = await ensureCategory();
    if (!categoryId) return;

    setIsRunning(true);
    isCancelledRef.current = false;
    setProgress({
      total: validLines.length,
      completed: 0,
      current: 'Iniciando...',
      items: validLines.map((l, i) => ({
        idx: i + 1,
        titulo: l.titulo,
        steps: baseSteps.map(s => ({ ...s })),
        status: 'pending'
      }))
    });

    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      const itemIdx = i + 1;

      if (isCancelledRef.current) break;

      // Pausa entre itens
      while (isPaused) {
        await new Promise(r => setTimeout(r, 200));
        if (isCancelledRef.current) break;
      }

      setProgress(prev => ({ ...prev, current: `Processando ${itemIdx}/${validLines.length}: ${line.titulo}` }));
      updateItemStatus(itemIdx, 'running');

      try {
        const USE_SERVER = true;
        if (USE_SERVER) {
          updateItemStep(itemIdx, 'Gerar campos', { status: 'running' });
          try {
            const resp = await fetch('/api/generate-and-save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: line.titulo,
                base_biblica: line.base,
                tema_central: line.tema,
                category_id: categoryId,
                playlists: line.playlists || []
              })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data?.ok) {
              const msg = data?.error || 'Falha no servidor';
              updateItemStep(itemIdx, 'Gerar campos', { status: 'error', message: msg });
              updateItemStatus(itemIdx, 'error', msg);
              continue;
            }
            updateItemStep(itemIdx, 'Gerar campos', { status: 'success' });
            updateItemStep(itemIdx, 'Título ajustado', { status: 'success' });
            updateItemStep(itemIdx, 'Áudio/Imagem', { status: 'success' });
            updateItemStep(itemIdx, 'Salvar', { status: 'success' });
            if (line.playlists && line.playlists.length > 0) {
              updateItemStep(itemIdx, 'Playlist', { status: 'success', message: `${line.playlists.length} playlists` });
            } else {
              updateItemStep(itemIdx, 'Playlist', { status: 'success', message: 'Sem playlist' });
            }
            updateItemStatus(itemIdx, 'success');
            setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
            continue;
          } catch (e: any) {
            const msg = e?.message || 'Falha no servidor';
            updateItemStep(itemIdx, 'Gerar campos', { status: 'error', message: msg });
            updateItemStatus(itemIdx, 'error', msg);
            continue;
          }
        }
        // 1) Gerar todos os campos
        updateItemStep(itemIdx, 'Gerar campos', { status: 'running' });
        // garantir que não herdaremos dados de item anterior
        resetForBatchItem();
        setCategoryById(categoryId);
        currentItemIdxRef.current = itemIdx;
        await api.flushState();
        let r = await generateAllWithContext({ tema: line.tema, base: line.base, titulo: line.titulo, categoryId });
        if (!r.ok) {
          // retry curto determinístico
          await api.flushState();
          await new Promise(r => setTimeout(r, 500));
          r = await generateAllWithContext({ tema: line.tema, base: line.base, titulo: line.titulo, categoryId });
        }
        
        // Validar campos essenciais usando o retorno do orquestrador (sem depender do estado do React)
        if (!r.ok) {
          updateItemStep(itemIdx, 'Gerar campos', { status: 'error', message: `Texto/Prep/Final incompletos (t:${r.textoLen}, p:${r.prepLen}, f:${r.finalLen})` });
          updateItemStatus(itemIdx, 'error', 'Campos faltando');
          continue;
        }
        updateItemStep(itemIdx, 'Gerar campos', { status: 'success', message: `t:${r.textoLen}, p:${r.prepLen}, f:${r.finalLen}` });

        // 2) Ajustar título
        updateItemStep(itemIdx, 'Título ajustado', { status: 'running' });
        setTitle(line.titulo);
        await api.flushState();
        // Aguardar commit do título antes de prosseguir
        await new Promise(r => setTimeout(r, 500));
        
        // Validar se o título foi realmente atualizado
        const updatedData = api.getPrayerData();
        if (typeof window !== 'undefined' && window.localStorage.getItem('gm_debug') === '1') {
          console.log(`[gm] item ${itemIdx} título após setTitle:`, {
            esperado: line.titulo,
            atual: updatedData?.title || '(vazio)',
            match: updatedData?.title === line.titulo
          });
        }
        
        updateItemStep(itemIdx, 'Título ajustado', { status: 'success' });

        // 3) Garantir áudio/imagen prontos (ou tentar até o timeout)
        updateItemStep(itemIdx, 'Áudio/Imagem', { status: 'running' });
        let ensuredAudio = await waitForAudioUrl(90000);
        if (!ensuredAudio) {
          // retry curto adicional
          ensuredAudio = await waitForAudioUrl(30000);
          if (!ensuredAudio) {
            updateItemStep(itemIdx, 'Áudio/Imagem', { status: 'error', message: 'Áudio não gerado a tempo' });
            updateItemStatus(itemIdx, 'error', 'Áudio não gerado');
            continue; // pula salvar/playlist
          }
        }
        // Aguardar imagem também (pode demorar mais)
        await waitForImageUrl(90000);
        updateItemStep(itemIdx, 'Áudio/Imagem', { status: 'success' });

        // 4) Salvar
        updateItemStep(itemIdx, 'Salvar', { status: 'running' });
        // No fluxo em massa já geramos todos os campos; evitar ensure dentro do salvar
        const saveRes = await handleSaveToDatabase(line.titulo, line.base, categoryId, true);
        if (!saveRes?.id) {
          const msg = saveRes?.error || 'Falha ao salvar';
          updateItemStep(itemIdx, 'Salvar', { status: 'error', message: msg });
          updateItemStatus(itemIdx, 'error', msg);
          continue; // pula playlist
        }
        updateItemStep(itemIdx, 'Salvar', { status: 'success' });

        // 5) Playlist (opcional)
        updateItemStep(itemIdx, 'Playlist', { status: 'running' });
        if (line.playlists && line.playlists.length > 0) {
          let failures: string[] = [];
          for (const name of line.playlists) {
            const pl = await ensurePlaylistByTitleInsensitive(name.trim(), categoryId);
            if (pl?.id) {
              const res = await addAudioToPlaylist(saveRes.id, pl.id);
              if (!res.success) failures.push(`${name}: ${res.error || 'falha'}`);
            } else {
              failures.push(`${name}: não encontrada/criada`);
            }
          }
          if (failures.length > 0) {
            updateItemStep(itemIdx, 'Playlist', { status: 'error', message: failures.join('; ') });
          } else {
            updateItemStep(itemIdx, 'Playlist', { status: 'success', message: `${line.playlists.length} playlists` });
          }
        } else {
          updateItemStep(itemIdx, 'Playlist', { status: 'success', message: 'Sem playlist' });
        }

        updateItemStatus(itemIdx, 'success');
        setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      } catch (e: any) {
        console.error(e);
        updateItemStatus(itemIdx, 'error', e?.message || 'Erro desconhecido');
      }

      // Respeitar pausa/cancelamento entre itens
      if (isCancelledRef.current) break;
      // pequeno intervalo para aliviar rate limiting
      await new Promise(r => setTimeout(r, 400));
    }

    setIsRunning(false);
    setProgress(prev => ({ ...prev, current: 'Lote finalizado.' }));
    toast.success('Processo de geração em massa concluído.');
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* AIGenerator escondido: reuso da lógica sem duplicação */}
      <div className="hidden">
        <AIGeneratorWithRef ref={aiRef} onReady={setAiReady} onProgress={handleGeneratorProgress as AIGeneratorProps['onProgress']} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Gerar em Massa
          </CardTitle>
          <CardDescription>
            Cole linhas em formato JSON (um por linha) com “Título da Oração”, “Base bíblica”, “Tema central” e “Playlist”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium mb-3">Categoria</label>
            <div className="flex gap-2">
              <Button
                variant={categoryMode === 'existing' ? 'default' : 'outline'}
                onClick={() => setCategoryMode('existing')}
                disabled={isRunning}
              >
                Usar existente
              </Button>
              <Button
                variant={categoryMode === 'new' ? 'default' : 'outline'}
                onClick={() => setCategoryMode('new')}
                disabled={isRunning}
              >
                Criar nova
              </Button>
            </div>
            {categoryMode === 'existing' ? (
              <div className="mt-3">
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} disabled={isRunning}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input placeholder="Nome da nova categoria" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} disabled={isRunning} />
                <Input placeholder="Descrição (opcional)" value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} disabled={isRunning} />
              </div>
            )}
          </div>

          {/* Input NDJSON */}
          <div>
            <label className="block text-sm font-medium mb-2">Conteúdo (NDJSON)</label>
            <Textarea
              placeholder='{"Título da Oração":"...","Base bíblica":"...","Tema central":"...","Playlist":"..."}'
              rows={10}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isRunning}
            />
            <div className="text-xs text-muted-foreground mt-1">Máximo de {MAX_ITEMS} linhas por lote. Uma entrada JSON por linha.</div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleValidate} disabled={isRunning || isValidating}>
              {isValidating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando...</>) : (<><ListChecks className="mr-2 h-4 w-4" />Validar e pré-visualizar</>)}
            </Button>
            <Button onClick={runBatch} disabled={isRunning || validLines.length === 0}>
              {isRunning ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>) : (<><Wand2 className="mr-2 h-4 w-4" />Gerar em massa</>)}
            </Button>
            <Button variant="outline" onClick={() => setIsPaused(p => !p)} disabled={!isRunning}>
              {isPaused ? (<><Play className="mr-2 h-4 w-4" />Retomar</>) : (<><Pause className="mr-2 h-4 w-4" />Pausar</>)}
            </Button>
            <Button variant="destructive" onClick={() => { isCancelledRef.current = true; }} disabled={!isRunning}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pré-visualização */}
      {lines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            <CardDescription>Linhas válidas: {validLines.length} / {lines.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm font-medium">
              <div>Título</div>
              <div>Base bíblica</div>
              <div>Tema central</div>
              <div>Playlist</div>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm p-2 border rounded-md">
                  <div className="truncate">{l.titulo || <span className="text-red-600">-</span>}</div>
                  <div className="truncate">{l.base || <span className="text-red-600">-</span>}</div>
                  <div className="truncate">{l.tema || <span className="text-red-600">-</span>}</div>
                  <div className="truncate">{l.playlists && l.playlists.length ? l.playlists.join(', ') : ''}</div>
                  {l.error && <div className="sm:col-span-4 text-xs text-red-600">{l.error}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progresso */}
      {progress.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Progresso</span>
              <span className="text-sm font-normal">{progress.completed} / {progress.total} • {progressPercent}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {progress.items.map(item => (
                <div key={item.idx} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-shrink-0">
                      {item.status === 'pending' && <AlertCircle className="h-4 w-4 text-gray-400" />}
                      {item.status === 'running' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                      {item.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {item.status === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="font-medium truncate">Oração {item.idx}: {item.titulo}</div>
                  </div>
                  <div className="grid sm:grid-cols-5 gap-2">
                    {item.steps.map(step => (
                      <div key={step.name} className="flex items-center gap-2 text-xs p-2 rounded bg-gray-50">
                        <div className="flex-shrink-0">
                          {step.status === 'pending' && <div className="w-3 h-3 bg-gray-300 rounded-full" />}
                          {step.status === 'running' && <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />}
                          {step.status === 'success' && <CheckCircle className="h-3 w-3 text-green-600" />}
                          {step.status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                        </div>
                        <div className="truncate">{step.name}</div>
                        {step.message && <div className="truncate text-muted-foreground">• {step.message}</div>}
                      </div>
                    ))}
                  </div>
                  {item.error && <div className="mt-2 text-xs text-red-600">{item.error}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


