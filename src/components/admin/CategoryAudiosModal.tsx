"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Play, Pause, Search, Plus, Trash2, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer } from '@/contexts/PlayerContext';
import {
  getCategoryHomeOrder,
  saveCategoryHomeOrder,
  deleteCategoryHomeOrder,
  type CategoryHomeOrderItem
} from '@/lib/supabase-queries';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface Playlist {
  id: string;
  title: string | null;
  name?: string | null;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  created_at: string;
  category_id?: string | null;
  category_ids?: string[] | null;
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

type HomeItem = {
  id: string; // 'audio:<id>' ou 'playlist:<id>'
  refId: string;
  type: 'audio' | 'playlist';
  title: string;
  description?: string | null;
  created_at: string;
};

function SortableHomeItem({ item, index }: { item: HomeItem; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-white hover:bg-gray-50 cursor-move"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-500 w-6">
          {index + 1}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium truncate">{item.title}</h4>
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded ${
              item.type === 'audio'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-purple-100 text-purple-800'
            }`}
          >
            {item.type === 'audio' ? 'Áudio' : 'Playlist'}
          </span>
        </div>
        {item.description && (
          <p className="text-sm text-gray-500 truncate">{item.description}</p>
        )}
      </div>
    </div>
  );
}

export default function CategoryAudiosModal({ category, isOpen, onClose }: CategoryAudiosModalProps) {
  const [audios, setAudios] = useState<Audio[]>([]);
  const [allAudios, setAllAudios] = useState<Audio[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddAudios, setShowAddAudios] = useState(false);
  const [addPlaylistSearch, setAddPlaylistSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'manage' | 'home_order'>('manage');

  const [homeItems, setHomeItems] = useState<HomeItem[]>([]);
  const [homeOrderLoading, setHomeOrderLoading] = useState(false);
  const [homeOrderSaving, setHomeOrderSaving] = useState(false);
  const [homeOrderDirty, setHomeOrderDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );

  const normalizePlaylistCategories = (playlist: Playlist) => {
    const ids = Array.isArray(playlist.category_ids)
      ? playlist.category_ids.filter(Boolean)
      : playlist.category_id
        ? [playlist.category_id]
        : [];
    return Array.from(new Set(ids));
  };

  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const getPlaylistTitle = (playlist: Playlist) => {
    const title = (playlist.title || playlist.name || '').trim();
    return title || 'Sem título';
  };

  const playlistMatchesTerm = (playlist: Playlist, term: string) => {
    const normalized = normalizeText(term.trim());
    if (!normalized) return true;
    const title = normalizeText(getPlaylistTitle(playlist));
    const description = normalizeText(playlist.description || '');
    return title.includes(normalized) || description.includes(normalized);
  };
  
  // Usar PlayerContext para controle de áudio
  const { state, playAudio, pause } = usePlayer();

  useEffect(() => {
    if (isOpen && category) {
      fetchCategoryAudios();
      fetchAllAudios();
      fetchCategoryPlaylists();
      fetchAllPlaylists();
    }
  }, [isOpen, category]);

  useEffect(() => {
    if (!isOpen || !category) return;

    const loadHomeOrder = async () => {
      try {
        setHomeOrderLoading(true);
        const savedOrder: CategoryHomeOrderItem[] = await getCategoryHomeOrder(category.id);
        const items = buildHomeItemsFromData(audios, playlists, savedOrder);
        setHomeItems(items);
        setHomeOrderDirty(false);
      } catch (error) {
        console.error('Erro ao carregar ordem da home:', error);
      } finally {
        setHomeOrderLoading(false);
      }
    };

    loadHomeOrder();
  }, [isOpen, category, audios, playlists]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('manage');
      setHomeItems([]);
      setHomeOrderDirty(false);
      setAddPlaylistSearch('');
    }
  }, [isOpen]);

  const buildHomeItemsFromData = (
    audiosData: Audio[],
    playlistsData: Playlist[],
    savedOrder: CategoryHomeOrderItem[]
  ): HomeItem[] => {
    const items: HomeItem[] = [];
    const usedAudio = new Set<string>();
    const usedPlaylist = new Set<string>();

    const audioMap = new Map(audiosData.map((a) => [a.id, a]));
    const playlistMap = new Map(playlistsData.map((p) => [p.id, p]));

    const sortedAudios = [...audiosData].sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || '')
    );
    const sortedPlaylists = [...playlistsData].sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || '')
    );

    (savedOrder || []).forEach((entry) => {
      if (entry.type === 'audio') {
        const audio = audioMap.get(entry.id);
        if (audio && !usedAudio.has(audio.id)) {
          items.push({
            id: `audio:${audio.id}`,
            refId: audio.id,
            type: 'audio',
            title: audio.title,
            description: audio.description,
            created_at: audio.created_at
          });
          usedAudio.add(audio.id);
        }
      } else if (entry.type === 'playlist') {
        const playlist = playlistMap.get(entry.id);
        if (playlist && !usedPlaylist.has(playlist.id)) {
          items.push({
            id: `playlist:${playlist.id}`,
            refId: playlist.id,
            type: 'playlist',
            title: getPlaylistTitle(playlist),
            description: playlist.description,
            created_at: playlist.created_at
          });
          usedPlaylist.add(playlist.id);
        }
      }
    });

    sortedAudios.forEach((audio) => {
      if (!usedAudio.has(audio.id)) {
        items.push({
          id: `audio:${audio.id}`,
          refId: audio.id,
          type: 'audio',
          title: audio.title,
          description: audio.description,
          created_at: audio.created_at
        });
        usedAudio.add(audio.id);
      }
    });

    sortedPlaylists.forEach((playlist) => {
      if (!usedPlaylist.has(playlist.id)) {
        items.push({
          id: `playlist:${playlist.id}`,
          refId: playlist.id,
          type: 'playlist',
          title: getPlaylistTitle(playlist),
          description: playlist.description,
          created_at: playlist.created_at
        });
        usedPlaylist.add(playlist.id);
      }
    });

    return items;
  };

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

  const fetchCategoryPlaylists = async () => {
    if (!category) return;

    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id,title,description,cover_url,is_public,created_at,category_ids,category_id')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = ((data as Playlist[]) || []).filter((playlist) =>
        normalizePlaylistCategories(playlist).includes(category.id)
      );
      setPlaylists(list);
    } catch (error) {
      console.error('Erro ao buscar playlists da categoria:', error);
      toast.error('Erro ao carregar playlists da categoria');
    }
  };

  const fetchAllPlaylists = async () => {
    if (!category) return;
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id,title,description,cover_url,is_public,created_at,category_ids,category_id')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const available = ((data as Playlist[]) || []).filter(
        (playlist) => !normalizePlaylistCategories(playlist).includes(category.id)
      );
      setAllPlaylists(available);
    } catch (error) {
      console.error('Erro ao buscar todas as playlists:', error);
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

  const handleAddPlaylist = async (playlistId: string) => {
    if (!category) return;

    try {
      const target =
        playlists.find((p) => p.id === playlistId) ||
        allPlaylists.find((p) => p.id === playlistId);
      const currentIds = Array.isArray(target?.category_ids)
        ? target?.category_ids.filter(Boolean)
        : [];
      const nextIds = Array.from(new Set([...(currentIds || []), category.id]));
      const primaryCategory = nextIds[0] || null;

      const { error } = await supabase
        .from('playlists')
        .update({ category_ids: nextIds, category_id: primaryCategory })
        .eq('id', playlistId);

      if (error) throw error;

      toast.success('Playlist adicionada à categoria');
      fetchCategoryPlaylists();
      fetchAllPlaylists();
    } catch (error) {
      console.error('Erro ao adicionar playlist:', error);
      toast.error('Erro ao adicionar playlist à categoria');
    }
  };

  const handleRemovePlaylist = async (playlistId: string) => {
    if (!category) return;
    if (!confirm('Tem certeza que deseja remover esta playlist da categoria?')) return;

    try {
      const target =
        playlists.find((p) => p.id === playlistId) ||
        allPlaylists.find((p) => p.id === playlistId);
      const currentIds = Array.isArray(target?.category_ids)
        ? target?.category_ids.filter(Boolean)
        : [];
      const nextIds = currentIds.filter((id) => id !== category?.id);
      const primaryCategory = nextIds[0] || null;

      const { error } = await supabase
        .from('playlists')
        .update({ category_ids: nextIds, category_id: primaryCategory })
        .eq('id', playlistId);

      if (error) throw error;

      setPlaylists(playlists.filter((playlist) => playlist.id !== playlistId));
      toast.success('Playlist removida da categoria');
      fetchAllPlaylists();
    } catch (error) {
      console.error('Erro ao remover playlist:', error);
      toast.error('Erro ao remover playlist da categoria');
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

  const filteredPlaylists = playlists.filter((playlist) =>
    playlistMatchesTerm(playlist, searchTerm)
  );

  const filteredAllAudios = allAudios.filter(audio =>
    audio.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    audio.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAllPlaylists = allPlaylists.filter((playlist) =>
    playlistMatchesTerm(playlist, searchTerm)
  );

  const availablePlaylistResults = (addPlaylistSearch.trim()
    ? allPlaylists.filter((playlist) => playlistMatchesTerm(playlist, addPlaylistSearch))
    : allPlaylists
  ).slice(0, 8);

  const handleHomeDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setHomeItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
    setHomeOrderDirty(true);
  };

  const handleSaveHomeOrder = async () => {
    if (!category) return;
    try {
      setHomeOrderSaving(true);
      const payload: CategoryHomeOrderItem[] = homeItems.map((item) => ({
        type: item.type,
        id: item.refId
      }));
      const result = await saveCategoryHomeOrder(category.id, payload);
      if (!result.success) {
        toast.error(result.error || 'Erro ao salvar ordem da home');
        return;
      }
      toast.success('Ordem da home salva com sucesso');
      setHomeOrderDirty(false);
    } catch (error) {
      console.error('Erro ao salvar ordem da home:', error);
      toast.error('Erro ao salvar ordem da home');
    } finally {
      setHomeOrderSaving(false);
    }
  };

  const handleResetHomeOrder = async () => {
    if (!category) return;
    try {
      setHomeOrderSaving(true);
      const result = await deleteCategoryHomeOrder(category.id);
      if (!result.success) {
        toast.error(result.error || 'Erro ao reverter ordem da home');
        return;
      }
      const items = buildHomeItemsFromData(audios, playlists, []);
      setHomeItems(items);
      setHomeOrderDirty(false);
      toast.success('Ordem da home revertida para padrão');
    } catch (error) {
      console.error('Erro ao reverter ordem da home:', error);
      toast.error('Erro ao reverter ordem da home');
    } finally {
      setHomeOrderSaving(false);
    }
  };

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
              <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
              <p className="text-sm text-gray-700 font-normal">
                Gerenciar orações da categoria
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'manage' | 'home_order')}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Controles topo */}
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Buscar playlists ou orações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-gray-900 placeholder:text-gray-500"
                  disabled={activeTab === 'home_order'}
                />
              </div>
              <div className="flex items-center gap-2">
                <TabsList>
                  <TabsTrigger value="manage">Gerenciar</TabsTrigger>
                  <TabsTrigger value="home_order">Ordem na home</TabsTrigger>
                </TabsList>
                {activeTab === 'manage' && (
                  <Button
                    onClick={() => setShowAddAudios(!showAddAudios)}
                    variant={showAddAudios ? 'secondary' : 'default'}
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
                        Adicionar Conteúdo
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Aba Gerenciar */}
            <TabsContent value="manage" className="flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {showAddAudios ? (
                  /* Lista de áudios para adicionar */
                  <div>
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold mb-3 text-gray-700">
                          Playlists Disponíveis ({filteredAllPlaylists.length})
                        </h3>
                        {filteredAllPlaylists.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">
                            Nenhuma playlist disponível para adicionar
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {filteredAllPlaylists.map((playlist) => (
                              <div
                                key={playlist.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                              >
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium truncate text-gray-900">
                                    {getPlaylistTitle(playlist)}
                                  </h4>
                                  <p className="text-sm text-gray-500 truncate">
                                    {playlist.description || 'Sem descrição'}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => handleAddPlaylist(playlist.id)}
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
                    </div>
                  </div>
                ) : (
                  /* Lista de áudios da categoria */
                  <div className="space-y-8">
                    <div className="p-4 border rounded-lg bg-gray-50">
                      <h3 className="font-semibold mb-3 text-gray-700">
                        Adicionar playlist à categoria
                      </h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Buscar playlists disponíveis..."
                          value={addPlaylistSearch}
                          onChange={(e) => setAddPlaylistSearch(e.target.value)}
                          className="pl-9 bg-white text-gray-900 placeholder:text-gray-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Mostrando playlists públicas que ainda não estão nesta categoria.
                      </p>
                      <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                        {availablePlaylistResults.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            {allPlaylists.length === 0
                              ? 'Nenhuma playlist disponível para adicionar'
                              : addPlaylistSearch
                                ? 'Nenhuma playlist encontrada'
                                : 'Digite para buscar uma playlist'}
                          </p>
                        ) : (
                          availablePlaylistResults.map((playlist) => (
                            <div
                              key={playlist.id}
                              className="flex items-center justify-between p-3 border rounded-lg bg-white"
                            >
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium truncate text-gray-900">
                                  {getPlaylistTitle(playlist)}
                                </h4>
                                <p className="text-sm text-gray-500 truncate">
                                  {playlist.description || 'Sem descrição'}
                                </p>
                              </div>
                              <Button
                                onClick={() => handleAddPlaylist(playlist.id)}
                                size="sm"
                                className="flex-shrink-0"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3 text-gray-700">
                        Playlists na Categoria ({filteredPlaylists.length})
                      </h3>
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : filteredPlaylists.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                          {searchTerm ? 'Nenhuma playlist encontrada' : 'Nenhuma playlist nesta categoria'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredPlaylists.map((playlist) => (
                            <div
                              key={playlist.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                            >
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium truncate text-gray-900">
                                  {getPlaylistTitle(playlist)}
                                </h4>
                                <p className="text-sm text-gray-500 truncate">
                                  {playlist.description || 'Sem descrição'}
                                </p>
                              </div>
                              <Button
                                onClick={() => handleRemovePlaylist(playlist.id)}
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
                                  <GripVertical className="h-4 w-4 text-gray-400" />
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
                                          {Math.floor(audio.duration / 60)}:
                                          {(audio.duration % 60).toString().padStart(2, '0')}
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
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Aba Ordem na Home */}
            <TabsContent value="home_order" className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex-shrink-0 mb-3">
                <p className="text-sm text-gray-600 mb-3">
                  Arraste para definir a ordem dos cards na home para esta categoria (áudios e
                  playlists juntos).
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {homeItems.length} item(s) na home
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetHomeOrder}
                      disabled={homeOrderLoading || homeOrderSaving}
                    >
                      Reverter
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveHomeOrder}
                      disabled={homeOrderLoading || homeOrderSaving || !homeOrderDirty}
                    >
                      {homeOrderSaving ? 'Salvando...' : 'Salvar ordem'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {homeOrderLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : homeItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum áudio ou playlist nesta categoria para ordenar.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleHomeDragEnd}
                  >
                    <SortableContext
                      items={homeItems.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 pb-2">
                        {homeItems.map((item, index) => (
                          <SortableHomeItem key={item.id} item={item} index={index} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-500">
            {audios.length} oração(ões) • {playlists.length} playlist(s) nesta categoria
          </div>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
