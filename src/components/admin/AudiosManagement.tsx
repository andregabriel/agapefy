"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Music, Edit, Trash2, Plus, Search, Play, Pause, Volume2, MoreVertical, Image } from 'lucide-react';
import AudioModal from './AudioModal';

interface Audio {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  audio_url: string;
  cover_url?: string; // NOVO CAMPO ADICIONADO
  duration: number;
  transcript: string;
  category_id: string;
  created_by: string;
  created_at: string;
  categories?: { name: string };
  profiles?: { full_name: string };
}

export default function AudiosManagement() {
  const [audios, setAudios] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedAudio, setSelectedAudio] = useState<Audio | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAudios();
    // Detectar mobile para mudar view mode
    const checkMobile = () => {
      setViewMode(window.innerWidth < 768 ? 'cards' : 'table');
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchAudios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('audios')
        .select(`
          *,
          categories(name),
          profiles(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAudios(data || []);
    } catch (error) {
      console.error('Erro ao buscar áudios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAudio = async (audioId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta oração?')) return;

    console.log('🗑️ Iniciando exclusão do áudio:', audioId);
    setDeletingId(audioId);

    try {
      // Verificar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ Erro ao verificar usuário:', userError);
        throw new Error(`Erro de autenticação: ${userError.message}`);
      }

      if (!user) {
        console.error('❌ Usuário não autenticado');
        throw new Error('Você precisa estar logado para excluir áudios');
      }

      console.log('✅ Usuário autenticado:', user.id);

      // Buscar informações do áudio antes de excluir
      const { data: audioInfo, error: fetchError } = await supabase
        .from('audios')
        .select('id, title, created_by')
        .eq('id', audioId)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar áudio:', fetchError);
        throw new Error(`Áudio não encontrado: ${fetchError.message}`);
      }

      console.log('🎵 Áudio encontrado:', audioInfo);

      // Primeiro, remover das playlists (playlist_audios)
      console.log('🗑️ Removendo áudio das playlists...');
      const { error: deletePlaylistAudiosError } = await supabase
        .from('playlist_audios')
        .delete()
        .eq('audio_id', audioId);

      if (deletePlaylistAudiosError) {
        console.error('❌ Erro ao remover áudio das playlists:', {
          error: deletePlaylistAudiosError,
          message: deletePlaylistAudiosError.message,
          details: deletePlaylistAudiosError.details,
          hint: deletePlaylistAudiosError.hint,
          code: deletePlaylistAudiosError.code
        });
        throw new Error(`Erro ao remover áudio das playlists: ${deletePlaylistAudiosError.message || 'Erro desconhecido'}`);
      }

      console.log('✅ Áudio removido das playlists com sucesso');

      // Agora excluir o áudio
      console.log('🗑️ Excluindo áudio...');
      const { error: deleteError } = await supabase
        .from('audios')
        .delete()
        .eq('id', audioId);

      if (deleteError) {
        console.error('❌ Erro detalhado ao excluir áudio:', {
          error: deleteError,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
          code: deleteError.code,
          audioId: audioId,
          userId: user.id
        });

        // Tratamento específico de erros
        let errorMessage = 'Erro ao excluir áudio';
        
        if (deleteError.code === '42501') {
          errorMessage = 'Você não tem permissão para excluir este áudio. Apenas o criador ou administradores podem excluir.';
        } else if (deleteError.code === '23503') {
          errorMessage = 'Não é possível excluir este áudio pois ele possui dependências.';
        } else if (deleteError.message) {
          errorMessage = `Erro ao excluir: ${deleteError.message}`;
        }

        throw new Error(errorMessage);
      }

      console.log('✅ Áudio excluído com sucesso do banco de dados');

      // Remover da lista local apenas após sucesso no banco
      setAudios(prevAudios => {
        const updatedAudios = prevAudios.filter(audio => audio.id !== audioId);
        console.log('✅ Áudio removido da lista local. Total restante:', updatedAudios.length);
        return updatedAudios;
      });

      // Parar áudio se estiver tocando
      if (playingAudio === audioId) {
        setPlayingAudio(null);
        if (currentAudio) {
          currentAudio.pause();
          setCurrentAudio(null);
        }
      }

      console.log('🎉 Exclusão concluída com sucesso!');
      
      // Mostrar feedback de sucesso
      alert('Oração excluída com sucesso!');

    } catch (error: any) {
      console.error('❌ ERRO GERAL ao excluir áudio:', error);
      console.error('❌ Tipo do erro:', typeof error);
      console.error('❌ Erro serializado:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Tratamento de erro com mensagem clara
      let errorMessage = 'Erro ao excluir oração';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);

      // Recarregar a lista para garantir consistência
      console.log('🔄 Recarregando lista de áudios após erro...');
      fetchAudios();
    } finally {
      setDeletingId(null);
    }
  };

  const handlePlayAudio = (audio: Audio) => {
    if (playingAudio === audio.id) {
      // Pausar áudio atual
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      setPlayingAudio(null);
    } else {
      // Parar áudio anterior se existir
      if (currentAudio) {
        currentAudio.pause();
      }

      // Criar novo áudio
      const audioElement = new Audio(audio.audio_url);
      audioElement.addEventListener('ended', () => {
        setPlayingAudio(null);
        setCurrentAudio(null);
      });
      
      audioElement.addEventListener('error', () => {
        alert('Erro ao reproduzir áudio. Verifique se a URL está correta.');
        setPlayingAudio(null);
        setCurrentAudio(null);
      });

      audioElement.play().then(() => {
        setPlayingAudio(audio.id);
        setCurrentAudio(audioElement);
      }).catch((error) => {
        console.error('Erro ao reproduzir áudio:', error);
        alert('Erro ao reproduzir áudio');
      });
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredAudios = audios.filter(audio =>
    audio.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    audio.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    audio.categories?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Gerenciamento de Orações</h1>
          <p className="text-sm sm:text-base text-gray-600">Gerencie todas as orações da plataforma</p>
        </div>
        <button
          onClick={() => {
            setSelectedAudio(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center transition-colors w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Oração
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 sm:p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar orações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
        </div>

        {filteredAudios.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Music className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Nenhuma oração encontrada' : 'Nenhuma oração cadastrada'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => {
                  setSelectedAudio(null);
                  setIsModalOpen(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center mx-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira oração
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Oração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado por
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAudios.map((audio) => (
                    <tr key={audio.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => handlePlayAudio(audio)}
                            className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white mr-3 hover:bg-blue-700 transition-colors"
                            title={playingAudio === audio.id ? 'Pausar' : 'Reproduzir'}
                          >
                            {playingAudio === audio.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4 ml-0.5" />
                            )}
                          </button>
                          
                          {/* IMAGEM DA ORAÇÃO ADICIONADA */}
                          {audio.cover_url ? (
                            <img 
                              src={audio.cover_url} 
                              alt={audio.title}
                              className="w-12 h-12 rounded-lg object-cover mr-3"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                              <Image className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          
                          <div>
                            <div className="text-sm font-medium text-gray-900">{audio.title}</div>
                            {audio.subtitle && (
                              <div className="text-xs text-gray-600">{audio.subtitle}</div>
                            )}
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {audio.description || 'Sem descrição'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {audio.categories?.name || 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Volume2 className="h-4 w-4 text-gray-400 mr-1" />
                          {formatDuration(audio.duration)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {audio.profiles?.full_name || 'Usuário desconhecido'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(audio.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedAudio(audio);
                              setIsModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"
                            title="Editar oração"
                            disabled={deletingId === audio.id}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAudio(audio.id)}
                            disabled={deletingId === audio.id}
                            className="text-red-600 hover:text-red-900 p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir oração"
                          >
                            {deletingId === audio.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden">
              {filteredAudios.map((audio) => (
                <div key={audio.id} className="border-b border-gray-200 p-4">
                  <div className="flex items-start space-x-3">
                    <button
                      onClick={() => handlePlayAudio(audio)}
                      className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors flex-shrink-0"
                      title={playingAudio === audio.id ? 'Pausar' : 'Reproduzir'}
                    >
                      {playingAudio === audio.id ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" />
                      )}
                    </button>
                    
                    {/* IMAGEM DA ORAÇÃO ADICIONADA NO MOBILE */}
                    {audio.cover_url ? (
                      <img 
                        src={audio.cover_url} 
                        alt={audio.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Image className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {audio.title}
                          </h3>
                          {audio.subtitle && (
                            <p className="text-xs text-gray-600 mt-1">{audio.subtitle}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {audio.description || 'Sem descrição'}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-2">
                          <button
                            onClick={() => {
                              setSelectedAudio(audio);
                              setIsModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"
                            title="Editar oração"
                            disabled={deletingId === audio.id}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAudio(audio.id)}
                            disabled={deletingId === audio.id}
                            className="text-red-600 hover:text-red-900 p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir oração"
                          >
                            {deletingId === audio.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-3">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {audio.categories?.name || 'Sem categoria'}
                          </span>
                          <div className="flex items-center text-xs text-gray-500">
                            <Volume2 className="h-3 w-3 mr-1" />
                            {formatDuration(audio.duration)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        <span>Por {audio.profiles?.full_name || 'Usuário desconhecido'}</span>
                        <span className="mx-1">•</span>
                        <span>{new Date(audio.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <AudioModal
          audio={selectedAudio}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedAudio(null);
          }}
          onSave={() => {
            fetchAudios();
            setIsModalOpen(false);
            setSelectedAudio(null);
          }}
        />
      )}
    </div>
  );
}