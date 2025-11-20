"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Upload, Music, Image, Plus, Trash2 } from 'lucide-react';

interface AudioModalProps {
  audio: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function AudioModal({ audio, isOpen, onClose, onSave }: AudioModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    audio_url: '',
    cover_url: '', // NOVO CAMPO ADICIONADO
    duration: '',
    transcript: '',
    category_id: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [audioPlaylists, setAudioPlaylists] = useState<any[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<any[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedPlaylistToAdd, setSelectedPlaylistToAdd] = useState<string>('');

  // Helpers para draft persistence
  const getDraftKey = () => {
    const base = 'admin.draft.audio';
    if (audio?.id) return `${base}.edit.${audio.id}`;
    return `${base}.new`;
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (audio?.id && isOpen) {
      fetchAudioPlaylists();
      fetchAllPlaylists();
    }
  }, [audio?.id, isOpen]);

  useEffect(() => {
    if (audio) {
      setFormData({
        title: audio.title || '',
        subtitle: audio.subtitle || '',
        description: audio.description || '',
        audio_url: audio.audio_url || '',
        cover_url: audio.cover_url || '', // NOVO CAMPO ADICIONADO
        duration: audio.duration?.toString() || '',
        transcript: audio.transcript || '',
        category_id: audio.category_id || '',
      });
    } else {
      setFormData({
        title: '',
        subtitle: '',
        description: '',
        audio_url: '',
        cover_url: '', // NOVO CAMPO ADICIONADO
        duration: '',
        transcript: '',
        category_id: '',
      });
    }
  }, [audio]);

  // Restaurar draft ao abrir modal
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        setFormData(prev => ({ ...prev, ...draft }));
      }
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, audio?.id]);

  // Salvar draft quando editar campos com modal aberto
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof window === 'undefined') return;
      const key = getDraftKey();
      localStorage.setItem(key, JSON.stringify(formData));
    } catch (_) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isOpen, audio?.id]);

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

  const fetchAudioPlaylists = async () => {
    if (!audio?.id) return;
    
    try {
      setPlaylistsLoading(true);
      const { data, error } = await supabase
        .from('playlist_audios')
        .select(`
          playlist_id,
          playlists (
            id,
            title,
            description
          )
        `)
        .eq('audio_id', audio.id);

      if (error) throw error;
      
      const playlists = (data || [])
        .filter((item: any) => item.playlists) // Filtrar casos onde playlists pode ser null
        .map((item: any) => ({
          id: item.playlists.id,
          title: item.playlists.title,
          description: item.playlists.description,
        }));
      
      setAudioPlaylists(playlists);
    } catch (error) {
      console.error('Erro ao buscar playlists do áudio:', error);
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const fetchAllPlaylists = async () => {
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, title, description')
        .order('title');

      if (error) throw error;
      setAllPlaylists(data || []);
    } catch (error) {
      console.error('Erro ao buscar todas as playlists:', error);
    }
  };

  const handleRemoveFromPlaylist = async (playlistId: string) => {
    if (!audio?.id) return;
    
    try {
      const { error } = await supabase
        .from('playlist_audios')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('audio_id', audio.id);

      if (error) throw error;
      
      // Atualizar lista local
      setAudioPlaylists(prev => prev.filter(p => p.id !== playlistId));
    } catch (error) {
      console.error('Erro ao remover áudio da playlist:', error);
      alert('Erro ao remover áudio da playlist');
    }
  };

  const handleAddToPlaylist = async () => {
    if (!audio?.id || !selectedPlaylistToAdd) return;
    
    // Verificar se já está na playlist
    if (audioPlaylists.some(p => p.id === selectedPlaylistToAdd)) {
      alert('Este áudio já está nesta playlist');
      return;
    }

    try {
      // Buscar a posição máxima na playlist para adicionar no final
      const { data: existingPositions, error: posError } = await supabase
        .from('playlist_audios')
        .select('position')
        .eq('playlist_id', selectedPlaylistToAdd)
        .order('position', { ascending: false })
        .limit(1);

      if (posError) throw posError;

      const nextPosition = existingPositions && existingPositions.length > 0 
        ? existingPositions[0].position + 1 
        : 0;

      const { error } = await supabase
        .from('playlist_audios')
        .insert([{
          playlist_id: selectedPlaylistToAdd,
          audio_id: audio.id,
          position: nextPosition,
        }]);

      if (error) throw error;
      
      // Buscar dados da playlist adicionada
      const playlist = allPlaylists.find(p => p.id === selectedPlaylistToAdd);
      if (playlist) {
        setAudioPlaylists(prev => [...prev, playlist]);
      }
      
      setSelectedPlaylistToAdd('');
    } catch (error: any) {
      console.error('Erro ao adicionar áudio à playlist:', error);
      if (error.code === '23505') {
        alert('Este áudio já está nesta playlist');
      } else {
        alert('Erro ao adicionar áudio à playlist');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Por favor, insira um título para o áudio');
      return;
    }

    if (!formData.audio_url.trim()) {
      alert('Por favor, insira a URL do áudio');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Iniciando salvamento do áudio...');
      console.log('📝 Dados do formulário:', formData);

      // Verificar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ Erro ao verificar usuário:', userError);
        throw new Error(`Erro de autenticação: ${userError.message}`);
      }

      if (!user) {
        console.error('❌ Usuário não autenticado');
        throw new Error('Você precisa estar logado para salvar áudios');
      }

      console.log('✅ Usuário autenticado:', user.id);

      const audioData = {
        title: formData.title.trim(),
        subtitle: formData.subtitle?.trim() || null,
        description: formData.description?.trim() || null,
        audio_url: formData.audio_url.trim(),
        cover_url: formData.cover_url?.trim() || null, // NOVO CAMPO ADICIONADO
        duration: formData.duration ? parseInt(formData.duration) : null,
        transcript: formData.transcript?.trim() || null,
        category_id: formData.category_id || null,
        created_by: user.id,
      };

      console.log('📝 Dados para salvar:', audioData);

      if (audio) {
        // Atualizar áudio existente
        console.log('🔄 Atualizando áudio existente:', audio.id);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('audios')
          .update(audioData)
          .eq('id', audio.id)
          .select();

        if (updateError) {
          console.error('❌ Erro detalhado ao atualizar áudio:', {
            error: updateError,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code
          });
          throw new Error(`Erro ao atualizar áudio: ${updateError.message || 'Erro desconhecido'}`);
        }

        console.log('✅ Áudio atualizado com sucesso:', updateResult);
      } else {
        // Criar novo áudio
        console.log('🆕 Criando novo áudio...');
        
        const { data: insertResult, error: insertError } = await supabase
          .from('audios')
          .insert([audioData])
          .select();

        if (insertError) {
          console.error('❌ Erro detalhado ao criar áudio:', {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          throw new Error(`Erro ao criar áudio: ${insertError.message || 'Erro desconhecido'}`);
        }

        console.log('✅ Áudio criado com sucesso:', insertResult);
      }

      console.log('🎉 Áudio salvo com sucesso!');
      onSave();
      clearDraft();
    } catch (error: any) {
      console.error('❌ ERRO GERAL ao salvar áudio:', error);
      console.error('❌ Tipo do erro:', typeof error);
      console.error('❌ Erro serializado:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Tratamento específico de erros
      let errorMessage = 'Erro ao salvar áudio';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        if (error.code === '42501') {
          errorMessage = 'Você não tem permissão para salvar este áudio. Faça login como administrador.';
        } else if (error.code === '23505') {
          errorMessage = 'Já existe um áudio com este título.';
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
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {audio ? 'Editar Áudio' : 'Novo Áudio'}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título da Oração *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="Ex: Oração da Manhã"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sub-título
            </label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="Ex: Elevando nossos corações"
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
              placeholder="Breve descrição da oração..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL do Áudio *
            </label>
            <input
              type="url"
              value={formData.audio_url}
              onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="https://exemplo.com/audio.mp3"
              required
            />
          </div>

          {/* NOVO CAMPO DE IMAGEM ADICIONADO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Image className="inline h-4 w-4 mr-1" />
              URL da Imagem da Oração
            </label>
            <input
              type="url"
              value={formData.cover_url}
              onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="https://exemplo.com/imagem-oracao.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Imagem que será exibida na home e nas listagens (opcional)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duração (segundos)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="Ex: 300"
              min="0"
            />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcrição
            </label>
            <textarea
              value={formData.transcript}
              onChange={(e) => setFormData({ ...formData, transcript: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-black"
              placeholder="Texto completo da oração (opcional)..."
            />
          </div>

          {/* Seção de Playlists - apenas para edição */}
          {audio?.id && (
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Playlists
              </label>
              
              {/* Lista de playlists que o áudio está */}
              {playlistsLoading ? (
                <div className="text-sm text-gray-500 mb-3">Carregando playlists...</div>
              ) : (
                <>
                  {audioPlaylists.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {audioPlaylists.map((playlist) => (
                        <div
                          key={playlist.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {playlist.title}
                            </div>
                            {playlist.description && (
                              <div className="text-xs text-gray-500 mt-1">
                                {playlist.description}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromPlaylist(playlist.id)}
                            className="ml-3 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remover da playlist"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mb-4">
                      Este áudio não está em nenhuma playlist
                    </div>
                  )}

                  {/* Adicionar a uma playlist */}
                  <div className="flex gap-2">
                    <select
                      value={selectedPlaylistToAdd}
                      onChange={(e) => setSelectedPlaylistToAdd(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
                    >
                      <option value="">Selecione uma playlist para adicionar</option>
                      {allPlaylists
                        .filter(p => !audioPlaylists.some(ap => ap.id === p.id))
                        .map((playlist) => (
                          <option key={playlist.id} value={playlist.id}>
                            {playlist.title}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddToPlaylist}
                      disabled={!selectedPlaylistToAdd}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                      title="Adicionar à playlist"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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
                  {audio ? 'Atualizar' : 'Salvar'} Áudio
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}