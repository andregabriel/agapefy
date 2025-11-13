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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
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
  Copy,
  Bot,
  Plus,
  Trash2,
  BookOpen,
  ShoppingCart,
  Headphones,
  TestTube,
  Power,
  PowerOff,
  Edit
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

interface Assistant {
  id: string;
  name: string;
  assistantId: string;
  type: 'biblical' | 'sales' | 'support';
  description: string;
  keywords: string[];
  enabled: boolean;
}

interface AssistantConfig {
  assistants: Assistant[];
  defaultAssistantId?: string;
}

export default function WhatsAppAdminPage() {
  const { settings, updateSetting } = useAppSettings();
  const [users, setUsers] = useState<WhatsAppUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [assistantRules, setAssistantRules] = useState('');
  const [savingRules, setSavingRules] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null);
  const [testAssistantMessage, setTestAssistantMessage] = useState('');
  const [testResult, setTestResult] = useState<{ assistant: Assistant | null; reason: string } | null>(null);
  const [assistantsInitialized, setAssistantsInitialized] = useState(false);
  const [editingUser, setEditingUser] = useState<WhatsAppUser | null>(null);
  const [editingPhone, setEditingPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

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

  useEffect(() => {
    if (assistantsInitialized) return;
    
    if (settings.whatsapp_assistant_rules !== undefined) {
      setAssistantRules(settings.whatsapp_assistant_rules);
      
      // Tentar carregar configuração estruturada
      try {
        const config: AssistantConfig = JSON.parse(settings.whatsapp_assistant_rules);
        if (config.assistants && Array.isArray(config.assistants) && config.assistants.length > 0) {
          setAssistants(config.assistants);
          setAssistantsInitialized(true);
        } else {
          // Se não for JSON estruturado, criar assistentes padrão
          const defaultAssistants = [
            {
              id: '1',
              name: 'Mentor Bíblico',
              assistantId: 'asst_I7wKwxVNjTtkO0lgaBVYkkGX',
              type: 'biblical' as const,
              description: 'Assistente especializado em respostas baseadas na Bíblia',
              keywords: ['bíblia', 'versículo', 'jesus', 'deus', 'bíblico', 'escritura', 'parábola', 'evangelho'],
              enabled: true
            },
            {
              id: '2',
              name: 'Vendas e Suporte',
              assistantId: 'asst_UXfZfMv9k0pPzTU4CiQRrpSR',
              type: 'sales' as const,
              description: 'Assistente para vendas, suporte e questões sobre o app',
              keywords: ['pagamento', 'assinatura', 'preço', 'como usar', 'funcionamento', 'ajuda', 'suporte', 'comprar', 'vender'],
              enabled: true
            }
          ];
          setAssistants(defaultAssistants);
          setAssistantsInitialized(true);
        }
      } catch {
        // Se não for JSON válido, usar como texto simples e inicializar padrão
        const defaultAssistants = [
          {
            id: '1',
            name: 'Mentor Bíblico',
            assistantId: 'asst_I7wKwxVNjTtkO0lgaBVYkkGX',
            type: 'biblical' as const,
            description: 'Assistente especializado em respostas baseadas na Bíblia',
            keywords: ['bíblia', 'versículo', 'jesus', 'deus', 'bíblico', 'escritura', 'parábola', 'evangelho'],
            enabled: true
          },
          {
            id: '2',
            name: 'Vendas e Suporte',
            assistantId: 'asst_UXfZfMv9k0pPzTU4CiQRrpSR',
            type: 'sales' as const,
            description: 'Assistente para vendas, suporte e questões sobre o app',
            keywords: ['pagamento', 'assinatura', 'preço', 'como usar', 'funcionamento', 'ajuda', 'suporte', 'comprar', 'vender'],
            enabled: true
          }
        ];
        setAssistants(defaultAssistants);
        setAssistantsInitialized(true);
      }
    } else {
      // Inicializar com padrão se não houver configuração
      const defaultAssistants = [
        {
          id: '1',
          name: 'Mentor Bíblico',
          assistantId: 'asst_I7wKwxVNjTtkO0lgaBVYkkGX',
          type: 'biblical' as const,
          description: 'Assistente especializado em respostas baseadas na Bíblia',
          keywords: ['bíblia', 'versículo', 'jesus', 'deus', 'bíblico', 'escritura', 'parábola', 'evangelho'],
          enabled: true
        },
        {
          id: '2',
          name: 'Vendas e Suporte',
          assistantId: 'asst_UXfZfMv9k0pPzTU4CiQRrpSR',
          type: 'sales' as const,
          description: 'Assistente para vendas, suporte e questões sobre o app',
          keywords: ['pagamento', 'assinatura', 'preço', 'como usar', 'funcionamento', 'ajuda', 'suporte', 'comprar', 'vender'],
          enabled: true
        }
      ];
      setAssistants(defaultAssistants);
      setAssistantsInitialized(true);
    }
  }, [settings.whatsapp_assistant_rules, assistantsInitialized]);

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

  const toggleUserStatus = async (phoneNumber: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const response = await fetch('/api/whatsapp/users/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          is_active: !currentStatus
        })
      });

      if (response.ok) {
        toast.success(`Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
        await loadUsers(); // Recarregar lista de usuários
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao atualizar status do usuário');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao atualizar status do usuário');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (user: WhatsAppUser) => {
    setEditingUser(user);
    setEditingPhone(user.phone_number);
  };

  const closeEditDialog = () => {
    setEditingUser(null);
    setEditingPhone('');
  };

  const savePhoneNumber = async () => {
    if (!editingUser) return;

    const cleanPhone = editingPhone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      toast.error('Número de telefone inválido. Deve ter pelo menos 10 dígitos.');
      return;
    }

    try {
      setSavingPhone(true);
      const response = await fetch('/api/whatsapp/users/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: editingUser.id,
          phone_number: cleanPhone
        })
      });

      if (response.ok) {
        toast.success('Número de telefone atualizado com sucesso!');
        await loadUsers(); // Recarregar lista de usuários
        closeEditDialog();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao atualizar número de telefone');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao atualizar número de telefone');
    } finally {
      setSavingPhone(false);
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

  const saveAssistantRules = async () => {
    setSavingRules(true);
    try {
      // Salvar como JSON estruturado
      const config: AssistantConfig = {
        assistants: assistants,
        defaultAssistantId: assistants.find(a => a.enabled)?.id
      };
      const configJson = JSON.stringify(config, null, 2);
      
      const result = await updateSetting('whatsapp_assistant_rules', configJson);
      if (result.success) {
        toast.success('Configuração de assistentes salva com sucesso!');
        setAssistantRules(configJson);
      } else {
        toast.error(result.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração de assistentes');
    } finally {
      setSavingRules(false);
    }
  };

  const addAssistant = () => {
    const newAssistant: Assistant = {
      id: Date.now().toString(),
      name: '',
      assistantId: '',
      type: 'biblical',
      description: '',
      keywords: [],
      enabled: true
    };
    setEditingAssistant(newAssistant);
  };

  const editAssistant = (assistant: Assistant) => {
    setEditingAssistant({ ...assistant });
  };

  const deleteAssistant = (id: string) => {
    setAssistants(assistants.filter(a => a.id !== id));
  };

  const saveAssistant = () => {
    if (!editingAssistant) return;
    
    if (!editingAssistant.name || !editingAssistant.assistantId) {
      toast.error('Preencha nome e ID do assistente');
      return;
    }

    const existingIndex = assistants.findIndex(a => a.id === editingAssistant!.id);
    if (existingIndex >= 0) {
      const updated = [...assistants];
      updated[existingIndex] = editingAssistant;
      setAssistants(updated);
    } else {
      setAssistants([...assistants, editingAssistant]);
    }
    
    setEditingAssistant(null);
    toast.success('Assistente salvo!');
  };

  const testAssistantSelection = () => {
    if (!testAssistantMessage.trim()) {
      toast.error('Digite uma mensagem para testar');
      return;
    }

    const message = testAssistantMessage.toLowerCase();
    let selectedAssistant: Assistant | null = null;
    let reason = '';

    // Verificar palavras-chave de cada assistente
    for (const assistant of assistants.filter(a => a.enabled)) {
      const matchedKeywords = assistant.keywords.filter(kw => 
        message.includes(kw.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        selectedAssistant = assistant;
        reason = `Palavras-chave encontradas: ${matchedKeywords.join(', ')}`;
        break;
      }
    }

    if (!selectedAssistant) {
      // Usar assistente padrão ou primeiro disponível
      selectedAssistant = assistants.find(a => a.enabled) || null;
      reason = selectedAssistant 
        ? 'Nenhuma palavra-chave encontrada, usando assistente padrão'
        : 'Nenhum assistente habilitado encontrado';
    }

    setTestResult({ assistant: selectedAssistant, reason });
  };

  const getAssistantTypeIcon = (type: string) => {
    switch (type) {
      case 'biblical':
        return <BookOpen className="h-4 w-4" />;
      case 'sales':
        return <ShoppingCart className="h-4 w-4" />;
      case 'support':
        return <Headphones className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getAssistantTypeLabel = (type: string) => {
    switch (type) {
      case 'biblical':
        return 'Bíblico';
      case 'sales':
        return 'Vendas';
      case 'support':
        return 'Suporte';
      default:
        return type;
    }
  };

  const maskAssistantId = (id: string): string => {
    if (!id || id.length < 8) return id;
    // Mostrar primeiros 7 caracteres e últimos 4, mascarar o resto
    const start = id.substring(0, 7);
    const end = id.substring(id.length - 4);
    const masked = '*'.repeat(Math.max(4, id.length - 11));
    return `${start}${masked}${end}`;
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
          <TabsTrigger value="assistants">Assistentes</TabsTrigger>
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
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Informações do usuário */}
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground truncate">{user.phone_number}</p>
                        </div>
                      </div>

                      {/* Badges e Botões */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-xs">
                            {user.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Badge variant={user.receives_daily_verse ? 'default' : 'outline'} className="text-xs">
                            {user.receives_daily_verse ? 'Versículo Diário' : 'Sem Versículo'}
                          </Badge>
                        </div>

                        {/* Botões */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            disabled={loading}
                            title="Editar número de telefone"
                            className="flex-1 sm:flex-initial"
                          >
                            <Edit className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Editar</span>
                          </Button>
                          <Button
                            variant={user.is_active ? 'destructive' : 'default'}
                            size="sm"
                            onClick={() => toggleUserStatus(user.phone_number, user.is_active)}
                            disabled={loading}
                            title={user.is_active ? 'Desativar WhatsApp' : 'Ativar WhatsApp'}
                            className="flex-1 sm:flex-initial"
                          >
                            {user.is_active ? (
                              <>
                                <PowerOff className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Desativar</span>
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Ativar</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
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

        <TabsContent value="assistants" className="space-y-6">
          {/* Lista de Assistentes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Assistentes OpenAI
                  </CardTitle>
                  <CardDescription>
                    Configure múltiplos assistentes para diferentes funções (Bíblico, Vendas, Suporte)
                  </CardDescription>
                </div>
                <Button onClick={addAssistant} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Assistente
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assistants.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum assistente configurado. Clique em "Adicionar Assistente" para começar.
                  </p>
                ) : (
                  assistants.map((assistant) => (
                    <div key={assistant.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getAssistantTypeIcon(assistant.type)}
                          <h3 className="font-semibold">{assistant.name}</h3>
                          <Badge variant={assistant.enabled ? 'default' : 'secondary'}>
                            {assistant.enabled ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Badge variant="outline">
                            {getAssistantTypeLabel(assistant.type)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{assistant.description}</p>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>ID:</strong> <code className="bg-muted px-1 rounded font-mono">{maskAssistantId(assistant.assistantId)}</code></p>
                          <p><strong>Palavras-chave:</strong> {assistant.keywords.join(', ') || 'Nenhuma'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="outline" size="sm" onClick={() => editAssistant(assistant)}>
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteAssistant(assistant.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formulário de Edição */}
          {editingAssistant && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingAssistant.id && assistants.find(a => a.id === editingAssistant!.id) ? 'Editar' : 'Novo'} Assistente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assistant-name">Nome do Assistente</Label>
                    <Input
                      id="assistant-name"
                      value={editingAssistant.name}
                      onChange={(e) => setEditingAssistant({ ...editingAssistant, name: e.target.value })}
                      placeholder="Ex: Mentor Bíblico"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assistant-type">Tipo</Label>
                    <select
                      id="assistant-type"
                      value={editingAssistant.type}
                      onChange={(e) => setEditingAssistant({ ...editingAssistant, type: e.target.value as any })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="biblical">Bíblico</option>
                      <option value="sales">Vendas</option>
                      <option value="support">Suporte</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant-id">ID do Assistente OpenAI</Label>
                  <Input
                    id="assistant-id"
                    value={editingAssistant.assistantId}
                    onChange={(e) => setEditingAssistant({ ...editingAssistant, assistantId: e.target.value })}
                    placeholder="asst_..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant-description">Descrição</Label>
                  <Textarea
                    id="assistant-description"
                    value={editingAssistant.description}
                    onChange={(e) => setEditingAssistant({ ...editingAssistant, description: e.target.value })}
                    placeholder="Descreva a função deste assistente..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant-keywords">Palavras-chave (separadas por vírgula)</Label>
                  <Input
                    id="assistant-keywords"
                    value={editingAssistant.keywords.join(', ')}
                    onChange={(e) => {
                      const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                      setEditingAssistant({ ...editingAssistant, keywords });
                    }}
                    placeholder="bíblia, versículo, jesus, deus"
                  />
                  <p className="text-xs text-muted-foreground">
                    Quando uma mensagem contiver essas palavras, este assistente será selecionado
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="assistant-enabled"
                    checked={editingAssistant.enabled}
                    onChange={(e) => setEditingAssistant({ ...editingAssistant, enabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="assistant-enabled" className="cursor-pointer">
                    Assistente habilitado
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveAssistant}>
                    Salvar Assistente
                  </Button>
                  <Button variant="outline" onClick={() => setEditingAssistant(null)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teste de Seleção */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Testar Seleção de Assistente
              </CardTitle>
              <CardDescription>
                Digite uma mensagem para ver qual assistente seria selecionado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-message-assistant">Mensagem de Teste</Label>
                <Input
                  id="test-message-assistant"
                  value={testAssistantMessage}
                  onChange={(e) => setTestAssistantMessage(e.target.value)}
                  placeholder="Ex: Preciso de ajuda com a Bíblia"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      testAssistantSelection();
                    }
                  }}
                />
              </div>
              <Button onClick={testAssistantSelection} variant="outline">
                <TestTube className="h-4 w-4 mr-2" />
                Testar Seleção
              </Button>
              
              {testResult && (
                <div className={`p-4 rounded-lg border ${testResult.assistant ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  {testResult.assistant ? (
                    <div>
                      <p className="font-semibold text-green-900 mb-2">
                        Assistente Selecionado: {testResult.assistant.name}
                      </p>
                      <div className="text-sm text-green-800 space-y-1">
                        <p><strong>Tipo:</strong> {getAssistantTypeLabel(testResult.assistant.type)}</p>
                        <p><strong>ID:</strong> <code className="bg-white px-1 rounded font-mono">{maskAssistantId(testResult.assistant.assistantId)}</code></p>
                        <p><strong>Motivo:</strong> {testResult.reason}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-yellow-900">
                      <strong>Atenção:</strong> {testResult.reason}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botão de Salvar Configuração */}
          <Card>
            <CardContent className="pt-6">
              <Button onClick={saveAssistantRules} disabled={savingRules} className="w-full">
                <Settings className="mr-2 h-4 w-4" />
                {savingRules ? 'Salvando...' : 'Salvar Configuração de Assistentes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Teste de Mensagem</CardTitle>
            <CardDescription>
              Envie uma mensagem de teste via WhatsApp (envio manual de teste, não é o webhook automático)
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

      {/* Modal de Edição de Número */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Número de Telefone</DialogTitle>
            <DialogDescription>
              Altere o número de telefone do usuário {editingUser?.name || 'Sem nome'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Número de Telefone</Label>
              <Input
                id="edit-phone"
                value={editingPhone}
                onChange={(e) => setEditingPhone(e.target.value)}
                placeholder="5511999999999"
                disabled={savingPhone}
              />
              <p className="text-xs text-muted-foreground">
                Digite o número completo com código do país (ex: 5511999999999)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditDialog}
              disabled={savingPhone}
            >
              Cancelar
            </Button>
            <Button
              onClick={savePhoneNumber}
              disabled={savingPhone || !editingPhone.trim()}
            >
              {savingPhone ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}