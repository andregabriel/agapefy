"use client";

import { LAYOUT_ICONS, LAYOUT_LABELS, LAYOUT_COLORS, LayoutType } from '@/constants/categoryLayouts';
import { MoreHorizontal } from 'lucide-react';

interface CategoryLayoutBadgeProps {
  layoutType: string;
}

export default function CategoryLayoutBadge({ layoutType }: CategoryLayoutBadgeProps) {
  const IconComponent = LAYOUT_ICONS[layoutType as LayoutType] || MoreHorizontal;
  const label = LAYOUT_LABELS[layoutType as LayoutType] || 'Padrão';
  const colorClass = LAYOUT_COLORS[layoutType as LayoutType] || 'text-gray-600 bg-gray-100';

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      <IconComponent className="h-3 w-3 mr-1" />
      {label}
    </div>
  );
}