import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  categoriesLoading: boolean;
  onRefresh: () => void;
}

export function EmptyState({ categoriesLoading, onRefresh }: EmptyStateProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Categorias</h2>
          <p className="text-sm text-gray-400">Orações organizadas por momentos especiais</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={categoriesLoading}
          className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
          title="Recarregar categorias"
        >
          <RefreshCw size={16} className={categoriesLoading ? 'animate-spin' : ''} />
        </Button>
      </div>
      
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">
          {categoriesLoading ? 'Carregando categorias...' : 'Nenhuma categoria com conteúdo encontrada'}
        </p>
        <p className="text-sm text-gray-500">
          {!categoriesLoading && 'Crie categorias e adicione orações ou playlists no painel administrativo'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={categoriesLoading}
          className="mt-4"
        >
          <RefreshCw size={16} className={`mr-2 ${categoriesLoading ? 'animate-spin' : ''}`} />
          Recarregar
        </Button>
      </div>
    </section>
  );
}