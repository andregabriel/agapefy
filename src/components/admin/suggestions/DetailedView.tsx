"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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

interface DetailedViewProps {
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

export default function DetailedView({ suggestions, onRefresh }: DetailedViewProps) {
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions;

    // Filtrar por fonte
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(s => s.source === sourceFilter);
    }

    // Filtrar por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.suggestion_text.toLowerCase().includes(query) ||
        (s.grouped_topic && s.grouped_topic.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [suggestions, sourceFilter, searchQuery]);

  const handleEditTopic = async (id: string, currentTopic: string | null) => {
    if (editingId === id) {
      // Salvar
      try {
        const { error } = await supabase
          .from('user_suggestions')
          .update({ grouped_topic: editingTopic.trim() || null })
          .eq('id', id);

        if (error) throw error;

        toast.success('Tópico atualizado');
        setEditingId(null);
        setEditingTopic('');
        onRefresh();
      } catch (error) {
        console.error('Erro ao atualizar tópico:', error);
        toast.error('Erro ao atualizar tópico');
      }
    } else {
      // Iniciar edição
      setEditingId(id);
      setEditingTopic(currentTopic || '');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta sugestão?')) {
      return;
    }

    try {
      setDeletingId(id);
      const { error } = await supabase
        .from('user_suggestions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Sugestão deletada');
      onRefresh();
    } catch (error) {
      console.error('Erro ao deletar sugestão:', error);
      toast.error('Erro ao deletar sugestão');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
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
      </div>

      {/* Tabela */}
      {filteredSuggestions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Nenhuma sugestão encontrada com os filtros aplicados.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Texto da Sugestão</TableHead>
                    <TableHead className="w-[15%]">Fonte</TableHead>
                    <TableHead className="w-[15%]">Data</TableHead>
                    <TableHead className="w-[20%]">Tópico Agrupado</TableHead>
                    <TableHead className="w-[10%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuggestions.map((suggestion) => (
                    <TableRow key={suggestion.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm text-gray-900 line-clamp-2">
                            {suggestion.suggestion_text}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={sourceColors[suggestion.source] || 'bg-gray-100 text-gray-700'}
                        >
                          {sourceLabels[suggestion.source] || suggestion.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatDate(suggestion.created_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {editingId === suggestion.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingTopic}
                              onChange={(e) => setEditingTopic(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleEditTopic(suggestion.id, suggestion.grouped_topic);
                                } else if (e.key === 'Escape') {
                                  setEditingId(null);
                                  setEditingTopic('');
                                }
                              }}
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditTopic(suggestion.id, suggestion.grouped_topic)}
                            >
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setEditingTopic('');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              {suggestion.grouped_topic || 'Sem tópico'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditTopic(suggestion.id, suggestion.grouped_topic)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(suggestion.id)}
                          disabled={deletingId === suggestion.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contador */}
      <div className="text-sm text-gray-500 text-center">
        Mostrando {filteredSuggestions.length} de {suggestions.length} sugestões
      </div>
    </div>
  );
}


