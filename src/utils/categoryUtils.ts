import { Category } from '@/types/category';
import { SortOption } from '@/constants/categoryLayouts';

export function sortCategories(categories: Category[], sortBy: SortOption): Category[] {
  return [...categories]
    // sempre manter visíveis primeiro em relação às ocultas (as ocultas acabam filtradas em home, mas útil no admin)
    .sort((a, b) => {
      const av = a.is_visible === false ? 1 : 0;
      const bv = b.is_visible === false ? 1 : 0;
      if (av !== bv) return av - bv;
      return 0;
    })
    .sort((a, b) => {
    // Sempre mostrar categoria fixa primeiro
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    
    // Para categorias não fixas, aplicar ordenação normal
    const posA = Number.isFinite(a.order_position as any)
      ? (a.order_position as unknown as number)
      : Number.POSITIVE_INFINITY;
    const posB = Number.isFinite(b.order_position as any)
      ? (b.order_position as unknown as number)
      : Number.POSITIVE_INFINITY;

    switch (sortBy) {
      case 'manual':
        return posA - posB;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      case 'created_at':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'created_at_desc':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return posA - posB;
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