"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationSettings } from '@/components/NotificationSettings';
import { 
  ArrowLeft, 
  LogOut, 
  Bell, 
  User, 
  Shield, 
  Smartphone,
  Settings,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ConfigPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string | null>('notifications');
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      // Imediatamente parar renderização para evitar piscar
      setIsSigningOut(true);
      
      // Fazer logout direto
      await supabase.auth.signOut();
      
      // Limpar modo convidado se existir
      localStorage.removeItem('guestMode');
      
      toast.success('Logout realizado com sucesso');
      
      // Redirecionamento único e suave
      router.replace('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
      // Em caso de erro, voltar ao estado normal
      setIsSigningOut(false);
    }
  };

  // Durante logout: renderizar tela de loading para evitar piscar
  if (isSigningOut) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          <p className="text-gray-400">Saindo...</p>
        </div>
      </div>
    );
  }

  // Só verificar !user se não estiver fazendo logout
  if (!user && !isSigningOut) {
    router.push('/login');
    return null;
  }

  const settingSections = [
    {
      key: 'notifications',
      title: 'Notificações',
      description: 'Configure suas preferências de notificação',
      icon: Bell,
      color: 'text-blue-500',
      component: NotificationSettings
    },
    {
      key: 'profile',
      title: 'Perfil',
      description: 'Editar informações do perfil (em breve)',
      icon: User,
      color: 'text-green-500',
      disabled: true
    },
    {
      key: 'privacy',
      title: 'Privacidade',
      description: 'Configurações de privacidade (em breve)',
      icon: Shield,
      color: 'text-purple-500',
      disabled: true
    },
    {
      key: 'preferences',
      title: 'Preferências',
      description: 'Configurações gerais do app (em breve)',
      icon: Smartphone,
      color: 'text-orange-500',
      disabled: true
    }
  ];

  const toggleSection = (sectionKey: string) => {
    if (activeSection === sectionKey) {
      setActiveSection(null);
    } else {
      setActiveSection(sectionKey);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/eu">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Perfil
            </Button>
          </Link>
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <Settings className="h-8 w-8 text-green-500" />
            <h1 className="text-2xl font-bold text-white">Configurações</h1>
          </div>
          <p className="text-gray-400">Gerencie suas preferências e configurações</p>
        </div>

        {/* Seções de Configuração */}
        <div className="space-y-4">
          {settingSections.map((section) => {
            const Icon = section.icon;
            const Component = section.component;
            const isActive = activeSection === section.key;
            
            return (
              <Card key={section.key} className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <Button
                    variant="ghost"
                    onClick={() => !section.disabled && toggleSection(section.key)}
                    disabled={section.disabled}
                    className={`w-full justify-between p-0 h-auto ${
                      section.disabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3 text-left">
                      <Icon className={`h-6 w-6 ${section.color}`} />
                      <div>
                        <CardTitle className="text-white font-medium text-lg">
                          {section.title}
                        </CardTitle>
                        <p className="text-sm text-gray-400 mt-1">{section.description}</p>
                      </div>
                    </div>
                    {!section.disabled && (
                      <div className={`transform transition-transform ${isActive ? 'rotate-180' : ''}`}>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    )}
                  </Button>
                </CardHeader>

                {/* Conteúdo da seção */}
                {isActive && Component && (
                  <CardContent className="pt-0">
                    <div className="border-t border-gray-800 pt-4">
                      <Component />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Seção de Logout */}
        <Card className="bg-gray-900 border-gray-800 border-red-800/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <LogOut className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="text-white font-medium">Sair da Conta</h3>
                  <p className="text-sm text-gray-400">Fazer logout do aplicativo</p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {isSigningOut ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                {isSigningOut ? 'Saindo...' : 'Sair'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Informações da conta */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-white font-medium mb-2">Informações da Conta</h3>
              <p className="text-sm text-gray-400 mb-1">
                <strong>Email:</strong> {user.email}
              </p>
              <p className="text-sm text-gray-400">
                <strong>ID:</strong> {user.id.slice(0, 8)}...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}