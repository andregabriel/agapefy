"use client";

import FontSizeControl from './FontSizeControl';
import ThemeToggle from './ThemeToggle';

interface BibleControlsProps {
  onFontScaleChange: (scale: number) => void;
  onThemeChange: (isDark: boolean) => void;
}

export function BibleControls({
  onFontScaleChange,
  onThemeChange
}: BibleControlsProps) {
  return (
    <div className="flex justify-center items-center gap-4">
      <FontSizeControl onScaleChange={onFontScaleChange} />
      <ThemeToggle onThemeChange={onThemeChange} />
    </div>
  );
}