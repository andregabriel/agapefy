"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface BiblePreferences {
  last_read_book?: string | null;
  last_read_chapter?: number | null;
  last_read_verse?: number | null;
  theme?: 'light' | 'dark' | null;
  font_scale?: number | null;
}

interface UseBiblePreferencesReturn {
  preferences: BiblePreferences | null;
  loading: boolean;
  saveLastRead: (book: string, chapter: number, verse: number) => Promise<void>;
  saveTheme: (theme: 'light' | 'dark') => Promise<void>;
  saveFontScale: (scale: number) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

export function useBiblePreferences(): UseBiblePreferencesReturn {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<BiblePreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar preferências do Supabase
  const loadPreferences = useCallback(async () => {
    if (!user) {
      // Se não estiver logado, carregar do localStorage como fallback
      try {
        const savedLastRead = localStorage.getItem('biblia_last_read');
        const savedTheme = localStorage.getItem('biblia_theme');
        const savedFontScale = localStorage.getItem('biblia_font_scale');
        
        const prefs: BiblePreferences = {};
        if (savedLastRead) {
          const parsed = JSON.parse(savedLastRead);
          prefs.last_read_book = parsed.book;
          prefs.last_read_chapter = parsed.chapter;
          prefs.last_read_verse = parsed.verse;
        }
        if (savedTheme) {
          prefs.theme = savedTheme === 'dark' ? 'dark' : 'light';
        }
        if (savedFontScale) {
          const scale = parseFloat(savedFontScale);
          if (!isNaN(scale)) prefs.font_scale = scale;
        }
        
        setPreferences(Object.keys(prefs).length > 0 ? prefs : null);
      } catch (err) {
        console.warn('[bible-preferences] Failed to load from localStorage:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bible_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[bible-preferences] Error loading preferences:', error);
        // Fallback para localStorage
        const savedLastRead = localStorage.getItem('biblia_last_read');
        const savedTheme = localStorage.getItem('biblia_theme');
        const savedFontScale = localStorage.getItem('biblia_font_scale');
        
        const prefs: BiblePreferences = {};
        if (savedLastRead) {
          const parsed = JSON.parse(savedLastRead);
          prefs.last_read_book = parsed.book;
          prefs.last_read_chapter = parsed.chapter;
          prefs.last_read_verse = parsed.verse;
        }
        if (savedTheme) {
          prefs.theme = savedTheme === 'dark' ? 'dark' : 'light';
        }
        if (savedFontScale) {
          const scale = parseFloat(savedFontScale);
          if (!isNaN(scale)) prefs.font_scale = scale;
        }
        
        setPreferences(Object.keys(prefs).length > 0 ? prefs : null);
      } else {
        setPreferences(data || null);
        // Sincronizar com localStorage como cache
        if (data) {
          if (data.last_read_book && data.last_read_chapter && data.last_read_verse) {
            localStorage.setItem('biblia_last_read', JSON.stringify({
              book: data.last_read_book,
              chapter: data.last_read_chapter,
              verse: data.last_read_verse
            }));
          }
          if (data.theme) {
            localStorage.setItem('biblia_theme', data.theme);
          }
          if (data.font_scale) {
            localStorage.setItem('biblia_font_scale', data.font_scale.toString());
          }
        }
      }
    } catch (err) {
      console.error('[bible-preferences] Unexpected error:', err);
      // Fallback para localStorage
      try {
        const savedLastRead = localStorage.getItem('biblia_last_read');
        const savedTheme = localStorage.getItem('biblia_theme');
        const savedFontScale = localStorage.getItem('biblia_font_scale');
        
        const prefs: BiblePreferences = {};
        if (savedLastRead) {
          const parsed = JSON.parse(savedLastRead);
          prefs.last_read_book = parsed.book;
          prefs.last_read_chapter = parsed.chapter;
          prefs.last_read_verse = parsed.verse;
        }
        if (savedTheme) {
          prefs.theme = savedTheme === 'dark' ? 'dark' : 'light';
        }
        if (savedFontScale) {
          const scale = parseFloat(savedFontScale);
          if (!isNaN(scale)) prefs.font_scale = scale;
        }
        
        setPreferences(Object.keys(prefs).length > 0 ? prefs : null);
      } catch (e) {
        console.warn('[bible-preferences] Failed to load from localStorage:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Salvar última leitura
  const saveLastRead = useCallback(async (book: string, chapter: number, verse: number) => {
    // Salvar no localStorage imediatamente (cache)
    try {
      localStorage.setItem('biblia_last_read', JSON.stringify({ book, chapter, verse }));
    } catch (err) {
      console.warn('[bible-preferences] Failed to save to localStorage:', err);
    }

    if (!user) return;

    try {
      const { error } = await supabase
        .from('bible_preferences')
        .upsert({
          user_id: user.id,
          last_read_book: book,
          last_read_chapter: chapter,
          last_read_verse: verse,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.warn('[bible-preferences] Error saving last read:', error);
      } else {
        // Atualizar estado local
        setPreferences(prev => ({
          ...prev,
          last_read_book: book,
          last_read_chapter: chapter,
          last_read_verse: verse
        }));
      }
    } catch (err) {
      console.error('[bible-preferences] Unexpected error saving last read:', err);
    }
  }, [user]);

  // Salvar tema
  const saveTheme = useCallback(async (theme: 'light' | 'dark') => {
    // Salvar no localStorage imediatamente (cache)
    try {
      localStorage.setItem('biblia_theme', theme);
    } catch (err) {
      console.warn('[bible-preferences] Failed to save theme to localStorage:', err);
    }

    if (!user) return;

    try {
      const { error } = await supabase
        .from('bible_preferences')
        .upsert({
          user_id: user.id,
          theme,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.warn('[bible-preferences] Error saving theme:', error);
      } else {
        // Atualizar estado local
        setPreferences(prev => ({
          ...prev,
          theme
        }));
      }
    } catch (err) {
      console.error('[bible-preferences] Unexpected error saving theme:', err);
    }
  }, [user]);

  // Salvar escala de fonte
  const saveFontScale = useCallback(async (scale: number) => {
    // Salvar no localStorage imediatamente (cache)
    try {
      localStorage.setItem('biblia_font_scale', scale.toString());
    } catch (err) {
      console.warn('[bible-preferences] Failed to save font scale to localStorage:', err);
    }

    if (!user) return;

    try {
      const { error } = await supabase
        .from('bible_preferences')
        .upsert({
          user_id: user.id,
          font_scale: scale,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.warn('[bible-preferences] Error saving font scale:', error);
      } else {
        // Atualizar estado local
        setPreferences(prev => ({
          ...prev,
          font_scale: scale
        }));
      }
    } catch (err) {
      console.error('[bible-preferences] Unexpected error saving font scale:', err);
    }
  }, [user]);

  // Carregar preferências ao montar ou quando o usuário mudar
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    saveLastRead,
    saveTheme,
    saveFontScale,
    loadPreferences
  };
}

