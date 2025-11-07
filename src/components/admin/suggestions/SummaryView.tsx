"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import SuggestionCard from './SuggestionCard';

interface UserSuggestion {
  id: string;
  user_id: string | null;
  suggestion_text: string;
  source: 'onboarding' | 'nps' | 'home';
  source_id: string | null;
  form_id: string | null;
  grouped_topic: string | null;
  created_at: string;
}

interface SummaryViewProps {
  suggestions: UserSuggestion[];
  onRefresh: () => void;
}

interface GroupedSuggestion {
  topic: string;
  count: number;
  suggestions: UserSuggestion[];
  sources: Set<string>;
  lastSuggestion: Date;
}

// Função para normalizar texto (remover acentos, lowercase, trim)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Função de agrupamento simples por palavras-chave
function groupSuggestions(suggestions: UserSuggestion[]): GroupedSuggestion[] {
  const groups = new Map<string, GroupedSuggestion>();

  suggestions.forEach((suggestion) => {
    const text = suggestion.suggestion_text.trim();
    if (!text) return;

    // Se já tem grouped_topic, usar ele
    if (suggestion.grouped_topic) {
      const topic = suggestion.grouped_topic;
      if (!groups.has(topic)) {
        groups.set(topic, {
          topic,
          count: 0,
          suggestions: [],
          sources: new Set(),
          lastSuggestion: new Date(suggestion.created_at),
        });
      }
      const group = groups.get(topic)!;
      group.count++;
      group.suggestions.push(suggestion);
      group.sources.add(suggestion.source);
      const suggestionDate = new Date(suggestion.created_at);
      if (suggestionDate > group.lastSuggestion) {
        group.lastSuggestion = suggestionDate;
      }
      return;
    }

    // Agrupamento automático por palavras-chave
    const normalized = normalizeText(text);
    const words = normalized.split(/\s+/).filter(w => w.length > 3); // Palavras com mais de 3 caracteres
    const keyWords = words.slice(0, 5).join(' '); // Primeiras 5 palavras

    // Criar chave de agrupamento baseada nas primeiras palavras
    const groupKey = keyWords || normalized.slice(0, 30);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        topic: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
        count: 0,
        suggestions: [],
        sources: new Set(),
        lastSuggestion: new Date(suggestion.created_at),
      });
    }

    const group = groups.get(groupKey)!;
    group.count++;
    group.suggestions.push(suggestion);
    group.sources.add(suggestion.source);
    const suggestionDate = new Date(suggestion.created_at);
    if (suggestionDate > group.lastSuggestion) {
      group.lastSuggestion = suggestionDate;
    }
  });

  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count); // Ordenar por quantidade (mais sugestões primeiro)
}

export default function SummaryView({ suggestions, onRefresh }: SummaryViewProps) {
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions;

    // Filtrar por fonte
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(s => s.source === sourceFilter);
    }

    // Filtrar por busca
    if (searchQuery.trim()) {
      const query = normalizeText(searchQuery);
      filtered = filtered.filter(s => 
        normalizeText(s.suggestion_text).includes(query) ||
        (s.grouped_topic && normalizeText(s.grouped_topic).includes(query))
      );
    }

    return filtered;
  }, [suggestions, sourceFilter, searchQuery]);

  const grouped = useMemo(() => {
    return groupSuggestions(filteredSuggestions);
  }, [filteredSuggestions]);

  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`;
    return `Há ${Math.floor(diffDays / 30)} meses`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Filtros e busca */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por texto ou tópico..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="nps">NPS</SelectItem>
            <SelectItem value="home">Home</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          variant="outline" 
          onClick={async () => {
            // TODO: Implementar agrupamento por IA
            alert('Funcionalidade de agrupamento por IA será implementada em breve');
          }}
        >
          <Sparkles size={16} className="mr-2" />
          Agrupar por IA
        </Button>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{suggestions.length}</div>
            <div className="text-sm text-gray-500">Total de sugestões</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{grouped.length}</div>
            <div className="text-sm text-gray-500">Tópicos identificados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {grouped.length > 0 ? grouped[0].count : 0}
            </div>
            <div className="text-sm text-gray-500">Tópico mais mencionado</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de tópicos agrupados */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Nenhuma sugestão encontrada com os filtros aplicados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Tópicos Agrupados ({grouped.length})
          </h2>
          {grouped.map((group, idx) => (
            <SuggestionCard
              key={idx}
              topic={group.topic}
              count={group.count}
              sources={Array.from(group.sources)}
              lastSuggestion={formatRelativeDate(group.lastSuggestion)}
              suggestions={group.suggestions}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}


