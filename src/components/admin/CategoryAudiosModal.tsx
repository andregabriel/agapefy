"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Pause, Search, Plus, Trash2, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer } from '@/contexts/PlayerContext';

interface Audio {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  duration: number | null;
  transcript: string;
  category_id: string | null;
  created_by: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
}

interface CategoryAudiosModalProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryAudiosModal({ category, isOpen, onClose }: CategoryAudiosModalProps) {
  const [audios, setAudios] = useState<Audio[]>([]);
  const [allAudios, setAllAudios] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddAudios, setShowAddAudios] = useState(false);
  
  // Usar PlayerContext para controle de áudio
  const { state, playAudio, pause } = usePlayer();

  useEffect(() => {
    if (isOpen && category) {
      fetchCategoryAudios();
      fetchAllAudios();
    }
  }, [isOpen, category]);

  const fetchCategoryAudios = async () => {
    if (!category) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('audios')
        .select('*')
        .eq('category_id', category.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAudios(data || []);
    } catch (error) {
      console.error('Erro ao buscar áudios da categoria:', error);
      toast.error('Erro ao carregar áudios da categoria');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAudios = async () => {
    try {
      const { data, error } = await supabase
        .from('audios')
        .select('*')
        .is('category_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllAudios(data || []);
    } catch (error) {
      console.error('Erro ao buscar todos os áudios:', error);
    }
  };

  const handleRemoveAudio = async (audioId: string) => {
    if (!confirm('Tem certeza que deseja remover esta oração da categoria?')) return;

    try {
      const { error } = await supabase
        .from('audios')
        .update({ category_id: null })
        .eq('id', audioId);

      if (error) throw error;

      setAudios(audios.filter(audio => audio.id !== audioId));
      toast.success('Oração removida da categoria');
      
      // Atualizar lista de áudios disponíveis
      fetchAllAudios();
    } catch (error) {
      console.error('Erro ao remover áudio:', error);
      toast.error('Erro ao remover oração da categoria');
    }
  };

  const handleAddAudio = async (audioId: string) => {
    if (!category) return;

    try {
      const { error } = await supabase
        .from('audios')
        .update({ category_id: category.id })
        .eq('id', audioId);

      if (error) throw error;

      toast.success('Oração adicionada à categoria');
      
      // Recarregar listas
      fetchCategoryAudios();
      fetchAllAudios();
    } catch (error) {
      console.error('Erro ao adicionar áudio:', error);
      toast.error('Erro ao adicionar oração à categoria');
    }
  };

  const handlePlayAudio = (audio: Audio) => {
    if (state.currentAudio?.id === audio.id && state.isPlaying) {
      // Se é o mesmo áudio e está tocando, pausar
      pause();
    } else {
      // Caso contrário, tocar o áudio
      playAudio({
        id: audio.id,
        title: audio.title,
        description: audio.description,
        audio_url: audio.audio_url,
        duration: audio.duration
      });
    }
  };

  const filteredAudios = audios.filter(audio =>
    audio.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    audio.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAllAudios = allAudios.filter(audio =>
    audio.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    audio.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!category) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {category.image_url ? (
              <img
                src={category.image_url}
                alt={category.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">
                  {category.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{category.name}</h2>
              <p className="text-sm text-gray-500 font-normal">
                Gerenciar orações da categoria
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Controles */}
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar orações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => setShowAddAudios(!showAddAudios)}
              variant={showAddAudios ? "secondary" : "default"}
              className="flex items-center gap-2"
            >
              {showAddAudios ? (
                <>
                  <X className="h-4 w-4" />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Adicionar Orações
                </>
              )}
            </Button>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto">
            {showAddAudios ? (
              /* Lista de áudios para adicionar */
              <div>
                <h3 className="font-semibold mb-3 text-gray-700">
                  Orações Disponíveis ({filteredAllAudios.length})
                </h3>
                {filteredAllAudios.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma oração disponível para adicionar
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredAllAudios.map((audio) => (
                      <div
                        key={audio.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePlayAudio(audio)}
                            className="flex-shrink-0"
                          >
                            {state.currentAudio?.id === audio.id && state.isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium truncate">{audio.title}</h4>
                            <p className="text-sm text-gray-500 truncate">
                              {audio.description || 'Sem descrição'}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAddAudio(audio.id)}
                          size="sm"
                          className="flex-shrink-0"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Lista de áudios da categoria */
              <div>
                <h3 className="font-semibold mb-3 text-gray-700">
                  Orações na Categoria ({filteredAudios.length})
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : filteredAudios.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    {searchTerm ? 'Nenhuma oração encontrada' : 'Nenhuma oração nesta categoria'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredAudios.map((audio, index) => (
                      <div
                        key={audio.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-sm text-gray-500 w-6">
                              {index + 1}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePlayAudio(audio)}
                            className="flex-shrink-0"
                          >
                            {state.currentAudio?.id === audio.id && state.isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium truncate">{audio.title}</h4>
                            <p className="text-sm text-gray-500 truncate">
                              {audio.description || 'Sem descrição'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                              <span>
                                {new Date(audio.created_at).toLocaleDateString()}
                              </span>
                              {audio.duration && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {Math.floor(audio.duration / 60)}:{(audio.duration % 60).toString().padStart(2, '0')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveAudio(audio.id)}
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-900 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-500">
            {audios.length} oração(ões) nesta categoria
          </div>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}