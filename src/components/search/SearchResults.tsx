"use client";

import { useState } from 'react';
import { Play, List, Folder, BookOpen, Heart, Download, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SearchResults, Audio, Playlist, Category } from '@/types/search';
import type { SearchResult } from '@/lib/search';
import { getBookName } from '@/lib/search';

interface SearchResultsProps {
  results: SearchResults;
  searchTerm: string;
  totalResults: number;
  onPlayAudio: (audio: Audio) => void;
  onToggleFavorite: (audio: Audio) => void;
  onDownload: (audio: Audio) => void;
  onVerseClick: (verse: SearchResult) => void;
  isFavorite: (audioId: string) => boolean;
  isDownloaded: (audioId: string) => boolean;
}

type TabType = 'all' | 'audios' | 'playlists' | 'categories' | 'verses';

export function SearchResults({
  results,
  searchTerm,
  totalResults,
  onPlayAudio,
  onToggleFavorite,
  onDownload,
  onVerseClick,
  isFavorite,
  isDownloaded
}: SearchResultsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const router = useRouter();

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} min`;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const tabs = [
    { id: 'all' as TabType, label: 'Principais Resultados', count: totalResults },
    { id: 'audios' as TabType, label: 'Orações', count: results.audios.length },
    { id: 'playlists' as TabType, label: 'Playlists', count: results.playlists.length },
    { id: 'categories' as TabType, label: 'Categorias', count: results.categories.length },
    { id: 'verses' as TabType, label: 'Versículos', count: results.verses.length }
  ].filter(tab => tab.count > 0);

  // Função para navegar para versículo específico na bíblia
  const handleVerseClick = (verse: SearchResult) => {
    console.log('🔍 Dados do versículo clicado:', {
      book: verse.book,
      chapter: verse.chapter,
      start_verse: verse.start_verse,
      end_verse: verse.end_verse,
      verse_id: verse.verse_id,
      bookName: getBookName(verse.book)
    });
    
    // Validar dados antes de navegar
    if (!verse.book || !verse.chapter || !verse.start_verse) {
      console.error('❌ Dados do versículo inválidos:', verse);
      return;
    }
    
    // Navegar para /biblia com parâmetros específicos
    const params = new URLSearchParams({
      book: verse.book.toString(),
      chapter: verse.chapter.toString(),
      verse: verse.start_verse.toString()
    });
    
    const url = `/biblia?${params.toString()}`;
    console.log('🔗 Navegando para URL:', url);
    
    router.push(url);
  };

  const AudioCard = ({ audio }: { audio: Audio }) => {
    // Usar thumbnail real do áudio ou da categoria como fallback
    const thumbnailUrl = (audio as any).image_url || audio.category?.image_url;

    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
        <div className="flex items-center gap-4">
          {/* Link principal que cobre todo o conteúdo do áudio */}
          <Link 
            href={`/player/audio/${audio.id}`}
            className="flex items-center gap-4 flex-1 min-w-0 group"
          >
            {/* Thumbnail real do áudio */}
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={audio.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `
                      <div class="w-full h-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    `;
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <Play className="text-white" size={24} />
                </div>
              )}
            </div>
            
            {/* Conteúdo principal */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-lg mb-1 truncate group-hover:text-green-600 transition-colors">
                {audio.title}
              </h3>
              {audio.subtitle && (
                <p className="text-gray-600 text-sm mb-1 truncate">
                  {audio.subtitle}
                </p>
              )}
              <div className="flex items-center gap-3 text-sm text-gray-500">
                {audio.category && (
                  <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
                    {audio.category.name}
                  </span>
                )}
                {audio.duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDuration(audio.duration)}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight className="text-gray-300 ml-2" size={20} />
          </Link>

          {/* Ações separadas (fora do link principal) */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(audio);
              }}
              className={`rounded-full w-10 h-10 p-0 ${
                isFavorite(audio.id)
                  ? 'text-red-500 hover:text-red-600 hover:bg-red-50'
                  : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
            >
              <Heart size={18} fill={isFavorite(audio.id) ? 'currentColor' : 'none'} />
            </Button>

            {!isDownloaded(audio.id) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDownload(audio);
                }}
                className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full w-10 h-10 p-0"
              >
                <Download size={18} />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const PlaylistCard = ({ playlist }: { playlist: Playlist }) => (
    <Link
      href={`/playlist/${playlist.id}`}
      className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center gap-4">
        {/* Imagem/Ícone da playlist */}
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            alt={playlist.title}
            className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-sm"
          />
        ) : (
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <List className="text-white" size={24} />
          </div>
        )}
        
        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg mb-1 truncate hover:text-blue-600 transition-colors">
            {playlist.title}
          </h3>
          {playlist.description && (
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
              {playlist.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {playlist.category && (
              <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
                {playlist.category.name}
              </span>
            )}
            {playlist.audio_count && (
              <span>{playlist.audio_count} áudios</span>
            )}
            {playlist.total_duration && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(playlist.total_duration)}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="text-gray-300" size={20} />
      </div>
    </Link>
  );

  const CategoryCard = ({ category }: { category: Category }) => (
    <Link
      href={`/categoria/${category.id}`}
      className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center gap-4">
        {/* Imagem/Ícone da categoria */}
        {category.image_url ? (
          <img
            src={category.image_url}
            alt={category.name}
            className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-sm"
          />
        ) : (
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Folder className="text-white" size={24} />
          </div>
        )}
        
        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg mb-1 truncate hover:text-purple-600 transition-colors">
            {category.name}
          </h3>
          <p className="text-gray-500 text-sm">Categoria</p>
          {category.description && (
            <p className="text-gray-600 text-sm mt-1 line-clamp-2">
              {category.description}
            </p>
          )}
        </div>

        <ChevronRight className="text-gray-300" size={20} />
      </div>
    </Link>
  );

  const VerseCard = ({ verse }: { verse: SearchResult }) => (
    <div
      onClick={() => handleVerseClick(verse)}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center gap-4">
        {/* Ícone da Bíblia */}
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <BookOpen className="text-white" size={24} />
        </div>
        
        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg mb-1 hover:text-yellow-600 transition-colors">
            {getBookName(verse.book)} {verse.chapter}:{verse.start_verse}
          </h3>
          <p className="text-gray-500 text-sm mb-2">Versículo Bíblico</p>
          <div 
            className="text-gray-600 text-sm leading-relaxed line-clamp-2"
            dangerouslySetInnerHTML={{ 
              __html: verse.highlighted_snippet 
            }}
          />
        </div>

        <ChevronRight className="text-gray-300" size={20} />
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'audios':
        return (
          <div className="space-y-3">
            {results.audios.map((audio) => (
              <AudioCard key={audio.id} audio={audio} />
            ))}
          </div>
        );
      
      case 'playlists':
        return (
          <div className="space-y-3">
            {results.playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        );
      
      case 'categories':
        return (
          <div className="space-y-3">
            {results.categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        );
      
      case 'verses':
        return (
          <div className="space-y-3">
            {results.verses.map((verse) => (
              <VerseCard key={verse.verse_id} verse={verse} />
            ))}
          </div>
        );
      
      default: // 'all'
        return (
          <div className="space-y-6">
            {/* Orações */}
            {results.audios.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Play className="text-green-500" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Orações ({results.audios.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {results.audios.slice(0, 3).map((audio) => (
                    <AudioCard key={audio.id} audio={audio} />
                  ))}
                  {results.audios.length > 3 && (
                    <button
                      onClick={() => setActiveTab('audios')}
                      className="w-full text-center py-3 text-green-600 hover:text-green-700 font-medium transition-colors"
                    >
                      Ver todas as {results.audios.length} orações
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Playlists */}
            {results.playlists.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <List className="text-blue-500" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Playlists ({results.playlists.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {results.playlists.slice(0, 3).map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                  ))}
                  {results.playlists.length > 3 && (
                    <button
                      onClick={() => setActiveTab('playlists')}
                      className="w-full text-center py-3 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      Ver todas as {results.playlists.length} playlists
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Categorias */}
            {results.categories.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Folder className="text-purple-500" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Categorias ({results.categories.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {results.categories.slice(0, 3).map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                  {results.categories.length > 3 && (
                    <button
                      onClick={() => setActiveTab('categories')}
                      className="w-full text-center py-3 text-purple-600 hover:text-purple-700 font-medium transition-colors"
                    >
                      Ver todas as {results.categories.length} categorias
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Versículos */}
            {results.verses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="text-yellow-500" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Versículos Bíblicos ({results.verses.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {results.verses.slice(0, 3).map((verse) => (
                    <VerseCard key={verse.verse_id} verse={verse} />
                  ))}
                  {results.verses.length > 3 && (
                    <button
                      onClick={() => setActiveTab('verses')}
                      className="w-full text-center py-3 text-yellow-600 hover:text-yellow-700 font-medium transition-colors"
                    >
                      Ver todos os {results.verses.length} versículos
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header dos resultados */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Resultados da busca
        </h2>
        <p className="text-gray-600">
          {totalResults} {totalResults === 1 ? 'resultado encontrado' : 'resultados encontrados'} para "{searchTerm}"
        </p>
      </div>

      {/* Tabs de navegação */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label} {tab.count > 0 && `(${tab.count})`}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {renderContent()}
    </div>
  );
}