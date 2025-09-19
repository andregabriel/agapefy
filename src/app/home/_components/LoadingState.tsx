export function LoadingState() {
  return (
    <div className="px-4 py-6 pt-20 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Carregando orações...</p>
        <p className="text-gray-500 text-sm mt-2">Preparando sua experiência</p>
      </div>
    </div>
  );
}