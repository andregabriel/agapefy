"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Upload, Image, Plus, Trash2, GripVertical } from 'lucide-react';

interface PlaylistModalProps {
  playlist: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function PlaylistModal({ playlist, isOpen, onClose, onSave }: PlaylistModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cover_url: '',
    category_id: '',
    is_public: true,
    is_challenge: false,
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [audios, setAudios] = useState<any[]>([]);
  const [selectedAudios, setSelectedAudios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
        category_id: playlist.category_id || '',
        is_public: playlist.is_public ?? true,
        is_challenge: playlist.is_challenge ?? false,
      });
      fetchPlaylistAudios();
    } else {
      setFormData({
        title: '',
        description: '',
        cover_url: '',
        category_id: '',
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
        if (draft.formData) setFormData((prev: any) => ({ ...prev, ...draft.formData }));
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
        .order('position');

      if (error) throw error;
      
      const playlistAudios = data?.map(item => ({
        ...item.audios,
        position: item.position
      })) || [];
      
      setSelectedAudios(playlistAudios);
    } catch (error) {
      console.error('Erro ao buscar áudios da playlist:', error);
    }
  };

  const addAudioToPlaylist = (audio: any) => {
    if (!selectedAudios.find(a => a.id === audio.id)) {
      setSelectedAudios([...selectedAudios, { ...audio, position: selectedAudios.length }]);
    }
  };

  const removeAudioFromPlaylist = (audioId: string) => {
    setSelectedAudios(selectedAudios.filter(a => a.id !== audioId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Por favor, insira um título para a playlist');
      return;
    }

    setLoading(true);

    try {
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
          category_id: formData.category_id || null,
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
          category_id: formData.category_id || null,
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
                <input
                  type="url"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
                  placeholder="https://exemplo.com/capa.jpg"
                />
                {formData.cover_url && (
                  <div className="mt-2">
                    <img
                      src={formData.cover_url}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded-lg border"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
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
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {audios.map((audio) => (
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
                        onClick={() => addAudioToPlaylist(audio)}
                        disabled={selectedAudios.find(a => a.id === audio.id)}
                        className="ml-2 p-1 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
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
                            <p className="text-sm font-medium text-gray-900 truncate">{audio.title}</p>
                            <p className="text-xs text-gray-500">
                              Posição {index + 1} • {audio.duration ? `${Math.floor(audio.duration / 60)}:${(audio.duration % 60).toString().padStart(2, '0')}` : 'Duração não definida'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAudioFromPlaylist(audio.id)}
                          className="ml-2 p-1 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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