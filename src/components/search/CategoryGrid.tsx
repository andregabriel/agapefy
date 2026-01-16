"use client";

import Link from 'next/link';
import type { Category } from '@/types/search';
import { normalizeImageUrl } from '@/app/home/_utils/homeUtils';

interface CategoryGridProps {
  categories: Category[];
  variant?: 'default' | 'search';
}

export function CategoryGrid({ categories, variant = 'default' }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categoria/${category.id}`}
          className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-900 hover:scale-105 transition-transform duration-200"
        >
          {category.image_url ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${normalizeImageUrl(category.image_url, {
                  width: 640,
                  height: 480,
                  quality: 60
                }) || category.image_url})`
              }}
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${
              variant === 'search' 
                ? 'from-purple-600 to-purple-800' 
                : 'from-green-600 to-green-800'
            }`} />
          )}
          
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
          
          <div className="absolute inset-0 flex items-end p-4">
            <h3 className="text-white font-semibold text-sm md:text-base leading-tight">
              {category.name}
            </h3>
          </div>
        </Link>
      ))}
    </div>
  );
}
