"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { List, Edit, Trash2, Plus, Search, Eye } from 'lucide-react';
import PlaylistModal from './PlaylistModal';

interface Playlist {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  is_public: boolean;
  created_at: string;
  categories?: { name: string };
  profiles?: { full_name: string };
}

export default function PlaylistsManagement() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          *,
          categories(name),
          profiles(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlaylists(data || []);
    } catch (error) {
      console.error('Erro ao buscar playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta playlist?')) return;

    console.log('🗑️ Iniciando exclusão da playlist:', playlistId);
    setDeletingId(playlistId);

    try {
      // Verificar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ Erro ao verificar usuário:', userError);
        throw new Error(`Erro de autenticação: ${userError.message}`);
      }

      if (!user) {
        console.error('❌ Usuário não autenticado');
        throw new Error('Você precisa estar logado para excluir playlists');
      }

      console.log('✅ Usuário autenticado:', user.id);

      // Buscar informações da playlist antes de excluir
      const { data: playlistInfo, error: fetchError } = await supabase
        .from('playlists')
        .select('id, title, created_by')
        .eq('id', playlistId)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar playlist:', fetchError);
        throw new Error(`Playlist não encontrada: ${fetchError.message}`);
      }

      console.log('📋 Playlist encontrada:', playlistInfo);

      // Primeiro, excluir áudios da playlist (playlist_audios)
      console.log('🗑️ Removendo áudios da playlist...');
      const { error: deleteAudiosError } = await supabase
        .from('playlist_audios')
        .delete()
        .eq('playlist_id', playlistId);

      if (deleteAudiosError) {
        console.error('❌ Erro ao remover áudios da playlist:', {
          error: deleteAudiosError,
          message: deleteAudiosError.message,
          details: deleteAudiosError.details,
          hint: deleteAudiosError.hint,
          code: deleteAudiosError.code
        });
        throw new Error(`Erro ao remover áudios da playlist: ${deleteAudiosError.message || 'Erro desconhecido'}`);
      }

      console.log('✅ Áudios da playlist removidos com sucesso');

      // Agora excluir a playlist
      console.log('🗑️ Excluindo playlist...');
      const { error: deleteError } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);

      if (deleteError) {
        console.error('❌ Erro detalhado ao excluir playlist:', {
          error: deleteError,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
          code: deleteError.code,
          playlistId: playlistId,
          userId: user.id
        });

        // Tratamento específico de erros
        let errorMessage = 'Erro ao excluir playlist';
        
        if (deleteError.code === '42501') {
          errorMessage = 'Você não tem permissão para excluir esta playlist. Apenas o criador ou administradores podem excluir.';
        } else if (deleteError.code === '23503') {
          errorMessage = 'Não é possível excluir esta playlist pois ela possui dependências.';
        } else if (deleteError.message) {
          errorMessage = `Erro ao excluir: ${deleteError.message}`;
        }

        throw new Error(errorMessage);
      }

      console.log('✅ Playlist excluída com sucesso do banco de dados');

      // Remover da lista local apenas após sucesso no banco
      setPlaylists(prevPlaylists => {
        const updatedPlaylists = prevPlaylists.filter(playlist => playlist.id !== playlistId);
        console.log('✅ Playlist removida da lista local. Total restante:', updatedPlaylists.length);
        return updatedPlaylists;
      });

      console.log('🎉 Exclusão concluída com sucesso!');
      
      // Mostrar feedback de sucesso
      alert('Playlist excluída com sucesso!');

    } catch (error: any) {
      console.error('❌ ERRO GERAL ao excluir playlist:', error);
      console.error('❌ Tipo do erro:', typeof error);
      console.error('❌ Erro serializado:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Tratamento de erro com mensagem clara
      let errorMessage = 'Erro ao excluir playlist';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);

      // Recarregar a lista para garantir consistência
      console.log('🔄 Recarregando lista de playlists após erro...');
      fetchPlaylists();
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPlaylists = playlists.filter(playlist =>
    playlist.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    playlist.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Gerenciamento de Playlists</h1>
          <p className="text-gray-600">Organize as orações em playlists temáticas</p>
        </div>
        <button
          onClick={() => {
            setSelectedPlaylist(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Playlist
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar playlists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {filteredPlaylists.map((playlist) => (
            <div key={playlist.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  {playlist.cover_url ? (
                    <img
                      src={playlist.cover_url}
                      alt={playlist.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <List className="h-6 w-6 text-purple-600" />
                    </div>
                  )}
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">{playlist.title}</h3>
                    <div className="flex items-center mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        playlist.is_public 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {playlist.is_public ? 'Pública' : 'Privada'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedPlaylist(playlist);
                      setIsModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                    disabled={deletingId === playlist.id}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    disabled={deletingId === playlist.id}
                    className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === playlist.id ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">
                {playlist.description || 'Sem descrição'}
              </p>
              
              <div className="text-xs text-gray-500">
                <p>Categoria: {playlist.categories?.name || 'Sem categoria'}</p>
                <p>Criado por: {playlist.profiles?.full_name || 'Usuário desconhecido'}</p>
                <p>Em {new Date(playlist.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredPlaylists.length === 0 && (
          <div className="text-center py-12">
            <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma playlist encontrada</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <PlaylistModal
          playlist={selectedPlaylist}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPlaylist(null);
          }}
          onSave={() => {
            fetchPlaylists();
            setIsModalOpen(false);
            setSelectedPlaylist(null);
          }}
        />
      )}
    </div>
  );
}