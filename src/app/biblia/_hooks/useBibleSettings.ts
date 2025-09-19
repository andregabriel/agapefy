"use client";

import { useState, useCallback } from 'react';

export function useBibleSettings() {
  const [fontScale, setFontScale] = useState<number>(1.0);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  // Handler para mudança de escala de fonte
  const handleFontScaleChange = useCallback((scale: number) => {
    setFontScale(scale);
  }, []);

  // Handler para mudança de tema
  const handleThemeChange = useCallback((isDark: boolean) => {
    setIsDarkTheme(isDark);
  }, []);

  // Classes de tema
  const getThemeClasses = useCallback(() => {
    const themeClasses = isDarkTheme 
      ? 'bg-gray-900 text-gray-100' 
      : 'bg-gray-50 text-gray-900';

    const headerThemeClasses = isDarkTheme
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200';

    const verseThemeClasses = isDarkTheme
      ? 'hover:bg-gray-800 text-gray-100'
      : 'hover:bg-white text-gray-800';

    const footerThemeClasses = isDarkTheme
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200';

    return {
      themeClasses,
      headerThemeClasses,
      verseThemeClasses,
      footerThemeClasses
    };
  }, [isDarkTheme]);

  return {
    // Estado
    fontScale,
    isDarkTheme,
    
    // Funções
    handleFontScaleChange,
    handleThemeChange,
    getThemeClasses
  };
}