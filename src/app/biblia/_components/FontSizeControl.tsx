// CHANGELOG: Fase 8 – Controles de fonte (A−/A+ + indicador + reset)
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface FontSizeControlProps {
  onScaleChange: (scale: number) => void;
}

export default function FontSizeControl({ onScaleChange }: FontSizeControlProps) {
  const [scale, setScale] = useState<number>(1.0);
  
  const MIN_SCALE = 0.90;
  const MAX_SCALE = 1.30;
  const STEP = 0.05;

  // Carregar escala do localStorage (client-only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedScale = localStorage.getItem('biblia_font_scale');
        if (savedScale) {
          const parsedScale = parseFloat(savedScale);
          if (!isNaN(parsedScale) && parsedScale >= MIN_SCALE && parsedScale <= MAX_SCALE) {
            setScale(parsedScale);
            onScaleChange(parsedScale);
          }
        }
      } catch (err) {
        console.warn('[font-control] Failed to load font scale from localStorage');
      }
    }
  }, [onScaleChange]);

  // Salvar escala no localStorage
  const saveScale = (newScale: number) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem('biblia_font_scale', newScale.toString());
      } catch (err) {
        console.warn('[font-control] Failed to save font scale to localStorage');
      }
    }
  };

  // Diminuir fonte
  const decreaseFont = () => {
    const newScale = Math.max(MIN_SCALE, Math.round((scale - STEP) * 100) / 100);
    setScale(newScale);
    onScaleChange(newScale);
    saveScale(newScale);
  };

  // Aumentar fonte
  const increaseFont = () => {
    const newScale = Math.min(MAX_SCALE, Math.round((scale + STEP) * 100) / 100);
    setScale(newScale);
    onScaleChange(newScale);
    saveScale(newScale);
  };

  // Formatar indicador de escala
  const formatScale = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  const canDecrease = scale > MIN_SCALE;
  const canIncrease = scale < MAX_SCALE;

  return (
    <div className="flex items-center gap-2">
      {/* Botão A− */}
      <Button
        variant="outline"
        size="sm"
        onClick={decreaseFont}
        disabled={!canDecrease}
        className="h-10 w-10 p-0"
        aria-label="Diminuir tamanho da fonte"
        title="Diminuir fonte"
      >
        <span className="text-sm font-medium">A−</span>
      </Button>

      {/* Indicador de escala */}
      <div className="px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 rounded min-w-[42px] text-center">
        {formatScale(scale)}
      </div>

      {/* Botão A+ */}
      <Button
        variant="outline"
        size="sm"
        onClick={increaseFont}
        disabled={!canIncrease}
        className="h-10 w-10 p-0"
        aria-label="Aumentar tamanho da fonte"
        title="Aumentar fonte"
      >
        <span className="text-sm font-medium">A+</span>
      </Button>

      {/* Botão Reset removido para reduzir poluição visual */}
    </div>
  );
}