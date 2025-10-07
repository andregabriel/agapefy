"use client";

import { useState } from 'react';
import { FolderOpen, Star } from 'lucide-react';
import { DropResult } from 'react-beautiful-dnd';
import { toast } from 'sonner';

import { useCategories } from '@/hooks/useCategories';
import { sortCategories, filterCategories } from '@/utils/categoryUtils';
import { SortOption } from '@/constants/categoryLayouts';
import { Category } from '@/types/category';

import CategoryFilters from './CategoryFilters';
import FeaturedCategoryCard from './FeaturedCategoryCard';
import DraggableCategoryList from './DraggableCategoryList';
import CategoryCard from './CategoryCard';
import CategoryModal from './CategoryModal';
import CategoryAudiosModal from './CategoryAudiosModal';

export default function CategoriesManagement() {
  const {
    categories,
    loading,
    setCategories,
    fetchCategories,
    updateCategoryOrder,
    toggleFeaturedCategory,
    deleteCategory
  } = useCategories();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('manual');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategoryForAudios, setSelectedCategoryForAudios] = useState<Category | null>(null);
  const [isAudiosModalOpen, setIsAudiosModalOpen] = useState(false);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Bloquear drag quando estiver filtrando por busca ou ordenação não manual
    if (searchTerm.trim() !== '' || sortBy !== 'manual') {
      toast.error('Para reordenar, limpe a busca e use "Ordem Manual".');
      return;
    }

    // Filtrar apenas categorias não fixas e visíveis para drag and drop
    const filteredCategories = sortCategories(
      categories.filter(c => (c.is_visible !== false)),
      sortBy
    );
    const nonFeaturedCategories = filteredCategories.filter(cat => !cat.is_featured);
    
    if (sourceIndex >= nonFeaturedCategories.length || destinationIndex >= nonFeaturedCategories.length) {
      toast.error('Não é possível mover categoria fixa');
      return;
    }

    // Reordenar localmente primeiro para feedback imediato
    const newCategories = Array.from(nonFeaturedCategories);
    const [reorderedItem] = newCategories.splice(sourceIndex, 1);
    newCategories.splice(destinationIndex, 0, reorderedItem);

    // Atualizar estado local
    setCategories(prevCategories => {
      const featuredCategories = prevCategories.filter(cat => cat.is_featured);
      const updatedNonFeatured = [...newCategories];
      return [...featuredCategories, ...updatedNonFeatured];
    });

    try {
      // Duas fases para evitar colisão com índice único:
      // 1) Atribui posições temporárias altas
      const tempOffset = 100000; // garante unicidade temporária
      await Promise.all(
        newCategories.map((category, index) => 
          updateCategoryOrder(category.id, tempOffset + index + 1)
        )
      );

      // 2) Atribui posições finais sequenciais
      await Promise.all(
        newCategories.map((category, index) => 
          updateCategoryOrder(category.id, index + 1)
        )
      );
      
    // Recarregar para garantir consistência
    await fetchCategories();
      
      toast.success('Ordem das categorias atualizada!');
    } catch (error) {
      console.error('Erro ao salvar nova ordem:', error);
      toast.error('Erro ao salvar nova ordem das categorias');
      // Reverter mudanças locais em caso de erro
      fetchCategories();
    }
  };

  const handleCategoryClick = (category: Category) => {
    console.log('📋 Abrindo gerenciamento de orações para:', category.name);
    setSelectedCategoryForAudios(category);
    setIsAudiosModalOpen(true);
  };

  const handleEditClick = (category: Category) => {
    console.log('✏️ Abrindo modal de edição para categoria:', category.name);
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const handleNewCategory = () => {
    console.log('➕ Criando nova categoria');
    setSelectedCategory(null);
    setIsModalOpen(true);
  };

  const handleModalSave = () => {
    console.log('💾 Categoria salva, recarregando lista');
    fetchCategories();
    setIsModalOpen(false);
    setSelectedCategory(null);
  };

  const handleModalClose = () => {
    console.log('❌ Modal de edição fechado');
    setIsModalOpen(false);
    setSelectedCategory(null);
  };

  const handleAudiosModalClose = () => {
    console.log('❌ Modal de orações fechado');
    setIsAudiosModalOpen(false);
    setSelectedCategoryForAudios(null);
  };

  // Filtrar e ordenar categorias
  const filteredCategories = sortCategories(
    filterCategories(categories, searchTerm),
    sortBy
  );

  // Separar categorias fixas e não fixas
  const featuredCategories = filteredCategories.filter(cat => cat.is_featured);
  const nonFeaturedCategories = filteredCategories.filter(cat => !cat.is_featured);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <CategoryFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onNewCategory={handleNewCategory}
      />

      {/* Categorias Fixas (não arrastáveis) */}
      {featuredCategories.length > 0 && (
        <div className="p-6 border-b bg-yellow-50">
          <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
            <Star className="h-5 w-5 mr-2 text-yellow-600" />
            Categoria Fixa (Primeira na Home)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCategories.map((category) => (
              <FeaturedCategoryCard
                key={category.id}
                category={category}
                onEdit={handleEditClick}
                onDelete={deleteCategory}
              onToggleFeatured={(cat) => toggleFeaturedCategory(cat.id, !!cat.is_featured)}
                onClick={handleCategoryClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Categorias Normais */}
      {sortBy === 'manual' ? (
        <DraggableCategoryList
          categories={nonFeaturedCategories}
          onDragEnd={handleDragEnd}
          onEdit={handleEditClick}
          onDelete={deleteCategory}
          onToggleFeatured={(cat) => toggleFeaturedCategory(cat.id, !!cat.is_featured)}
          onClick={handleCategoryClick}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {nonFeaturedCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleEditClick}
              onDelete={deleteCategory}
              onToggleFeatured={(cat) => toggleFeaturedCategory(cat.id, !!cat.is_featured)}
              onClick={handleCategoryClick}
            />
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Nenhuma categoria encontrada</p>
        </div>
      )}

      {/* Modais */}
      {isModalOpen && (
        <CategoryModal
          category={selectedCategory}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      <CategoryAudiosModal
        category={selectedCategoryForAudios}
        isOpen={isAudiosModalOpen}
        onClose={handleAudiosModalClose}
      />
    </div>
  );
}