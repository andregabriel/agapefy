"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NotificationSettings } from '@/components/NotificationSettings';
import { 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  Bell, 
  User, 
  Shield, 
  Smartphone 
} from 'lucide-react';

export function ExpandableSettings() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

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

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setActiveSection(null);
    }
  };

  const toggleSection = (sectionKey: string) => {
    if (activeSection === sectionKey) {
      setActiveSection(null);
    } else {
      setActiveSection(sectionKey);
    }
  };

  return (
    <div className="space-y-4">
      {/* Botão principal de Settings */}
      <Button
        variant="outline"
        onClick={toggleExpanded}
        className="w-full justify-between border-gray-600 text-gray-300 hover:bg-gray-800"
      >
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <span>Configurações</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {/* Seções expandíveis */}
      {isExpanded && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 space-y-3">
            {settingSections.map((section) => {
              const Icon = section.icon;
              const Component = section.component;
              const isActive = activeSection === section.key;
              
              return (
                <div key={section.key} className="space-y-3">
                  {/* Header da seção */}
                  <Button
                    variant="ghost"
                    onClick={() => !section.disabled && toggleSection(section.key)}
                    disabled={section.disabled}
                    className={`w-full justify-between p-3 h-auto ${
                      section.disabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3 text-left">
                      <Icon className={`h-5 w-5 ${section.color}`} />
                      <div>
                        <h4 className="text-white font-medium">{section.title}</h4>
                        <p className="text-sm text-gray-400">{section.description}</p>
                      </div>
                    </div>
                    {!section.disabled && (
                      isActive ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )
                    )}
                  </Button>

                  {/* Conteúdo da seção */}
                  {isActive && Component && (
                    <div className="pl-8 pr-4 pb-4">
                      <Component />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}