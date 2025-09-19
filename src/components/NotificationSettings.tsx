"use client";

import { Bell, Heart, MessageCircle, Users, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationSettings() {
  const { settings, updateSetting, simulateNotification } = useNotifications();

  const notificationTypes = [
    {
      key: 'likes' as const,
      title: 'Curtidas',
      description: 'Quando alguém curtir seus posts',
      icon: Heart,
      color: 'text-red-500',
    },
    {
      key: 'comments' as const,
      title: 'Comentários',
      description: 'Quando alguém comentar em seus posts',
      icon: MessageCircle,
      color: 'text-blue-500',
    },
    {
      key: 'intercessions' as const,
      title: 'Intercessões',
      description: 'Quando alguém orar por você',
      icon: Bell,
      color: 'text-green-500',
    },
    {
      key: 'daily_reminders' as const,
      title: 'Lembretes Diários',
      description: 'Lembrete para orar todos os dias',
      icon: Clock,
      color: 'text-purple-500',
    },
    {
      key: 'friend_activities' as const,
      title: 'Atividades de Amigos',
      description: 'Quando amigos postarem algo novo (em breve)',
      icon: Users,
      color: 'text-yellow-500',
      disabled: true,
    },
  ];

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Bell className="mr-2 h-5 w-5 text-blue-500" />
          Configurações de Notificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Lista de configurações */}
        <div className="space-y-4">
          {notificationTypes.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.key}
                className={`flex items-center justify-between p-3 rounded-lg border border-gray-800 ${
                  type.disabled ? 'opacity-50' : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-5 w-5 ${type.color}`} />
                  <div>
                    <h4 className="text-white font-medium">{type.title}</h4>
                    <p className="text-sm text-gray-400">{type.description}</p>
                  </div>
                </div>
                <Switch
                  checked={settings[type.key]}
                  onCheckedChange={(checked) => updateSetting(type.key, checked)}
                  disabled={type.disabled}
                />
              </div>
            );
          })}
        </div>

        {/* Botões de teste */}
        <div className="border-t border-gray-800 pt-4">
          <h4 className="text-white font-medium mb-3">Testar Notificações</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => simulateNotification('like')}
              className="border-red-600 text-red-400 hover:bg-red-900/20"
            >
              <Heart size={14} className="mr-1" />
              Testar Curtida
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => simulateNotification('comment')}
              className="border-blue-600 text-blue-400 hover:bg-blue-900/20"
            >
              <MessageCircle size={14} className="mr-1" />
              Testar Comentário
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => simulateNotification('intercession')}
              className="border-green-600 text-green-400 hover:bg-green-900/20"
            >
              <Bell size={14} className="mr-1" />
              Testar Intercessão
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}