// CHANGELOG: Fase 9 – Toggle de tema (claro/escuro)
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
  onThemeChange: (isDark: boolean) => void;
}

export default function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(false);

  // Carregar tema do localStorage (client-only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedTheme = localStorage.getItem('biblia_theme');
        if (savedTheme) {
          const isDarkTheme = savedTheme === 'dark';
          setIsDark(isDarkTheme);
          onThemeChange(isDarkTheme);
        }
      } catch (err) {
        console.warn('[theme-toggle] Failed to load theme from localStorage');
      }
    }
  }, [onThemeChange]);

  // Salvar tema no localStorage
  const saveTheme = (isDarkTheme: boolean) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem('biblia_theme', isDarkTheme ? 'dark' : 'light');
      } catch (err) {
        console.warn('[theme-toggle] Failed to save theme to localStorage');
      }
    }
  };

  // Toggle tema
  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    onThemeChange(newIsDark);
    saveTheme(newIsDark);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="min-h-[44px] min-w-[44px] p-2"
      aria-label="Alternar tema"
      title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {isDark ? (
        <Sun size={16} className="text-yellow-500" />
      ) : (
        <Moon size={16} className="text-gray-600" />
      )}
    </Button>
  );
}