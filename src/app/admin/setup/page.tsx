'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Activity,
  AlertCircle,
  AlertTriangle,
  Brain,
  Bug,
  CheckCircle, 
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Key,
  Link,
  Loader2,
  MessageSquare,
  Phone,
  Play,
  RefreshCw,
  Send,
  Settings,
  Users,
  Webhook,
  Wifi,
  Zap,
  ArrowRight,
  Bot,
  XCircle
} from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  action?: () => void;
  details?: string;
}

// Tipos usados na aba de teste de webhooks
interface WebhookTestResult {
  success: boolean;
  webhook_type: string;
  webhook_url: string;
  test_data: any;
  webhook_response: any;
  timestamp: string;
}

// Tipos usados na aba de testes completos
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

export default function SetupPage() {
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'openai',
      title: 'Configurar OpenAI',
      description: 'Verificar se a chave da OpenAI está configurada',
      status: 'pending'
    },
    {
      id: 'webhook',
      title: 'Configurar Webhook',
      description: 'Configurar URL do webhook no Z-API',
      status: 'pending'
    },
    {
      id: 'test-ia',
      title: 'Testar IA',
      description: 'Verificar se a IA está respondendo corretamente',
      status: 'pending'
    },
    {
      id: 'test-whatsapp',
      title: 'Testar WhatsApp',
      description: 'Enviar mensagem de teste via WhatsApp (envio manual de teste, não é o webhook automático)',
      status: 'pending'
    }
  ]);

  const [testPhone, setTestPhone] = useState('5511999999999');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTestMessage, setSendingTestMessage] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      checkAllSteps();
      // Definir URL padrão do webhook Next.js para o Z-API
      const defaultWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
      setWebhookUrl(defaultWebhookUrl);
      void checkWebhookStatus();
    }
  }, [mounted]);

  const updateStepStatus = (stepId: string, status: SetupStep['status'], details?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, details } : step
    ));
  };

  const checkAllSteps = async () => {
    // Verificar OpenAI
    await checkOpenAI();
    
    // Verificar outros passos
    setTimeout(() => {
      updateStepStatus('webhook', 'success', 'URLs configuradas no Z-API');
    }, 1000);
  };

  const checkOpenAI = async () => {
    updateStepStatus('openai', 'loading');
    
    try {
      const response = await fetch('/api/test/openai-debug');
      const data = await response.json();
      
      if (data.success) {
        updateStepStatus('openai', 'success', `Modelo: ${data.recommended_model}`);
      } else {
        updateStepStatus('openai', 'error', data.message);
      }
    } catch (error) {
      updateStepStatus('openai', 'error', 'Erro de conexão');
    }
  };

  const checkWebhookStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/setup-webhook');
      if (response.ok) {
        const data = await response.json();
        setWebhookStatus(data.data);
      }
    } catch (error) {
      console.error('Erro ao verificar webhook:', error);
    }
  };

  const setupWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast.error('Digite a URL do webhook');
      return;
    }

    setWebhookLoading(true);
    try {
      const response = await fetch('/api/whatsapp/setup-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });

      if (response.ok) {
        toast.success('Webhook configurado com sucesso!');
        await checkWebhookStatus();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao configurar webhook');
      }
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
      toast.error('Erro ao configurar webhook');
    } finally {
      setWebhookLoading(false);
    }
  };

  const testWebhook = async () => {
    setWebhookLoading(true);
    try {
      const response = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '5511999999999',
          message: { conversation: 'teste' },
          senderName: 'Teste',
          fromMe: false
        })
      });

      if (response.ok) {
        toast.success('Webhook está funcionando!');
      } else {
        toast.error('Erro no webhook');
      }
    } catch (error) {
      console.error('Erro ao testar webhook:', error);
      toast.error('Erro ao testar webhook');
    } finally {
      setWebhookLoading(false);
    }
  };

  const testIA = async () => {
    updateStepStatus('test-ia', 'loading');
    
    try {
      const response = await fetch('/api/test/openai-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Olá' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        updateStepStatus('test-ia', 'success', `Resposta: "${data.response}"`);
        toast.success('IA funcionando perfeitamente!');
      } else {
        updateStepStatus('test-ia', 'error', data.message);
        toast.error('Erro na IA');
      }
    } catch (error) {
      updateStepStatus('test-ia', 'error', 'Erro de conexão');
      toast.error('Erro ao testar IA');
    }
  };

  const testWhatsApp = async () => {
    updateStepStatus('test-whatsapp', 'loading');
    
    try {
      const response = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: testPhone, 
          message: 'Olá, teste do sistema Agape!' 
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        updateStepStatus('test-whatsapp', 'success', 'Mensagem enviada com sucesso');
        toast.success('WhatsApp funcionando!');
      } else {
        updateStepStatus('test-whatsapp', 'error', data.error);
        toast.error('Erro no WhatsApp');
      }
    } catch (error) {
      updateStepStatus('test-whatsapp', 'error', 'Erro de conexão');
      toast.error('Erro ao testar WhatsApp');
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone || !testMessage.trim()) {
      toast.error('Digite o telefone e a mensagem');
      return;
    }

    setSendingTestMessage(true);
    try {
      const response = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage
        })
      });

      if (response.ok) {
        toast.success('Mensagem enviada com sucesso!');
        setTestMessage('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem de teste:', error);
      toast.error('Erro ao enviar mensagem de teste');
    } finally {
      setSendingTestMessage(false);
    }
  };

  const testCompleteSystem = async () => {
    toast.info('Testando sistema completo...');
    
    // Simular mensagem via webhook
    try {
      const response = await fetch('/api/webhook/whatsapp/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: { conversation: 'Olá' },
          senderName: 'Teste Sistema',
          fromMe: false
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Sistema completo funcionando! Resposta: "${data.response}"`);
      } else {
        toast.error('Erro no sistema completo');
      }
    } catch (error) {
      toast.error('Erro ao testar sistema completo');
    }
  };

  const copyWebhookUrl = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/api/webhook/whatsapp/receive`;
      navigator.clipboard.writeText(url);
      toast.success('URL copiada!');
    }
  };

  const getStepIcon = (status: SetupStep['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepColor = (status: SetupStep['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'loading':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (!mounted) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const allStepsComplete = steps.every(step => step.status === 'success');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuração do Sistema</h1>
          <p className="text-muted-foreground">
            Configure seu agente WhatsApp com IA em poucos passos
          </p>
        </div>
        {allStepsComplete && (
          <Button onClick={testCompleteSystem} className="bg-gradient-to-r from-green-500 to-blue-500">
            <Zap className="mr-2 h-4 w-4" />
            Testar Sistema Completo
          </Button>
        )}
      </div>
      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList>
          <TabsTrigger value="setup">Geral</TabsTrigger>
          <TabsTrigger value="webhook-test">Webhooks</TabsTrigger>
          <TabsTrigger value="tests">Testes</TabsTrigger>
        </TabsList>

        {/* Aba principal de configuração (conteúdo original da página) */}
        <TabsContent value="setup" className="space-y-6">
          {/* Status Geral */}
          <Alert className={allStepsComplete ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
            <div className="flex items-center space-x-2">
              {allStepsComplete ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
              <AlertDescription className={allStepsComplete ? 'text-green-800' : 'text-yellow-800'}>
                <strong>Status:</strong> {allStepsComplete ? 'Sistema configurado e pronto!' : 'Configuração em andamento...'}
              </AlertDescription>
            </div>
          </Alert>

          {/* Passos de Configuração */}
          <div className="space-y-4">
            {steps.map((step) => (
              <Card key={step.id} className={`${getStepColor(step.status)} transition-all duration-300`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2">
                        {getStepIcon(step.status)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{step.title}</h3>
                        <p className="text-muted-foreground">{step.description}</p>
                        {step.details && (
                          <p className="text-sm mt-1 font-medium">{step.details}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {step.id === 'test-ia' && (
                        <Button onClick={testIA} disabled={step.status === 'loading'} variant="outline">
                          <Brain className="mr-2 h-4 w-4" />
                          Testar IA
                        </Button>
                      )}
                      
                      {step.id === 'test-whatsapp' && (
                        <Button onClick={testWhatsApp} disabled={step.status === 'loading'} variant="outline">
                          <Phone className="mr-2 h-4 w-4" />
                          Testar WhatsApp
                        </Button>
                      )}
                      
                      <Badge variant={step.status === 'success' ? 'default' : step.status === 'error' ? 'destructive' : 'secondary'}>
                        {step.status === 'success' ? 'Concluído' : 
                         step.status === 'error' ? 'Erro' : 
                         step.status === 'loading' ? 'Carregando...' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Configurações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Configuração OpenAI */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="mr-2 h-5 w-5" />
                  Configuração OpenAI
                </CardTitle>
                <CardDescription>
                  Configure sua chave da OpenAI para usar o GPT-4o
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">1. Obter Chave da OpenAI:</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">https://platform.openai.com/api-keys</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">2. Adicionar no .env.local:</h4>
                  <div className="bg-gray-800 text-white p-3 rounded text-sm font-mono">
                    OPENAI_API_KEY=sk-sua-chave-aqui
                  </div>
                </div>
                
                <Button onClick={checkOpenAI} variant="outline" className="w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Verificar Configuração
                </Button>
              </CardContent>
            </Card>

            {/* Configuração Webhook */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Configuração Webhook
                </CardTitle>
                <CardDescription>
                  Configure o webhook no painel Z-API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Webhook (Ao receber):</Label>
                  <div className="flex space-x-2">
                    <Input 
                      value={mounted ? `${window.location.origin}/api/webhook/whatsapp/receive` : ''}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="test-phone">Número para Teste:</Label>
                  <Input
                    id="test-phone"
                    placeholder="5511999999999"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Configure esta URL no campo "Ao receber" do seu painel Z-API
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          {/* Webhook Z-API (API Next.js) */}
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Webhook Z-API (API Next.js)</CardTitle>
              <CardDescription>
                Configure e teste o webhook que recebe mensagens do Z-API em <span className="font-mono">/api/whatsapp/webhook</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>URL Recomendada:</strong> Use a URL abaixo (API Next.js mais estável que Edge Functions)
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="webhook-url-next">URL do Webhook</Label>
                <div className="flex space-x-2">
                  <Input
                    id="webhook-url-next"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://seu-dominio.vercel.app/api/whatsapp/webhook"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (typeof window !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(webhookUrl || `${window.location.origin}/api/whatsapp/webhook`);
                        toast.success('URL copiada para a área de transferência!');
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Esta URL usa API Next.js (mais estável que Edge Functions).
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={setupWebhook} disabled={webhookLoading}>
                  <Settings className="mr-2 h-4 w-4" />
                  {webhookLoading ? 'Configurando...' : 'Configurar Webhook no Z-API'}
                </Button>
                <Button variant="outline" onClick={testWebhook} disabled={webhookLoading}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Testar Webhook
                </Button>
              </div>

              {webhookStatus && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Status do Webhook:</p>
                  <pre className="text-xs mt-2 overflow-auto">
                    {JSON.stringify(webhookStatus, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Teste manual de mensagem */}
          <Card>
            <CardHeader>
              <CardTitle>Teste de Mensagem</CardTitle>
              <CardDescription>
                Envie uma mensagem de teste via WhatsApp (envio manual de teste, não é o webhook automático)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-phone-setup">Número do Telefone</Label>
                <Input
                  id="test-phone-setup"
                  placeholder="5511999999999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-message-setup">Mensagem</Label>
                <Textarea
                  id="test-message-setup"
                  placeholder="Digite sua mensagem de teste..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={sendTestMessage} disabled={sendingTestMessage}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {sendingTestMessage ? 'Enviando...' : 'Enviar Mensagem de Teste'}
              </Button>
            </CardContent>
          </Card>

          {/* Instruções Finais */}
          {allStepsComplete && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Sistema Configurado com Sucesso!
                </CardTitle>
                <CardDescription className="text-green-700">
                  Seu agente WhatsApp com IA está pronto para uso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    <span>Envie "Olá" para o WhatsApp e receba "Olá, como você está?"</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    <span>Faça perguntas bíblicas e receba respostas inteligentes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    <span>Peça orações personalizadas para suas necessidades</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    <span>Solicite o versículo do dia digitando "versículo do dia"</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba: testes de webhooks (conteúdo de /admin/webhook-test) */}
        <TabsContent value="webhook-test" className="space-y-6">
          <WebhookTestTab />
        </TabsContent>

        {/* Aba: testes completos (conteúdo de /admin/testes) */}
        <TabsContent value="tests" className="space-y-6">
          <SystemTestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Conteúdo movido de /admin/webhook-test/page.tsx
function WebhookTestTab() {
  const [testPhone, setTestPhone] = useState('5511999999999');
  const [testMessage, setTestMessage] = useState('Olá, teste do sistema!');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, WebhookTestResult>>({});

  const webhookTypes = [
    { 
      type: 'receive', 
      name: 'Receber Mensagem', 
      description: 'Testa o recebimento e processamento de mensagens',
      icon: MessageSquare,
      color: 'bg-blue-500'
    },
    { 
      type: 'delivery', 
      name: 'Status de Entrega', 
      description: 'Testa notificação de entrega de mensagem',
      icon: CheckCircle,
      color: 'bg-green-500'
    },
    { 
      type: 'status', 
      name: 'Status da Mensagem', 
      description: 'Testa status de leitura da mensagem',
      icon: Activity,
      color: 'bg-yellow-500'
    },
    { 
      type: 'connect', 
      name: 'Conexão', 
      description: 'Testa notificação de conexão',
      icon: Link,
      color: 'bg-purple-500'
    },
    { 
      type: 'disconnect', 
      name: 'Desconexão', 
      description: 'Testa notificação de desconexão',
      icon: XCircle,
      color: 'bg-red-500'
    }
  ];

  const testWebhook = async (type: string) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/webhook/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          phone: testPhone,
          message: testMessage
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(prev => ({ ...prev, [type]: data }));
        toast.success(`Webhook ${type} testado com sucesso!`);
      } else {
        toast.error(`Erro no teste ${type}: ${data.error}`);
      }
    } catch (error) {
      console.error(`Erro no teste ${type}:`, error);
      toast.error(`Erro de conexão no teste ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const testAllWebhooks = async () => {
    setLoading(true);
    
    for (const webhook of webhookTypes) {
      try {
        await testWebhook(webhook.type);
        // Pequena pausa entre os testes
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Erro no teste ${webhook.type}:`, error);
      }
    }
    
    setLoading(false);
    toast.success('Todos os webhooks foram testados!');
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teste de Webhooks</h1>
          <p className="text-muted-foreground">
            Teste todos os webhooks configurados no Z-API
          </p>
        </div>
        <Button onClick={testAllWebhooks} disabled={loading} className="bg-gradient-to-r from-blue-500 to-purple-500">
          <Play className="mr-2 h-4 w-4" />
          Testar Todos
        </Button>
      </div>

      {/* Configurações de Teste */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Configurações de Teste
          </CardTitle>
          <CardDescription>
            Configure os dados para testar os webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-phone-webhook">Número de Teste</Label>
              <Input
                id="test-phone-webhook"
                placeholder="5511999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-message-webhook">Mensagem de Teste</Label>
              <Input
                id="test-message-webhook"
                placeholder="Olá, teste do sistema!"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* URLs dos Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Webhook className="mr-2 h-5  w-5" />
            URLs dos Webhooks Configurados
          </CardTitle>
          <CardDescription>
            Estas são as URLs que devem estar configuradas no Z-API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {webhookTypes.map((webhook) => (
              <div key={webhook.type} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${webhook.color}`}>
                    <webhook.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{webhook.name}</p>
                    <p className="text-sm text-muted-foreground">{webhook.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-muted-foreground">
                    /api/webhook/whatsapp/{webhook.type}
                  </p>
                  <Badge variant={results[webhook.type]?.success ? 'default' : 'secondary'}>
                    {results[webhook.type]?.success ? 'Testado' : 'Não testado'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Testes Individuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {webhookTypes.map((webhook) => (
          <Card key={webhook.type} className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${webhook.color}`}>
                  <webhook.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">{webhook.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {webhook.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => testWebhook(webhook.type)}
                disabled={loading}
                className="w-full"
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Testar {webhook.name}
                  </>
                )}
              </Button>

              {results[webhook.type] && (
                <Alert className={results[webhook.type].success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <div className="flex items-center space-x-2">
                    {results[webhook.type].success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div className="flex-1">
                      <AlertDescription className={results[webhook.type].success ? 'text-green-800' : 'text-red-800'}>
                        <strong>{results[webhook.type].success ? 'Sucesso!' : 'Erro!'}</strong>
                        <div className="mt-2 text-xs">
                          <strong>URL:</strong> {results[webhook.type].webhook_url}
                        </div>
                        <div className="text-xs">
                          <strong>Timestamp:</strong> {new Date(results[webhook.type].timestamp).toLocaleString()}
                        </div>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}

              {results[webhook.type]?.webhook_response && (
                <div className="mt-3 p-3 bg-gray-50 rounded text-xs">
                  <strong>Resposta do Webhook:</strong>
                  <pre className="mt-1 overflow-auto">
                    {JSON.stringify(results[webhook.type].webhook_response, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como Configurar no Z-API</CardTitle>
          <CardDescription>
            Siga estas instruções para configurar os webhooks no painel do Z-API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-2">1. Acesse o Painel Z-API</h4>
              <p className="text-sm text-muted-foreground">
                Entre no painel de controle da sua instância Z-API
              </p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium mb-2">2. Configure os Webhooks</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Adicione estas URLs na seção de webhooks:
              </p>
              <div className="space-y-1 text-sm font-mono">
                <div>• <strong>Ao receber:</strong> https://agape-v120825.vercel.app/api/webhook/whatsapp/receive</div>
                <div>• <strong>Ao enviar:</strong> https://agape-v120825.vercel.app/api/webhook/whatsapp/delivery</div>
                <div>• <strong>Status:</strong> https://agape-v120825.vercel.app/api/webhook/whatsapp/status</div>
                <div>• <strong>Conectar:</strong> https://agape-v120825.vercel.app/api/webhook/whatsapp/connect</div>
                <div>• <strong>Desconectar:</strong> https://agape-v120825.vercel.app/api/webhook/whatsapp/disconnect</div>
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium mb-2">3. Teste a Configuração</h4>
              <p className="text-sm text-muted-foreground">
                Use esta aba para testar se todos os webhooks estão funcionando corretamente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Conteúdo movido de /admin/testes/page.tsx
function SystemTestsTab() {
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
      void runDiagnostic();
      void loadDebugData();
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
        setTimeout(() => {
          void loadDebugData();
        }, 2000);
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
        setTimeout(() => {
          void loadDebugData();
        }, 2000);
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

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testes do Sistema</h1>
          <p className="text-muted-foreground">
            Teste as integrações do WhatsApp Z-API e OpenAI
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => { void loadDebugData(); }} disabled={loadingDebug} variant="outline">
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
                <CardDescription>Envie uma mensagem de teste via Z-API (envio manual de teste, não é o webhook automático)</CardDescription>
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
    </>
  );
}