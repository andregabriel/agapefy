"use client";

interface ProgressBarProps {
  percentage: number;
  loading?: boolean;
}

export function ProgressBar({ percentage, loading = false }: ProgressBarProps) {
  const displayPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="w-full">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200/50">
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

