"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import SummaryView from '@/components/admin/suggestions/SummaryView';
import DetailedView from '@/components/admin/suggestions/DetailedView';

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

export default function FeedbackPage() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'detailed'>('summary');

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSuggestions((data as UserSuggestion[]) || []);
    } catch (err) {
      console.error('Erro ao buscar sugestões:', err);
      setError('Erro ao carregar sugestões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSuggestions();
    }
  }, [user]);

  // Persistir tab ativa no localStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('feedback_admin_tab');
    if (savedTab === 'detailed' || savedTab === 'summary') {
      setActiveTab(savedTab);
    }
  }, []);

  const handleTabChange = (value: string) => {
    if (value === 'summary' || value === 'detailed') {
      setActiveTab(value);
      localStorage.setItem('feedback_admin_tab', value);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando feedbacks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Erro</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchSuggestions} variant="outline">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feedbacks</h1>
          <p className="text-gray-500 mt-1">Sugestões dos usuários de múltiplas fontes</p>
        </div>
        <Button onClick={fetchSuggestions} variant="outline" size="sm">
          <RefreshCw size={16} className="mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="border-b px-6 pt-4">
              <TabsList>
                <TabsTrigger value="summary">Resumo</TabsTrigger>
                <TabsTrigger value="detailed">Detalhado</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="summary" className="m-0">
              <SummaryView 
                suggestions={suggestions} 
                onRefresh={fetchSuggestions}
              />
            </TabsContent>

            <TabsContent value="detailed" className="m-0">
              <DetailedView 
                suggestions={suggestions} 
                onRefresh={fetchSuggestions}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}


