"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Download, Calendar, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CategoryMap {
  [key: string]: string;
}

export function QuickAccessIcons() {
  const [categoryRoutes, setCategoryRoutes] = useState<CategoryMap>({
    'Favoritos': '/eu',
    'Downloads': '/eu', 
    'Rotina': '/eu',
    'Recentes': '/eu'
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategoryRoutes = async () => {
      try {
        console.log('🔍 Buscando categorias para ícones de navegação...');
        
        const { data: categories, error } = await supabase
          .from('categories')
          .select('id, name')
          .in('name', ['Favoritos', 'Downloads', 'Rotina', 'Recentes']);

        if (error) {
          console.error('❌ Erro ao buscar categorias:', error);
          setLoading(false);
          return;
        }

        console.log('📋 Categorias encontradas:', categories);

        if (categories && categories.length > 0) {
          const routes: CategoryMap = {
            'Favoritos': '/eu',
            'Downloads': '/eu',
            'Rotina': '/eu', 
            'Recentes': '/eu'
          };

          // Mapear categorias encontradas
          categories.forEach(category => {
            if (category.name && routes.hasOwnProperty(category.name)) {
              routes[category.name] = `/categoria/${category.id}`;
              console.log(`✅ Mapeado: ${category.name} → /categoria/${category.id}`);
            }
          });

          setCategoryRoutes(routes);
          console.log('🎯 Rotas finais dos ícones:', routes);
        } else {
          console.log('📭 Nenhuma categoria encontrada, mantendo fallback para /eu');
        }
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar categorias:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryRoutes();
  }, []);

  return (
    <section className="my-8">
      <div className="grid grid-cols-3 gap-4">
        <Link 
          href={categoryRoutes['Favoritos']}
          className="flex flex-col items-center space-y-2 p-4 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
            <Heart size={24} className="text-red-400" />
          </div>
          <span className="text-sm text-gray-300 font-medium">Favoritos</span>
        </Link>
        
        <Link 
          href={categoryRoutes['Downloads']}
          className="hidden flex flex-col items-center space-y-2 p-4 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Download size={24} className="text-blue-400" />
          </div>
          <span className="text-sm text-gray-300 font-medium">Downloads</span>
        </Link>
        
        <Link 
          href={categoryRoutes['Rotina']}
          className="flex flex-col items-center space-y-2 p-4 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
            <Calendar size={24} className="text-green-400" />
          </div>
          <span className="text-sm text-gray-300 font-medium">Rotina</span>
        </Link>
        
        <Link 
          href={categoryRoutes['Recentes']}
          className="flex flex-col items-center space-y-2 p-4 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
            <Clock size={24} className="text-purple-400" />
          </div>
          <span className="text-sm text-gray-300 font-medium">Recentes</span>
        </Link>
      </div>
    </section>
  );
}