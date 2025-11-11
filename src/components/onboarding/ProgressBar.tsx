"use client";

import { ArrowLeft } from "lucide-react";

interface ProgressBarProps {
  percentage: number;
  loading?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ProgressBar({ percentage, loading = false, onBack, showBackButton = false }: ProgressBarProps) {
  const displayPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="w-full flex items-center gap-2">
      {showBackButton && onBack && (
        <button
          onClick={onBack}
          className="flex-shrink-0 p-1 rounded-full hover:bg-gray-800/40 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
          aria-label="Voltar ao passo anterior"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-gray-400 hover:text-gray-200 transition-colors" />
        </button>
      )}
      <div className="flex-1 relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200/50">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 transition-all duration-500 ease-out"
          style={{
            width: loading ? '0%' : `${displayPercentage}%`,
          }}
        />
      </div>
    </div>
  );
}

