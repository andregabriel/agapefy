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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Plus className="h-5 w-5 mr-2 text-blue-500" />
            Adicionar à Minha Rotina
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar áudios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant={selectedCategory === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('')}
                className={`border-gray-700 ${selectedCategory === '' ? 'text-white' : 'text-black'}`}
              >
                Todas
              </Button>
              {categories.slice(0, 3).map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`border-gray-700 ${selectedCategory === category.id ? 'text-white' : 'text-black'}`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Lista de áudios */}
          <ScrollArea className="h-96">
            {loading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
                    <div className="w-16 h-16 bg-gray-700 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                    <div className="w-20 h-8 bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : audios.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum áudio encontrado</p>
                <p className="text-sm">Tente ajustar sua busca ou categoria</p>
              </div>
            ) : (
              <div className="space-y-2">
                {audios.map((audio) => {
                  const inRoutine = isAudioInRoutine(audio.id);
                  
                  return (
                    <div
                      key={audio.id}
                      className="flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                        <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                          <Play className="h-6 w-6 text-white" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">
                          {audio.title}
                        </h3>
                        <p className="text-sm text-gray-400 truncate">
                          {audio.subtitle || audio.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {audio.category && (
                            <Badge variant="secondary" className="text-xs">
                              {audio.category.name}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatDuration(audio.duration)}
                          </span>
                        </div>
                      </div>

                      {/* Botão */}
                      <Button
                        size="sm"
                        variant={inRoutine ? "secondary" : "default"}
                        onClick={() => inRoutine ? handleRemoveAudio(audio) : handleAddAudio(audio)}
                        className={inRoutine ? "bg-green-600 hover:bg-red-600 transition-colors" : ""}
                        title={inRoutine ? "Clique para remover da rotina" : "Clique para adicionar à rotina"}
                      >
                        {inRoutine ? (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            Remover
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
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

          {/* Footer */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-700 text-black hover:bg-gray-800 hover:text-white"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}