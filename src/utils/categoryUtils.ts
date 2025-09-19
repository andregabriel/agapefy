import { Category } from '@/types/category';
import { SortOption } from '@/constants/categoryLayouts';

export function sortCategories(categories: Category[], sortBy: SortOption): Category[] {
  return [...categories].sort((a, b) => {
    // Sempre mostrar categoria fixa primeiro
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    
    // Para categorias não fixas, aplicar ordenação normal
    switch (sortBy) {
      case 'manual':
        return a.order_position - b.order_position;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      case 'created_at':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'created_at_desc':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return a.order_position - b.order_position;
    }
  });
}

export function filterCategories(categories: Category[], searchTerm: string): Category[] {
  if (!searchTerm.trim()) return categories;
  
  const term = searchTerm.toLowerCase();
  return categories.filter(category =>
    category.name.toLowerCase().includes(term) ||
    category.description?.toLowerCase().includes(term)
  );
}