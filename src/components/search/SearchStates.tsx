"use client";

import { Search } from 'lucide-react';

export function LoadingState({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

export function EmptySearchState({ searchTerm }: { searchTerm: string }) {
  return (
    <div className="text-center py-12">
      <Search className="h-16 w-16 mx-auto mb-4 text-gray-400" />
      <h2 className="text-xl font-bold mb-2 text-gray-900">Nenhum resultado encontrado</h2>
      <p className="text-gray-600 mb-6">
        Não encontramos conteúdo para "{searchTerm}"
      </p>
      <div className="text-sm text-gray-500">
        <p>Tente:</p>
        <ul className="mt-2 space-y-1">
          <li>• Verificar a ortografia</li>
          <li>• Usar termos mais gerais</li>
          <li>• Buscar por sinônimos</li>
          <li>• Explorar categorias acima</li>
        </ul>
      </div>
    </div>
  );
}

export function EmptyCategoriesState() {
  return (
    <div className="text-center py-12">
      <Search className="h-16 w-16 mx-auto mb-4 text-gray-400" />
      <h2 className="text-xl font-bold mb-2 text-gray-900">Nenhuma categoria encontrada</h2>
      <p className="text-gray-600">
        Não há categorias com conteúdo disponível no momento.
      </p>
    </div>
  );
}