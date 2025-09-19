'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Send, 
  Brain, 
  CheckCircle, 
  XCircle, 
  Loader2,
  MessageSquare,
  Zap,
  Phone,
  Bot,
  AlertTriangle,
  RefreshCw,
  Key,
  DollarSign,
  Wifi,
  Bug,
  Clock,
  Users
} from 'lucide-react';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

interface DiagnosticResult {
  success?: boolean;
  error?: string;
  message: string;
  solution?: string;
  models?: any;
  recommended_model?: string;
}

interface DebugData {
  status: string;
  webhook_url: string;
  openai: {
    configured: boolean;
    key_format: string;
    model: string;
  };
  statistics: {
    total_conversations: number;
    conversations_today: number;
    total_users: number;
    last_conversation_time: string;
    last_user_update: string;
  };
  recent_conversations: any[];
  recent_users: any[];
}

export default function TestesPage() {
  const [whatsappPhone, setWhatsappPhone] = useState('5511999999999');
  const [whatsappMessage, setWhatsappMessage] = useState('Mensagem de teste...');
  const [iaText, setIaText] = useState('Olá');
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState<TestResult | null>(null);
  const [iaResult, setIaResult] = useState<TestResult | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [mounted, setMounted] = useState(false);

  // Aguardar montagem do componente
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      runDiagnostic();
      loadDebugData();
    }
  }, [mounted]);

  const runDiagnostic = async () => {
    setLoadingDiagnostic(true);
    try {
      const response = await fetch('/api/test/openai-debug');
      const data = await response.json();
      setDiagnosticResult(data);
    } catch (error) {
      setDiagnosticResult({
        error: 'ERRO_CONEXAO',
        message: 'Erro ao executar diagnóstico',
        solution: 'Verifique sua conexão'
      });
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  const loadDebugData = async () => {
    setLoadingDebug(true);
    try {
      const response = await fetch('/api/whatsapp/debug');
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Erro ao carregar debug:', error);
    } finally {
      setLoadingDebug(false);
    }
  };

  const testWhatsApp = async () => {
    if (!whatsappPhone || !whatsappMessage) {
      toast.error('Preencha o número e a mensagem');
      return;
    }

    setLoadingWhatsapp(true);
    setWhatsappResult(null);

    try {
      const response = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: whatsappPhone, 
          message: whatsappMessage 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setWhatsappResult({
          success: true,
          message: 'Mensagem enviada com sucesso via Z-API!',
          data: data,
          timestamp: new Date().toLocaleString()
        });
        toast.success('Mensagem enviada com sucesso!');
        // Recarregar debug após envio
        setTimeout(loadDebugData, 2000);
      } else {
        setWhatsappResult({
          success: false,
          message: data.error || 'Erro ao enviar mensagem',
          data: data,
          timestamp: new Date().toLocaleString()
        });
        toast.error(data.error || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      setWhatsappResult({
        success: false,
        message: 'Erro de conexão com Z-API',
        data: { error: error instanceof Error ? error.message : 'Erro desconhecido' },
        timestamp: new Date().toLocaleString()
      });
      toast.error('Erro de conexão');
    } finally {
      setLoadingWhatsapp(false);
    }
  };

  const testIA = async () => {
    if (!iaText) {
      toast.error('Digite um texto para análise');
      return;
    }

    setLoadingIA(true);
    setIaResult(null);

    try {
      const response = await fetch('/api/test/openai-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: iaText 
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIaResult({
          success: true,
          message: `IA funcionando com modelo ${data.model_used}!`,
          data: data,
          timestamp: new Date().toLocaleString()
        });
        toast.success('IA funcionando perfeitamente!');
      } else {
        setIaResult({
          success: false,
          message: data.message || 'Erro na OpenAI',
          data: data,
          timestamp: new Date().toLocaleString()
        });
        toast.error(data.message || 'Erro na OpenAI');
      }
    } catch (error) {
      setIaResult({
        success: false,
        message: 'Erro de conexão com OpenAI',
        data: { error: error instanceof Error ? error.message : 'Erro desconhecido' },
        timestamp: new Date().toLocaleString()
      });
      toast.error('Erro de conexão com OpenAI');
    } finally {
      setLoadingIA(false);
    }
  };

  const testWebhookComplete = async () => {
    setLoadingWhatsapp(true);
    setLoadingIA(true);

    try {
      // Simular mensagem completa via webhook
      const response = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappPhone,
          message: { conversation: iaText },
          senderName: 'Teste Sistema',
          fromMe: false
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Sistema completo funcionando!');
        setWhatsappResult({
          success: true,
          message: 'Webhook processou mensagem com sucesso!',
          data: data,
          timestamp: new Date().toLocaleString()
        });
        setIaResult({
          success: true,
          message: 'IA integrada funcionando!',
          data: { response: data.response },
          timestamp: new Date().toLocaleString()
        });
        // Recarregar debug após teste
        setTimeout(loadDebugData, 2000);
      } else {
        toast.error('Erro no sistema completo');
      }
    } catch (error) {
      toast.error('Erro ao testar sistema completo');
    } finally {
      setLoadingWhatsapp(false);
      setLoadingIA(false);
    }
  };

  const getDiagnosticIcon = () => {
    if (loadingDiagnostic) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (diagnosticResult?.success) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (diagnosticResult?.error === 'CHAVE_NAO_CONFIGURADA') return <Key className="h-4 w-4 text-red-600" />;
    if (diagnosticResult?.error === 'LIMITE_EXCEDIDO') return <DollarSign className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getDiagnosticColor = () => {
    if (diagnosticResult?.success) return 'border-green-200 bg-green-50';
    if (diagnosticResult?.error === 'CHAVE_NAO_CONFIGURADA') return 'border-red-200 bg-red-50';
    if (diagnosticResult?.error === 'LIMITE_EXCEDIDO') return 'border-yellow-200 bg-yellow-50';
    return 'border-red-200 bg-red-50';
  };

  // Não renderizar até que o componente esteja montado
  if (!mounted) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testes do Sistema</h1>
          <p className="text-muted-foreground">
            Teste as integrações do WhatsApp Z-API e OpenAI
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadDebugData} disabled={loadingDebug} variant="outline">
            <Bug className="mr-2 h-4 w-4" />
            Debug WhatsApp
          </Button>
          <Button onClick={testWebhookComplete} disabled={loadingWhatsapp || loadingIA} className="bg-gradient-to-r from-green-500 to-purple-500">
            <Zap className="mr-2 h-4 w-4" />
            Testar Sistema Completo
          </Button>
        </div>
      </div>

      {/* Debug WhatsApp */}
      {debugData && (
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-blue-800 flex items-center">
              <Bug className="mr-2 h-5 w-5" />
              Debug WhatsApp - Status do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 border rounded-lg">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{debugData.statistics.total_conversations}</div>
                <div className="text-sm text-muted-foreground">Total Conversas</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Clock className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{debugData.statistics.conversations_today}</div>
                <div className="text-sm text-muted-foreground">Conversas Hoje</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Users className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">{debugData.statistics.total_users}</div>
                <div className="text-sm text-muted-foreground">Usuários Registrados</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-3">Últimas Conversas:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {debugData.recent_conversations.length > 0 ? (
                    debugData.recent_conversations.map((conv, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">{conv.phone}</div>
                        <div className="text-muted-foreground">"{conv.message}"</div>
                        <div className="text-blue-600">→ "{conv.response}"</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(conv.time).toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhuma conversa ainda</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Usuários Recentes:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {debugData.recent_users.length > 0 ? (
                    debugData.recent_users.map((user, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">{user.name || 'Sem nome'}</div>
                        <div className="text-muted-foreground">{user.phone}</div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={user.active ? 'default' : 'secondary'}>
                            {user.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(user.last_update).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhum usuário ainda</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm"><strong>Webhook URL:</strong> {debugData.webhook_url}</p>
              <p className="text-sm"><strong>OpenAI:</strong> {debugData.openai.configured ? '✅ Configurada' : '❌ Não configurada'} ({debugData.openai.model})</p>
              <p className="text-sm"><strong>Última conversa:</strong> {debugData.statistics.last_conversation_time !== 'Nenhuma' ? new Date(debugData.statistics.last_conversation_time).toLocaleString() : 'Nenhuma'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnóstico OpenAI */}
      <Alert className={getDiagnosticColor()}>
        <div className="flex items-center space-x-2">
          {getDiagnosticIcon()}
          <div className="flex-1">
            <AlertDescription>
              <strong>Diagnóstico OpenAI:</strong> {diagnosticResult?.message}
              {diagnosticResult?.solution && (
                <div className="mt-2 text-sm">
                  <strong>Solução:</strong> {diagnosticResult.solution}
                </div>
              )}
              {diagnosticResult?.recommended_model && (
                <div className="mt-2">
                  <Badge variant="outline">
                    Modelo recomendado: {diagnosticResult.recommended_model}
                  </Badge>
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teste de Envio WhatsApp */}
        <Card className="border-green-200">
          <CardHeader className="bg-green-50">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Send className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-green-800">Teste de Envio WhatsApp</CardTitle>
                <CardDescription>Envie uma mensagem de teste via Z-API</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone">Número do WhatsApp</Label>
              <Input
                id="whatsapp-phone"
                placeholder="5511999999999"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp-message">Mensagem</Label>
              <Textarea
                id="whatsapp-message"
                placeholder="Mensagem de teste..."
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={testWhatsApp} 
              disabled={loadingWhatsapp}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {loadingWhatsapp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Teste
                </>
              )}
            </Button>

            {whatsappResult && (
              <Alert className={whatsappResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center space-x-2">
                  {whatsappResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={whatsappResult.success ? 'text-green-800' : 'text-red-800'}>
                      <strong>{whatsappResult.success ? 'Sucesso:' : 'Erro:'}</strong> {whatsappResult.message}
                    </AlertDescription>
                    <p className="text-xs text-muted-foreground mt-1">{whatsappResult.timestamp}</p>
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Teste de Processamento IA */}
        <Card className="border-purple-200">
          <CardHeader className="bg-purple-50">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-purple-800">Teste de Processamento IA</CardTitle>
                <CardDescription>Teste como a IA interpreta mensagens</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="ia-text">Texto para Análise</Label>
              <Textarea
                id="ia-text"
                placeholder="Olá"
                value={iaText}
                onChange={(e) => setIaText(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={testIA} 
              disabled={loadingIA || !diagnosticResult?.success}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loadingIA ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Testar IA
                </>
              )}
            </Button>

            {!diagnosticResult?.success && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  Configure a chave OpenAI primeiro para testar a IA
                </AlertDescription>
              </Alert>
            )}

            {iaResult && (
              <Alert className={iaResult.success ? 'border-purple-200 bg-purple-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center space-x-2">
                  {iaResult.success ? (
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={iaResult.success ? 'text-purple-800' : 'text-red-800'}>
                      <strong>{iaResult.success ? 'Sucesso:' : 'Erro:'}</strong> {iaResult.message}
                    </AlertDescription>
                    <p className="text-xs text-muted-foreground mt-1">{iaResult.timestamp}</p>
                  </div>
                </div>
              </Alert>
            )}

            {iaResult?.success && iaResult.data?.response && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm font-medium text-purple-800 mb-2">Resposta da IA:</p>
                <p className="text-sm text-purple-700">{iaResult.data.response}</p>
                {iaResult.data.model_used && (
                  <Badge variant="outline" className="mt-2">
                    Modelo: {iaResult.data.model_used}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status das Integrações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span>Status das Integrações</span>
          </CardTitle>
          <CardDescription>
            Verificação em tempo real das conexões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Z-API WhatsApp</p>
                  <p className="text-sm text-muted-foreground">Envio de mensagens</p>
                </div>
              </div>
              <Badge variant={whatsappResult?.success ? 'default' : 'secondary'}>
                {whatsappResult?.success ? 'Conectado' : 'Não testado'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Brain className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium">OpenAI GPT-4o</p>
                  <p className="text-sm text-muted-foreground">Melhor modelo disponível</p>
                </div>
              </div>
              <Badge variant={diagnosticResult?.success ? 'default' : 'destructive'}>
                {diagnosticResult?.success ? 'Conectado' : 'Erro'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Webhook</p>
                  <p className="text-sm text-muted-foreground">Recebimento automático</p>
                </div>
              </div>
              <Badge variant={debugData?.statistics.total_conversations ? 'default' : 'outline'}>
                {debugData?.statistics.total_conversations ? 'Funcionando' : 'Configurar'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exemplos de Teste */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Teste</CardTitle>
          <CardDescription>
            Use estes exemplos para testar diferentes funcionalidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Testes para WhatsApp:</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setWhatsappMessage('Olá, este é um teste do sistema Agape!')}>
                  • "Olá, este é um teste do sistema Agape!"
                </div>
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setWhatsappMessage('🙏 Teste de emoji e formatação')}>
                  • "🙏 Teste de emoji e formatação"
                </div>
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setWhatsappMessage('Mensagem longa para testar se o sistema consegue processar textos maiores sem problemas de formatação ou limite de caracteres.')}>
                  • Mensagem longa para teste
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Testes para IA (GPT-4o):</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setIaText('Olá')}>
                  • "Olá" → Deve responder "Olá, como você está?"
                </div>
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setIaText('Estou passando por dificuldades financeiras')}>
                  • "Estou passando por dificuldades financeiras"
                </div>
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setIaText('O que significa João 3:16?')}>
                  • "O que significa João 3:16?"
                </div>
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setIaText('Preciso de uma oração para minha família')}>
                  • "Preciso de uma oração para minha família"
                </div>
                <div className="p-2 bg-gray-50 rounded cursor-pointer" onClick={() => setIaText('versículo do dia')}>
                  • "versículo do dia"
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}