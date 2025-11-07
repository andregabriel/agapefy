"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

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

interface SuggestionCardProps {
  topic: string;
  count: number;
  sources: string[];
  lastSuggestion: string;
  suggestions: UserSuggestion[];
  onRefresh: () => void;
}

const sourceColors: Record<string, string> = {
  onboarding: 'bg-blue-100 text-blue-700',
  nps: 'bg-purple-100 text-purple-700',
  home: 'bg-green-100 text-green-700',
};

const sourceLabels: Record<string, string> = {
  onboarding: 'Onboarding',
  nps: 'NPS',
  home: 'Home',
};

export default function SuggestionCard({
  topic,
  count,
  sources,
  lastSuggestion,
  suggestions,
  onRefresh,
}: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-gray-900 text-lg">{topic}</h3>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                {count} {count === 1 ? 'sugestão' : 'sugestões'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">Fonte:</span>
              {sources.map((source) => (
                <Badge
                  key={source}
                  className={sourceColors[source] || 'bg-gray-100 text-gray-700'}
                >
                  {sourceLabels[source] || source}
                </Badge>
              ))}
              <span className="text-sm text-gray-500">•</span>
              <span className="text-sm text-gray-500">Última: {lastSuggestion}</span>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-4 p-1 hover:bg-gray-100 rounded"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    className={sourceColors[suggestion.source] || 'bg-gray-100 text-gray-700'}
                  >
                    {sourceLabels[suggestion.source] || suggestion.source}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(suggestion.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{suggestion.suggestion_text}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


