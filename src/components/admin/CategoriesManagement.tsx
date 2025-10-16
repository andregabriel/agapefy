"use client";

import { useState } from 'react';
import { FolderOpen, Star } from 'lucide-react';
import { DropResult } from 'react-beautiful-dnd';
import { toast } from 'sonner';

import { useCategories } from '@/hooks/useCategories';
import { isRecentesCategoryName, isRotinaCategoryName } from '@/lib/utils';
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

    // Lista exatamente igual à renderizada
    const displayList = sortCategories(
      filterCategories(categories, searchTerm),
      sortBy
    ).filter(cat => !cat.is_featured);

    // Nova lista com item movido (apenas para UI e vizinhos)
    const working = Array.from(displayList);
    const [moved] = working.splice(sourceIndex, 1);
    working.splice(destinationIndex, 0, moved);

    // Calcular nova posição usando "gap indexing" (atualiza apenas o item movido)
    const prevNeighbor = working[destinationIndex - 1];
    const nextNeighbor = working[destinationIndex + 1];

    const STEP = 10; // espaçamento padrão entre posições
    const normalize = (value: number | null | undefined, fallback: number) => (
      Number.isFinite(value as any) ? (value as number) : fallback
    );

    const prevPos = prevNeighbor
      ? normalize(prevNeighbor.order_position as any, (destinationIndex) * STEP)
      : undefined;
    const nextPos = nextNeighbor
      ? normalize(nextNeighbor.order_position as any, (destinationIndex + 2) * STEP)
      : undefined;

    let newPosition: number;
    if (prevPos === undefined && nextPos === undefined) {
      // Lista tinha um único item
      newPosition = STEP;
    } else if (prevPos === undefined && nextPos !== undefined) {
      newPosition = Math.floor(nextPos) - STEP;
    } else if (prevPos !== undefined && nextPos === undefined) {
      newPosition = Math.floor(prevPos) + STEP;
    } else {
      // ambos existem
      const low = Math.floor(prevPos as number);
      const high = Math.floor(nextPos as number);
      if (high - low > 1) {
        newPosition = Math.floor((low + high) / 2);
      } else {
        // Sem espaço: reindexar uma janela pequena ao redor para criar gaps
        let base = STEP;
        for (let i = 0; i < working.length; i++) {
          const cat = working[i];
          if (cat.id === moved.id) continue; // não gravar aqui; apenas criar referência
          cat.order_position = base;
          base += STEP;
        }
        // Recalcular vizinhos após reindexação local
        const prevAfter = working[destinationIndex - 1];
        newPosition = prevAfter ? (prevAfter.order_position as number) + STEP : STEP;
      }
    }

    // Atualizar estado local imediatamente para melhor UX
    setCategories(prev => {
      const featured = prev.filter(cat => cat.is_featured);
      const nonFeatured = prev.filter(cat => !cat.is_featured).map(cat =>
        cat.id === moved.id ? { ...cat, order_position: newPosition } : cat
      );
      // Ordenar localmente somente para refletir a mudança
      const nextList = sortCategories(nonFeatured, 'manual');
      return [...featured, ...nextList];
    });

    try {
      // Atualiza apenas o item movido sempre que possível
      await updateCategoryOrder(moved.id, newPosition);

      // Se reindexamos os vizinhos no estado, persistir também para manter a base espaçada
      // Detectar se criamos sequência espaçada (multiplo de STEP)
      const needBulk = working.some((c, i) => i !== destinationIndex && (c.order_position % STEP) !== 0);
      if (needBulk) {
        let base = STEP;
        for (const cat of working) {
          if (cat.id === moved.id) continue;
          await updateCategoryOrder(cat.id, base);
          base += STEP;
        }
      }

      await fetchCategories();
      toast.success('Ordem das categorias atualizada!');
    } catch (error) {
      console.error('Erro ao salvar nova ordem:', error);
      toast.error('Erro ao salvar nova ordem das categorias');
      fetchCategories();
    }
  };

  const handleCategoryClick = (category: Category) => {
    // Evita abrir modal de gerenciamento para as categorias especiais (Recentes e Rotina)
    if (isRecentesCategoryName(category.name) || isRotinaCategoryName(category.name)) {
      return;
    }
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

  // Alterar ordem via seletor numérico (1-based)
  const handleChangeOrder = async (category: Category, newIndex1Based: number) => {
    if (sortBy !== 'manual') {
      toast.error('Para reordenar, use "Ordem Manual".');
      return;
    }

    const nonFeatured = sortCategories(
      filterCategories(categories, ''),
      'manual'
    ).filter(c => !c.is_featured);

    const currentIndex = nonFeatured.findIndex(c => c.id === category.id);
    if (currentIndex === -1) return;

    const targetIndex = Math.max(0, Math.min(newIndex1Based - 1, nonFeatured.length - 1));
    if (targetIndex === currentIndex) return;

    // Recriar lista como se tivesse sido movido para targetIndex
    const working = Array.from(nonFeatured);
    const [moved] = working.splice(currentIndex, 1);
    working.splice(targetIndex, 0, moved);

    // Usar o mesmo algoritmo de gap indexing do drag
    const STEP = 10;
    let base = STEP;
    const updates: { id: string; pos: number }[] = [];
    for (const item of working) {
      updates.push({ id: item.id, pos: base });
      base += STEP;
    }

    // Atualiza estado local para feedback imediato
    setCategories(prev => {
      const featured = prev.filter(cat => cat.is_featured);
      const mapped = prev.filter(cat => !cat.is_featured).map(cat => {
        const upd = updates.find(u => u.id === cat.id);
        return upd ? { ...cat, order_position: upd.pos } : cat;
      });
      return [...featured, ...sortCategories(mapped, 'manual')];
    });

    try {
      for (const { id, pos } of updates) {
        await updateCategoryOrder(id, pos);
      }
      await fetchCategories();
      toast.success('Ordem atualizada');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar ordem');
      fetchCategories();
    }
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
          onChangeOrder={handleChangeOrder}
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