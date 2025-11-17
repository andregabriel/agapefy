"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationSettings } from '@/components/NotificationSettings';
import { ProfileEditCard } from './_components/ProfileEditCard';
import { SubscriptionCard } from './_components/SubscriptionCard';
import { PresentModal } from '@/components/modals/PresentModal';
import { 
  ArrowLeft, 
  LogOut, 
  Bell, 
  User, 
  Settings,
  Loader2,
  MessageCircle,
  Gift,
  CreditCard,
  FileText,
  HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ConfigPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showPresentModal, setShowPresentModal] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      localStorage.removeItem('guestMode');
      toast.success('Logout realizado com sucesso');
      router.replace('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
      setIsSigningOut(false);
    }
  };

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

  if (!user && !isSigningOut) {
    router.push('/login');
    return null;
  }

  const toggleSection = (sectionKey: string) => {
    if (activeSection === sectionKey) {
      setActiveSection(null);
    } else {
      setActiveSection(sectionKey);
    }
  };

  const handleWhatsAppSupport = () => {
    const whatsappUrl = 'https://api.whatsapp.com/send?phone=5531998445391&text=Ol%C3%A1%2C%20gostaria%20de%20come%C3%A7ar%20a%20receber%20minhas%20ora%C3%A7%C3%B5es%20do%20Agapefy';
    window.open(whatsappUrl, '_blank');
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

        {/* Cards de Configuração */}
        <div className="space-y-4">
          {/* 1. Perfil */}
          <ProfileEditCard />

          {/* 2. Suporte */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <Button
                variant="ghost"
                onClick={() => toggleSection('support')}
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <div className="flex items-center space-x-3 text-left">
                  <HelpCircle className="h-6 w-6 text-blue-500" />
                  <div>
                    <CardTitle className="text-white font-medium text-lg">Suporte</CardTitle>
                    <p className="text-sm text-gray-400 mt-1">Entre em contato conosco</p>
                  </div>
                </div>
                <div className={`transform transition-transform ${activeSection === 'support' ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </Button>
            </CardHeader>
            {activeSection === 'support' && (
              <CardContent className="pt-0">
                <div className="border-t border-gray-800 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleWhatsAppSupport}
                    className="w-full border-green-600 text-green-400 hover:bg-green-900/20 hover:text-green-300"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Suporte no WhatsApp
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 3. Notificações */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <Button
                variant="ghost"
                onClick={() => toggleSection('notifications')}
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <div className="flex items-center space-x-3 text-left">
                  <Bell className="h-6 w-6 text-blue-500" />
                  <div>
                    <CardTitle className="text-white font-medium text-lg">
                      Notificações
                    </CardTitle>
                    <p className="text-sm text-gray-400 mt-1">Configure suas preferências de notificação</p>
                  </div>
                </div>
                <div className={`transform transition-transform ${activeSection === 'notifications' ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </Button>
            </CardHeader>
            {activeSection === 'notifications' && (
              <CardContent className="pt-0">
                <div className="border-t border-gray-800 pt-4">
                  <NotificationSettings />
                </div>
              </CardContent>
            )}
          </Card>

          {/* 4. Dê um Presente */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <Button
                variant="ghost"
                onClick={() => toggleSection('gift')}
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <div className="flex items-center space-x-3 text-left">
                  <Gift className="h-6 w-6 text-yellow-500" />
                  <div>
                    <CardTitle className="text-white font-medium text-lg">Dê um Presente</CardTitle>
                    <p className="text-sm text-gray-400 mt-1">Presenteie seus amigos</p>
                  </div>
                </div>
                <div className={`transform transition-transform ${activeSection === 'gift' ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </Button>
            </CardHeader>
            {activeSection === 'gift' && (
              <CardContent className="pt-0">
                <div className="border-t border-gray-800 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowPresentModal(true)}
                    className="w-full border-yellow-600 text-yellow-400 hover:bg-yellow-900/20 hover:text-yellow-300"
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Presentear Amigos
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 5. Assinatura */}
          <SubscriptionCard />

          {/* 6. Jurídico */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <Button
                variant="ghost"
                onClick={() => toggleSection('legal')}
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <div className="flex items-center space-x-3 text-left">
                  <FileText className="h-6 w-6 text-purple-500" />
                  <div>
                    <CardTitle className="text-white font-medium text-lg">Jurídico</CardTitle>
                    <p className="text-sm text-gray-400 mt-1">Documentos legais</p>
                  </div>
                </div>
                <div className={`transform transition-transform ${activeSection === 'legal' ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </Button>
            </CardHeader>
            {activeSection === 'legal' && (
              <CardContent className="pt-0 space-y-2">
                <div className="border-t border-gray-800 pt-4">
                  <Link href="/termos-de-uso" className="block">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Termos de Uso
                    </Button>
                  </Link>
                  <Link href="/politica-de-privacidade" className="block">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Política de Privacidade
                    </Button>
                  </Link>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 7. Sair */}
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
        </div>
      </div>

      {/* Modal de Presente */}
      <PresentModal
        isOpen={showPresentModal}
        onClose={() => setShowPresentModal(false)}
      />
    </div>
  );
}
