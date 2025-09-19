interface LoadingIndicatorProps {
  show: boolean;
}

export function LoadingIndicator({ show }: LoadingIndicatorProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 rounded-lg p-3 shadow-lg">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-gray-300 text-sm">Atualizando...</span>
      </div>
    </div>
  );
}