"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, MessageCircle, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useMessages, useConversationMessages } from '@/hooks/useMessages';
import { useAuth } from '@/contexts/AuthContext';

interface MessagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MessagesModal({ open, onOpenChange }: MessagesModalProps) {
  const { user } = useAuth();
  const { conversations, loading, searchUsers, getOrCreateConversation } = useMessages();
  const [view, setView] = useState<'list' | 'chat' | 'search'>('list');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const {
    messages,
    loading: messagesLoading,
    sendMessage
  } = useConversationMessages(selectedConversationId);

  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Buscar usuários
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Erro na busca:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Iniciar conversa com usuário
  const handleStartConversation = async (userId: string) => {
    const conversationId = await getOrCreateConversation(userId);
    if (conversationId) {
      setSelectedConversationId(conversationId);
      setView('chat');
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!messageInput.trim() || sendingMessage) return;

    setSendingMessage(true);
    const success = await sendMessage(messageInput);
    if (success) {
      setMessageInput('');
    }
    setSendingMessage(false);
  };

  // Voltar para lista
  const handleBack = () => {
    setView('list');
    setSelectedConversationId(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Formatar tempo relativo
  const formatTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'agora';
    if (diffInMinutes < 60) return `${diffInMinutes}min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Obter nome do usuário
  const getUserName = (profile: any) => {
    return profile?.full_name || profile?.username || 'Usuário';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[600px] bg-gray-900 border-gray-800 p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {view !== 'list' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-gray-400 hover:text-white p-2"
              >
                <ArrowLeft size={20} />
              </Button>
            )}
            
            <DialogTitle className="text-white text-lg">
              {view === 'list' && 'Mensagens'}
              {view === 'search' && 'Nova Conversa'}
              {view === 'chat' && 'Chat'}
            </DialogTitle>

            {view === 'list' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('search')}
                className="text-gray-400 hover:text-white p-2"
              >
                <Plus size={20} />
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Lista de conversas */}
          {view === 'list' && (
            <div className="h-full overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : conversations.length > 0 ? (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => {
                        setSelectedConversationId(conversation.id);
                        setView('chat');
                      }}
                      className="flex items-center space-x-3 p-4 hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conversation.other_user?.avatar_url || ''} />
                        <AvatarFallback className="bg-gray-700 text-white">
                          {getUserName(conversation.other_user).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-white font-medium truncate">
                            {getUserName(conversation.other_user)}
                          </p>
                          <div className="flex items-center space-x-2">
                            {conversation.unread_count! > 0 && (
                              <Badge className="bg-blue-600 text-white text-xs">
                                {conversation.unread_count}
                              </Badge>
                            )}
                            <span className="text-xs text-gray-400">
                              {formatTime(conversation.last_message_at)}
                            </span>
                          </div>
                        </div>
                        
                        {conversation.last_message && (
                          <p className="text-sm text-gray-400 truncate mt-1">
                            {conversation.last_message.sender_id === user?.id ? 'Você: ' : ''}
                            {conversation.last_message.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <MessageCircle className="h-12 w-12 text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">
                    Nenhuma conversa ainda
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Inicie uma conversa com outros usuários
                  </p>
                  <Button
                    onClick={() => setView('search')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus size={16} className="mr-2" />
                    Nova Conversa
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Busca de usuários */}
          {view === 'search' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {searchLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="animate-spin text-gray-400" size={24} />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleStartConversation(user.id)}
                        className="flex items-center space-x-3 p-4 hover:bg-gray-800 cursor-pointer transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback className="bg-gray-700 text-white">
                            {getUserName(user).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {getUserName(user)}
                          </p>
                          {user.username && (
                            <p className="text-sm text-gray-400">
                              @{user.username}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <div className="flex items-center justify-center h-32 text-gray-400">
                    Nenhum usuário encontrado
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    Digite pelo menos 2 caracteres para buscar
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat individual */}
          {view === 'chat' && (
            <div className="h-full flex flex-col">
              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="animate-spin text-gray-400" size={24} />
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.sender_id === user?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    Nenhuma mensagem ainda
                  </div>
                )}
              </div>

              {/* Input de mensagem */}
              <div className="p-4 border-t border-gray-800">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 bg-gray-800 border-gray-700 text-white"
                    disabled={sendingMessage}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendingMessage}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {sendingMessage ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Send size={16} />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}