"use client";

import { FolderOpen, Edit, Trash2, Star, StarOff, Music } from 'lucide-react';
import { Category } from '@/types/category';
import CategoryLayoutBadge from './CategoryLayoutBadge';

interface FeaturedCategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onToggleFeatured: (category: Category) => void;
  onClick: (category: Category) => void;
}

export default function FeaturedCategoryCard({
  category,
  onEdit,
  onDelete,
  onToggleFeatured,
  onClick
}: FeaturedCategoryCardProps) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🖊️ Editando categoria fixa:', category.name);
    onEdit(category);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(category.id);
  };

  const handleToggleFeaturedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFeatured(category);
  };

  return (
    <div 
      className="border-2 border-yellow-300 rounded-lg p-4 bg-white shadow-sm cursor-pointer group"
      onClick={() => onClick(category)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-yellow-600" />
            </div>
          )}
          <div className="ml-3">
            <h3 className="font-medium text-gray-900 group-hover:text-yellow-600 transition-colors flex items-center">
              <Star className="h-4 w-4 mr-1 text-yellow-500" />
              {category.name}
            </h3>
          </div>
        </div>
        
        {/* HEADER COM BOTÕES DE AÇÃO - INCLUINDO EDIT */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleFeaturedClick}
            className="p-1 rounded hover:bg-yellow-100 text-yellow-600 hover:text-yellow-800 transition-colors"
            title="Remover da posição fixa"
            aria-label="Remover categoria da posição fixa"
          >
            <StarOff className="h-4 w-4" />
          </button>
          
          {/* BOTÃO EDIT - GARANTINDO QUE ESTÁ PRESENTE E VISÍVEL */}
          <button
            onClick={handleEditClick}
            className="p-1 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
            title="Editar categoria"
            aria-label="Editar categoria"
            data-testid={`edit-cat-${category.id}`}
          >
            <Edit className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleDeleteClick}
            className="p-1 rounded hover:bg-red-50 text-red-600 hover:text-red-900 transition-colors"
            title="Excluir categoria"
            aria-label="Excluir categoria"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-3">
        {category.description || 'Sem descrição'}
      </p>
      
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">
          Posição: FIXA • {new Date(category.created_at).toLocaleDateString()}
        </div>
        <div className="flex items-center text-xs text-yellow-600 group-hover:text-yellow-700 transition-colors">
          <Music className="h-3 w-3 mr-1" />
          Gerenciar orações
        </div>
      </div>
      
      {/* Badge do Layout */}
      <div className="flex justify-start">
        <CategoryLayoutBadge layoutType={category.layout_type || 'spotify'} />
      </div>
    </div>
  );
}