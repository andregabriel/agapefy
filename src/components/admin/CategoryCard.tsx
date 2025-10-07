"use client";

import { FolderOpen, Edit, Trash2, Star, Music, GripVertical, EyeOff, Eye } from 'lucide-react';
import { Category } from '@/types/category';
import CategoryLayoutBadge from './CategoryLayoutBadge';

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onToggleFeatured: (category: Category) => void;
  onClick: (category: Category) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
  draggableProps?: any;
  innerRef?: any;
}

export default function CategoryCard({
  category,
  onEdit,
  onDelete,
  onToggleFeatured,
  onClick,
  isDragging = false,
  dragHandleProps,
  draggableProps,
  innerRef
}: CategoryCardProps) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🖊️ Editando categoria:', category.name);
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

  const handleDragHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={`
        border rounded-lg p-4 transition-all duration-200 cursor-pointer group bg-white
        ${isDragging 
          ? 'shadow-2xl scale-105 rotate-3 border-blue-300 bg-blue-50 z-50 opacity-90' 
          : 'shadow-sm hover:shadow-lg'
        }
      `}
      onClick={() => !isDragging && onClick(category)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {dragHandleProps && (
            <div 
              {...dragHandleProps}
              className={`
                mr-2 p-1 rounded transition-colors duration-200
                ${isDragging 
                  ? 'text-blue-600 bg-blue-100' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }
                cursor-grab active:cursor-grabbing
              `}
              onClick={handleDragHandleClick}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </div>
          )}
          
          <div className="ml-3">
            <h3 className={`
              font-medium transition-colors duration-200
              ${isDragging 
                ? 'text-blue-700' 
                : 'text-gray-900 group-hover:text-blue-600'
              }
            `}>
              {category.name}
            </h3>
          </div>
        </div>
        
        {/* HEADER COM BOTÕES DE AÇÃO - INCLUINDO EDIT */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleFeaturedClick}
            className="p-1 rounded hover:bg-yellow-50 text-gray-400 hover:text-yellow-500 transition-colors"
            title="Fixar em primeiro lugar"
            aria-label="Fixar categoria em primeiro lugar"
          >
            <Star className="h-4 w-4" />
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
          Posição: {category.order_position} • {new Date(category.created_at).toLocaleDateString()}
        </div>
        <div className={`
          flex items-center text-xs transition-colors duration-200
          ${isDragging 
            ? 'text-blue-700' 
            : 'text-blue-600 group-hover:text-blue-700'
          }
        `}>
          <Music className="h-3 w-3 mr-1" />
          Gerenciar orações
        </div>
      </div>
      
      {/* Badge do Layout */}
      <div className="flex justify-start">
        <CategoryLayoutBadge layoutType={category.layout_type || 'spotify'} />
      </div>

      {/* Visibilidade */}
      {category.is_visible === false && (
        <div className="mt-2 text-xs text-gray-500 flex items-center">
          <EyeOff className="h-3 w-3 mr-1" /> Oculta na home
        </div>
      )}
    </div>
  );
}