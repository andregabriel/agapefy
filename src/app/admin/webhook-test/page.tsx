'use client';

import { useState } from 'react';
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
  CheckCircle, 
  XCircle, 
  Loader2,
  MessageSquare,
  Phone,
  Webhook,
  Play,
  Settings,
  Link,
  Activity
} from 'lucide-react';

interface WebhookTestResult {
  success: boolean;
  webhook_type: string;
  webhook_url: string;
  test_data: any;
  webhook_response: any;
  timestamp: string;
}

export default function WebhookTestPage() {
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
    <div className="container mx-auto p-6 space-y-6">
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
              <Label htmlFor="test-phone">Número de Teste</Label>
              <Input
                id="test-phone"
                placeholder="5511999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-message">Mensagem de Teste</Label>
              <Input
                id="test-message"
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
                Use esta página para testar se todos os webhooks estão funcionando corretamente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}