"use client";

export default function PostSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse">
      {/* Cabeçalho */}
      <div className="flex items-center space-x-3 mb-3">
        <div className="h-10 w-10 bg-gray-700 rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-700 rounded w-24 mb-1"></div>
          <div className="h-3 bg-gray-700 rounded w-16"></div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
      </div>

      {/* Ações */}
      <div className="flex items-center space-x-4">
        <div className="h-8 bg-gray-700 rounded w-16"></div>
        <div className="h-8 bg-gray-700 rounded w-16"></div>
        <div className="h-8 bg-gray-700 rounded w-24"></div>
      </div>
    </div>
  );
}