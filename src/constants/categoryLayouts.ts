import { MoreHorizontal, Smartphone, Grid3X3, Layout } from 'lucide-react';

export const LAYOUT_ICONS = {
  spotify: MoreHorizontal,
  full: Smartphone,
  grid_3_rows: Grid3X3,
  double_height: Layout,
  banner: Layout
} as const;

export const LAYOUT_LABELS = {
  spotify: 'Padrão Spotify',
  full: 'Full',
  grid_3_rows: 'Grid 3 linhas',
  double_height: 'Altura dobrada',
  banner: 'Banner'
} as const;

export const LAYOUT_COLORS = {
  spotify: 'text-blue-600 bg-blue-100',
  full: 'text-green-600 bg-green-100',
  grid_3_rows: 'text-purple-600 bg-purple-100',
  double_height: 'text-orange-600 bg-orange-100',
  banner: 'text-pink-600 bg-pink-100'
} as const;

export type LayoutType = keyof typeof LAYOUT_ICONS;
export type SortOption = 'manual' | 'name' | 'created_at' | 'name_desc' | 'created_at_desc';