"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface LegalDocument {
  id: string;
  document_type: string;
  title: string;
  content: string;
  updated_at: string;
}

export default function TermosDeUsoPage() {
  const router = useRouter();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const { data, error } = await supabase
          .from('legal_documents')
          .select('*')
          .eq('document_type', 'terms_of_service')
          .single();

        if (error) {
          console.error('Erro ao carregar termos de uso:', error);
          // Usar conteúdo padrão se não encontrar no banco
          setDocument({
            id: 'default',
            document_type: 'terms_of_service',
            title: 'Termos de Serviço – Agapefy',
            content: 'Documento não encontrado. Entre em contato com o suporte.',
            updated_at: new Date().toISOString()
          });
        } else {
          setDocument(data);
        }
      } catch (error) {
        console.error('Erro ao buscar documento:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando termos de uso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Termos de Serviço</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="prose prose-gray max-w-none">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              {document?.title || 'Termos de Serviço – Agapefy'}
            </h1>
            
            {document && (
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {document.content}
              </div>
            )}

            <div className="text-center mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Este documento contém os termos completos de serviço. Para questões específicas, entre em contato conosco através dos canais oficiais.
              </p>
              {document && (
                <p className="text-xs text-gray-400 mt-2">
                  Última atualização: {new Date(document.updated_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}