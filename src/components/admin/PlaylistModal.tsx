"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Upload, Image, Plus, Trash2, GripVertical, Search, ChevronUp, ChevronDown } from 'lucide-react';

interface PlaylistFormData {
  title: string;
  description: string;
  cover_url: string;
  category_ids: string[];
  is_public: boolean;
  is_challenge: boolean;
}

interface PlaylistModalProps {
  playlist: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function PlaylistModal({ playlist, isOpen, onClose, onSave }: PlaylistModalProps) {
  const [formData, setFormData] = useState<PlaylistFormData>({
    title: '',
    description: '',
    cover_url: '',
    category_ids: [],
    is_public: true,
    is_challenge: false,
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [audios, setAudios] = useState<any[]>([]);
  const [selectedAudios, setSelectedAudios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [audioSearchTerm, setAudioSearchTerm] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const normalizeCategoryIds = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string' && raw) return [raw];
    return [];
  };

  // Helpers para draft persistence
  const getDraftKey = () => {
    const base = 'admin.draft.playlist';
    if (playlist?.id) return `${base}.edit.${playlist.id}`;
    return `${base}.new`;
  };

  useEffect(() => {
    fetchCategories();
    fetchAudios();
  }, []);

  useEffect(() => {
    if (playlist) {
      setFormData({
        title: playlist.title || '',
        description: playlist.description || '',
        cover_url: playlist.cover_url || '',
        category_ids: normalizeCategoryIds((playlist as any).category_ids ?? playlist.category_id),
        is_public: playlist.is_public ?? true,
        is_challenge: playlist.is_challenge ?? false,
      });
      fetchPlaylistAudios();
    } else {
      setFormData({
        title: '',
        description: '',
        cover_url: '',
        category_ids: [],
        is_public: true,
        is_challenge: false,
      });
      setSelectedAudios([]);
    }
  }, [playlist]);

  // Restaurar draft ao abrir modal
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.formData) {
          const draftCategories =
            (draft.formData as any).category_ids ??
            (draft.formData as any).category_id;
          setFormData((prev: any) => ({
            ...prev,
            ...draft.formData,
            category_ids:
              draftCategories !== undefined
                ? normalizeCategoryIds(draftCategories)
                : prev.category_ids,
          }));
        }
        if (Array.isArray(draft.selectedAudios)) setSelectedAudios(draft.selectedAudios);
      }
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, playlist?.id]);

  // Salvar draft quando editar campos com modal aberto
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      localStorage.setItem(key, JSON.stringify({ formData, selectedAudios }));
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, selectedAudios, isOpen, playlist?.id]);

  useEffect(() => {
    if (!categoryDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryDropdownOpen]);

  // Limpar draft ao fechar/salvar
  const clearDraft = () => {
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      localStorage.removeItem(key);
    } catch (_) {
      // ignore
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const fetchAudios = async () => {
    try {
      const { data, error } = await supabase
        .from('audios')
        .select('id, title, duration')
        .order('title');

      if (error) throw error;
      setAudios(data || []);
    } catch (error) {
      console.error('Erro ao buscar áudios:', error);
    }
  };

  const fetchPlaylistAudios = async () => {
    if (!playlist) return;

    try {
      const { data, error } = await supabase
        .from('playlist_audios')
        .select(`
          position,
          audios (id, title, duration)
        `)
        .eq('playlist_id', playlist.id)
        .order('position', { ascending: true });

      if (error) throw error;
      
      // Ordenar por position e garantir que está na ordem correta
      const playlistAudios = (data || [])
        .map(item => ({
          ...item.audios,
          position: item.position
        }))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      
      setSelectedAudios(playlistAudios);
    } catch (error) {
      console.error('Erro ao buscar áudios da playlist:', error);
    }
  };

  const addAudioToPlaylist = (audio: any) => {
    setSelectedAudios(prev => {
      if (prev.find(a => a.id === audio.id)) return prev;
      const next = [...prev, { ...audio }];
      // Normalizar posições para manter consistente com a ordem visual
      return next.map((item, index) => ({ ...item, position: index }));
    });
  };

  const removeAudioFromPlaylist = (audioId: string) => {
    setSelectedAudios(prev => {
      const updated = prev.filter(a => a.id !== audioId);
      // Recalcular posições após remoção
      return updated.map((item, index) => ({ ...item, position: index }));
    });
  };

  const toggleCategorySelection = (categoryId: string) => {
    setFormData((prev) => {
      const current = prev.category_ids || [];
      const exists = current.includes(categoryId);
      const next = exists ? current.filter((id) => id !== categoryId) : [...current, categoryId];
      return { ...prev, category_ids: next };
    });
  };

  const filteredCategories = useMemo(() => {
    const term = categorySearchTerm.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((cat) => cat.name.toLowerCase().includes(term));
  }, [categories, categorySearchTerm]);

  const selectedCategories = useMemo(
    () => formData.category_ids.map((id) => categoryMap.get(id)).filter(Boolean),
    [formData.category_ids, categoryMap]
  );

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Tipo de arquivo inválido. Use JPEG, PNG ou WebP');
      return;
    }

    // Validar tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('Arquivo muito grande. Máximo 5MB permitido');
      return;
    }

    setUploadingImage(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload-playlist-image', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao fazer upload da imagem');
      }

      const data = await response.json();
      
      if (data.success && data.image_url) {
        setFormData((prev) => ({ ...prev, cover_url: data.image_url }));
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload da imagem:', error);
      alert(error.message || 'Erro ao fazer upload da imagem');
    } finally {
      setUploadingImage(false);
      // Limpar o input para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const moveAudio = (fromIndex: number, toIndex: number) => {
    setSelectedAudios(prev => {
      const working = [...prev];
      if (toIndex < 0 || toIndex >= working.length) return working;

      const [moved] = working.splice(fromIndex, 1);
      working.splice(toIndex, 0, moved);

      // Normalizar posições com base na nova ordem
      return working.map((item, index) => ({ ...item, position: index }));
    });
  };

  // Filtrar áudios disponíveis baseado na busca e excluir os já selecionados
  const availableAudios = audios.filter(audio => {
    const isNotSelected = !selectedAudios.find(a => a.id === audio.id);
    const matchesSearch = audioSearchTerm.trim() === '' || 
      audio.title.toLowerCase().includes(audioSearchTerm.toLowerCase());
    return isNotSelected && matchesSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Por favor, insira um título para a playlist');
      return;
    }

    setLoading(true);

    try {
      const primaryCategoryId = formData.category_ids[0] || null;
      console.log('🔄 Iniciando salvamento da playlist...');
      console.log('📝 Dados do formulário:', formData);
      console.log('🎵 Áudios selecionados:', selectedAudios.length);

      // Verificar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ Erro ao verificar usuário:', userError);
        throw new Error(`Erro de autenticação: ${userError.message}`);
      }

      if (!user) {
        console.error('❌ Usuário não autenticado');
        throw new Error('Você precisa estar logado para salvar playlists');
      }

      console.log('✅ Usuário autenticado:', user.id);
      
      let playlistId = playlist?.id;

      if (playlist) {
        // Atualizar playlist existente
        console.log('🔄 Atualizando playlist existente:', playlist.id);
        
        const updateData = {
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          cover_url: formData.cover_url?.trim() || null,
          category_id: primaryCategoryId,
          category_ids: formData.category_ids || [],
          is_public: formData.is_public,
          is_challenge: formData.is_challenge,
        };

        console.log('📝 Dados para atualização:', updateData);

        const { data: updateResult, error: updateError } = await supabase
          .from('playlists')
          .update(updateData)
          .eq('id', playlist.id)
          .select();

        if (updateError) {
          console.error('❌ Erro detalhado ao atualizar playlist:', {
            error: updateError,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code
          });
          throw new Error(`Erro ao atualizar playlist: ${updateError.message || 'Erro desconhecido'}`);
        }

        console.log('✅ Playlist atualizada com sucesso:', updateResult);
      } else {
        // Criar nova playlist
        console.log('🆕 Criando nova playlist...');
        
        const insertData = {
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          cover_url: formData.cover_url?.trim() || null,
          category_id: primaryCategoryId,
          category_ids: formData.category_ids || [],
          is_public: formData.is_public,
          is_challenge: formData.is_challenge,
          created_by: user.id,
        };

        console.log('📝 Dados para inserção:', insertData);

        const { data: insertResult, error: insertError } = await supabase
          .from('playlists')
          .insert([insertData])
          .select()
          .single();

        if (insertError) {
          console.error('❌ Erro detalhado ao criar playlist:', {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          throw new Error(`Erro ao criar playlist: ${insertError.message || 'Erro desconhecido'}`);
        }

        console.log('✅ Playlist criada com sucesso:', insertResult);
        playlistId = insertResult.id;
      }

      // Atualizar áudios da playlist
      if (playlistId) {
        console.log('🎵 Atualizando áudios da playlist...');
        console.log('🆔 ID da playlist:', playlistId);
        
        // Remover áudios existentes
        console.log('🗑️ Removendo áudios existentes...');
        const { error: deleteError } = await supabase
          .from('playlist_audios')
          .delete()
          .eq('playlist_id', playlistId);

        if (deleteError) {
          console.error('❌ Erro detalhado ao remover áudios existentes:', {
            error: deleteError,
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint,
            code: deleteError.code,
            playlistId: playlistId
          });
          throw new Error(`Erro ao remover áudios existentes: ${deleteError.message || 'Erro de permissão'}`);
        }

        console.log('✅ Áudios existentes removidos com sucesso');

        // Adicionar novos áudios
        if (selectedAudios.length > 0) {
          console.log('➕ Adicionando novos áudios:', selectedAudios.length);
          
          const playlistAudios = selectedAudios.map((audio, index) => ({
            playlist_id: playlistId,
            audio_id: audio.id,
            position: index,
          }));

          console.log('📝 Dados dos áudios para inserção:', playlistAudios);
          console.log('🔍 Verificando IDs:', {
            playlistId: playlistId,
            audioIds: selectedAudios.map(a => a.id),
            totalAudios: playlistAudios.length
          });

          // Verificar se os áudios existem antes de inserir
          const audioIds = selectedAudios.map(a => a.id);
          const { data: existingAudios, error: checkError } = await supabase
            .from('audios')
            .select('id')
            .in('id', audioIds);

          if (checkError) {
            console.error('❌ Erro ao verificar áudios existentes:', checkError);
            throw new Error(`Erro ao verificar áudios: ${checkError.message}`);
          }

          console.log('✅ Áudios verificados:', existingAudios?.length, 'de', audioIds.length);

          if (existingAudios?.length !== audioIds.length) {
            console.error('❌ Alguns áudios não existem no banco');
            throw new Error('Alguns áudios selecionados não existem mais no banco de dados');
          }

          const { data: insertResult, error: insertAudiosError } = await supabase
            .from('playlist_audios')
            .insert(playlistAudios)
            .select();

          if (insertAudiosError) {
            console.error('❌ Erro detalhado ao inserir áudios:', {
              error: insertAudiosError,
              message: insertAudiosError.message,
              details: insertAudiosError.details,
              hint: insertAudiosError.hint,
              code: insertAudiosError.code,
              playlistId: playlistId,
              audioCount: playlistAudios.length,
              audioData: playlistAudios
            });

            // Tratamento específico de erros para playlist_audios
            let audioErrorMessage = 'Erro ao adicionar áudios à playlist';
            
            if (insertAudiosError.code === '42501') {
              audioErrorMessage = 'Você não tem permissão para adicionar áudios à playlist. Verifique se está logado como administrador.';
            } else if (insertAudiosError.code === '23503') {
              audioErrorMessage = 'Alguns áudios selecionados não existem mais no banco de dados.';
            } else if (insertAudiosError.code === '23505') {
              audioErrorMessage = 'Alguns áudios já estão na playlist.';
            } else if (insertAudiosError.message) {
              audioErrorMessage = `Erro ao adicionar áudios: ${insertAudiosError.message}`;
            }

            throw new Error(audioErrorMessage);
          }

          console.log('✅ Áudios adicionados com sucesso:', insertResult?.length || 0);
        } else {
          console.log('ℹ️ Nenhum áudio para adicionar');
        }
      }

      console.log('🎉 Playlist salva com sucesso!');
      onSave();
      clearDraft();
    } catch (error: any) {
      console.error('❌ ERRO GERAL ao salvar playlist:', error);
      console.error('❌ Tipo do erro:', typeof error);
      console.error('❌ Erro serializado:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Tratamento específico de erros
      let errorMessage = 'Erro ao salvar playlist';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        if (error.code === '42501') {
          errorMessage = 'Você não tem permissão para salvar esta playlist. Faça login como administrador.';
        } else if (error.code === '23505') {
          errorMessage = 'Já existe uma playlist com este nome.';
        } else if (error.message) {
          errorMessage = `Erro: ${error.message}`;
        }
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {playlist ? 'Editar Playlist' : 'Nova Playlist'}
          </h2>
          <button 
            onClick={() => {
              clearDraft();
              onClose();
            }} 
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informações da Playlist */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Informações da Playlist</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título da Playlist *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
                  placeholder="Ex: Orações para Dormir"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
                  placeholder="Breve descrição da playlist..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL da Capa
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.cover_url}
                      onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
                      placeholder="https://exemplo.com/capa.jpg"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleUploadButtonClick}
                      disabled={uploadingImage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      {uploadingImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span className="hidden sm:inline">Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Image className="h-4 w-4" />
                          <span className="hidden sm:inline">Upload</span>
                        </>
                      )}
                    </button>
                  </div>
                  {formData.cover_url && (
                    <div className="mt-2">
                      <img
                        src={formData.cover_url}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Digite uma URL ou faça upload de uma imagem (JPEG, PNG ou WebP - máx. 5MB)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categorias
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 min-h-[44px] border border-gray-200 rounded-lg px-3 py-2 bg-white">
                    {selectedCategories.length === 0 ? (
                      <span className="text-xs text-gray-500">Nenhuma categoria selecionada</span>
                    ) : (
                      selectedCategories.map((category: any) => (
                        <span
                          key={category.id}
                          className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs"
                        >
                          {category.name}
                          <button
                            type="button"
                            onClick={() => toggleCategorySelection(category.id)}
                            className="p-0.5 text-blue-600 hover:text-blue-800"
                            aria-label={`Remover categoria ${category.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryDropdownOpen((prev) => !prev);
                        setCategorySearchTerm('');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black bg-white"
                    >
                      <span>{categoryDropdownOpen ? 'Fechar seleção' : 'Selecionar categorias'}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-500 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {categoryDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg">
                        <div className="p-2">
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={categorySearchTerm}
                              onChange={(e) => setCategorySearchTerm(e.target.value)}
                              placeholder="Buscar categoria..."
                              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filteredCategories.length === 0 ? (
                              <p className="text-sm text-gray-500 px-2 py-2">Nenhuma categoria encontrada</p>
                            ) : (
                              filteredCategories.map((category: any) => (
                                <label
                                  key={category.id}
                                  className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={formData.category_ids.includes(category.id)}
                                    onChange={() => toggleCategorySelection(category.id)}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                  />
                                  <span className="text-sm text-gray-900">{category.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_public" className="ml-2 block text-sm text-gray-900">
                Playlist pública
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_challenge"
                checked={formData.is_challenge}
                onChange={(e) => setFormData({ ...formData, is_challenge: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_challenge" className="ml-2 block text-sm text-gray-900">
                Desafio
              </label>
            </div>
          </div>
            </div>

            {/* Gerenciamento de Áudios */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Áudios da Playlist</h3>
              
              {/* Lista de áudios disponíveis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adicionar Áudios
                </label>
                <div className="mb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={audioSearchTerm}
                      onChange={(e) => setAudioSearchTerm(e.target.value)}
                      placeholder="Buscar áudio..."
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
                    />
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {availableAudios.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">
                      {audioSearchTerm.trim() ? 'Nenhum áudio encontrado' : 'Nenhum áudio disponível'}
                    </p>
                  ) : (
                    availableAudios.map((audio) => (
                      <div
                        key={audio.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{audio.title}</p>
                          <p className="text-xs text-gray-500">
                            {audio.duration ? `${Math.floor(audio.duration / 60)}:${(audio.duration % 60).toString().padStart(2, '0')}` : 'Duração não definida'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            addAudioToPlaylist(audio);
                            setAudioSearchTerm(''); // Limpar busca após adicionar
                          }}
                          className="ml-2 p-1 text-blue-600 hover:text-blue-800"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Lista de áudios selecionados */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Áudios Selecionados ({selectedAudios.length})
                </label>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {selectedAudios.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">
                      Nenhum áudio selecionado
                    </p>
                  ) : (
                    selectedAudios.map((audio, index) => (
                      <div
                        key={audio.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {audio.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              Posição {index + 1} •{' '}
                              {audio.duration
                                ? `${Math.floor(audio.duration / 60)}:${(
                                    audio.duration % 60
                                  )
                                    .toString()
                                    .padStart(2, '0')}`
                                : 'Duração não definida'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => moveAudio(index, index - 1)}
                            disabled={index === 0}
                            className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Mover para cima"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAudio(index, index + 1)}
                            disabled={index === selectedAudios.length - 1}
                            className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Mover para baixo"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAudioFromPlaylist(audio.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            aria-label="Remover áudio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                clearDraft();
                onClose();
              }}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 transition-colors order-2 sm:order-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors order-1 sm:order-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {playlist ? 'Atualizar' : 'Salvar'} Playlist
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
