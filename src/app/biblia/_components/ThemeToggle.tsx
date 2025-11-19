// CHANGELOG: Fase 9 – Toggle de tema (claro/escuro)
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useBiblePreferences } from '@/hooks/useBiblePreferences';

interface ThemeToggleProps {
  onThemeChange: (isDark: boolean) => void;
}

export default function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const { preferences, saveTheme: saveThemeToSupabase } = useBiblePreferences();
  const [isDark, setIsDark] = useState<boolean>(false);

  // Carregar tema das preferências (Supabase > localStorage)
  useEffect(() => {
    if (preferences?.theme) {
      const isDarkTheme = preferences.theme === 'dark';
      setIsDark(isDarkTheme);
      onThemeChange(isDarkTheme);
    } else if (typeof window !== "undefined") {
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
  }, [preferences, onThemeChange]);

  // Toggle tema
  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    onThemeChange(newIsDark);
    // Salvar no Supabase (que também salva no localStorage como cache)
    void saveThemeToSupabase(newIsDark ? 'dark' : 'light');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="h-10 w-10 p-0"
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