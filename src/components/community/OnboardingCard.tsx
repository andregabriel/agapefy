"use client";

import { useState } from 'react';
import { Heart, MessageCircle, Music, Users, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OnboardingCardProps {
  onDismiss: () => void;
  onCreatePost: () => void;
  onCreateIntention: () => void;
}

export default function OnboardingCard({ onDismiss, onCreatePost, onCreateIntention }: OnboardingCardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <Heart className="text-red-500" size={24} />,
      title: "Bem-vindo à comunidade!",
      description: "Aqui você pode compartilhar sua jornada de fé com outros irmãos",
      action: "Começar",
      onClick: () => setCurrentStep(1)
    },
    {
      icon: <MessageCircle className="text-blue-500" size={24} />,
      title: "Compartilhe reflexões",
      description: "Publique versículos, pensamentos ou experiências que tocaram seu coração",
      action: "Criar post",
      onClick: onCreatePost
    },
    {
      icon: <Music className="text-green-500" size={24} />,
      title: "Crie intenções de oração",
      description: "Peça orações da comunidade ou ore pelos pedidos de outros",
      action: "Criar intenção",
      onClick: onCreateIntention
    },
    {
      icon: <Users className="text-purple-500" size={24} />,
      title: "Interaja com amor",
      description: "Curta, comente e interceda pelos posts da comunidade",
      action: "Entendi!",
      onClick: onDismiss
    }
  ];

  const currentStepData = steps[currentStep];

  return (
    <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-800/50 mb-6">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {currentStepData.icon}
            <div>
              <h3 className="text-lg font-semibold text-white">
                {currentStepData.title}
              </h3>
              <p className="text-gray-300 text-sm">
                {currentStepData.description}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-gray-400 hover:text-white"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index <= currentStep ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          <Button
            onClick={currentStepData.onClick}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {currentStepData.action}
            <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}