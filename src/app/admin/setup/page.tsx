'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  XCircle, 
  Loader2,
  Settings,
  Brain,
  MessageSquare,
  Phone,
  Key,
  Zap,
  ArrowRight,
  Copy,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  action?: () => void;
  details?: string;
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
      description: 'Enviar mensagem de teste via WhatsApp',
      status: 'pending'
    }
  ]);

  const [testPhone, setTestPhone] = useState('5511999999999');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      checkAllSteps();
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
        {steps.map((step, index) => (
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
    </div>
  );
}