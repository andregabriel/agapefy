import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="px-4 py-6 pt-20 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <p className="text-red-400 mb-4">{error}</p>
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-red-700 text-red-400 hover:bg-red-900/20"
        >
          <RefreshCw size={16} className="mr-2" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}