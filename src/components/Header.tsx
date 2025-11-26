"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useMessages } from '@/hooks/useMessages';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Bell, Heart, MessageCircle, Users, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MessagesModal from '@/components/messages/MessagesModal';

export function Header() {
  const { user } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const { totalUnreadCount } = useMessages();
  const { settings } = useAppSettings();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);

  // Buscar role do usuário quando user mudar
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      try {
        setRoleLoading(true);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('⚠️ Header: Erro ao buscar perfil:', error);
          setUserRole('user');
        } else {
          setUserRole(profile?.role || 'user');
        }
      } catch (error) {
        console.error('❌ Header: Erro ao buscar role:', error);
        setUserRole('user');
      } finally {
        setRoleLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleNotificationClick = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead(notificationId);
    }
  };

  // Mapear tipos de notificação para ícones
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return { icon: Heart, color: 'text-red-500' };
      case 'comment':
        return { icon: MessageCircle, color: 'text-blue-500' };
      case 'intercession':
        return { icon: Bell, color: 'text-green-500' };
      case 'friend_activity':
        return { icon: Users, color: 'text-purple-500' };
      default:
        return { icon: Bell, color: 'text-gray-500' };
    }
  };

  // Formatar tempo relativo
  const getRelativeTime = (dateString: string) => {
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

  // Verificar se é admin
  const isAdmin = userRole === 'admin';

  return (
    <div className="fixed top-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-b border-gray-800 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img 
            src="https://vvgqqlrujmyxzzygsizc.supabase.co/storage/v1/object/public/media/app-26/images/1758119247895-09choju49.png"
            alt="Logo"
            className="h-10 w-auto object-contain max-w-[120px]"
          />
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-2">
              {/* Ícone de Mensagens */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMessagesModal(true)}
                className="hidden text-gray-400 hover:text-white hover:bg-gray-800 relative"
              >
                <MessageCircle size={16} />
                {totalUnreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">
                      {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                    </span>
                  </div>
                )}
              </Button>

              {/* Dropdown de Notificações */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden text-gray-400 hover:text-white hover:bg-gray-800 relative"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Bell size={16} />
                    )}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-80 bg-gray-900 border-gray-800"
                >
                  <DropdownMenuLabel className="text-white">
                    Notificações
                    {unreadCount > 0 && (
                      <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  
                  {loading ? (
                    <DropdownMenuItem className="text-gray-400 justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Carregando...
                    </DropdownMenuItem>
                  ) : notifications.length > 0 ? (
                    <>
                      {notifications.slice(0, 5).map((notification) => {
                        const { icon: Icon, color } = getNotificationIcon(notification.type);
                        const fromUserName = notification.from_user?.full_name || 
                                           notification.from_user?.username || 
                                           'Usuário';
                        
                        return (
                          <DropdownMenuItem 
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id, notification.read)}
                            className={`text-gray-300 hover:bg-gray-800 cursor-pointer p-3 ${
                              !notification.read ? 'bg-gray-800/50' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-3 w-full">
                              <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${
                                  !notification.read ? 'text-white font-medium' : 'text-gray-300'
                                }`}>
                                  {notification.message}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs text-gray-400">
                                    {fromUserName}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {getRelativeTime(notification.created_at)}
                                  </p>
                                </div>
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                      
                      {notifications.length > 5 && (
                        <DropdownMenuItem className="text-blue-400 hover:bg-gray-800 cursor-pointer justify-center">
                          Ver todas ({notifications.length})
                        </DropdownMenuItem>
                      )}
                      
                      {unreadCount > 0 && (
                        <>
                          <DropdownMenuSeparator className="bg-gray-800" />
                          <DropdownMenuItem 
                            onClick={handleMarkAllAsRead}
                            className="text-blue-400 hover:bg-gray-800 cursor-pointer justify-center"
                          >
                            Marcar todas como lidas
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  ) : (
                    <DropdownMenuItem className="text-gray-400 justify-center py-6">
                      <Bell className="h-4 w-4 mr-2" />
                      Nenhuma notificação
                    </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Admin Link - APENAS PARA ADMINS */}
              {isAdmin && !roleLoading && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-800">
                    <Settings size={16} className="mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              {/* Botão de busca - leva para a página de busca */}
              <Link href="/busca">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center text-gray-300 hover:text-white hover:bg-white/5 rounded-full px-4"
                >
                  <Search size={16} className="mr-2" />
                  <span className="text-sm font-medium">
                    Buscar
                  </span>
                </Button>
              </Link>

              {/* Link de entrar simples, minimalista */}
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-300 hover:text-white hover:bg-white/5 px-4"
                >
                  Entrar
                </Button>
              </Link>

              {/* CTA principal para convidado */}
              <Link href="/login">
                <Button
                  variant="default"
                  size="sm"
                  className="rounded-full bg-white text-black hover:bg-white/90 px-5 text-sm font-semibold shadow-sm"
                >
                  Experimente de Graça
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Mensagens */}
      <MessagesModal
        open={showMessagesModal}
        onOpenChange={setShowMessagesModal}
      />
    </div>
  );
}