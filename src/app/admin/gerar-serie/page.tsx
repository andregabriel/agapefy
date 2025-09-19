"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, AlertCircle, CheckCircle, Play, Pause, Clock, Image, CheckSquare, Volume2, AlertTriangle, ThumbsUp, Edit, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type EstadoItem = 'AGUARDANDO' | 'BUSCANDO_TEXTO' | 'GERANDO_IMAGEM' | 'GERANDO_AUDIO' | 'PRONTO_REVISAO' | 'ERRO_REFERENCIA' | 'ERRO_PROCESSAMENTO';

interface QueueItem {
  id: string;
  titulo: string;
  descricao_curta: string;
  descricao_longa: string;
  referencias: string;
  estado: EstadoItem;
  texto_gerado?: string;
  imagem_url?: string;
  audio_url?: string;
  audio_duracao?: number;
  erro_mensagem?: string;
}

export default function GerarSeriePage() {
  const [inputText, setInputText] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | null; message: string }>({ type: null, message: '' });
  const [currentItem, setCurrentItem] = useState<QueueItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validateDescricaoCurta = (descricao: string): boolean => {
    const words = descricao.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length <= 4;
  };

  const normalizeText = (text: string): string => {
    return text.trim().replace(/\s+/g, ' ');
  };

  const parseLines = (text: string): { valid: QueueItem[]; invalid: number } => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const validItems: QueueItem[] = [];
    let invalidCount = 0;

    lines.forEach(line => {
      const parts = line.split('|');
      
      if (parts.length === 4) {
        const [titulo, descricao_curta, descricao_longa, referencias] = parts.map(part => normalizeText(part));
        
        if (titulo && descricao_curta && descricao_longa && referencias) {
          validItems.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            titulo,
            descricao_curta,
            descricao_longa,
            referencias,
            estado: 'AGUARDANDO'
          });
        } else {
          invalidCount++;
        }
      } else {
        invalidCount++;
      }
    });

    return { valid: validItems, invalid: invalidCount };
  };

  const handleAddToQueue = () => {
    if (!inputText.trim()) {
      setFeedback({ type: 'warning', message: 'Por favor, insira pelo menos uma linha.' });
      return;
    }

    const { valid, invalid } = parseLines(inputText);
    
    if (valid.length > 0) {
      setQueue(prev => [...prev, ...valid]);
      setInputText('');
      
      let message = `${valid.length} item(s) adicionado(s) à fila.`;
      if (invalid > 0) {
        message += ` ${invalid} linha(s) ignorada(s) por formato inválido.`;
      }
      
      setFeedback({ type: 'success', message });
    } else {
      setFeedback({ type: 'warning', message: 'Nenhuma linha válida encontrada. Verifique o formato: Título | Descrição curta | Descrição longa | Referências' });
    }

    setTimeout(() => setFeedback({ type: null, message: '' }), 5000);
  };

  const clearCurrentTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const updateItemState = (itemId: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
    
    if (currentItem && currentItem.id === itemId) {
      setCurrentItem(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const buscarTextoBiblico = async (referencias: string): Promise<string> => {
    try {
      console.log('Buscando texto bíblico para:', referencias);
      
      // Buscar na tabela verses do Supabase
      const { data, error } = await supabase
        .from('verses')
        .select('verse_text, book, chapter, start_verse, end_verse')
        .ilike('verse_id', `%${referencias.replace(/\s+/g, '%')}%`)
        .limit(10);

      if (error) {
        console.error('Erro ao buscar no Supabase:', error);
        throw new Error('Erro ao consultar base bíblica');
      }

      if (data && data.length > 0) {
        // Concatenar todos os versículos encontrados
        const textoCompleto = data.map(verse => 
          `${verse.book} ${verse.chapter}:${verse.start_verse}${verse.end_verse !== verse.start_verse ? `-${verse.end_verse}` : ''}\n${verse.verse_text}`
        ).join('\n\n');
        
        console.log('Texto bíblico encontrado:', textoCompleto.substring(0, 100) + '...');
        return textoCompleto;
      } else {
        throw new Error('Referência bíblica não encontrada');
      }
    } catch (error) {
      console.error('Erro ao buscar texto bíblico:', error);
      throw error;
    }
  };

  const gerarTextoIA = async (titulo: string, descricao: string): Promise<string> => {
    try {
      console.log('Gerando texto com IA para:', titulo);
      
      const response = await fetch('/api/generate-prayer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${titulo}: ${descricao}`
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar texto com IA');
      }

      const data = await response.json();
      return data.prayer_text || data.title || 'Texto gerado com sucesso';
    } catch (error) {
      console.error('Erro ao gerar texto com IA:', error);
      throw error;
    }
  };

  const gerarImagem = async (prompt: string): Promise<string> => {
    try {
      console.log('Gerando imagem para:', prompt.substring(0, 50) + '...');
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar imagem');
      }

      const data = await response.json();
      return data.image_url;
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      throw error;
    }
  };

  const gerarAudio = async (texto: string): Promise<{ url: string; duracao: number }> => {
    try {
      console.log('Gerando áudio para texto de', texto.length, 'caracteres');
      
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: texto,
          voice_id: 'pNInz6obpgDQGcFmaJgB' // Voz padrão
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar áudio');
      }

      const data = await response.json();
      
      // Estimar duração baseada no texto (aproximadamente 150 palavras por minuto)
      const palavras = texto.split(/\s+/).length;
      const duracaoEstimada = Math.ceil(palavras / 150);
      
      return {
        url: data.audio_url,
        duracao: duracaoEstimada
      };
    } catch (error) {
      console.error('Erro ao gerar áudio:', error);
      throw error;
    }
  };

  const processarItem = async (item: QueueItem) => {
    if (isPaused) return;

    try {
      // Etapa 1: Buscar texto
      updateItemState(item.id, { estado: 'BUSCANDO_TEXTO' });
      
      let textoGerado: string;
      
      // Verificar se há referências bíblicas
      const temReferencias = item.referencias && item.referencias.trim() !== '';
      
      if (temReferencias) {
        try {
          textoGerado = await buscarTextoBiblico(item.referencias);
        } catch (error) {
          // Se falhar na busca bíblica, tentar gerar com IA
          console.log('Falha na busca bíblica, tentando IA...');
          textoGerado = await gerarTextoIA(item.titulo, item.descricao_longa);
        }
      } else {
        textoGerado = await gerarTextoIA(item.titulo, item.descricao_longa);
      }

      updateItemState(item.id, { texto_gerado: textoGerado });

      if (isPaused) return;

      // Etapa 2: Gerar imagem
      updateItemState(item.id, { estado: 'GERANDO_IMAGEM' });
      
      const promptImagem = `Imagem religiosa cristã relacionada a: ${item.titulo}. ${item.descricao_curta}. Estilo artístico, inspirador, cores suaves.`;
      const imagemUrl = await gerarImagem(promptImagem);
      
      updateItemState(item.id, { imagem_url: imagemUrl });

      if (isPaused) return;

      // Etapa 3: Gerar áudio
      updateItemState(item.id, { estado: 'GERANDO_AUDIO' });
      
      const { url: audioUrl, duracao } = await gerarAudio(textoGerado);
      
      updateItemState(item.id, { 
        audio_url: audioUrl,
        audio_duracao: duracao
      });

      if (isPaused) return;

      // Finalizar
      updateItemState(item.id, { estado: 'PRONTO_REVISAO' });
      setIsProcessing(false);
      setCurrentItem(null);

    } catch (error) {
      console.error('Erro no processamento:', error);
      updateItemState(item.id, { 
        estado: 'ERRO_PROCESSAMENTO',
        erro_mensagem: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      setIsProcessing(false);
      setCurrentItem(null);
    }
  };

  const startProcessing = (item: QueueItem) => {
    if (isProcessing) return;
    
    setCurrentItem(item);
    setIsProcessing(true);
    setIsPaused(false);
    processarItem(item);
  };

  const pauseProcessing = () => {
    setIsPaused(true);
  };

  const resumeProcessing = () => {
    if (currentItem && isPaused) {
      setIsPaused(false);
      processarItem(currentItem);
    }
  };

  const removeFromQueue = (id: string) => {
    const isCurrentItem = currentItem?.id === id;
    
    if (isCurrentItem) {
      clearCurrentTimeout();
      setCurrentItem(null);
      setIsProcessing(false);
      setIsPaused(false);
    }
    
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const getStateIcon = (estado: EstadoItem) => {
    switch (estado) {
      case 'AGUARDANDO': return <Clock className="w-4 h-4" />;
      case 'BUSCANDO_TEXTO': return <Clock className="w-4 h-4 animate-spin" />;
      case 'GERANDO_IMAGEM': return <Image className="w-4 h-4 animate-pulse" />;
      case 'GERANDO_AUDIO': return <Volume2 className="w-4 h-4 animate-bounce" />;
      case 'PRONTO_REVISAO': return <CheckSquare className="w-4 h-4" />;
      case 'ERRO_REFERENCIA': return <AlertTriangle className="w-4 h-4" />;
      case 'ERRO_PROCESSAMENTO': return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getStateColor = (estado: EstadoItem) => {
    switch (estado) {
      case 'AGUARDANDO': return 'bg-gray-100 text-gray-800';
      case 'BUSCANDO_TEXTO': return 'bg-blue-100 text-blue-800';
      case 'GERANDO_IMAGEM': return 'bg-yellow-100 text-yellow-800';
      case 'GERANDO_AUDIO': return 'bg-purple-100 text-purple-800';
      case 'PRONTO_REVISAO': return 'bg-green-100 text-green-800';
      case 'ERRO_REFERENCIA': return 'bg-red-100 text-red-800';
      case 'ERRO_PROCESSAMENTO': return 'bg-red-100 text-red-800';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => clearCurrentTimeout();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gerar em Série</h1>
        <p className="text-gray-600 mt-2">
          Cole múltiplas linhas no formato: Título | Descrição curta | Descrição longa | Referências (BPM)
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label htmlFor="input-text" className="block text-sm font-medium text-gray-700 mb-2">
            Dados para processamento
          </label>
          <Textarea
            id="input-text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Exemplo:&#10;As Bem-Aventuranças | Ensinamentos de Jesus | Sermão da Montanha onde Jesus proclama as bem-aventuranças. | Mt 5:1-12&#10;Oração da Manhã | Começar bem o dia | Uma oração especial para iniciar o dia com gratidão e esperança | Salmos 23, Mateus 6:9-13"
            className="min-h-[120px] resize-none"
          />
        </div>

        <Button 
          onClick={handleAddToQueue}
          className="w-full sm:w-auto"
          disabled={!inputText.trim()}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar à Fila
        </Button>

        {feedback.type && (
          <Alert className={feedback.type === 'success' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
            {feedback.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
            <AlertDescription className={feedback.type === 'success' ? 'text-green-800' : 'text-yellow-800'}>
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Card do Item Atual */}
      {currentItem && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-blue-900">
              <span>Item Atual em Processamento</span>
              <div className="flex items-center gap-2">
                {getStateIcon(currentItem.estado)}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(currentItem.estado)}`}>
                  {currentItem.estado.replace('_', ' ')}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <p className="text-gray-900 font-medium">{currentItem.titulo}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Curta</label>
                <p className={!validateDescricaoCurta(currentItem.descricao_curta) ? 'text-red-600 font-medium' : 'text-gray-900'}>
                  {currentItem.descricao_curta}
                </p>
                {!validateDescricaoCurta(currentItem.descricao_curta) && (
                  <p className="text-xs text-red-500 mt-1">Mais de 4 palavras</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Longa</label>
              <p className="text-gray-900">{currentItem.descricao_longa}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referências</label>
              <p className="text-gray-900">{currentItem.referencias}</p>
            </div>

            {/* Resultados do processamento */}
            {currentItem.texto_gerado && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto Gerado</label>
                <div className="bg-white p-3 rounded border max-h-32 overflow-y-auto">
                  <p className="text-gray-900 text-sm whitespace-pre-wrap">{currentItem.texto_gerado}</p>
                </div>
              </div>
            )}

            {currentItem.imagem_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imagem Gerada</label>
                <img 
                  src={currentItem.imagem_url} 
                  alt="Imagem gerada" 
                  className="w-32 h-32 object-cover rounded border"
                />
              </div>
            )}

            {currentItem.audio_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Áudio Gerado {currentItem.audio_duracao && `(${currentItem.audio_duracao} min)`}
                </label>
                <audio controls className="w-full">
                  <source src={currentItem.audio_url} type="audio/mpeg" />
                  Seu navegador não suporta áudio.
                </audio>
              </div>
            )}

            {currentItem.erro_mensagem && (
              <div>
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {currentItem.erro_mensagem}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {currentItem.estado === 'PRONTO_REVISAO' ? (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Aprovar
                  </Button>
                  <Button size="sm" variant="outline">
                    <Edit className="w-4 h-4 mr-1" />
                    Atualizar
                  </Button>
                  <Button 
                    onClick={() => removeFromQueue(currentItem.id)} 
                    size="sm" 
                    variant="destructive"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                </>
              ) : currentItem.estado.includes('ERRO') ? (
                <Button 
                  onClick={() => removeFromQueue(currentItem.id)} 
                  size="sm" 
                  variant="destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remover
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button onClick={resumeProcessing} size="sm" className="bg-green-600 hover:bg-green-700">
                      <Play className="w-4 h-4 mr-1" />
                      Retomar
                    </Button>
                  ) : (
                    <Button onClick={pauseProcessing} size="sm" variant="outline">
                      <Pause className="w-4 h-4 mr-1" />
                      Pausar
                    </Button>
                  )}
                  <Button 
                    onClick={() => removeFromQueue(currentItem.id)} 
                    size="sm" 
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-medium text-gray-900">
            Fila de Processamento ({queue.length} item{queue.length !== 1 ? 's' : ''})
          </h2>
        </div>

        {queue.length === 0 ? (
          <div className="p-6 text-center text-gray-500 bg-white">
            Nenhum item na fila. Adicione itens usando o formulário acima.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-16 text-gray-900 font-medium">#</TableHead>
                  <TableHead className="text-gray-900 font-medium">Título</TableHead>
                  <TableHead className="text-gray-900 font-medium">Descrição Curta</TableHead>
                  <TableHead className="text-gray-900 font-medium">Descrição Longa</TableHead>
                  <TableHead className="text-gray-900 font-medium">Referências</TableHead>
                  <TableHead className="text-gray-900 font-medium">Estado</TableHead>
                  <TableHead className="w-20 text-gray-900 font-medium">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item, index) => (
                  <TableRow key={item.id} className="bg-white hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">{index + 1}</TableCell>
                    <TableCell className="font-medium text-gray-900">{item.titulo}</TableCell>
                    <TableCell className="text-gray-900">
                      <span className={!validateDescricaoCurta(item.descricao_curta) ? 'text-red-600 font-medium' : 'text-gray-900'}>
                        {item.descricao_curta}
                      </span>
                      {!validateDescricaoCurta(item.descricao_curta) && (
                        <div className="text-xs text-red-500 mt-1">
                          Mais de 4 palavras
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs text-gray-900">{item.descricao_longa}</TableCell>
                    <TableCell className="max-w-xs truncate text-gray-900" title={item.referencias}>
                      {item.referencias}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStateIcon(item.estado)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(item.estado)}`}>
                          {item.estado.replace('_', ' ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {item.estado === 'AGUARDANDO' && !isProcessing && (
                          <Button
                            onClick={() => startProcessing(item)}
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromQueue(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}