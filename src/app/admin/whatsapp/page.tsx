'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { 
  MessageCircle, 
  Users, 
  Send, 
  Settings, 
  Calendar,
  Activity,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy
} from 'lucide-react';

interface WhatsAppUser {
  id: string;
  phone_number: string;
  name: string;
  is_active: boolean;
  receives_daily_verse: boolean;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  user_phone: string;
  conversation_type: string;
  message_content: string;
  response_content: string;
  message_type: string;
  created_at: string;
}

export default function WhatsAppAdminPage() {
  const [users, setUsers] = useState<WhatsAppUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Aguardar montagem do componente para acessar window
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadUsers();
      loadConversations();
      checkWebhookStatus();
      
      // Só definir a URL do webhook após a montagem
      const defaultWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
      setWebhookUrl(defaultWebhookUrl);
    }
  }, [mounted]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    }
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      toast.error('Erro ao carregar conversas');
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
    if (!webhookUrl) {
      toast.error('Digite a URL do webhook');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/setup-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });

      if (response.ok) {
        toast.success('Webhook configurado com sucesso!');
        checkWebhookStatus();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao configurar webhook');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao configurar webhook');
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone || !testMessage) {
      toast.error('Digite o telefone e a mensagem');
      return;
    }

    setLoading(true);
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
      console.error('Erro:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      const defaultWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
      navigator.clipboard.writeText(defaultWebhookUrl);
      toast.success('URL copiada para a área de transferência!');
    }
  };

  const testWebhook = async () => {
    setLoading(true);
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
      console.error('Erro:', error);
      toast.error('Erro ao testar webhook');
    } finally {
      setLoading(false);
    }
  };

  const getConversationTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'intelligent_chat': 'Chat Inteligente',
      'brother': 'Irmão da Igreja',
      'bible_expert': 'Especialista Bíblico',
      'prayer': 'Oração',
      'daily_verse': 'Versículo Diário',
      'help': 'Ajuda',
      'general': 'Geral'
    };
    return types[type] || type;
  };

  const getConversationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'intelligent_chat': 'bg-blue-100 text-blue-800',
      'brother': 'bg-green-100 text-green-800',
      'bible_expert': 'bg-purple-100 text-purple-800',
      'prayer': 'bg-pink-100 text-pink-800',
      'daily_verse': 'bg-yellow-100 text-yellow-800',
      'help': 'bg-gray-100 text-gray-800',
      'general': 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
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
          <h1 className="text-3xl font-bold">WhatsApp Agape</h1>
          <p className="text-muted-foreground">
            Administração do agente WhatsApp inteligente
          </p>
        </div>
      </div>

      {/* Status do Sistema */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Sistema Ativo:</strong> Usando API Next.js (mais estável que Edge Functions)
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="test">Testes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Usuários
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground">
                  Usuários registrados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Usuários Ativos
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter(u => u.is_active).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Recebem mensagens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Conversas Hoje
                </CardTitle>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {conversations.filter(c => 
                    new Date(c.created_at).toDateString() === new Date().toDateString()
                  ).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mensagens processadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Versículo Diário
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter(u => u.receives_daily_verse).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Inscritos
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usuários WhatsApp</CardTitle>
              <CardDescription>
                Lista de usuários registrados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{user.name || 'Sem nome'}</p>
                        <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant={user.receives_daily_verse ? 'default' : 'outline'}>
                        {user.receives_daily_verse ? 'Versículo Diário' : 'Sem Versículo'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum usuário registrado ainda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Conversas</CardTitle>
              <CardDescription>
                Últimas 50 conversas processadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversations.map((conv) => (
                  <div key={conv.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{conv.user_phone}</span>
                        <Badge className={getConversationTypeColor(conv.conversation_type)}>
                          {getConversationTypeLabel(conv.conversation_type)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {new Date(conv.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Usuário:</p>
                        <p className="text-sm">{conv.message_content}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Agape:</p>
                        <p className="text-sm">{conv.response_content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma conversa registrada ainda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Webhook</CardTitle>
              <CardDescription>
                Configure o webhook para receber mensagens do Z-API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>URL Recomendada:</strong> Use a URL abaixo (API Next.js mais estável)
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL do Webhook</Label>
                <div className="flex space-x-2">
                  <Input
                    id="webhook-url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://seu-dominio.vercel.app/api/whatsapp/webhook"
                  />
                  <Button variant="outline" onClick={copyWebhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Esta URL usa API Next.js (mais estável que Edge Functions)
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={setupWebhook} disabled={loading}>
                  <Settings className="mr-2 h-4 w-4" />
                  {loading ? 'Configurando...' : 'Configurar Webhook'}
                </Button>
                <Button variant="outline" onClick={testWebhook} disabled={loading}>
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
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Teste de Mensagem</CardTitle>
              <CardDescription>
                Envie uma mensagem de teste via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-phone">Número do Telefone</Label>
                <Input
                  id="test-phone"
                  placeholder="5511999999999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-message">Mensagem</Label>
                <Textarea
                  id="test-message"
                  placeholder="Digite sua mensagem de teste..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={sendTestMessage} disabled={loading}>
                <Send className="mr-2 h-4 w-4" />
                {loading ? 'Enviando...' : 'Enviar Mensagem'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}