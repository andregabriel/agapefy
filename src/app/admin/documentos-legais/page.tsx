"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Save, 
  RefreshCw, 
  Eye, 
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface LegalDocument {
  id: string;
  document_type: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function DocumentosLegaisPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('terms_of_service');

  // Estados para edição
  const [editingTerms, setEditingTerms] = useState({
    title: '',
    content: ''
  });
  const [editingPrivacy, setEditingPrivacy] = useState({
    title: '',
    content: ''
  });

  // Carregar documentos
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .order('document_type');

      if (error) throw error;

      setDocuments(data || []);

      // Preencher formulários com dados existentes
      const termsDoc = data?.find(doc => doc.document_type === 'terms_of_service');
      const privacyDoc = data?.find(doc => doc.document_type === 'privacy_policy');

      if (termsDoc) {
        setEditingTerms({
          title: termsDoc.title,
          content: termsDoc.content
        });
      }

      if (privacyDoc) {
        setEditingPrivacy({
          title: privacyDoc.title,
          content: privacyDoc.content
        });
      }

      console.log('✅ Documentos legais carregados:', data?.length || 0);
    } catch (error) {
      console.error('❌ Erro ao carregar documentos:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  // Salvar documento
  const saveDocument = async (documentType: string, title: string, content: string) => {
    if (!user) {
      toast.error('Você precisa estar logado como admin');
      return;
    }

    if (!title.trim() || !content.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }

    setSaving(documentType);
    try {
      console.log(`💾 Salvando documento: ${documentType}`);

      const { data, error } = await supabase
        .from('legal_documents')
        .upsert({
          document_type: documentType,
          title: title.trim(),
          content: content.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'document_type'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao salvar documento:', error);
        throw error;
      }

      console.log('✅ Documento salvo com sucesso:', data);
      toast.success(`${documentType === 'terms_of_service' ? 'Termos de Uso' : 'Política de Privacidade'} atualizado com sucesso!`);
      
      // Recarregar documentos
      await fetchDocuments();

    } catch (error: any) {
      console.error('❌ Erro detalhado ao salvar:', error);
      
      let errorMessage = 'Erro ao salvar documento';
      if (error.code === '42501') {
        errorMessage = 'Você não tem permissão para editar documentos legais. Apenas administradores podem fazer isso.';
      } else if (error.message) {
        errorMessage = `Erro: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setSaving(null);
    }
  };

  // Salvar Termos de Uso
  const handleSaveTerms = () => {
    saveDocument('terms_of_service', editingTerms.title, editingTerms.content);
  };

  // Salvar Política de Privacidade
  const handleSavePrivacy = () => {
    saveDocument('privacy_policy', editingPrivacy.title, editingPrivacy.content);
  };

  // Obter documento por tipo
  const getDocument = (type: string) => {
    return documents.find(doc => doc.document_type === type);
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando documentos legais...</p>
        </div>
      </div>
    );
  }

  const termsDoc = getDocument('terms_of_service');
  const privacyDoc = getDocument('privacy_policy');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documentos Legais</h1>
          <p className="text-gray-600 mt-2">Edite o conteúdo dos Termos de Uso e Política de Privacidade</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={fetchDocuments}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>
        </div>
      </div>

      {/* Status dos documentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="text-blue-500" size={20} />
                <div>
                  <h3 className="font-medium">Termos de Uso</h3>
                  <p className="text-sm text-gray-500">
                    {termsDoc ? `Atualizado em ${formatDate(termsDoc.updated_at)}` : 'Não encontrado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={termsDoc ? 'default' : 'secondary'}>
                  {termsDoc ? 'Ativo' : 'Não encontrado'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/termos-de-uso', '_blank')}
                >
                  <ExternalLink size={14} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="text-green-500" size={20} />
                <div>
                  <h3 className="font-medium">Política de Privacidade</h3>
                  <p className="text-sm text-gray-500">
                    {privacyDoc ? `Atualizado em ${formatDate(privacyDoc.updated_at)}` : 'Não encontrado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={privacyDoc ? 'default' : 'secondary'}>
                  {privacyDoc ? 'Ativo' : 'Não encontrado'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/politica-de-privacidade', '_blank')}
                >
                  <ExternalLink size={14} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editor de documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="text-blue-600" size={24} />
            <span>Editor de Documentos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="terms_of_service" className="flex items-center space-x-2">
                <FileText size={16} />
                <span>Termos de Uso</span>
              </TabsTrigger>
              <TabsTrigger value="privacy_policy" className="flex items-center space-x-2">
                <FileText size={16} />
                <span>Política de Privacidade</span>
              </TabsTrigger>
            </TabsList>

            {/* Editor de Termos de Uso */}
            <TabsContent value="terms_of_service" className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Alterações nos Termos de Uso afetam todos os usuários. Certifique-se de revisar cuidadosamente antes de salvar.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="terms-title">Título do Documento</Label>
                  <Input
                    id="terms-title"
                    value={editingTerms.title}
                    onChange={(e) => setEditingTerms(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Termos de Serviço – Agapefy"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="terms-content">Conteúdo dos Termos de Uso</Label>
                  <Textarea
                    id="terms-content"
                    value={editingTerms.content}
                    onChange={(e) => setEditingTerms(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Digite o conteúdo completo dos Termos de Uso..."
                    className="mt-1 min-h-[400px] font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingTerms.content.length} caracteres
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {termsDoc && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock size={14} />
                        <span>Última atualização: {formatDate(termsDoc.updated_at)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open('/termos-de-uso', '_blank')}
                    >
                      <Eye size={16} className="mr-2" />
                      Visualizar Página
                    </Button>
                    
                    <Button
                      onClick={handleSaveTerms}
                      disabled={saving === 'terms_of_service' || !editingTerms.title.trim() || !editingTerms.content.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {saving === 'terms_of_service' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-2" />
                          Salvar Termos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Editor de Política de Privacidade */}
            <TabsContent value="privacy_policy" className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Alterações na Política de Privacidade podem exigir notificação aos usuários conforme LGPD e outras leis de proteção de dados.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="privacy-title">Título do Documento</Label>
                  <Input
                    id="privacy-title"
                    value={editingPrivacy.title}
                    onChange={(e) => setEditingPrivacy(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Política de Privacidade – Agapefy"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="privacy-content">Conteúdo da Política de Privacidade</Label>
                  <Textarea
                    id="privacy-content"
                    value={editingPrivacy.content}
                    onChange={(e) => setEditingPrivacy(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Digite o conteúdo completo da Política de Privacidade..."
                    className="mt-1 min-h-[400px] font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingPrivacy.content.length} caracteres
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {privacyDoc && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock size={14} />
                        <span>Última atualização: {formatDate(privacyDoc.updated_at)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open('/politica-de-privacidade', '_blank')}
                    >
                      <Eye size={16} className="mr-2" />
                      Visualizar Página
                    </Button>
                    
                    <Button
                      onClick={handleSavePrivacy}
                      disabled={saving === 'privacy_policy' || !editingPrivacy.title.trim() || !editingPrivacy.content.trim()}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {saving === 'privacy_policy' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-2" />
                          Salvar Política
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Informações importantes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Conformidade Legal:</strong> Certifique-se de que os documentos estejam em conformidade com LGPD, GDPR, COPPA e outras leis aplicáveis.
            </AlertDescription>
          </Alert>

          <Alert className="border-blue-200 bg-blue-50">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Atualizações Automáticas:</strong> As páginas públicas são atualizadas automaticamente quando você salva as alterações aqui.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <h4 className="font-medium mb-2">Links das Páginas:</h4>
              <ul className="space-y-1">
                <li>• <a href="/termos-de-uso" target="_blank" className="text-blue-600 hover:underline">Termos de Uso</a></li>
                <li>• <a href="/politica-de-privacidade" target="_blank" className="text-blue-600 hover:underline">Política de Privacidade</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Dicas de Edição:</h4>
              <ul className="space-y-1">
                <li>• Use formatação Markdown para títulos e listas</li>
                <li>• Mantenha backup antes de grandes alterações</li>
                <li>• Teste as páginas após salvar</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}