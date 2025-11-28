"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Check, Play, X } from 'lucide-react';
import { searchAudios, getCategories } from '@/lib/supabase-queries';
import type { Audio, Category } from '@/lib/supabase-queries';
import { useRoutinePlaylist } from '@/hooks/useRoutinePlaylist';
import { toast } from 'sonner';

interface AddAudioToRoutineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAudioToRoutineModal({ open, onOpenChange }: AddAudioToRoutineModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [audios, setAudios] = useState<Audio[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { addAudioToRoutine, removeAudioFromRoutine, isAudioInRoutine } = useRoutinePlaylist();

  // Carregar categorias
  useEffect(() => {
    const loadCategories = async () => {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    };
    loadCategories();
  }, []);

  // Buscar áudios
  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await searchAudios(searchTerm, selectedCategory || undefined);
      setAudios(results);
    } catch (error) {
      console.error('Erro ao buscar áudios:', error);
      toast.error('Erro ao buscar áudios');
    } finally {
      setLoading(false);
    }
  };

  // Buscar automaticamente quando modal abre
  useEffect(() => {
    if (open) {
      handleSearch();
    }
  }, [open, selectedCategory]);

  // Buscar quando usuário digita (debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        handleSearch();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Adicionar áudio à rotina
  const handleAddAudio = async (audio: Audio) => {
    try {
      const success = await addAudioToRoutine(audio.id);
      if (success) {
        toast.success(`"${audio.title}" adicionado à sua rotina!`);
        // O estado já foi atualizado de forma otimista no hook
      } else {
        toast.error('Erro ao adicionar áudio à rotina');
      }
    } catch (error) {
      console.error('Erro ao adicionar áudio:', error);
      toast.error('Erro inesperado');
    }
  };

  // Remover áudio da rotina
  const handleRemoveAudio = async (audio: Audio) => {
    try {
      const success = await removeAudioFromRoutine(audio.id);
      if (success) {
        toast.success(`"${audio.title}" removido da sua rotina!`);
        // O estado já foi atualizado de forma otimista no hook
      } else {
        toast.error('Erro ao remover áudio da rotina');
      }
    } catch (error) {
      console.error('Erro ao remover áudio:', error);
      toast.error('Erro inesperado');
    }
  };

  // Formatar duração
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Melhor imagem disponível para o áudio
  const getAudioImageUrl = (audio: Audio): string | null => {
    return (
      audio.thumbnail_url ||
      audio.cover_url ||
      audio.category?.image_url ||
      null
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white w-[100vw] h-[100vh] max-w-none rounded-none p-0 sm:w-auto sm:h-auto sm:max-h-[80vh] sm:max-w-4xl sm:rounded-xl sm:p-6">
        <div className="flex h-full flex-col p-4 sm:p-0">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg sm:text-xl">
              <Plus className="h-5 w-5 mr-2 text-blue-500" />
              Adicionar à Minha Rotina
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 flex flex-1 flex-col space-y-5">
            {/* Busca */}
            <div className="w-full">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar áudios por tema, emoção ou referência..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-gray-800/90 border-gray-700/80 text-white pl-9 h-11 rounded-xl placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/70 focus-visible:border-blue-500/40"
                />
              </div>
            </div>

            {/* Menu horizontal de filtros */}
            <div
              className="flex w-full items-center gap-2 overflow-x-auto scrollbar-hide pb-2 px-1"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <Button
                  variant={selectedCategory === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('')}
                  className={`shrink-0 touch-target whitespace-nowrap rounded-full px-4 text-xs font-medium ${
                    selectedCategory === ''
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Todas
                </Button>
              {categories.map((category) => {
                const isActive = selectedCategory === category.id;
                return (
                  <Button
                    key={category.id}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`shrink-0 touch-target whitespace-nowrap rounded-full px-4 text-xs font-medium ${
                      isActive
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {category.name}
                  </Button>
                );
              })}
            </div>

            {/* Lista de áudios */}
            <div className="flex-1 rounded-xl border border-gray-800/70 bg-gray-900/40">
              <ScrollArea className="h-full pr-3">
                {loading ? (
                  <div className="space-y-4 p-3">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse flex items-center space-x-4 rounded-lg px-2 py-3"
                      >
                        <div className="w-16 h-16 bg-gray-700 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-700 rounded w-3/4" />
                          <div className="h-3 bg-gray-700 rounded w-1/2" />
                        </div>
                        <div className="w-20 h-8 bg-gray-700 rounded" />
                      </div>
                    ))}
                  </div>
                ) : audios.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center text-gray-400">
                    <Search className="h-10 w-10 mb-3 opacity-60" />
                    <p className="text-sm font-medium">Nenhum áudio encontrado</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Ajuste sua busca ou tente outra categoria.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 p-2">
                    {audios.map((audio) => {
                      const inRoutine = isAudioInRoutine(audio.id);
                      const imageUrl = getAudioImageUrl(audio);

                      return (
                        <div
                          key={audio.id}
                          className="flex items-center space-x-4 rounded-lg px-2 py-3 hover:bg-gray-800/60 transition-colors"
                        >
                          {/* Thumbnail com capa real */}
                          <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-800">
                            {imageUrl ? (
                              <>
                                <img
                                  src={imageUrl}
                                  alt={audio.title}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                                <div className="pointer-events-none absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm">
                                  <Play className="h-4 w-4 ml-0.5" />
                                </div>
                              </>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
                                <Play className="h-6 w-6 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm sm:text-base text-white truncate">
                              {audio.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-400 truncate">
                              {audio.subtitle || audio.description}
                            </p>
                            <div className="mt-1 flex items-center space-x-2">
                              {audio.category && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] sm:text-xs px-2 py-0.5"
                                >
                                  {audio.category.name}
                                </Badge>
                              )}
                              <span className="text-[10px] sm:text-xs text-gray-500">
                                {formatDuration(audio.duration)}
                              </span>
                            </div>
                          </div>

                          {/* Botão */}
                          <Button
                            size="sm"
                            variant={inRoutine ? "secondary" : "default"}
                            onClick={() =>
                              inRoutine ? handleRemoveAudio(audio) : handleAddAudio(audio)
                            }
                            className={`whitespace-nowrap text-xs sm:text-sm ${
                              inRoutine
                                ? "bg-green-600 hover:bg-red-600 transition-colors"
                                : ""
                            }`}
                            title={
                              inRoutine
                                ? "Clique para remover da rotina"
                                : "Clique para adicionar à rotina"
                            }
                          >
                            {inRoutine ? (
                              <>
                                <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                Remover
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                Adicionar
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-gray-700 text-gray-100 hover:bg-gray-800"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


