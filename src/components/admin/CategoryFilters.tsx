"use client";

import { Search, Plus } from 'lucide-react';
import { SortOption } from '@/constants/categoryLayouts';

interface CategoryFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  onNewCategory: () => void;
}

export default function CategoryFilters({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  onNewCategory
}: CategoryFiltersProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Gerenciamento de Categorias</h1>
          <p className="text-gray-600">Organize as orações em categorias, defina a ordem de exibição e escolha o layout</p>
        </div>
        <button
          onClick={onNewCategory}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar categorias..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Controles de ordenação */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="manual">Ordem Manual</option>
                <option value="created_at_desc">Mais recentes</option>
                <option value="created_at">Mais antigas</option>
                <option value="name">Nome (A-Z)</option>
                <option value="name_desc">Nome (Z-A)</option>
              </select>
            </div>
          </div>
          
          {sortBy === 'manual' && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Modo de Ordenação Manual:</strong> Arraste e solte as categorias para reorganizar a ordem de exibição na página inicial.
                <br />
                <strong>Categoria Fixa:</strong> Use o botão ⭐ para fixar uma categoria em primeiro lugar na home.
                <br />
                <strong>Layout:</strong> Cada categoria pode ter um layout diferente na home (Padrão Spotify, Full, Grid 3 linhas, Altura dobrada).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}